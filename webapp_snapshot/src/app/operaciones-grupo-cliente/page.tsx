'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { usePeriod } from '@/components/PeriodProvider'
import { useGuard } from '@/hooks/useGuard'
import { ExcelIcon } from '@/components/ActionIcons'
import { renderDashboardData, calculateDynamicCommission, isVentaWithinDates, normalizeString, getCurrentMonthString, isSaleActive, isSolar360 } from '@/lib/salesUtils'
import { getSaleCommission } from '@/lib/saleCommission'
import { computeBonosO2 } from '@/lib/territorialConsolidado'
import { matchesRule, getValueForRule, matchTipoVenta } from '@/hooks/useComisionesData'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'

// Definición estática de las 6 palancas solicitadas y sus tramos según el mockup
const STATIC_PALANCAS = [
  {
    key: 'altas_baf',
    negocio: 'Fijo',
    palanca: 'Altas BAF',
    tramos: { tramo1: '20%', tramo2: '30%', tramo3: '-', bonif: '-' },
    matches: ['Alta BAF Total', 'Altas BAF', 'baf total']
  },
  {
    key: 'altas_baf_conv',
    negocio: 'Fijo',
    palanca: 'Altas BAF Movistar Convergente',
    tramos: { tramo1: '40%', tramo2: '50%', tramo3: '-', bonif: '-' },
    matches: ['Alta BAF Convergente', 'Altas BAF Movistar Convergente', 'baf convergente']
  },
  {
    key: 'baf_conv_ms_disp',
    negocio: 'Fijo',
    palanca: 'BAF Convergente MS / Dispositivos',
    tramos: { tramo1: '-', tramo2: '-', tramo3: '-', bonif: '20%' },
    matches: ['BAF Convergente MS / Dispositivos', 'baf convergente ms / dispositivos']
  },
  {
    key: 'fibra_fttr',
    negocio: 'Fijo',
    palanca: 'Fibra FTTR por Tienda',
    tramos: { tramo1: '200 €', tramo2: '-', tramo3: '-', bonif: '-' },
    matches: ['FTTR', 'Fibra FTTR por Tienda', 'fttr por tienda']
  },
  {
    key: 'rent_disp_seguros',
    negocio: 'Móvil',
    palanca: 'Rent/Dispositivos + Seguros',
    tramos: { tramo1: '3,5%', tramo2: '4,5%', tramo3: '6,0%', bonif: '-' },
    matches: ['Dispositivos + Seguros', 'Rent/Dispositivos + Seguros', 'Dispositivos + Seguro']
  },
  {
    key: 'altas_futbol_tv',
    negocio: 'Fijo',
    palanca: 'Altas Fútbol/ Desarrollo TV por Tienda',
    tramos: { tramo1: '300 €', tramo2: '500 €', tramo3: '-', bonif: '-' },
    matches: ['Repo Fútbol', 'Altas Fútbol/ Desarrollo TV por Tienda', 'Repo Futbol', 'futbol por tienda']
  }
];

// ── Tabs ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'contratos_movil', label: 'Contratos Móvil', emoji: '📋', color: '#059669', grupo: 'TI' },
  { id: 'rent',            label: 'Rent',            emoji: '🔄', color: '#BE185D', grupo: 'REN' },
  { id: 'o2',              label: 'O2 MovilFree',    emoji: '🔵', color: '#005D82', grupo: 'O2' },
  { id: 'seguro',          label: 'Seguro',          emoji: '🛡️', color: '#10B981', grupo: 'SEGURO' },
  { id: 'mimovi',          label: 'miMovistar',      emoji: '🏠', color: '#7C3AED', grupo: 'MIMOVI' },
  { id: 'traslado',        label: 'Traslado miMovistar', emoji: '🚚', color: '#7C3AED', grupo: 'TRASLADO' },
  { id: 'tv',              label: 'Suscripciones TV',emoji: '📺', color: '#D97706', grupo: 'TV' },
  { id: 'varios',          label: 'Varios',          emoji: '📦', color: '#8B5CF6', grupo: 'VARIOS' },
  { id: 'repos',           label: 'Arpu (Repos)',    emoji: '🔁', color: '#0891B2', grupo: 'REPOS' },
  { id: 'resto',           label: 'Resto BAF',       emoji: '📡', color: '#3B82F6', grupo: 'RESTO_BAF' },
  { id: 'extras',          label: 'PRV Territorial Tiendas', emoji: '⚡', color: '#10b981', grupo: 'EXTRAS' },
  { id: 'bonos_o2',        label: 'Bonos O2',        emoji: '🏆', color: '#005D82', grupo: 'BONOS_O2' },
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
  const d = (sale.detalle || '').toLowerCase().trim()
  const c = (sale.categoria || '').toLowerCase().trim()
  const val = d || c
  
  switch (tabId) {
    case 'contratos_movil': return val === 'ti' || val === 'contratos móvil' || val === 'contratos movil'
    case 'rent':            return val === 'rent'
    case 'o2':              return val === 'o2' || val === 'o2 movilfree'
    case 'seguro':          return val === 'seguro'
    case 'mimovi':          return val === 'mimovi' || val === 'mimovistar'
    case 'tv':              return val === 'tv' || val === 'suscripciones tv'
    // Varios incluye sus ventas propias + las ventas Swap (¿Swap? marcado) de
    // cualquier palanca. La venta sigue contando en su palanca de origen; el
    // totalizador global usa "primera coincidencia", así que no hay doble conteo.
    case 'varios':          return val === 'varios' || sale.isSwap === true
    case 'repos':           return val === 'repos'
    case 'resto':           return val === 'resto baf'
    case 'traslado':        return val === 'traslado mimovistar'
    default:                return false
  }
}

// ── Llaves de cruce con Telefónica por palanca (semáforo de columnas) ──
// Mismo criterio que el formulario de Nueva Venta: estas columnas permiten
// identificar la operación en la liquidación. Verde = dato presente,
// naranja = falta (la operación solo podría cruzarse por NIF).
const LLAVES_TAB: Record<string, string[]> = {
  contratos_movil: ['telf', 'pedido'],
  rent:            ['imei', 'pedido'],
  seguro:          ['telf', 'pedido'],
  mimovi:          ['pedido'],
  traslado:        ['pedido'],
  resto:           ['pedido'],
  repos:           ['telf', 'pedido'],
  tv:              ['telf', 'pedido'],
}
const tdLlave = (filled: boolean): any => filled
  ? { background: '#E8F5E9', color: '#1B5E20', fontWeight: 700 }
  : { background: '#F57C00', color: '#FFFFFF', fontWeight: 800 }
