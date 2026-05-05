'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { usePeriod } from '@/components/PeriodProvider'
import { useGuard } from '@/hooks/useGuard'
import { renderDashboardData, calculateDynamicCommission } from '@/lib/salesUtils'
import * as XLSX from 'xlsx'

// ── Tabs ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'fd',     label: 'FD',          emoji: '🔌', color: '#059669', grupo: 'FD'     },
  { id: 'baf',    label: 'BAF / 5G',    emoji: '📡', color: '#BE185D', grupo: 'BAF'    },
  { id: 'alta',   label: 'Alta Móvil',  emoji: '📶', color: '#7C3AED', grupo: 'ALTA'   },
  { id: 'porta',  label: 'Portas Móvil',emoji: '🔄', color: '#D97706', grupo: 'PORTA'  },
  { id: 'tma',    label: 'TMA',         emoji: '📱', color: '#6366F1', grupo: 'TMA'    },
  { id: 'ti',     label: 'Ti',          emoji: '🖥️', color: '#0D9488', grupo: 'TI'     },
  { id: 'micro',  label: 'Micro',       emoji: '💻', color: '#0891B2', grupo: 'MICRO'  },
  { id: 'mpa',    label: 'MPA',         emoji: '📲', color: '#8B5CF6', grupo: 'MPA'    },
  { id: 'extras', label: 'Extras',      emoji: '⚡', color: '#10b981', grupo: 'EXTRAS' },
]

const PLUS_CODES = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7']
const isPlus   = (c: string) => PLUS_CODES.some(x => (c || '').toLowerCase().includes(x))
const isBasico = (c: string) => {
  const l = (c || '').toLowerCase()
  return l.includes('básico xcu') || l.includes('basico xcu')
}

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + '€'

const filterByTab = (sale: any, tabId: string): boolean => {
  if (tabId === 'extras') return false // extras come from extraAssignments, not sales
  const g = (sale.grupo || '').toUpperCase()
  const d = (sale.detalle || '').toLowerCase().trim()
  switch (tabId) {
    case 'tma':   return d === 'tma'
    case 'micro': return d === 'micro'
    case 'ti':    return d === 'ti'
    case 'mpa':   return d === 'mpa' || g === 'MPA' || g === 'ALARMAS' || (sale.producto || '').toLowerCase().includes('alarma')
    case 'fd':    {
      if (g === 'REN' && (sale.producto || '').toLowerCase().includes('dispositivo')) return false
      return ['FD','FN','PF','REN'].includes(g)
    }
    case 'porta': return g === 'PORTA'
    case 'alta':  return g === 'ALTA'
    case 'baf':   return ['BAF','MBAF'].includes(g)
    default:      return false
  }
}

// ── NIF grouping ──────────────────────────────────────────────────────
interface SaleRow { sale: any }
interface NifGroup {
  nif: string; nombre: string; telf: string; potencial: string
  sales: any[]
  subtotal: number
}

function groupSalesByNif(sales: any[]): NifGroup[] {
  const map = new Map<string, NifGroup>()
  for (const s of sales) {
    const nif = ((s.nif || 'SIN NIF').toUpperCase().trim())
    if (!map.has(nif)) {
      map.set(nif, { nif, nombre: s.nombreCliente || '-', telf: s.telf || '-', potencial: s.potencial || '', sales: [], subtotal: 0 })
    }
    const g = map.get(nif)!
    if (s.nombreCliente && g.nombre === '-') g.nombre = s.nombreCliente
    if (s.telf && g.telf === '-') g.telf = s.telf
    g.sales.push(s)
    g.subtotal += Number(s.cuota ?? 0)
  }
  return Array.from(map.values()).sort((a, b) => b.subtotal - a.subtotal)
}

// ── Get full tramo info for a given grupo from dashboard rows ──────────
interface TramoInfo { tramoVal: number; isPercentage: boolean; pje: number; pjeProyectado: number; tramoValProyectado: number }
function getTramoInfo(dashRows: any[], grupoKey: string): TramoInfo {
  if (!dashRows || !grupoKey) return { tramoVal: 0, isPercentage: false, pje: 0, pjeProyectado: 0, tramoValProyectado: 0 }
  const gUpper = grupoKey.toUpperCase()
  const row = dashRows.find((r: any) => {
    const rg = (r.grupo || '').toUpperCase()
    return rg === gUpper || (gUpper === 'MICRO' && (rg === 'MIC' || rg === 'MICRO'))
  })
  if (!row) return { tramoVal: 0, isPercentage: false, pje: 0, pjeProyectado: 0, tramoValProyectado: 0 }
  return {
    tramoVal: row.tramoVal ?? 0,
    isPercentage: row.isPercentage === true || row.isMonetary === true,
    pje: row.pje ?? 0,
    pjeProyectado: row.pjeProyectado ?? 0,
    tramoValProyectado: row.tramoValProyectado ?? 0
  }
}

// ── Compute pago por tramo for a NIF group ────────────────────────────
function calcNifTramo(subtotal: number, units: number, info: TramoInfo): number {
  if (info.tramoVal === 0) return 0
  const rawValue = info.isPercentage ? subtotal * (info.tramoVal / 100) : units * info.tramoVal
  return Math.round(rawValue * 100) / 100
}