// Códigos de operación reales de Movistar: CO+añomes+referencia o pedidos
// MD/MDN+dígitos. Los rellenos o códigos mal tecleados se pintan en naranja.
const coOk = (v: any) => /^(CO\d{4}[A-Z0-9]{6,12}|MDN?\d{6,10})$/.test(String(v || '').trim().toUpperCase())
// IMEI real: 15 dígitos con dígito de control (Luhn). Caza inventados,
// incompletos o con un dígito mal tecleado: se pintan en naranja.
const imeiValido = (v: any): boolean => {
  const s = String(v || '').trim()
  if (!/^[0-9]{15}$/.test(s)) return false
  // Mismo dígito repetido 15 veces = relleno (000... pasa el Luhn)
  if (/^([0-9])\1{14}$/.test(s)) return false
  let suma = 0
  for (let i = 0; i < 15; i++) {
    let d = s.charCodeAt(i) - 48
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
    suma += d
  }
  return suma % 10 === 0
}
// Documento real: DNI (letra mod-23), NIE y CIF (control).
const docOk = (v: any): boolean => {
  const s = String(v || '').trim().toUpperCase().replace(/[\s-]/g, '')
  const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE'
  let m = s.match(/^(\d{8})([A-Z])$/)
  if (m) return LETRAS[parseInt(m[1], 10) % 23] === m[2]
  m = s.match(/^([XYZ])(\d{7})([A-Z])$/)
  if (m) return LETRAS[parseInt(String('XYZ'.indexOf(m[1])) + m[2], 10) % 23] === m[3]
  m = s.match(/^([ABCDEFGHJKLMNPQRSUVW])(\d{7})([0-9A-J])$/)
  if (m) {
    let suma = 0
    for (let i = 0; i < 7; i++) {
      let n = parseInt(m[2][i], 10)
      if (i % 2 === 0) { n *= 2; n = Math.floor(n / 10) + (n % 10) }
      suma += n
    }
    const digito = (10 - (suma % 10)) % 10
    const letra = 'JABCDEFGHI'[digito]
    if ('KPQS'.includes(m[1])) return m[3] === letra
    if ('ABEH'.includes(m[1])) return m[3] === String(digito)
    return m[3] === String(digito) || m[3] === letra
  }
  return false
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
  label, badge, badgeColor, groups, tabColor, isRent, calcCommission, importeLabel = 'Cuota Total (€)', calcImporte, showCuotaTotal = false, tabId = ''
}: {
  label: string; badge: string; badgeColor: string
  groups: NifGroup[]; tabColor: string;
  isRent?: boolean;
  calcCommission?: (sale: any) => number;
  importeLabel?: string;
  calcImporte?: (sale: any) => number;
  showCuotaTotal?: boolean;
  tabId?: string;
}) {
  if (groups.length === 0) return null

  const llaves = LLAVES_TAB[tabId] || []
  const telfEsLlave = llaves.includes('telf')
  const conPedido = llaves.includes('pedido')
  const conImei = llaves.includes('imei')
  const hayDato = (v: any) => String(v || '').trim() !== '' && String(v || '').trim() !== '—' && String(v || '').toUpperCase() !== 'SIN NIF'

  const getSaleImporte = (sale: any) => calcImporte ? calcImporte(sale) : Number(sale.cuota ?? 0)
  const sectionTotal = groups.reduce((s, g) => s + g.sales.reduce((sum, sale) => sum + getSaleImporte(sale), 0), 0)
  const totalUnits   = groups.reduce((s, g) => s + g.sales.length, 0)

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 18px', marginBottom: 0,
        background: `${badgeColor}18`, borderRadius: '12px 12px 0 0',
        border: `1px solid ${badgeColor}40`, borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: badgeColor, color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: 1 }}>{badge}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--light-text)' }}>{label}</span>
          <span style={{ fontSize: 12, color: 'var(--medium-gray)' }}>{groups.length} clientes · {totalUnits} uds.</span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {showCuotaTotal && (
            <span style={{ fontSize: 13, color: 'var(--medium-gray)' }}>{importeLabel}: <strong style={{ color: 'var(--light-text)' }}>{fmt(sectionTotal)}</strong></span>
          )}
          <span style={{ fontSize: 13, color: 'var(--medium-gray)' }}>Comisión: <strong style={{ color: 'var(--light-text)' }}>{fmt(groups.reduce((acc, g) => acc + g.sales.reduce((sum, s) => sum + (calcCommission ? calcCommission(s) : Number(s.cuota ?? 0)), 0), 0))}</strong></span>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: `1px solid ${badgeColor}40`, borderRadius: '0 0 12px 12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 800 }}>
          <thead>
            <tr style={{ background: 'var(--active-bg)' }}>
              {(() => {
                const headers = ['Cliente (NIF) 🔑', 'Nombre del Cliente', 'Fecha Tram.', telfEsLlave ? 'Teléfono 🔑' : 'Teléfono'];
                if (conPedido) headers.push('Nº Pedido 🔑');
                if (conImei) headers.push('IMEI 🔑', 'Anotaciones');
                headers.push('Código', 'Comercial', 'Productos', 'Uds.');
                if (showCuotaTotal) headers.push(importeLabel);
                headers.push('Comisión');
                return headers.map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 14px', textAlign: (h === importeLabel || h === 'Comisión' || h === 'Uds.') ? 'right' : 'left',
                    whiteSpace: 'nowrap', color: 'var(--medium-gray)', fontWeight: 600, fontSize: 11,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    borderBottom: `2px solid ${badgeColor}60` }}>{h}</th>
                ));
              })()}
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((group, gi) => {
              return group.sales.map((sale: any, si: number) => {
                const rowBg = si % 2 === 0 ? 'transparent' : `${badgeColor}08`
                const isLast = si === group.sales.length - 1
                const saleImporte = calcImporte ? calcImporte(sale) : Number(sale.cuota ?? 0)
                return (
                  <tr key={`${gi}-${si}`} style={{ background: rowBg, borderBottom: isLast ? `2px solid ${badgeColor}30` : `1px dashed var(--border-color)`, verticalAlign: 'middle' }}>
                    <td style={{ padding: '12px 14px', fontSize: 12, whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color)', ...tdLlave(docOk(group.nif)) }}>{hayDato(group.nif) ? group.nif : 'FALTA'}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--light-text)', borderRight: '1px solid var(--border-color)' }}>{group.nombre || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{sale.fecha || '—'}</td>
                    {telfEsLlave ? (
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', ...tdLlave(hayDato(sale.telf)) }}>{hayDato(sale.telf) ? sale.telf : 'FALTA'}</td>
                    ) : (
                      <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{sale.telf || '—'}</td>
                    )}
                    {conPedido && (
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontSize: 12, ...tdLlave(coOk(sale.numeroPedido)) }}>{hayDato(sale.numeroPedido) ? String(sale.numeroPedido).trim().toUpperCase() : 'FALTA'}</td>
                    )}
                    {conImei && (() => {
                      // Rent por envío logístico: lo manda Telefónica, sin IMEI → no se exige (verde).
                      const esLogistico = String(sale.origenStock || '') === 'LOGISTICO'
                      return (
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontSize: 12, ...tdLlave(imeiValido(sale.imei) || esLogistico) }}>
                          {hayDato(sale.imei) ? String(sale.imei).trim() : (esLogistico ? '🚚 Logístico' : 'FALTA')}
                        </td>
                      )
                    })()}
                    {conImei && (
                      <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', fontSize: 11.5, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sale.anotaciones || ''}>{sale.anotaciones || '—'}</td>
                    )}
                    <td style={{ padding: '12px 14px', fontSize: 11.5, color: 'var(--medium-gray)', borderRight: '1px solid var(--border-color)' }}>{sale.codigo || '—'}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, borderRight: '1px solid var(--border-color)' }}>{sale.vendedor || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--light-text)', maxWidth: 280 }}>{sale.producto || '—'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span style={{ background: `${tabColor}22`, color: tabColor, borderRadius: 20, padding: '3px 11px', fontWeight: 800, fontSize: 13 }}>1</span>
                    </td>
                    {showCuotaTotal && (
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--medium-gray)', fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(saleImporte)}</td>
                    )}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--light-text)', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {calcCommission ? fmt(calcCommission(sale)) : fmt(Number(sale.cuota ?? 0))}
                    </td>
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
  const { authorized } = useGuard('VIEW_OPERACIONES_GRUPO')
  const { activePeriodKey, availablePeriods } = usePeriod()
  const [sales, setSales]           = useState<any[]>([])
  const [importesPyme, setImportesPyme] = useState<any[]>([])
  const [importesPlus, setImportesPlus] = useState<any[]>([])
  const [objetivos, setObjetivos]   = useState<any>({ Pyme: {}, Captador: {} })
  const [objGrupos, setObjGrupos]   = useState<any>({ Pyme: {}, Captador: {} })
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('fd')
  const [extraAssignments, setExtraAssignments] = useState<any[]>([])
  const [catalogs, setCatalogs] = useState<any>({})
  const [territorialO2Rules, setTerritorialO2Rules] = useState<any[]>([])
  const [tiendaRules, setTiendaRules] = useState<any[]>([])
  const [territorialRules, setTerritorialRules] = useState<any[]>([])
  const [movilFreeSales, setMovilFreeSales] = useState<any[]>([])
  const [movilFreeProducts, setMovilFreeProducts] = useState<any[]>([])

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
      fetch(`/api/catalogs?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/territorial?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({ success: true, o2: [], tiendas: [] })),
      fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({ success: true, rules: [] })),
      fetch(`/api/movilfree/sales`).then(r => r.json()).catch(() => ([])),
      fetch(`/api/movilfree/products`).then(r => r.json()).catch(() => ([])),
    ]).then(([sData, pymeData, plusData, objData, extrasData, catData, territorialRes, tiendasRes, mfSalesData, mfProductsData]) => {
      setMovilFreeSales(Array.isArray(mfSalesData) ? mfSalesData : (mfSalesData?.sales || mfSalesData?.data || []))
      setMovilFreeProducts(Array.isArray(mfProductsData) ? mfProductsData : (mfProductsData?.products || mfProductsData?.data || []))
      if (territorialRes?.success) {
        setTerritorialO2Rules(territorialRes.o2 || [])
        setTerritorialRules(territorialRes.tiendas || [])
      }
      if (tiendasRes?.success) {
        // "Señalización Solar 360" eliminada como palanca (no se cobra ni se paga).
        setTiendaRules((tiendasRes.rules || []).filter((r: any) => !String(r.nombre || '').toLowerCase().includes('solar')))
      }
      if (sData?.success) {
        // Solar 360 fuera del listado de operaciones por completo (no solo a 0 €).
        setSales((sData.logs || []).filter((s: any) => isSaleActive(s) && !isSolar360(s)))
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
      if (catData?.success && catData.catalogs) {
        setCatalogs(catData.catalogs)
      } else {
        setCatalogs({})
      }
    }).finally(() => setLoading(false))
  }, [activePeriodKey])

  // Auxiliares para cálculo territorial
  const parseNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).replace(/[^0-9.,\-]/g, '').trim();
    s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  };

  const findRuleInList = (palancaMatches: string[], rules: any[]) => {
    const clean = (str: string) => String(str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
    const cleanMatches = palancaMatches.map(m => clean(m));

    return rules.find(r => {
      const rName = clean(r.nombre);
      return cleanMatches.some(m => rName === m || rName.includes(m) || m.includes(rName));
    });
  };

  const getSalesCountForRule = (ruleName: string, ruleProductosCuentan: string) => {
    let completed = 0;
    const isPercentage = String(ruleName).toLowerCase().includes('dispositivos') || String(ruleName).toLowerCase().includes('seguro');

    sales.forEach(s => {
      if (String(s.vendedor || '').toLowerCase().includes('marta')) return;
      if (s.anulado === 'Si' || s.anulado === 'Sí' || s.pendiente === 'Anulado') return;

      if (matchesRule(s, ruleName, ruleProductosCuentan)) {
        const val = isPercentage ? getValueForRule(s, ruleName, catalogs) : 1;
        completed += val;
      }

      if (s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet || '').toLowerCase() !== 'seguro') {
        const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
        if (matchesRule(virtualSeguro, ruleName, ruleProductosCuentan)) {
          const val = isPercentage ? getValueForRule(virtualSeguro, ruleName, catalogs) : 1;
          completed += val;
        }
      }
    });

    return completed;
  };

  const calculatedRows = useMemo(() => {
    return STATIC_PALANCAS.map(p => {
      const baseRule = findRuleInList(p.matches, tiendaRules);
      const objetivo = baseRule ? (baseRule.objPrimerTramo || 0) : 0;
      const terrRule = findRuleInList(p.matches, territorialRules);
      
      const t1Raw = terrRule ? terrRule.importe1 : p.tramos.tramo1;
      const t2Raw = terrRule ? terrRule.importe2 : p.tramos.tramo2;
      const t3Raw = p.tramos.tramo3;
      const bonifRaw = p.tramos.bonif;

      let ventas = 0;
      if (baseRule) {
        ventas = getSalesCountForRule(baseRule.nombre, baseRule.productosCuentan);
      } else {
        if (p.key === 'altas_baf') {
          ventas = getSalesCountForRule('Alta BAF Total', 'Alta BAF Total, Alta BAF Convergente');
        } else if (p.key === 'altas_baf_conv') {
          ventas = getSalesCountForRule('Alta BAF Convergente', 'Alta BAF Convergente');
        } else if (p.key === 'baf_conv_ms_disp') {
          ventas = sales.filter(s => {
            if (String(s.vendedor || '').toLowerCase().includes('marta')) return false;
            if (s.anulado === 'Si' || s.anulado === 'Sí' || s.pendiente === 'Anulado') return false;
            return String(s.categoria || s.detalle || s.sheet || '').toLowerCase() === 'rent';
          }).length;
        } else if (p.key === 'fibra_fttr') {
          ventas = getSalesCountForRule('FTTR', 'Solución FTTR');
        } else if (p.key === 'rent_disp_seguros') {
          ventas = getSalesCountForRule('Dispositivos + Seguros', 'Dispositivos, Seguro');
        } else if (p.key === 'altas_futbol_tv') {
          ventas = getSalesCountForRule('Repo Fútbol', 'Extra Repos up destino Fútbol');
        }
      }

      let pct = 0;
      if (p.key === 'baf_conv_ms_disp') {
        const bafConvRow = findRuleInList(['Alta BAF Convergente'], tiendaRules);
        const bafConvObj = bafConvRow ? (bafConvRow.objPrimerTramo || 0) : 0;
        const bafConvSales = getSalesCountForRule('Alta BAF Convergente', 'Alta BAF Convergente');
        pct = bafConvObj > 0 ? (bafConvSales / bafConvObj) * 100 : 0;
      } else {
        pct = objetivo > 0 ? (ventas / objetivo) * 100 : 0;
      }

      let importe = 0;
      let tramoAplicado = '';
      const isPct = (str: string) => String(str).includes('%');
      
      if (p.key === 'baf_conv_ms_disp') {
        if (pct >= 100) {
          tramoAplicado = 'Bonif (20%)';
          importe = ventas * 0.20;
        }
      } else if (p.key === 'rent_disp_seguros') {
        if (pct >= 130) {
          tramoAplicado = 'Tramo 3 (6%)';
          importe = ventas * 0.06;
        } else if (pct >= 115) {
          tramoAplicado = 'Tramo 2 (4,5%)';
          importe = ventas * 0.045;
        } else if (pct >= 100) {
          tramoAplicado = 'Tramo 1 (3,5%)';
          importe = ventas * 0.035;
        }
      } else {
        const obj1Val = objetivo;
        const obj2Val = baseRule ? (baseRule.objSegundoTramo || 0) : 0;
        const val1 = parseNumber(t1Raw);
        const val2 = parseNumber(t2Raw);

        if (obj2Val > 0 && ventas >= obj2Val) {
          tramoAplicado = `Tramo 2 (${t2Raw})`;
          importe = isPct(t2Raw) ? (ventas * (val2 / 100)) : val2;
        } else if (obj1Val > 0 && ventas >= obj1Val) {
          tramoAplicado = `Tramo 1 (${t1Raw})`;
          importe = isPct(t1Raw) ? (ventas * (val1 / 100)) : val1;
        }
      }

      return {
        ...p,
        objetivo,
        ventas,
        pct,
        t1Raw,
        t2Raw,
        t3Raw,
        bonifRaw,
        tramoAplicado,
        importe
      };
    });
  }, [sales, tiendaRules, territorialRules, catalogs]);

  const totalImporteTerritorial = useMemo(() => {
    return calculatedRows.reduce((acc, row) => acc + row.importe, 0);
  }, [calculatedRows]);

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

  const getRentCommission = (sale: any) => {
    const list = catalogs['Rent'] || [];
    const matchingProducts = list.filter((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
    
    let found = matchingProducts[0];
    
    // If there are multiple versions of the same product, apply validity window filtering
    if (matchingProducts.length > 1) {
        const correctlyDated = matchingProducts.find((c: any) => isVentaWithinDates(sale.fecha, c.validFrom, c.validTo));
        if (correctlyDated) {
            found = correctlyDated;
        } else {
            found = matchingProducts[matchingProducts.length - 1]; // Fallback to the latest one
        }
    }
    
    if (found) {
        const isConCoste = sale.rentConCoste && (sale.rentConCoste.toLowerCase() === 'sí' || sale.rentConCoste.toLowerCase() === 'si');
        if (isConCoste) {
            return Number(String(found.comisionConCoste || 0).replace(',','.'));
        } else {
            return Number(String(found.comision || 0).replace(',','.'));
        }
    }
    return 0;
  }

  const getSeguroImporte = (sale: any) => {
    const list = catalogs['Seguro'] || [];
    const matchingProducts = list.filter((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
    
    let found = matchingProducts[0];
    if (matchingProducts.length > 1) {
        const correctlyDated = matchingProducts.find((c: any) => isVentaWithinDates(sale.fecha, c.validFrom, c.validTo));
        if (correctlyDated) {
            found = correctlyDated;
        } else {
            found = matchingProducts[matchingProducts.length - 1];
        }
    }
    
    if (found) {
        return Number(String(found.anual || 0).replace(',','.'));
    }
    return Number(sale.cuota || 0); // Fallback
  }

  const getSaleCuotaTotal = (s: any): number => {
    const d = (s.detalle || '').toLowerCase().trim()
    const c = (s.categoria || '').toLowerCase().trim()
    if (d === 'rent' || d === 'tma' || c === 'rent') {
      return Number(s.cuota || 0)
    }
    if (d === 'seguro' || c === 'seguro') {
      return getSeguroImporte(s)
    }
    return 0
  }

  // Delegado en la fuente unica lib/saleCommission. Incluye el +15 de Swap,
  // igual que Liquidaciones/MOD (antes Grupo Cliente se lo dejaba sin sumar).
  const getCommission = (sale: any): number => getSaleCommission(sale, {
    catalogs,
    dashRowsPlus: plusDash?.rows || [],
    dashRowsBasico: basicoDash?.rows || [],
    viewingPeriod: activePeriodKey ? activePeriodKey.replace('_', '') : getCurrentMonthString(),
  });

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

  const showCuotaTotal = activeTab === 'rent' || activeTab === 'seguro';

  // Total comisiones (dinámico según pestaña)
  const grandComisionesTotal = tabSales.reduce((acc, sale) => {
    return acc + getCommission(sale);
  }, 0)

  // ── Margen MovilFree del mes (ingreso sin IVA − coste). Igual que MOD/Rentabilidad. ──
  const movilFreeReal = useMemo(() => {
    const y = activePeriodObj?.year
    const m = activePeriodObj?.month
    if (!y || !m) return 0
    return movilFreeSales
      .filter((s: any) => {
        const d = new Date(s.fechaVenta)
        return s.estado === 'COMPLETADA' && d.getFullYear() === y && (d.getMonth() + 1) === m
      })
      .reduce((acc: number, s: any) => {
        try {
          const list = JSON.parse(s.listaProductos)
          const cost = list.reduce((cAcc: number, item: any) => {
            const prodCost = item.coste !== undefined ? item.coste : (movilFreeProducts.find((p: any) => p.id === item.id)?.coste || 0)
            return cAcc + (prodCost * item.cantidad)
          }, 0)
          return acc + ((s.importeTotal / 1.21) - cost)
        } catch (e) { return acc }
      }, 0)
  }, [movilFreeSales, movilFreeProducts, activePeriodObj])

  // ── Global Totalizers Calculation ───────────────────────────────────
  const { globalCuotaTotal, globalComisionTotal } = useMemo(() => {
    // Cuota Total (€): se mantiene igual — solo ventas con pestaña reconocida.
    let cuotaSum = 0
    sales.forEach(s => {
      if (!TABS.find(t => filterByTab(s, t.id))) return
      cuotaSum += getSaleCuotaTotal(s)
    })

    // Comisión Periodo = la CAJA, idéntica a MOD / Resumen MOD / Rentabilidad por Tiendas:
    //   Σ comisión de TODAS las ventas (motor único getSaleCommission, incl. la huérfana)
    //   + margen MovilFree + PRV Territorial O2 (computeBonosO2).
    // El PRV Territorial Tiendas y los extras se ven en sus pestañas pero NO entran en el
    // titular (no forman parte de la caja operativa). Así cuadra con las otras 5 vistas.
    const ventasComision = sales.reduce((acc, s) => acc + getCommission(s), 0)
    const prvTerritorialO2 = computeBonosO2(sales, territorialO2Rules)
    const comSum = ventasComision + movilFreeReal + prvTerritorialO2

    return { globalCuotaTotal: cuotaSum, globalComisionTotal: comSum }
  }, [sales, catalogs, plusDash, basicoDash, territorialO2Rules, movilFreeReal])

  // ── Ventas huérfanas: sin pestaña reconocida ────────────────────────
  // Si el 'detalle' de una venta no casa con ninguna pestaña, la venta no
  // aparece en ningún sitio (ni totales ni exports). Aquí se detectan para
  // avisar de forma visible en vez de morir en silencio.
  const ventasHuerfanas = useMemo(() => {
    return sales.filter(s => !TABS.find(t => filterByTab(s, t.id)))
  }, [sales])

  // ── Export "Revisión ERP": Excel para subir a mi-nuevo-erp tal cual ──
  // Una fila por OPERACIÓN (sin agrupar) con las columnas exactas que el
  // ERP espera para el cruce con Telefónica. Una hoja por palanca.
  // Excluye anuladas y las pestañas internas (PRV Territorial, Bonos O2).
  const exportRevisionERP = async () => {
    const wb = new ExcelJS.Workbook()
    const sheetName = (label: string) =>
      label.replace(/[\/\\*?:\[\]]/g, '-').slice(0, 31).trim() || 'Hoja'

    TABS.filter(t => t.id !== 'extras' && t.id !== 'bonos_o2').forEach(t => {
      const rows = sales
        .filter((s: any) => filterByTab(s, t.id))
        .filter((s: any) => !s.anulado || s.anulado === 'No')
      const sheet = wb.addWorksheet(sheetName(t.label))
      sheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Comercial', key: 'comercial', width: 16 },
        { header: 'Tienda', key: 'tienda', width: 16 },
        { header: 'NIF', key: 'nif', width: 13 },
        { header: 'Móvil', key: 'movil', width: 13 },
        { header: 'Producto Vendido', key: 'producto', width: 34 },
        { header: 'IMEI', key: 'imei', width: 18 },
        { header: 'COD_PEDIDO', key: 'pedido', width: 16 },
      ]
      const hr = sheet.getRow(1)
      hr.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00ADEF' } }
      rows.forEach((s: any) => {
        sheet.addRow({
          fecha: s.fecha || '',
          comercial: s.vendedor || '',
          tienda: s.codigo || '',
          nif: (s.nif || '').toUpperCase().trim(),
          movil: s.telf || s.telefonoMovil || '',
          producto: s.producto || '',
          imei: s.imei || '',
          pedido: s.numeroPedido || '',
        })
      })
    })

    try {
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `REVISION_ERP_${periodLabel}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('Error al exportar Excel')
    }
  }

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

  // ── Bonos O2 tab content ─────────────────────────────────────────────
  const renderBonosO2Tab = () => {
    const COLOR = '#005D82'
    const TRAMOS_MES = [
      { key: '4_10',    label: 'Mes de 4 a 10',  min: 4,  max: 10    },
      { key: '11_14',   label: 'Mes de 11 a 14', min: 11, max: 14    },
      { key: '15_20',   label: 'Mes de 15 a 20', min: 15, max: 20    },
      { key: '21_30',   label: 'Mes de 21 a 30', min: 21, max: 30    },
      { key: '31_40',   label: 'Mes de 31 a 40', min: 31, max: 40    },
      { key: '41_plus', label: 'Mes de \u226541',     min: 41, max: 99999 },
    ]
    const TRAMOS_TRIM = [
      { key: '5_9',     label: 'Trim de 5 a 9', min: 5,  max: 9     },
      { key: '10_plus', label: 'Trim \u226510',      min: 10, max: 99999 },
    ]
    const parseNum = (v: any) => {
      const s = String(v || '0').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
      return parseFloat(s) || 0
    }

    const ruleRows = territorialO2Rules.map((rule: any) => {
      const filtered = sales.filter((s: any) => {
        if (s.anulado === 'Si' || s.anulado === 'S\u00ed' || s.pendiente === 'Anulado') return false
        const det = String(s.detalle || s.categoria || '').toLowerCase().trim()
        if (det !== 'o2') return false
        const prod = String(s.producto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        return prod.startsWith('fibra') || prod.startsWith('interna')
      })
      const altasFibra    = filtered.filter((s: any) => String(s.producto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().startsWith('fibra')).length
      const internasFibra = filtered.filter((s: any) => String(s.producto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().startsWith('interna')).length
      const totalSales = filtered.length
      let activeMesKey = ''
      for (const t of [...TRAMOS_MES].reverse()) { if (totalSales >= t.min) { activeMesKey = t.key; break } }
      let activeTrimKey = ''
      for (const t of [...TRAMOS_TRIM].reverse()) { if (totalSales >= t.min) { activeTrimKey = t.key; break } }
      const tramoMesAmt  = activeMesKey  ? parseNum(rule.tramosMes?.[activeMesKey])  : 0
      const tramoTrimAmt = activeTrimKey ? parseNum(rule.tramosTrim?.[activeTrimKey]) : 0
      const conectividad = totalSales > 0 ? parseNum(rule.conectividad) : 0
      const totalBono    = tramoMesAmt + tramoTrimAmt + conectividad
      return { rule, totalSales, altasFibra, internasFibra, activeMesKey, activeTrimKey, tramoMesAmt, tramoTrimAmt, conectividad, totalBono }
    })
    const grandTotal  = ruleRows.reduce((a: number, r: any) => a + r.totalBono, 0)
    const totalVentas = ruleRows.reduce((a: number, r: any) => a + r.totalSales, 0)

    const TH: React.CSSProperties = {
      padding: '9px 12px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase' as const,
      letterSpacing: 0.4, color: '#ffffff', background: '#0284c7', whiteSpace: 'nowrap' as const,
      borderRight: '1px solid rgba(255,255,255,0.15)',
    }
    const TD_OBJ: React.CSSProperties = {
      padding: '10px 14px', fontWeight: 600, fontSize: 13, color: 'var(--light-text)',
      borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' as const,
    }
    const TD_NUM: React.CSSProperties = {
      padding: '10px 12px', textAlign: 'center' as const, fontSize: 13,
      color: 'var(--medium-gray)', borderBottom: '1px solid var(--border-color)',
      borderLeft: '1px solid var(--border-color)',
    }
    const TD_ACTIVE_GREEN: React.CSSProperties = {
      padding: '10px 12px', textAlign: 'center' as const, fontWeight: 800, fontSize: 14,
      color: '#166534', background: '#dcfce7',
      borderBottom: '1px solid var(--border-color)', borderLeft: '1px solid var(--border-color)',
    }
    const TD_ACTIVE_PURPLE: React.CSSProperties = {
      padding: '10px 12px', textAlign: 'center' as const, fontWeight: 800, fontSize: 14,
      color: '#4c1d95', background: '#ede9fe',
      borderBottom: '1px solid var(--border-color)', borderLeft: '1px solid var(--border-color)',
    }

    return (
      <>
        {/* KPIs superiores */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { v: territorialO2Rules.length, label: 'Reglas',        color: COLOR },
            { v: `${totalVentas} uds.`,     label: 'Ventas Marta', color: '#0891B2' },
            { v: fmt(grandTotal),           label: 'Bono Total O2', color: '#10b981' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', border: `1px solid ${k.color}40`, borderRadius: 10, padding: '11px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: k.color }}>{k.v}</span>
              <span style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</span>
            </div>
          ))}
        </div>

        {territorialO2Rules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', color: 'var(--medium-gray)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No hay reglas configuradas para este per\u00edodo.</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Conf\u00edguralas en Entrada de Datos \u2192 TERRITORIAL O2 MOVILFREE</div>
          </div>
        ) : ruleRows.map((row: any, rIdx: number) => (
          <div key={rIdx} style={{ marginBottom: 32 }}>
            {/* Cabecera de bloque */}
            <div style={{ background: `${COLOR}10`, borderRadius: '12px 12px 0 0', padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${COLOR}30`, borderBottom: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: COLOR, color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 12px', borderRadius: 20 }}>TERRITORIAL O2 MOVILFREE</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--light-text)' }}>Bonos de cobro \u2014 Marta</span>
                <span style={{ fontSize: 12, color: 'var(--medium-gray)' }}>Tramo activo en verde \u2713</span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#10b981' }}>COMISI\u00d3N TOTAL: {fmt(row.totalBono)}</span>
            </div>

            {/* Tabla vertical */}
            <div style={{ overflowX: 'auto', border: `1px solid ${COLOR}30`, borderRadius: '0 0 12px 12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'var(--bg-card)' }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, textAlign: 'left' }}>Objetivo</th>
                    <th style={{ ...TH, textAlign: 'center' }}>Altas Fibra</th>
                    <th style={{ ...TH, textAlign: 'center' }}>Internas Altas Fibra</th>
                    <th style={{ ...TH, textAlign: 'center' }}>Bonos</th>
                    <th style={{ ...TH, textAlign: 'center', background: '#166534' }}>Conseguido</th>
                    <th style={{ ...TH, textAlign: 'center' }}>UDS.</th>
                    <th style={{ ...TH, textAlign: 'center', borderRight: 'none' }}>Comisi\u00f3n</th>
                  </tr>
                </thead>
                <tbody>
                  {TRAMOS_MES.map((t, tIdx) => {
                    const bonoVal  = parseNum(row.rule.tramosMes?.[t.key])
                    const isActive = row.activeMesKey === t.key
                    const rowBg    = tIdx % 2 === 0 ? 'transparent' : `${COLOR}04`
                    return (
                      <tr key={t.key} style={{ background: rowBg }}>
                        <td style={{ ...TD_OBJ, fontWeight: isActive ? 800 : 600, color: isActive ? '#0f172a' : 'var(--light-text)' }}>{t.label}</td>
                        <td style={{ ...TD_NUM }}>
                          {isActive && row.altasFibra > 0 ? <span style={{ fontWeight: 700, color: '#0f172a' }}>{row.altasFibra}</span> : ''}
                        </td>
                        <td style={{ ...TD_NUM }}>
                          {isActive && row.internasFibra > 0 ? <span style={{ fontWeight: 700, color: '#0f172a' }}>{row.internasFibra}</span> : ''}
                        </td>
                        <td style={{ ...TD_NUM, color: bonoVal > 0 ? '#334155' : '#d1d5db' }}>
                          {bonoVal > 0 ? fmt(bonoVal) : '\u2014'}
                        </td>
                        <td style={isActive && bonoVal > 0 ? TD_ACTIVE_GREEN : { ...TD_NUM, color: '#d1d5db' }}>
                          {isActive && bonoVal > 0 ? fmt(bonoVal) : ''}
                        </td>
                        <td style={{ ...TD_NUM }}>
                          {isActive ? <span style={{ fontWeight: 800, color: COLOR }}>{row.totalSales}</span> : ''}
                        </td>
                        <td style={{ ...TD_NUM, fontWeight: isActive ? 800 : 400, color: isActive && bonoVal > 0 ? '#166534' : '#d1d5db', borderRight: 'none' }}>
                          {isActive && bonoVal > 0 ? fmt(bonoVal) : ''}
                        </td>
                      </tr>
                    )
                  })}

                  <tr><td colSpan={7} style={{ height: 2, background: `${COLOR}20`, padding: 0 }} /></tr>

                  {TRAMOS_TRIM.map((t, tIdx) => {
                    const bonoVal  = parseNum(row.rule.tramosTrim?.[t.key])
                    const isActive = row.activeTrimKey === t.key
                    const rowBg    = (TRAMOS_MES.length + tIdx) % 2 === 0 ? 'transparent' : `${COLOR}04`
                    return (
                      <tr key={t.key} style={{ background: rowBg }}>
                        <td style={{ ...TD_OBJ, fontWeight: isActive ? 800 : 600, color: isActive ? '#0f172a' : 'var(--light-text)' }}>{t.label}</td>
                        <td style={{ ...TD_NUM }}></td>
                        <td style={{ ...TD_NUM }}></td>
                        <td style={{ ...TD_NUM, color: bonoVal > 0 ? '#334155' : '#d1d5db' }}>
                          {bonoVal > 0 ? fmt(bonoVal) : '\u2014'}
                        </td>
                        <td style={isActive && bonoVal > 0 ? TD_ACTIVE_GREEN : { ...TD_NUM, color: '#d1d5db' }}>
                          {isActive && bonoVal > 0 ? fmt(bonoVal) : ''}
                        </td>
                        <td style={{ ...TD_NUM }}></td>
                        <td style={{ ...TD_NUM, fontWeight: isActive ? 800 : 400, color: isActive && bonoVal > 0 ? '#166534' : '#d1d5db', borderRight: 'none' }}>
                          {isActive && bonoVal > 0 ? fmt(bonoVal) : ''}
                        </td>
                      </tr>
                    )
                  })}

                  {(() => {
                    const bonoVal  = parseNum(row.rule.conectividad)
                    const isActive = row.conectividad > 0
                    const rowBg    = (TRAMOS_MES.length + TRAMOS_TRIM.length) % 2 === 0 ? 'transparent' : `${COLOR}04`
                    return (
                      <tr style={{ background: rowBg }}>
                        <td style={{ ...TD_OBJ, fontWeight: isActive ? 800 : 600 }}>Conect.</td>
                        <td style={{ ...TD_NUM }}></td>
                        <td style={{ ...TD_NUM }}></td>
                        <td style={{ ...TD_NUM, color: bonoVal > 0 ? '#334155' : '#d1d5db' }}>
                          {bonoVal > 0 ? fmt(bonoVal) : '\u2014'}
                        </td>
                        <td style={isActive ? TD_ACTIVE_PURPLE : { ...TD_NUM, color: '#d1d5db' }}>
                          {isActive ? fmt(bonoVal) : ''}
                        </td>
                        <td style={{ ...TD_NUM }}></td>
                        <td style={{ ...TD_NUM, fontWeight: isActive ? 800 : 400, color: isActive ? '#4c1d95' : '#d1d5db', borderRight: 'none' }}>
                          {isActive ? fmt(bonoVal) : ''}
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${COLOR}40`, background: `${COLOR}08` }}>
                    <td colSpan={6} style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--medium-gray)', fontSize: 13 }}>
                      TOTAL \u2014 {ruleRows.length} regla{ruleRows.length !== 1 ? 's' : ''} \u00b7 {totalVentas} ventas de Marta
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', borderLeft: '1px solid var(--border-color)', borderRight: 'none' }}>
                      <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 900, fontSize: 17, borderRadius: 8, padding: '5px 16px' }}>{fmt(grandTotal)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}
      </>
    )
  }

  // ── Extras tab content (separate render path) ────────────────────────
  const renderExtrasTab = () => {
    const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
    };

    const formatPercent = (val: number) => {
      return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val) + '%';
    };

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
                    { label: 'CUOTA TOTAL (€)',  right: true  },
                    { label: 'COMISIÓN',         right: true  },
                    
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
        {/* TABLA TERRITORIAL PDV MIRROR */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: 'rgba(2, 132, 199, 0.08)', borderRadius: '12px 12px 0 0', border: '1px solid rgba(2, 132, 199, 0.25)', borderBottom: 'none' }}>
            <span style={{ background: '#0284c7', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: 1 }}>TERRITORIAL PDV</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--light-text)' }}>Cálculo y auditoría del tramo territorial consolidado para los puntos de venta</span>
          </div>
          <div style={{ 
            backgroundColor: 'var(--bg-card)', 
            borderRadius: '0 0 12px 12px', 
            border: '1px solid var(--border-color)', 
            overflow: 'hidden', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ 
                  background: 'linear-gradient(90deg, #0ea5e9, #0284c7)', 
                  color: 'white',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Negocio</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Palanca</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Objetivos</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center', fontSize: '10px', whiteSpace: 'normal', lineHeight: 1.1 }}>Tramo 1<br/>(&gt;=100% y &lt;115%)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center', fontSize: '10px', whiteSpace: 'normal', lineHeight: 1.1 }}>Tramo 2<br/>(&gt;=115% y &lt;130%)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center', fontSize: '10px', whiteSpace: 'normal', lineHeight: 1.1 }}>Tramo 3<br/>(&gt;=130%)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center', fontSize: '10px', whiteSpace: 'normal', lineHeight: 1.1 }}>Bonificación<br/>(&gt;=100%)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Ventas</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Porcentaje Ventas</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {calculatedRows.map((row) => {
                  const isValueObjective = row.key === 'rent_disp_seguros';
                  const isBafConvMsDisp = row.key === 'baf_conv_ms_disp';

                  const displayObj = isBafConvMsDisp
                    ? '-' 
                    : (isValueObjective ? formatCurrency(row.objetivo) : row.objetivo);
                  
                  const displaySales = isValueObjective
                    ? formatCurrency(row.ventas)
                    : row.ventas;

                  const displayPct = isBafConvMsDisp || row.objetivo > 0
                    ? formatPercent(row.pct)
                    : '-';

                  const hasEarned = row.importe > 0;

                  return (
                    <tr 
                      key={row.key} 
                      style={{ 
                        borderBottom: '1px solid var(--border-color)', 
                        backgroundColor: 'transparent'
                      }}
                    >
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--medium-gray)' }}>{row.negocio}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--light-text)' }}>{row.palanca}</td>
                      
                      <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--light-text)' }}>
                        {displayObj}
                      </td>
                      
                      <td style={{ padding: '9px 12px', textAlign: 'center', color: row.tramoAplicado.includes('Tramo 1') ? '#10b981' : 'var(--medium-gray)', fontWeight: row.tramoAplicado.includes('Tramo 1') ? 700 : 400 }}>
                        {row.t1Raw}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', color: row.tramoAplicado.includes('Tramo 2') ? '#10b981' : 'var(--medium-gray)', fontWeight: row.tramoAplicado.includes('Tramo 2') ? 700 : 400 }}>
                        {row.t2Raw}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', color: row.tramoAplicado.includes('Tramo 3') ? '#10b981' : 'var(--medium-gray)', fontWeight: row.tramoAplicado.includes('Tramo 3') ? 700 : 400 }}>
                        {row.t3Raw}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', color: row.tramoAplicado.includes('Bonif') ? '#10b981' : 'var(--medium-gray)', fontWeight: row.tramoAplicado.includes('Bonif') ? 700 : 400 }}>
                        {row.bonifRaw}
                      </td>

                      <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#00ADEF' }}>
                        {displaySales}
                      </td>
                      
                      <td style={{ 
                        padding: '9px 12px', 
                        textAlign: 'center', 
                        fontWeight: 800, 
                        color: row.pct >= 100 ? '#10b981' : (row.pct > 0 ? '#f59e0b' : 'var(--medium-gray)')
                      }}>
                        {displayPct}
                      </td>
                      
                      <td style={{ 
                        padding: '9px 12px', 
                        textAlign: 'right', 
                        fontWeight: 900, 
                        color: hasEarned ? '#10b981' : 'var(--medium-gray)',
                        fontSize: '13px',
                        backgroundColor: hasEarned ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
                      }}>
                        {formatCurrency(row.importe)}
                      </td>
                    </tr>
                  )
                })}

                <tr style={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  borderTop: '2px solid var(--border-color)',
                  fontWeight: 800
                }}>
                  <td colSpan={2} style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--light-text)' }}>Total Consolidado Tiendas</td>
                  <td colSpan={7}></td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: '14px', color: '#10b981', fontWeight: 900 }}>
                    {formatCurrency(totalImporteTerritorial)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { v: extraAssignments.length, label: 'PRV Territorial Tiendas totales', color: '#10b981' },
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
            <div style={{ fontSize: 16, fontWeight: 600 }}>No hay incentivos o cálculos para PRV Territorial Tiendas.</div>
          </div>
        ) : (
          <>
            {renderExtraSection(extrasPlus,   'Canal Plus',   'PLUS',   '#00ADEF')}
            {renderExtraSection(extrasBasico, 'Canal Básico', 'BÁSICO', '#F59E0B')}
            {/* Grand total */}
            <div style={{ marginTop: 8, padding: '18px 28px', background: 'rgba(16,185,129,0.08)', border: '2px solid rgba(16,185,129,0.3)', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--medium-gray)', marginBottom: 2 }}>⚡ PRV Territorial Tiendas — GRAN TOTAL</div>
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

    const flatMode = tab.id === 'prepago' || tab.id === 'varios'
    const dedupeInfo = tab.id === 'contratos_movil' || tab.id === 'rent'
    const exportRows: any[] = []
    const nifGroups = groupSalesByNif(tabSales)

    const getSaleCuotaTotalLocal = (s: any) => {
      return getSaleCuotaTotal(s)
    }

    const getSaleComisionLocal = (s: any) => {
      return getCommission(s)
    }

    nifGroups.forEach(group => {
      if (flatMode) {
        group.sales.forEach((s: any) => {
          exportRows.push({
            Grupo: `${tab.emoji} ${tab.label}`,
            NIF: group.nif || '—',
            Empresa: group.nombre || '—',
            'Fecha Tram.': s.fecha || '—',
            Telefono: s.telf || '—',
            'Nº Pedido': s.numeroPedido || '—',
            Codigo: s.codigo || '—',
            Comercial: s.vendedor || '—',
            Producto: s.producto || '—',
            Uds: 1,
            'Cuota Total (€)': fmtN(getSaleCuotaTotalLocal(s)),
            Comisión: fmtN(getSaleComisionLocal(s))
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

          const cuotaSum = pg.sales.reduce((acc, s) => acc + getSaleCuotaTotalLocal(s), 0)
          const comisionSum = pg.sales.reduce((acc, s) => acc + getSaleComisionLocal(s), 0)

          exportRows.push({
            Grupo: `${tab.emoji} ${tab.label}`,
            NIF: group.nif || '—',
            Empresa: group.nombre || '—',
            'Fecha Tram.': fechas.length > 0 ? fechas.join(', ') : '—',
            Telefono: telefons.length > 0 ? telefons.join(', ') : '—',
            'Nº Pedido': Array.from(new Set(pg.sales.map((s: any) => s.numeroPedido).filter(Boolean))).join(', ') || '—',
            Codigo: first.codigo || '—',
            Comercial: first.vendedor || '—',
            Producto: first.producto || '—',
            Uds: pg.sales.length,
            'Cuota Total (€)': fmtN(cuotaSum),
            Comisión: fmtN(comisionSum)
          })
        })
      }
    })

    return exportRows
  }

  // Excel sheet names helper
  const safeSheet = (name: string) =>
    name.replace(/[\/\\*?\:\[\]]/g, '-').replace(/[^\x20-\x7E]/g, '').slice(0, 31).trim() || 'Hoja'

  // Helper para generar una pestaña de operaciones estilizada
  const addStyledSalesSheet = (workbook: ExcelJS.Workbook, sheetName: string, rows: any[], tabLabel: string) => {
    const sheet = workbook.addWorksheet(sheetName)
    sheet.views = [{ showGridLines: true }]

    // Definir columnas
    sheet.columns = [
      { header: 'Grupo', key: 'Grupo', width: 22 },
      { header: 'NIF', key: 'NIF', width: 14 },
      { header: 'Empresa', key: 'Empresa', width: 28 },
      { header: 'Fecha Tram.', key: 'Fecha Tram.', width: 15 },
      { header: 'Teléfono', key: 'Telefono', width: 16 },
      { header: 'Nº Pedido', key: 'Nº Pedido', width: 16 },
      { header: 'Código', key: 'Codigo', width: 12 },
      { header: 'Comercial', key: 'Comercial', width: 20 },
      { header: 'Producto', key: 'Producto', width: 26 },
      { header: 'Uds', key: 'Uds', width: 8 },
      { header: 'Cuota Total (€)', key: 'Cuota Total (€)', width: 18 },
      { header: 'Comisión', key: 'Comisión', width: 18 }
    ]

    // Formato de cabecera
    const headerRow = sheet.getRow(1)
    headerRow.height = 30
    headerRow.eachCell(cell => {
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00ADEF' } }
      const rightAlign = ['Uds', 'Cuota Total (€)', 'Comisión'].includes(cell.value as string)
      const centerAlign = ['NIF', 'Fecha Tram.', 'Teléfono', 'Código'].includes(cell.value as string)
      cell.alignment = {
        vertical: 'middle',
        horizontal: rightAlign ? 'right' : (centerAlign ? 'center' : 'left')
      }
    })

    if (rows.length === 0) {
      const dataRow = sheet.addRow({
        Grupo: tabLabel,
        NIF: 'Sin operaciones',
        Empresa: '',
        'Fecha Tram.': '',
        Telefono: '',
        Codigo: '',
        Comercial: '',
        Producto: '',
        Uds: 0,
        'Cuota Total (€)': 0,
        Comisión: 0
      })
      dataRow.height = 22
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 10 }
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : (colNumber === 2 ? 'center' : 'left') }
      })
      return
    }

    let totalUds = 0
    let totalCuota = 0
    let totalComision = 0

    // Agregar filas de datos
    rows.forEach(r => {
      totalUds += Number(r.Uds || 0)
      totalCuota += Number(r['Cuota Total (€)'] || 0)
      totalComision += Number(r['Comisión'] || 0)
      sheet.addRow(r)
    })

    // Estilos de filas
    const currencyFmt = '#,##0.00" €";-#,##0.00" €";"-   €"'
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return

      row.height = 22
      const isEven = rowNumber % 2 === 0

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 10 }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF9FAFB' : 'FFFFFFFF' }
        }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
        
        const rightAlign = colNumber >= 9
        const centerAlign = [2, 4, 5, 6].includes(colNumber)
        cell.alignment = {
          vertical: 'middle',
          horizontal: rightAlign ? 'right' : (centerAlign ? 'center' : 'left')
        }

        if (colNumber === 9) {
          cell.numFmt = '#,##0'
        }
        if (colNumber === 10 || colNumber === 11) {
          cell.numFmt = currencyFmt
        }
      })
    })

    // Fila TOTAL de cierre
    const totalRow = sheet.addRow({
      Grupo: 'TOTAL',
      NIF: '',
      Empresa: '',
      'Fecha Tram.': '',
      Telefono: '',
      Codigo: '',
      Comercial: '',
      Producto: '',
      Uds: totalUds,
      'Cuota Total (€)': totalCuota,
      Comisión: totalComision
    })
    totalRow.height = 24
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F2FE' }
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF94A3B8' } }
      }
      
      const rightAlign = colNumber >= 9
      const centerAlign = [2, 4, 5, 6].includes(colNumber)
      cell.alignment = {
        vertical: 'middle',
        horizontal: rightAlign ? 'right' : (centerAlign ? 'center' : 'left')
      }

      if (colNumber === 9) {
        cell.numFmt = '#,##0'
      }
      if (colNumber === 10 || colNumber === 11) {
        cell.numFmt = currencyFmt
      }
    })
  }

  // Helper para generar pestaña de Extras estilizada
  const addStyledExtrasSheet = (workbook: ExcelJS.Workbook, sheetName: string, rows: any[]) => {
    const sheet = workbook.addWorksheet(sheetName)
    sheet.views = [{ showGridLines: true }]

    sheet.columns = [
      { header: 'Grupo', key: 'Grupo', width: 16 },
      { header: 'Comercial', key: 'Comercial', width: 20 },
      { header: 'Cliente', key: 'Cliente', width: 28 },
      { header: 'Regla', key: 'Regla', width: 24 },
      { header: 'Canal', key: 'Canal', width: 15 },
      { header: 'Importe Comercial', key: 'Importe Comercial', width: 20 }
    ]

    const headerRow = sheet.getRow(1)
    headerRow.height = 30
    headerRow.eachCell(cell => {
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00ADEF' } }
      const rightAlign = cell.value === 'Importe Comercial'
      cell.alignment = {
        vertical: 'middle',
        horizontal: rightAlign ? 'right' : 'left'
      }
    })

    if (rows.length === 0) {
      const dataRow = sheet.addRow({ Grupo: 'PRV Territorial Tiendas', Comercial: 'Sin extras' })
      dataRow.height = 22
      dataRow.eachCell(cell => {
        cell.font = { name: 'Segoe UI', size: 10 }
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
      })
      return
    }

    let totalImporte = 0
    rows.forEach(r => {
      totalImporte += Number(r['Importe Comercial'] || 0)
      sheet.addRow(r)
    })

    const currencyFmt = '#,##0.00" €";-#,##0.00" €";"-   €"'
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return

      row.height = 22
      const isEven = rowNumber % 2 === 0

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 10 }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF9FAFB' : 'FFFFFFFF' }
        }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
        
        const rightAlign = colNumber === 6
        cell.alignment = {
          vertical: 'middle',
          horizontal: rightAlign ? 'right' : 'left'
        }

        if (colNumber === 6) {
          cell.numFmt = currencyFmt
        }
      })
    })

    const totalRow = sheet.addRow({
      Grupo: 'TOTAL',
      Comercial: '',
      Cliente: '',
      Regla: '',
      Canal: '',
      'Importe Comercial': totalImporte
    })
    totalRow.height = 24
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F2FE' }
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF94A3B8' } }
      }
      
      const rightAlign = colNumber === 6
      cell.alignment = {
        vertical: 'middle',
        horizontal: rightAlign ? 'right' : 'left'
      }

      if (colNumber === 6) {
        cell.numFmt = currencyFmt
      }
    })
  }

  // Opción A — Una hoja por grupo
  const exportByGroup = async () => {
    const plusRows   = plusDash?.rows   || []
    const basicoRows = basicoDash?.rows || []
    const wb = new ExcelJS.Workbook()
    
    TABS.filter(t => t.id !== 'extras').forEach(t => {
      const rows = getTabExportRows(t, plusRows, basicoRows)
      addStyledSalesSheet(wb, safeSheet(t.label), rows, t.label)
    })
    
    // Pestaña de extras
    const extrasRows = extraAssignments.map((ea: any) => ({
      Grupo:    'PRV Territorial Tiendas',
      Comercial: ea.seller || '—',
      Cliente:   ea.customerName || '—',
      Regla:     ea.rule?.name || 'Extra Manual',
      Canal:     ea.rule?.channelType || '—',
      'Importe Comercial': ea.sellerRewardAmount || 0
    }))
    addStyledExtrasSheet(wb, 'PRV Territorial Tiendas', extrasRows)

    try {
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `OGC_PorGrupo_${periodLabel}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch(e) {
      console.error(e)
      alert("Error al exportar Excel")
    }
  }

  // Opción B — Todo en una sola hoja
  const exportAllInOne = async () => {
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
        Grupo: '⚡ PRV Territorial Tiendas',
        NIF: nif,
        Empresa: ea.customerName || '—',
        'Fecha Tram.': fch,
        Telefono: telf,
        Codigo: cod,
        Comercial: ea.seller || '—',
        Producto: ea.rule?.name || 'Extra Manual',
        Uds: 1,
        'Cuota Total (€)': 0,
        Comisión: ea.telecomRewardAmount || 0
      })
    })

    const wb = new ExcelJS.Workbook()
    addStyledSalesSheet(wb, 'Todas las Operaciones', allRows, 'Todas')

    try {
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `OGC_TodoJunto_${periodLabel}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch(e) {
      console.error(e)
      alert("Error al exportar Excel")
    }
  }

  // Opción C — Resumen por grupo (Hoja de Resumen Estilizada Premium)
  const exportSummary = async () => {
    const wb = new ExcelJS.Workbook()
    const sheet = wb.addWorksheet('Resumen')
    sheet.views = [{ showGridLines: true }]

    // Configurar columnas y anchos premium
    sheet.columns = [
      { header: 'Grupo', key: 'grupo', width: 30 },
      { header: 'Nº Ventas', key: 'ventas', width: 15 },
      { header: 'Cuota Total (€)', key: 'cuota', width: 22 },
      { header: 'Comisión', key: 'comision', width: 22 }
    ]

    // Formato de la cabecera
    const headerRow = sheet.getRow(1)
    headerRow.height = 30
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00ADEF' } }
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 ? 'left' : (colNumber === 2 ? 'center' : 'right')
      }
    })

    let totalVentas = 0
    let totalCuotas = 0
    let totalComisiones = 0

    // Cargar datos
    TABS.filter(t => t.id !== 'extras').forEach(t => {
      const tabSls = sales.filter((s: any) => filterByTab(s, t.id))
      const cuotaSum = tabSls.reduce((acc, s) => acc + getSaleCuotaTotal(s), 0)
      const comisionSum = tabSls.reduce((acc, s) => acc + getCommission(s), 0)

      totalVentas += tabSls.length
      totalCuotas += cuotaSum
      totalComisiones += comisionSum

      sheet.addRow({
        grupo: `${t.emoji} ${t.label}`,
        ventas: tabSls.length,
        cuota: cuotaSum,
        comision: comisionSum
      })
    })

    // Fila de Extras
    const extrasVentas = extraAssignments.length
    const extrasTotal = extraAssignments.reduce((a: number, e: any) => a + (e.telecomRewardAmount || 0), 0)

    totalVentas += extrasVentas
    totalComisiones += extrasTotal

    sheet.addRow({
      grupo: '⚡ PRV Territorial Tiendas',
      ventas: extrasVentas,
      cuota: 0,
      comision: extrasTotal
    })

    // Dar estilo a las filas de datos
    const currencyFmt = '#,##0.00" €";-#,##0.00" €";"-   €"'
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return

      row.height = 22
      const isEven = rowNumber % 2 === 0

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 10 }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF9FAFB' : 'FFFFFFFF' }
        }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 1 ? 'left' : (colNumber === 2 ? 'center' : 'right')
        }

        if (colNumber === 3 || colNumber === 4) {
          cell.numFmt = currencyFmt
        }
      })
    })

    // Fila de TOTALES
    const totalRow = sheet.addRow({
      grupo: 'TOTAL',
      ventas: totalVentas,
      cuota: totalCuotas,
      comision: totalComisiones
    })
    totalRow.height = 24
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F2FE' }
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF94A3B8' } }
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 ? 'left' : (colNumber === 2 ? 'center' : 'right')
      }

      if (colNumber === 3 || colNumber === 4) {
        cell.numFmt = currencyFmt
      }
    })

    try {
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `OGC_Resumen_${periodLabel}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch(e) {
      console.error(e)
      alert("Error al exportar Excel")
    }
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
              Ventas agrupadas por NIF con desglose por producto. 
            </p>
          </div>
        }
      />

      {/* ── Botones de exportación Excel y Totalizadores Globales ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: <><ExcelIcon size={16} /> Hoja por Grupo</>, desc: 'Una pestaña por cada grupo', fn: exportByGroup, color: '#107c41' },
            { label: <><ExcelIcon size={16} /> Todo en Una Hoja</>, desc: 'Todas las ventas juntas con columna Grupo', fn: exportAllInOne, color: '#107c41' },
            { label: <><ExcelIcon size={16} /> Resumen</>, desc: 'Totales por grupo: ventas, cuota y tramo', fn: exportSummary, color: '#107c41' },
            { label: <><ExcelIcon size={16} /> Revisión ERP</>, desc: 'Excel para mi-nuevo-erp: una fila por operación, una hoja por palanca', fn: exportRevisionERP, color: '#0284C7' },
          ].map((btn, i) => (
            <button key={i} onClick={btn.fn} title={btn.desc} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 10, border: `1px solid ${btn.color}40`,
              background: `${btn.color}12`, color: btn.color,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = `${btn.color}22`; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = `${btn.color}12`; e.currentTarget.style.transform = 'none' }}
            >
              {btn.label}
            </button>
          ))}
          <span style={{ fontSize: 11, color: 'var(--medium-gray)', marginLeft: 8 }}>
            Exportar todas las operaciones de {periodLabel}
          </span>
        </div>

        {/* Totalizadores Globales de la Página */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0.15) 100%)',
            border: '1px solid rgba(37, 99, 235, 0.25)',
            borderRadius: 12, padding: '8px 16px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.04)',
            display: 'flex', flexDirection: 'column', minWidth: 155
          }}>
            <span style={{ fontSize: 10, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Cuota Total (€)</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#2563eb', marginTop: 2 }}>{fmt(globalCuotaTotal)}</span>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.15) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 12, padding: '8px 16px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.04)',
            display: 'flex', flexDirection: 'column', minWidth: 155
          }}>
            <span style={{ fontSize: 10, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Comisión Periodo</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#10b981', marginTop: 2 }}>{fmt(globalComisionTotal)}</span>
          </div>
        </div>
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
              transition: 'all 0.15s' }}>
              {t.emoji} {t.label}
              {active && count > 0 && (
                <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 20, fontSize: 11, fontWeight: 800, padding: '1px 7px' }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Aviso de ventas huérfanas (sin pestaña reconocida) ── */}
      {!loading && ventasHuerfanas.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.12)', border: '1px solid #F59E0B', borderRadius: 10,
          padding: '10px 16px', marginBottom: 16, fontSize: 13, color: 'var(--light-text)'
        }}>
          ⚠️ <strong>{ventasHuerfanas.length} venta{ventasHuerfanas.length > 1 ? 's' : ''} sin pestaña reconocida</strong> — no aparecen en totales ni exportaciones.
          Detalle: {Array.from(new Set(ventasHuerfanas.map((s: any) => `"${s.detalle || s.categoria || '(vacío)'}"`))).join(', ')}.
          {' '}Cliente{ventasHuerfanas.length > 1 ? 's' : ''}: {Array.from(new Set(ventasHuerfanas.map((s: any) => s.nif || s.nombreCliente || '—'))).slice(0, 6).join(', ')}.
          Corrige su categoría desde el Registro de Operaciones.
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--medium-gray)' }}>Cargando operaciones...</div>
      ) : activeTab === 'bonos_o2' ? renderBonosO2Tab() : activeTab === 'extras' ? renderExtrasTab() : tabSales.length === 0 ? (
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
              <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--light-text)' }}>{fmt(grandComisionesTotal)}</span>
              <span style={{ fontSize: 12, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Comisiones</span>
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
              if (!info || (info.pje === 0 && info.tramoVal === 0)) return null
              const pje = info.pje || 0
              const isPercentage = info.isPercentage

              const TRAMOS = [
                { p: 50, label: '< 50%', col: '#EF4444', bg: '#FEE2E2' },
                { p: 80, label: '50-80%', col: '#F59E0B', bg: '#FEF3C7' },
                { p: 100, label: '80-100%', col: '#10B981', bg: '#D1FAE5' },
                { p: 999, label: '> 100%', col: '#3B82F6', bg: '#DBEAFE' }
              ]
              
              const tramoLabel = pje < 50 ? TRAMOS[0] : pje < 80 ? TRAMOS[1] : pje <= 100 ? TRAMOS[2] : TRAMOS[3]
              const activeColor = tramoLabel.col
              const activeBg = tramoLabel.bg
              const barPct = Math.min(pje, 130)

              return (
                <div style={{ flex: 1, minWidth: '100%', background: '#fff', border: `1px solid ${color}40`, borderRadius: 16, padding: '24px 32px', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                  
                  {/* Top Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ background: color, color: '#fff', fontSize: 13, fontWeight: 800, padding: '4px 12px', borderRadius: 20, letterSpacing: 1 }}>{label}</span>
                        <span style={{ fontSize: 15, color: 'var(--medium-gray)', fontWeight: 500 }}>Estado del Tramo</span>
                      </div>
                      <div style={{ marginTop: 12, fontSize: 16, color: 'var(--medium-gray)' }}>
                        Liquidación actual: <strong style={{ color }}>{info.tramoVal}{isPercentage ? '%' : '€/ud'}</strong>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, color: 'var(--medium-gray)', marginBottom: 4 }}>Pago de este grupo</div>
                      <div style={{ fontSize: 32, fontWeight: 900, color }}>{fmt(tramoAmt)}</div>
                    </div>
                  </div>

                  {/* Percentage Row */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 28, marginBottom: 32 }}>
                    <span style={{ fontSize: 56, fontWeight: 900, color: activeColor, letterSpacing: -1, lineHeight: 1 }}>{pje.toFixed(1)}%</span>
                    <span style={{ fontSize: 16, color: 'var(--medium-gray)', fontWeight: 500 }}>cumplimiento actual</span>
                    <span style={{ marginLeft: 'auto', background: activeBg, color: activeColor, border: `1px solid ${activeColor}40`, padding: '8px 20px', borderRadius: 24, fontWeight: 700, fontSize: 14 }}>
                      Tramo {tramoLabel.label}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ position: 'relative', marginBottom: 48 }}>
                    {/* Background segments */}
                    <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ width: '38.4%', background: '#FEE2E2', borderRight: '2px solid #fff' }} /> {/* 0-50% */}
                      <div style={{ width: '23.1%', background: '#FEF3C7', borderRight: '2px solid #fff' }} /> {/* 50-80% */}
                      <div style={{ width: '15.4%', background: '#D1FAE5', borderRight: '2px solid #fff' }} /> {/* 80-100% */}
                      <div style={{ width: '23.1%', background: '#DBEAFE' }} /> {/* >100% */}
                    </div>
                    
                    {/* Fill */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: `${(barPct / 130) * 100}%`, height: 14, borderRadius: 8, background: `linear-gradient(90deg, ${activeColor}99, ${activeColor})`, transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: `0 2px 10px ${activeColor}50` }} />
                    
                    {/* Markers */}
                    <div style={{ position: 'absolute', top: 22, left: 0, fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600 }}>0%</div>
                    <div style={{ position: 'absolute', top: 22, left: '38.4%', transform: 'translateX(-50%)', fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600 }}>50%</div>
                    <div style={{ position: 'absolute', top: 22, left: '61.5%', transform: 'translateX(-50%)', fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600 }}>80%</div>
                    <div style={{ position: 'absolute', top: 22, left: '76.9%', transform: 'translateX(-50%)', fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600 }}>100%</div>
                    <div style={{ position: 'absolute', top: 22, right: 0, fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600 }}>+</div>
                  </div>

                  {/* Tramos Boxes */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
                    {TRAMOS.map((t, i) => {
                      const isActive = (i === 0 && pje < 50) || (i === 1 && pje >= 50 && pje < 80) || (i === 2 && pje >= 80 && pje <= 100) || (i === 3 && pje > 100)
                      return (
                        <div key={i} style={{
                          background: isActive ? t.bg : '#f8fafc',
                          border: isActive ? `2px solid ${t.col}` : '1px solid #e2e8f0',
                          borderRadius: 12, padding: '16px 8px', textAlign: 'center',
                          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                          height: 70
                        }}>
                          <div style={{ fontSize: 15, color: isActive ? t.col : 'var(--medium-gray)', fontWeight: isActive ? 800 : 500 }}>{t.label}</div>
                          {isActive && <div style={{ fontSize: 12, color: t.col, fontWeight: 900, marginTop: 4 }}>← AQUÍ</div>}
                        </div>
                      )
                    })}
                  </div>

                  {/* Footer Base de Cálculo */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20, fontSize: 14, color: 'var(--medium-gray)' }}>
                    Base de cálculo: <strong style={{ color: '#1e293b', fontSize: 15 }}>{fmt(totalImporte)}</strong>
                  </div>
                </div>
              )
            }
            return (
              <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexDirection: 'column' }}>
                {renderCard(plusInfo,   'PLUS',   '#00ADEF', plusTotal,   plusTramoAmt,   plusTramoProyectado)}
                {renderCard(basicoInfo, 'BÁSICO', '#F59E0B', basicoTotal, basicoTramoAmt, basicoTramoProyectado)}
              </div>
            )
          })()}

          {/* ── Sections ── */}
          <SectionTable 
            label="Código Plus" 
            badge="PLUS" 
            badgeColor="#00ADEF" 
            groups={plusGroups} 
            tabColor={tab.color} 
            isRent={tab.id === 'rent' || tab.id === 'seguro'}
            tabId={tab.id}
            calcCommission={getCommission}
            calcImporte={getSaleCuotaTotal}
            showCuotaTotal={showCuotaTotal}
          />
          <SectionTable 
            label="Código Básico" 
            badge="BÁSICO" 
            badgeColor="#F59E0B" 
            groups={basicoGroups} 
            tabColor={tab.color} 
            isRent={tab.id === 'rent' || tab.id === 'seguro'}
            tabId={tab.id}
            calcCommission={getCommission}
            calcImporte={getSaleCuotaTotal}
            showCuotaTotal={showCuotaTotal}
          />
          <SectionTable 
            label="Otros Códigos" 
            badge="OTROS" 
            badgeColor="#6B7280" 
            groups={otrosGroups} 
            tabColor={tab.color} 
            isRent={tab.id === 'rent' || tab.id === 'seguro'}
            tabId={tab.id}
            calcCommission={getCommission}
            calcImporte={getSaleCuotaTotal}
            showCuotaTotal={showCuotaTotal}
          />

          {/* ── Grand total ── */}
          <div style={{ marginTop: 8, padding: '18px 28px', background: `${tab.color}15`, border: `2px solid ${tab.color}40`, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--medium-gray)', marginBottom: 2 }}>{tab.emoji} {tab.label} — COMISIONES</div>
              <div style={{ fontSize: 12, color: 'var(--medium-gray)' }}>{tabSales.length} operaciones · {uniqueNifs} clientes</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: 'var(--medium-gray)', marginBottom: 2 }}>Total comisiones</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: tab.color }}>{fmt(grandComisionesTotal)}</div>
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