// ── Section table ─────────────────────────────────────────────────────
function SectionTable({
  label, badge, badgeColor, groups, tabColor, tramoInfo, dashRows, flatRows, dedupeInfo
}: {
  label: string; badge: string; badgeColor: string
  groups: NifGroup[]; tabColor: string; tramoInfo: TramoInfo
  dashRows?: any[]; flatRows?: boolean; dedupeInfo?: boolean
}) {
  if (groups.length === 0) return null

  const sectionTotal = groups.reduce((s, g) => s + g.subtotal, 0)
  const totalUnits   = groups.reduce((s, g) => s + g.sales.length, 0)
  // Use per-sale calculateDynamicCommission for correct multi-rate totals (all tabs)
  const totalTramo = dashRows && dashRows.length > 0
    ? groups.reduce((sum, g) => sum + g.sales.reduce((s2: number, sale: any) => s2 + calculateDynamicCommission(sale, dashRows), 0), 0)
    : calcNifTramo(sectionTotal, totalUnits, tramoInfo)

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 18px', marginBottom: 0,
        background: `${badgeColor}18`, borderRadius: '12px 12px 0 0',
        border: `1px solid ${badgeColor}40`, borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: badgeColor, color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: 1 }}>{badge}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--light-text)' }}>{label}</span>
          <span style={{ fontSize: 12, color: 'var(--medium-gray)' }}>{groups.length} clientes · {totalUnits} uds.</span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--medium-gray)' }}>Total: <strong style={{ color: 'var(--light-text)' }}>{fmt(sectionTotal)}</strong></span>
          {tramoInfo.pje > 0 && <span style={{ fontSize: 12, color: badgeColor, background: `${badgeColor}18`, padding: '2px 10px', borderRadius: 20 }}>{tramoInfo.pje.toFixed(1)}% → {tramoInfo.tramoVal}{tramoInfo.isPercentage ? '%' : '€/u'}</span>}
          <span style={{ fontSize: 13, color: badgeColor }}>Tramo: <strong>{tramoInfo.tramoVal > 0 ? fmt(totalTramo) : '—'}</strong></span>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: `1px solid ${badgeColor}40`, borderRadius: '0 0 12px 12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 800 }}>
          <thead>
            <tr style={{ background: 'var(--active-bg)' }}>
              {['Cliente (NIF)', 'Empresa', 'Fecha Tram.', 'Teléfono', 'Código', 'Comercial', 'Productos', 'Uds.', 'Total', 'Pago por tramo'].map((h, i) => (
                <th key={i} style={{
                  padding: '10px 14px', textAlign: i >= 7 ? 'right' : 'left',
                  whiteSpace: 'nowrap', color: 'var(--medium-gray)', fontWeight: 600, fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  borderBottom: `2px solid ${badgeColor}60`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flatRows
              // ── PLANO: una fila por venta individual ────────────────
              ? groups.flatMap((group, gi) => {
                  const rowBg = gi % 2 === 0 ? 'transparent' : `${badgeColor}08`
                  return group.sales.map((sale: any, si: number) => {
                    const isLast = si === group.sales.length - 1
                    const tramo = dashRows && dashRows.length > 0
                      ? calculateDynamicCommission(sale, dashRows)
                      : calcNifTramo(Number(sale.cuota ?? 0), 1, tramoInfo)
                    return (
                      <tr key={`${gi}-${si}`} style={{ background: rowBg, borderBottom: isLast ? `2px solid ${badgeColor}30` : `1px dashed var(--border-color)`, verticalAlign: 'middle' }}>
                        <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', fontSize: 12, whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color)' }}>{group.nif}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--light-text)', borderRight: '1px solid var(--border-color)' }}>{group.nombre}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{sale.fecha || '—'}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{sale.telf || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: 11.5, color: 'var(--medium-gray)', borderRight: '1px solid var(--border-color)' }}>{sale.codigo || '—'}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, borderRight: '1px solid var(--border-color)' }}>{sale.vendedor || '—'}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--light-text)', maxWidth: 280 }}>{sale.producto || '—'}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <span style={{ background: `${tabColor}22`, color: tabColor, borderRadius: 20, padding: '3px 11px', fontWeight: 800, fontSize: 13 }}>1</span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--light-text)', fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(Number(sale.cuota ?? 0))}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: badgeColor, fontSize: 13, whiteSpace: 'nowrap' }}>{tramoInfo.tramoVal > 0 ? fmt(tramo) : '—'}</td>
                      </tr>
                    )
                  })
                })
              // ── AGRUPADO: una fila por producto ────────────
              : groups.map((group, gi) => {
              const rowBg  = gi % 2 === 0 ? 'transparent' : `${badgeColor}08`
              const first  = group.sales[0] || {}
              const prodMap = new Map<string, { sales: any[]; subtotal: number }>()
              group.sales.forEach((s: any) => {
                const key = (s.producto || '—').trim()
                if (!prodMap.has(key)) prodMap.set(key, { sales: [], subtotal: 0 })
                const pg = prodMap.get(key)!
                pg.sales.push(s)
                pg.subtotal += Number(s.cuota ?? 0)
              })
              const prodGroups = Array.from(prodMap.entries())
              const span = prodGroups.length
              return prodGroups.map(([producto, pg], pi) => {
                const isLastProd = pi === span - 1
                const prodTramo = dashRows && dashRows.length > 0
                  ? pg.sales.reduce((sum: number, s: any) => sum + calculateDynamicCommission(s, dashRows), 0)
                  : calcNifTramo(pg.subtotal, pg.sales.length, tramoInfo)
                let telefons = pg.sales.map((s: any) => s.telf || group.telf).filter(Boolean)
                let fechas = pg.sales.map((s: any) => s.fecha).filter(Boolean)
                
                if (dedupeInfo) {
                  telefons = Array.from(new Set(telefons))
                  fechas = Array.from(new Set(fechas))
                }

                return (
                  <tr
                    key={`${gi}-${pi}`}
                    style={{
                      background: rowBg,
                      borderBottom: isLastProd ? `2px solid ${badgeColor}30` : `1px dashed var(--border-color)`,
                      verticalAlign: 'top',
                    }}
                  >
                    <td style={{
                      padding: '12px 14px', color: 'var(--medium-gray)', fontSize: 12,
                      whiteSpace: 'nowrap', verticalAlign: 'top',
                      borderRight: '1px solid var(--border-color)'
                    }}>{group.nif}</td>
                    
                    <td style={{
                      padding: '12px 14px', fontWeight: 600, color: 'var(--light-text)',
                      verticalAlign: 'top',
                      borderRight: '1px solid var(--border-color)'
                    }}>{group.nombre}</td>
                    
                    <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>
                      {fechas.length > 1
                        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {fechas.map((f, fi) => <span key={fi}>{f}</span>)}
                          </div>
                        : fechas[0] || '—'
                      }
                    </td>

                    <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>
                      {telefons.length > 1
                        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {telefons.map((t, ti) => <span key={ti}>{t}</span>)}
                          </div>
                        : telefons[0] || '—'
                      }
                    </td>
                    
                    <td style={{
                      padding: '12px 14px', fontSize: 11.5, color: 'var(--medium-gray)',
                      verticalAlign: 'top',
                      borderRight: '1px solid var(--border-color)'
                    }}>{first.codigo}</td>
                    
                    <td style={{
                      padding: '12px 14px', fontWeight: 600, verticalAlign: 'top',
                      borderRight: '1px solid var(--border-color)'
                    }}>{first.vendedor}</td>
                    
                    <td style={{ padding: '12px 14px', color: 'var(--light-text)', maxWidth: 280 }}>{producto}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span style={{ background: `${tabColor}22`, color: tabColor, borderRadius: 20, padding: '3px 11px', fontWeight: 800, fontSize: 13 }}>
                        {pg.sales.length}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--light-text)', fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(pg.subtotal)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: badgeColor, fontSize: 13, whiteSpace: 'nowrap' }}>{tramoInfo.tramoVal > 0 ? fmt(prodTramo) : '—'}</td>
                  </tr>
                )
              })
            })}

          </tbody>
        </table>
      </div>
    </div>
  )
}



// ── Main page content ─────────────────────────────────────────────────
function GrupoClienteContent() {
  const { authorized } = useGuard('MODULE_TIENDAS')
  const { activePeriodKey, availablePeriods } = usePeriod()
  const [sales, setSales]           = useState<any[]>([])
  const [importesPyme, setImportesPyme] = useState<any[]>([])
  const [importesPlus, setImportesPlus] = useState<any[]>([])
  const [objetivos, setObjetivos]   = useState<any>({ Pyme: {}, Captador: {} })
  const [objGrupos, setObjGrupos]   = useState<any>({ Pyme: {}, Captador: {} })
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('fd')
  const [extraAssignments, setExtraAssignments] = useState<any[]>([])

  const activePeriodObj = availablePeriods?.find((p: any) => p.period_key === activePeriodKey)

  useEffect(() => {
    if (!activePeriodKey) return
    setLoading(true)
    Promise.all([
      fetch(`/api/sales?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/importes-pyme?periodKey=${activePeriodKey}&strictPeriod=1`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/importes-plus?periodKey=${activePeriodKey}&strictPeriod=1`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/objetivos?periodKey=${activePeriodKey}&strictPeriod=1`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/extras/assignments?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({})),
    ]).then(([sData, pymeData, plusData, objData, extrasData]) => {
      if (sData?.success) {
        setSales((sData.logs || []).filter((s: any) => s.anulado !== 'Si' && s.pendiente !== 'Anulado'))
      }
      if (pymeData?.success) setImportesPyme(pymeData.importes || pymeData.data || [])
      if (plusData?.success) setImportesPlus(plusData.importes || plusData.data || [])
      if (objData?.success && objData.objetivos) {
        setObjetivos(objData.objetivos)
        if (objData.grupos) setObjGrupos(objData.grupos)
      }
      if (extrasData?.success && extrasData.assignments) {
        setExtraAssignments(extrasData.assignments.filter((ea: any) => ea.status !== 'CANCELLED'))
      } else {
        setExtraAssignments([])
      }
    }).finally(() => setLoading(false))
  }, [activePeriodKey])

  const tab = TABS.find(t => t.id === activeTab) || TABS[0]

  // Sales for the active tab
  const tabSales = useMemo(() => sales.filter(s => filterByTab(s, activeTab)), [sales, activeTab])

  // Split by channel
  const plusSales   = useMemo(() => tabSales.filter(s => isPlus(s.codigo)),   [tabSales])
  const basicoSales = useMemo(() => tabSales.filter(s => isBasico(s.codigo)), [tabSales])
  const otrosSales  = useMemo(() => tabSales.filter(s => !isPlus(s.codigo) && !isBasico(s.codigo)), [tabSales])

  // NIF groups
  const plusGroups   = useMemo(() => groupSalesByNif(plusSales),   [plusSales])
  const basicoGroups = useMemo(() => groupSalesByNif(basicoSales), [basicoSales])
  const otrosGroups  = useMemo(() => groupSalesByNif(otrosSales),  [otrosSales])

  // Dashboard calculations for tramo rates
  const activeMonthStr = activePeriodKey ? activePeriodKey.replace('_', '') : ''
  const pymeObjMonth   = objetivos.Pyme?.[activeMonthStr] || {}
  const captObjMonth   = objetivos.Captador?.[activeMonthStr] || {}

  // ALL channel sales (not tab-filtered) — same as Liquidaciones uses for pje calculation
  const allPlusSales   = useMemo(() => sales.filter(s => isPlus(s.codigo)),   [sales])
  const allBasicoSales = useMemo(() => sales.filter(s => isBasico(s.codigo)), [sales])

  const plusDash  = useMemo(() => {
    if (!importesPyme.length || !allPlusSales.length) return null
    return renderDashboardData('Pyme', importesPyme, pymeObjMonth, allPlusSales, objGrupos, activePeriodObj)
  }, [importesPyme, allPlusSales, pymeObjMonth, objGrupos, activePeriodObj])

  const basicoDash = useMemo(() => {
    if (!importesPlus.length || !allBasicoSales.length) return null
    return renderDashboardData('Captador', importesPlus, captObjMonth, allBasicoSales, objGrupos, activePeriodObj)
  }, [importesPlus, allBasicoSales, captObjMonth, objGrupos, activePeriodObj])

  const plusInfo   = plusDash   ? getTramoInfo(plusDash.rows,   tab.grupo) : { tramoVal: 0, isPercentage: false, pje: 0, pjeProyectado: 0, tramoValProyectado: 0 }
  const basicoInfo = basicoDash ? getTramoInfo(basicoDash.rows, tab.grupo) : { tramoVal: 0, isPercentage: false, pje: 0, pjeProyectado: 0, tramoValProyectado: 0 }

  // Totals — use dash totalImporte/Proyectado for tramo panels (includes pending logic)
  const grandTotal          = tabSales.reduce((s, x) => s + Number(x.cuota ?? 0), 0)
  const plusTotal           = plusSales.reduce((s, x) => s + Number(x.cuota ?? 0), 0)
  const basicoTotal         = basicoSales.reduce((s, x) => s + Number(x.cuota ?? 0), 0)

  // ── Comisión del tab actual: suma de calculateDynamicCommission por venta (igual que SectionTable) ──
  const plusTramoAmt = plusDash?.rows?.length
    ? plusSales.reduce((s, sale) => s + calculateDynamicCommission(sale, plusDash.rows), 0)
    : 0
  const basicoTramoAmt = basicoDash?.rows?.length
    ? basicoSales.reduce((s, sale) => s + calculateDynamicCommission(sale, basicoDash.rows), 0)
    : 0
  const plusTramoProyectado = plusDash   ? plusDash.totalImporteProyectado   : 0
  const basicoTramoProyectado = basicoDash ? basicoDash.totalImporteProyectado : 0
  const grandTramo          = plusTramoAmt + basicoTramoAmt
  const uniqueNifs          = new Set(tabSales.map(s => (s.nif || 'SIN NIF').toUpperCase())).size

  // ── Resolve extra channel code ──────────────────────────────────────
  const resolveExtraCode = (ea: any): string => {
    let code = ea.rule?.channelType || 'EXTRA'
    if (code === 'AMBOS' && ea.sourceSaleIds) {
      try {
        const ids = JSON.parse(ea.sourceSaleIds)
        if (ids?.length > 0) {
          const fs = sales.find((s: any) => s.id === ids[0])
          if (fs?.codigo) code = fs.codigo
        }
      } catch(e) {}
    }
    return code.toLowerCase()
  }

  const extrasPlus   = useMemo(() => extraAssignments.filter(ea => { const rc = resolveExtraCode(ea); return rc.includes('plus') || rc === 'ambos' }), [extraAssignments, sales])
  const extrasBasico = useMemo(() => extraAssignments.filter(ea => { const rc = resolveExtraCode(ea); return rc.includes('basico') || rc.includes('básico') || rc === 'ambos' }), [extraAssignments, sales])
  const extrasPlusTotal   = extrasPlus.reduce((s: number, e: any) => s + (e.telecomRewardAmount || 0), 0)
  const extrasBasicoTotal = extrasBasico.reduce((s: number, e: any) => s + (e.telecomRewardAmount || 0), 0)
  const extrasGrandTotal  = extrasPlusTotal + extrasBasicoTotal

  if (authorized === null) return <div style={{ padding: 40 }}>Verificando acceso...</div>

  // ── Extras tab content (separate render path) ────────────────────────
  const renderExtrasTab = () => {
    // Lookup first source sale for NIF / phone / código
    const getSale = (ea: any): any => {
      try {
        const ids = JSON.parse(ea.sourceSaleIds || '[]')
        if (ids?.length > 0) return sales.find((s: any) => s.id === ids[0]) || null
      } catch(e) {}
      return null
    }

    const renderExtraSection = (extras: any[], label: string, badge: string, color: string) => {
      if (extras.length === 0) return null
      const sectionTotal = extras.reduce((s: number, e: any) => s + (e.telecomRewardAmount || 0), 0)
      return (
        <div style={{ marginBottom: 24 }}>
          {/* Header — mismo estilo que SectionTable */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: `${color}12`, border: `1px solid ${color}30`, borderRadius: '12px 12px 0 0' }}>
            <span style={{ background: color, color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 12px', borderRadius: 20 }}>{badge}</span>
            <span style={{ fontWeight: 700, color: 'var(--light-text)', fontSize: 14 }}>{label}</span>
            <span style={{ fontSize: 12, color: 'var(--medium-gray)' }}>{extras.length} extras</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color, fontWeight: 800 }}>Total: {fmt(sectionTotal)}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color }}>Tramo: {fmt(sectionTotal)}</span>
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 12px 12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  {[
                    { label: 'CLIENTE (NIF)', right: false },
                    { label: 'EMPRESA',          right: false },
                    { label: 'FECHA TRAM.',      right: false },
                    { label: 'TELÉFONO',         right: false },
                    { label: 'CÓDIGO',           right: false },
                    { label: 'COMERCIAL',        right: false },
                    { label: 'CONCEPTO / REGLA', right: false },
                    { label: 'TOTAL',            right: true  },
                    { label: 'PAGO POR TRAMO',   right: true  },
                  ].map(h => (
                    <th key={h.label} style={{ padding: '10px 14px', textAlign: h.right ? 'right' : 'left', color: 'var(--medium-gray)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, background: 'var(--active-bg)' }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {extras.map((ea: any, idx: number) => {
                  const sale   = getSale(ea)
                  const nif    = sale?.nif || '—'
                  const emp    = ea.customerName || sale?.nombreCliente || '—'
                  const fch    = sale?.fecha || '—'
                  const telf   = sale?.telf || '—'
                  const cod    = sale?.codigo || '—'
                  const amt    = ea.telecomRewardAmount || 0
                  return (
                    <tr key={idx} style={{ borderBottom: `2px solid ${color}30` }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--medium-gray)', fontSize: 12 }}>{nif}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--light-text)' }}>{emp}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{fch}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{telf}</td>
                      <td style={{ padding: '12px 14px', fontSize: 11.5, color: 'var(--medium-gray)' }}>{cod}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{ea.seller || '—'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--medium-gray)' }}>{ea.rule?.name || 'Extra Manual'}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--light-text)', whiteSpace: 'nowrap' }}>{fmt(amt)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color, whiteSpace: 'nowrap' }}>{fmt(amt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    return (

      <>
        {/* KPIs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { v: extraAssignments.length, label: 'Extras totales', color: '#10b981' },
            { v: fmt(extrasPlusTotal),   label: 'Total Plus',    color: '#34C759' },
            { v: fmt(extrasBasicoTotal), label: 'Total Básico',  color: 'var(--mercedes-cyan)' },
            { v: fmt(extrasGrandTotal),  label: 'Gran Total',    color: '#10b981' },
          ].map((kpi, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', border: `1px solid ${kpi.color}40`, borderRadius: 10, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: kpi.color }}>{kpi.v}</span>
              <span style={{ fontSize: 12, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{kpi.label}</span>
            </div>
          ))}
        </div>
        {extrasPlus.length === 0 && extrasBasico.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', color: 'var(--medium-gray)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No hay Incentivos Extra en el período activo.</div>
          </div>
        ) : (
          <>
            {renderExtraSection(extrasPlus,   'Canal Plus',   'PLUS',   '#00ADEF')}
            {renderExtraSection(extrasBasico, 'Canal Básico', 'BÁSICO', '#F59E0B')}
            {/* Grand total */}
            <div style={{ marginTop: 8, padding: '18px 28px', background: 'rgba(16,185,129,0.08)', border: '2px solid rgba(16,185,129,0.3)', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--medium-gray)', marginBottom: 2 }}>⚡ Extras — GRAN TOTAL</div>
                <div style={{ fontSize: 12, color: 'var(--medium-gray)' }}>{extraAssignments.length} extras activos</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: 'var(--medium-gray)', marginBottom: 2 }}>Importe Movistar total</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#10b981' }}>{fmt(extrasGrandTotal)}</div>
              </div>
            </div>
          </>
        )}
      </>
    )
  }

  // ── Shared helpers for export ──────────────────────────────────────
  const periodLabel = activePeriodKey ? activePeriodKey.replace('_', ' ') : 'periodo'
  const fmtN = (v: number) => Number(v.toFixed(2))

  const getTabExportRows = (tab: any, plusRows: any[], basicoRows: any[]) => {
    const tabSales = sales.filter((s: any) => filterByTab(s, tab.id))
    if (tabSales.length === 0) return []

    const flatMode = tab.id === 'alta' || tab.id === 'porta'
    const dedupeInfo = tab.id === 'tma' || tab.id === 'ti' || tab.id === 'micro'
    const exportRows: any[] = []
    const nifGroups = groupSalesByNif(tabSales)

    nifGroups.forEach(group => {
      if (flatMode) {
        group.sales.forEach((s: any) => {
          let tramo = 0
          if (isPlus(s.codigo)) {
            tramo = calculateDynamicCommission(s, plusRows)
          } else if (isBasico(s.codigo)) {
            tramo = calculateDynamicCommission(s, basicoRows)
          }
          
          exportRows.push({
            Grupo: `${tab.emoji} ${tab.label}`,
            NIF: group.nif || '—',
            Empresa: group.nombre || '—',
            'Fecha Tram.': s.fecha || '—',
            Telefono: s.telf || '—',
            Codigo: s.codigo || '—',
            Comercial: s.vendedor || '—',
            Producto: s.producto || '—',
            Uds: 1,
            'Cuota Bruta': fmtN(Number(s.cuota ?? 0)),
            'Pago por Tramo': fmtN(tramo)
          })
        })
      } else {
        const prodMap = new Map<string, { sales: any[]; subtotal: number }>()
        group.sales.forEach((s: any) => {
          const key = (s.producto || '—').trim()
          if (!prodMap.has(key)) prodMap.set(key, { sales: [], subtotal: 0 })
          const pg = prodMap.get(key)!
          pg.sales.push(s)
          pg.subtotal += Number(s.cuota ?? 0)
        })

        Array.from(prodMap.values()).forEach(pg => {
          const first = pg.sales[0] || {}
          let telefons = pg.sales.map((s: any) => s.telf || group.telf).filter(Boolean)
          let fechas = pg.sales.map((s: any) => s.fecha).filter(Boolean)
          
          if (dedupeInfo) {
            telefons = Array.from(new Set(telefons))
            fechas = Array.from(new Set(fechas))
          }

          const tramo = pg.sales.reduce((sum, s) => {
            if (isPlus(s.codigo)) return sum + calculateDynamicCommission(s, plusRows)
            if (isBasico(s.codigo)) return sum + calculateDynamicCommission(s, basicoRows)
            return sum
          }, 0)

          exportRows.push({
            Grupo: `${tab.emoji} ${tab.label}`,
            NIF: group.nif || '—',
            Empresa: group.nombre || '—',
            'Fecha Tram.': fechas.length > 0 ? fechas.join(', ') : '—',
            Telefono: telefons.length > 0 ? telefons.join(', ') : '—',
            Codigo: first.codigo || '—',
            Comercial: first.vendedor || '—',
            Producto: first.producto || '—',
            Uds: pg.sales.length,
            'Cuota Bruta': fmtN(pg.subtotal),
            'Pago por Tramo': fmtN(tramo)
          })
        })
      }
    })

    return exportRows
  }

  // Opción A — Una hoja por grupo
  const exportByGroup = () => {
    // Excel sheet names: max 31 chars, no /\*?:[]
    const safeSheet = (name: string) =>
      name.replace(/[\/\\*?\:\[\]]/g, '-').replace(/[^\x20-\x7E]/g, '').slice(0, 31).trim() || 'Hoja'

    const plusRows   = plusDash?.rows   || []
    const basicoRows = basicoDash?.rows || []
    const wb = XLSX.utils.book_new()
    
    TABS.filter(t => t.id !== 'extras').forEach(t => {
      const rows = getTabExportRows(t, plusRows, basicoRows)
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Grupo: t.label, Info: 'Sin operaciones' }])
      XLSX.utils.book_append_sheet(wb, ws, safeSheet(t.label))
    })
    
    // Extras sheet
    const extrasRows = extraAssignments.map((ea: any) => ({
      Grupo:    'Extras',
      Comercial: ea.seller || '—',
      Cliente:   ea.customerName || '—',
      Regla:     ea.rule?.name || 'Extra Manual',
      Canal:     ea.rule?.channelType || '—',
      'Pago por Tramo': fmtN(ea.telecomRewardAmount || 0),
      'Importe Comercial': fmtN(ea.sellerRewardAmount || 0),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(extrasRows.length ? extrasRows : [{ Info: 'Sin extras' }]), 'Extras')
    XLSX.writeFile(wb, `OGC_PorGrupo_${periodLabel}.xlsx`)
  }

  // Opción B — Todo en una sola hoja
  const exportAllInOne = () => {
    const plusRows   = plusDash?.rows   || []
    const basicoRows = basicoDash?.rows || []

    const allRows = TABS.filter(t => t.id !== 'extras').flatMap(t => getTabExportRows(t, plusRows, basicoRows))

    // Añadir Extras a la hoja unificada
    extraAssignments.forEach((ea: any) => {
      let nif = '—', fch = '—', telf = '—', cod = '—'
      try {
        const ids = JSON.parse(ea.sourceSaleIds || '[]')
        if (ids?.length > 0) {
          const sale = sales.find((s: any) => s.id === ids[0])
          if (sale) {
            nif = sale.nif || '—'
            fch = sale.fecha || '—'
            telf = sale.telf || '—'
            cod = sale.codigo || '—'
          }
        }
      } catch(e) {}

      allRows.push({
        Grupo: '⚡ Extras',
        NIF: nif,
        Empresa: ea.customerName || '—',
        'Fecha Tram.': fch,
        Telefono: telf,
        Codigo: cod,
        Comercial: ea.seller || '—',
        Producto: ea.rule?.name || 'Extra Manual',
        Uds: 1,
        'Cuota Bruta': 0,
        'Pago por Tramo': fmtN(ea.telecomRewardAmount || 0)
      })
    })

    const ws = XLSX.utils.json_to_sheet(allRows.length ? allRows : [{ Info: 'Sin operaciones' }])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Todas las Operaciones')
    XLSX.writeFile(wb, `OGC_TodoJunto_${periodLabel}.xlsx`)
  }

  // Opción C — Resumen por grupo
  const exportSummary = () => {
    const plusRows   = plusDash?.rows   || []
    const basicoRows = basicoDash?.rows || []
    const summaryRows = TABS.filter(t => t.id !== 'extras').map(t => {
      const tabSls = sales.filter((s: any) => filterByTab(s, t.id))
      const plusSls   = tabSls.filter((s: any) => isPlus(s.codigo))
      const basicoSls = tabSls.filter((s: any) => isBasico(s.codigo))
      const plusTramo   = plusRows.length   ? plusSls.reduce((a: number, s: any)   => a + calculateDynamicCommission(s, plusRows), 0)   : 0
      const basicoTramo = basicoRows.length ? basicoSls.reduce((a: number, s: any) => a + calculateDynamicCommission(s, basicoRows), 0) : 0
      return {
        Grupo:             `${t.emoji} ${t.label}`,
        'Nº Ventas':       tabSls.length,
        'Cuota Bruta':     fmtN(tabSls.reduce((a: number, s: any) => a + Number(s.cuota ?? 0), 0)),
        'Pago por Tramo (€)': fmtN(plusTramo + basicoTramo),
      }
    })
    // Extras row
    const extrasTotal = extraAssignments.reduce((a: number, e: any) => a + (e.telecomRewardAmount || 0), 0)
    summaryRows.push({ Grupo: '⚡ Extras', 'Nº Ventas': extraAssignments.length, 'Cuota Bruta': 0, 'Pago por Tramo (€)': fmtN(extrasTotal) })
    // Grand total
    summaryRows.push({
      Grupo: 'TOTAL',
      'Nº Ventas':       summaryRows.reduce((a, r) => a + (r['Nº Ventas'] as number), 0),
      'Cuota Bruta':     fmtN(summaryRows.reduce((a, r) => a + (r['Cuota Bruta'] as number), 0)),
      'Pago por Tramo (€)': fmtN(summaryRows.reduce((a, r) => a + (r['Pago por Tramo (€)'] as number), 0)),
    })
    const ws = XLSX.utils.json_to_sheet(summaryRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen')
    XLSX.writeFile(wb, `OGC_Resumen_${periodLabel}.xlsx`)
  }

  return (
    <div style={{ padding: '24px 32px', paddingBottom: 100, background: 'var(--bg-app)', minHeight: '100vh' }}>
      <PageHeader
        title="Operaciones por Grupo Cliente"
        showBack={true}
        backFallback="/liquidacion"
        helpContent={
          <div>
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Análisis por Grupo Cliente</h4>
            <p style={{ margin: 0, lineHeight: 1.5, fontSize: 13 }}>
              Ventas agrupadas por NIF con desglose por producto. El <strong>Pago por tramo</strong> se calcula
              automáticamente usando las tablas de comisiones (Ventas vs Importes PLUS / BÁSICO) y el % cumplimiento
              acumulado del período activo.
            </p>
          </div>
        }
      />

      {/* ── Botones de exportación Excel ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: '📋 Hoja por Grupo', desc: 'Una pestaña por cada grupo', fn: exportByGroup, color: '#059669' },
          { label: '📄 Todo en Una Hoja', desc: 'Todas las ventas juntas con columna Grupo', fn: exportAllInOne, color: '#2563eb' },
          { label: '📊 Resumen', desc: 'Totales por grupo: ventas, cuota y tramo', fn: exportSummary, color: '#7C3AED' },
        ].map((btn, i) => (
          <button key={i} onClick={btn.fn} title={btn.desc} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 10, border: `1px solid ${btn.color}40`,
            background: `${btn.color}12`, color: btn.color,
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = `${btn.color}22`; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = `${btn.color}12`; e.currentTarget.style.transform = 'none' }}
          >
            {btn.label}
          </button>
        ))}
        <span style={{ fontSize: 11, color: 'var(--medium-gray)', alignSelf: 'center', marginLeft: 4 }}>
          Exportar todas las operaciones de {periodLabel}
        </span>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24, padding: 6, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-color)', width: 'fit-content' }}>
        {TABS.map(t => {
          const active = activeTab === t.id
          const count = t.id === 'extras' ? extraAssignments.length : sales.filter(s => filterByTab(s, t.id)).length
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10,
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500,
              background: active ? t.color : 'transparent', color: active ? '#fff' : 'var(--medium-gray)',
              transition: 'all 0.15s',
            }}>
              {t.emoji} {t.label}
              {active && count > 0 && (
                <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 20, fontSize: 11, fontWeight: 800, padding: '1px 7px' }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--medium-gray)' }}>Cargando operaciones...</div>
      ) : activeTab === 'extras' ? renderExtrasTab() : tabSales.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', color: 'var(--medium-gray)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{tab.emoji}</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No hay operaciones de {tab.label} en el período activo.</div>
        </div>
      ) : (
        <>
          {/* ── Resumen rápido ── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--bg-card)', border: `1px solid ${tab.color}40`, borderRadius: 10, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: tab.color }}>{tabSales.length}</span>
              <span style={{ fontSize: 12, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Operaciones</span>
            </div>
            <div style={{ background: 'var(--bg-card)', border: `1px solid ${tab.color}40`, borderRadius: 10, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: tab.color }}>{uniqueNifs}</span>
              <span style={{ fontSize: 12, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Clientes únicos</span>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--light-text)' }}>{fmt(grandTotal)}</span>
              <span style={{ fontSize: 12, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Gran Total</span>
            </div>
            {grandTramo > 0 && (
              <div style={{ background: 'var(--bg-card)', border: `1px solid ${tab.color}40`, borderRadius: 10, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: tab.color }}>{fmt(grandTramo)}</span>
                <span style={{ fontSize: 12, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Tramo</span>
              </div>
            )}
          </div>

          {/* ── Panel Estado de Tramo ── */}
          {(plusInfo.pje > 0 || basicoInfo.pje > 0) && (() => {
            const TRAMOS = [
              { label: '< 50%',    from: 0,   to: 50,  bg: '#fee2e2', col: '#ef4444' },
              { label: '50–80%',  from: 50,  to: 80,  bg: '#fef3c7', col: '#d97706' },
              { label: '80–100%', from: 80,  to: 100, bg: '#d1fae5', col: '#059669' },
              { label: '> 100%',  from: 100, to: 130, bg: '#dbeafe', col: '#2563eb' },
            ]
            const getTramoLabel = (pje: number) => {
              if (pje < 50)  return { label: '< 50%',    col: '#ef4444' }
              if (pje < 80)  return { label: '50–80%',  col: '#d97706' }
              if (pje <= 100) return { label: '80–100%', col: '#059669' }
              return { label: '> 100%', col: '#2563eb' }
            }
            const renderCard = (info: TramoInfo, label: string, color: string, totalImporte: number, tramoAmt: number, tramoProyectado: number) => {
              if (info.pje === 0 && info.tramoVal === 0) return null
              const pje = info.pje
              const pjeP = info.pjeProyectado
              const barPct = Math.min(pje, 130)
              const tramoLabel  = getTramoLabel(pje)
              const tramoPLabel = getTramoLabel(pjeP)
              const liquidDesc = info.isPercentage ? `${info.tramoVal}% s/importe` : `${fmt(info.tramoVal)}/ud`
              const liquidDescP = info.isPercentage ? `${info.tramoValProyectado}% s/importe` : `${fmt(info.tramoValProyectado)}/ud`
              return (
                <div style={{ flex: 1, minWidth: 320, background: 'var(--bg-card)', border: `1px solid ${color}40`, borderRadius: 14, padding: '18px 22px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ background: color, color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 20 }}>{label}</span>
                        <span style={{ fontSize: 12, color: 'var(--medium-gray)' }}>Estado del Tramo</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--medium-gray)' }}>
                        Liquidación actual: <strong style={{ color }}>{liquidDesc}</strong>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--medium-gray)', marginBottom: 2 }}>Pago de este grupo</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color }}>{fmt(tramoAmt)}</div>
                      </div>
                    </div>
                  </div>

                  {/* % Cumplimiento grande */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 40, fontWeight: 900, color: tramoLabel.col, lineHeight: 1 }}>{pje.toFixed(1)}%</div>
                    <div style={{ fontSize: 13, color: 'var(--medium-gray)' }}>cumplimiento actual</div>
                    <div style={{ marginLeft: 'auto', fontSize: 12, background: `${tramoLabel.col}18`, color: tramoLabel.col, fontWeight: 700, padding: '4px 12px', borderRadius: 20, border: `1px solid ${tramoLabel.col}40` }}>
                      Tramo {tramoLabel.label}
                    </div>
                  </div>

                  {/* Barra de progreso con marcas de tramo */}
                  <div style={{ position: 'relative', marginBottom: 6 }}>
                    {/* Fondo segmentado */}
                    <div style={{ display: 'flex', height: 12, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
                      {TRAMOS.map((t, i) => (
                        <div key={i} style={{ flex: i < 3 ? 30 : 30, background: t.bg, position: 'relative' }} />
                      ))}
                    </div>
                    {/* Barra de progreso encima */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: `${Math.min(barPct / 1.3, 100)}%`, height: 12, borderRadius: 8, background: `linear-gradient(90deg, ${tramoLabel.col}aa, ${tramoLabel.col})`, transition: 'width 0.6s ease', boxShadow: `0 0 6px ${tramoLabel.col}60` }} />
                    {/* Marcas */}
                    {[50, 80, 100].map(mark => (
                      <div key={mark} style={{ position: 'absolute', top: -4, left: `${(mark / 130) * 100}%`, width: 2, height: 20, background: 'var(--border-color)', transform: 'translateX(-50%)' }} />
                    ))}
                  </div>
                  {/* Etiquetas bajo la barra */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--medium-gray)', marginBottom: 12 }}>
                    <span>0%</span><span>50%</span><span>80%</span><span>100%</span><span>+</span>
                  </div>

                  {/* Escalera de tramos */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                    {TRAMOS.map((t, i) => {
                      const isActive = (i === 0 && pje < 50) || (i === 1 && pje >= 50 && pje < 80) || (i === 2 && pje >= 80 && pje <= 100) || (i === 3 && pje > 100)
                      return (
                        <div key={i} style={{ background: isActive ? t.bg : 'var(--active-bg)', border: isActive ? `2px solid ${t.col}` : '1px solid var(--border-color)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: isActive ? t.col : 'var(--medium-gray)', fontWeight: isActive ? 800 : 400 }}>{t.label}</div>
                          {isActive && <div style={{ fontSize: 10, color: t.col, fontWeight: 900, marginTop: 2 }}>← AQUÍ</div>}
                        </div>
                      )
                    })}
                  </div>

                  {/* Importe base */}
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--medium-gray)', borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                    Base de cálculo: <strong style={{ color: 'var(--light-text)' }}>{fmt(totalImporte)}</strong>
                    {info.isPercentage && <> × {info.tramoVal}% = <strong style={{ color }}>{fmt(tramoAmt)}</strong></>}
                  </div>
                </div>
              )
            }
            return (
              <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                {renderCard(plusInfo,   'PLUS',   '#00ADEF', plusTotal,   plusTramoAmt,   plusTramoProyectado)}
                {renderCard(basicoInfo, 'BÁSICO', '#F59E0B', basicoTotal, basicoTramoAmt, basicoTramoProyectado)}
              </div>
            )
          })()}

          {/* ── Sections ── */}
          <SectionTable label="Código Plus"   badge="PLUS"   badgeColor="#00ADEF" groups={plusGroups}   tabColor={tab.color} tramoInfo={plusInfo}   dashRows={plusDash?.rows} flatRows={activeTab === 'alta' || activeTab === 'porta'} dedupeInfo={activeTab === 'tma' || activeTab === 'ti' || activeTab === 'micro'} />
          <SectionTable label="Código Básico" badge="BÁSICO" badgeColor="#F59E0B" groups={basicoGroups} tabColor={tab.color} tramoInfo={basicoInfo} dashRows={basicoDash?.rows} flatRows={activeTab === 'alta' || activeTab === 'porta'} dedupeInfo={activeTab === 'tma' || activeTab === 'ti' || activeTab === 'micro'} />
          <SectionTable label="Otros Códigos" badge="OTROS"   badgeColor="#6B7280" groups={otrosGroups}  tabColor={tab.color} tramoInfo={{ tramoVal: 0, isPercentage: false, pje: 0, pjeProyectado: 0, tramoValProyectado: 0 }} flatRows={activeTab === 'alta' || activeTab === 'porta'} dedupeInfo={activeTab === 'tma' || activeTab === 'ti' || activeTab === 'micro'} />

          {/* ── Grand total ── */}
          <div style={{ marginTop: 8, padding: '18px 28px', background: `${tab.color}15`, border: `2px solid ${tab.color}40`, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--medium-gray)', marginBottom: 2 }}>{tab.emoji} {tab.label} — GRAN TOTAL</div>
              <div style={{ fontSize: 12, color: 'var(--medium-gray)' }}>{tabSales.length} operaciones · {uniqueNifs} clientes</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: 'var(--medium-gray)', marginBottom: 2 }}>Importe total</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: tab.color }}>{fmt(grandTotal)}</div>
              {grandTramo > 0 && <div style={{ fontSize: 13, color: tab.color, fontWeight: 700 }}>Tramo total: {fmt(grandTramo)}</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function GrupoClientePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Cargando...</div>}>
      <GrupoClienteContent />
    </Suspense>
  )
}
