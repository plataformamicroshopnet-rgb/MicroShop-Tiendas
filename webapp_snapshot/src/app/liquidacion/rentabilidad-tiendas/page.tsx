'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, User, ChevronDown, ChevronUp, BarChart2, Calendar, Wallet, ShoppingBag, Trophy } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { usePeriod } from '@/components/PeriodProvider'
import { renderDashboardData, isSolar360 } from '@/lib/salesUtils'
import { getSaleCommission } from '@/lib/saleCommission'
import { TIENDAS_COMERCIALES } from '@/lib/constants'
import { getEffectiveTiendaComerciales } from '@/lib/comercialRoster'
import { computeBonosO2 } from '@/lib/territorialConsolidado'

type GroupedSale = {
  fecha: string
  producto: string
  comision: number
  varios: string
  estado: string
}

const TIPOS_VENTA = [
  'Contratos Móvil', 'Rent', 'O2 MovilFree', 'Seguro', 'miMovistar',
  'Suscripciones TV', 'Varios', 'Repos', 'Resto BAF', 'Accesorios'
]

export default function RentabilidadTiendasPage() {
  const { activePeriodKey, availablePeriods } = usePeriod()
  const activePeriodObj = availablePeriods.find(p => p.period_key === activePeriodKey)
  const router = useRouter()

  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [catalogs, setCatalogs] = useState<any>({})

  const [pymeRows, setPymeRows] = useState<any[]>([])
  const [captadorRows, setCaptadorRows] = useState<any[]>([])

  const [movilFreeSales, setMovilFreeSales] = useState<any[]>([])
  const [movilFreeProducts, setMovilFreeProducts] = useState<any[]>([])
  const [territorialO2Rules, setTerritorialO2Rules] = useState<any[]>([])
  const [tiendaHours, setTiendaHours] = useState<any[]>([])

  const [expandedTiendas, setExpandedTiendas] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.keys(TIENDAS_COMERCIALES).forEach(t => { initial[t === 'O2' ? 'O2 MovilFree' : t] = true });
    return initial;
  })
  const [expandedCell, setExpandedCell] = useState<string | null>(null) // "Tienda-Comercial-Tipo"

  const toggleTienda = (tienda: string) => setExpandedTiendas(prev => ({ ...prev, [tienda]: !prev[tienda] }))
  const toggleCell = (key: string) => setExpandedCell(prev => prev === key ? null : key)

  const formatEuro = (val: number) => {
    return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const currentPeriodObj = availablePeriods.find(p => p.period_key === activePeriodKey)
        const periodStr = currentPeriodObj ? `${currentPeriodObj.year}${String(currentPeriodObj.month).padStart(2, '0')}` : ''

        if (!activePeriodKey) return;

        const [salesRes, catRes, pymeRes, plusRes, objRes, mfSalesRes, mfProductsRes, territorialRes, hoursRes] = await Promise.all([
          fetch(`/api/sales?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/catalogs?_t=${Date.now()}`).catch(() => null),
          fetch(`/api/importes-pyme?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/importes-plus?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/objetivos?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/movilfree/sales`).catch(() => null),
          fetch(`/api/movilfree/products`).catch(() => null),
          fetch(`/api/territorial?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({ o2: [] })),
          fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({ hours: [] }))
        ])

        const salesData = salesRes && salesRes.ok ? await salesRes.json() : { logs: [] }
        const catData = catRes && catRes.ok ? await catRes.json() : {}
        const pymeData = pymeRes && pymeRes.ok ? await pymeRes.json() : {}
        const plusData = plusRes && plusRes.ok ? await plusRes.json() : {}
        const objData = objRes && objRes.ok ? await objRes.json() : {}
        const mfSalesData = mfSalesRes && mfSalesRes.ok ? await mfSalesRes.json() : []
        const mfProductsData = mfProductsRes && mfProductsRes.ok ? await mfProductsRes.json() : []

        const fetchedSales = salesData.logs || []
        setSales(fetchedSales)
        setCatalogs(catData.catalogs || catData || {})
        setMovilFreeSales(Array.isArray(mfSalesData) ? mfSalesData : (mfSalesData.sales || mfSalesData.data || []))
        setMovilFreeProducts(Array.isArray(mfProductsData) ? mfProductsData : (mfProductsData.products || mfProductsData.data || []))
        setTerritorialO2Rules((territorialRes && territorialRes.o2) || [])
        setTiendaHours((hoursRes && hoursRes.hours) || [])

        const importesPyme = pymeData.importes || pymeData.data || []
        const importesPlus = plusData.importes || plusData.data || []
        const objetivosObj = objData.objetivos || { Pyme: {}, Captador: {} }
        const objGruposObj = objData.grupos || { Pyme: {}, Captador: {} }

        const parsedPyme = renderDashboardData('Pyme', importesPyme, objetivosObj.Pyme || {}, fetchedSales, objGruposObj.Pyme || {}, currentPeriodObj)
        const parsedCaptador = renderDashboardData('Captador', importesPlus, objetivosObj.Captador || {}, fetchedSales, objGruposObj.Captador || {}, currentPeriodObj)
        
        setPymeRows(parsedPyme.rows)
        setCaptadorRows(parsedCaptador.rows)
      } catch (err) {
        console.error('Error loading data for rentabilidad:', err)
      } finally {
        setLoading(false)
      }
    }

    if (activePeriodKey && availablePeriods.length > 0) {
      fetchData()
    }
  }, [activePeriodKey, availablePeriods])

  const matrixData = useMemo(() => {
    if (sales.length === 0 && !loading) {
       // We still want to show the matrix even if 0 sales!
    }

    const getCurrentMonthString = () => {
      const now = new Date()
      return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`
    }

    const viewingPeriod = activePeriodObj
      ? `${activePeriodObj.year}${String(activePeriodObj.month).padStart(2, '0')}`
      : getCurrentMonthString();

    // FUENTE ÚNICA de la comisión por venta: lib/saleCommission.getSaleCommission, la misma que
    // MOD, Resumen MOD, Liquidaciones y Operaciones por Grupo Cliente (incluye el +15 € de Swap).
    // Antes esta página replicaba el cálculo inline y se desviaba (se le olvidó el Swap -> 330 €).
    const salesWithCommission = sales.map(sale => {
      // Anuladas fuera (no cuentan como operación ni pagan), igual que la MOD.
      if (sale.anulado === 'Si' || sale.anulado === 'Sí' || sale.pendiente === 'Anulado') return null;
      // Solar360 fuera por completo (ni cuenta como operación ni paga).
      if (isSolar360(sale)) return null;
      // Solo el periodo visualizado (las ventas ya vienen strictPeriod; filtro defensivo).
      let saleMonth = '';
      if (sale.fecha) {
        const parts = String(sale.fecha).split('/');
        if (parts.length === 3) saleMonth = `${parts[2]}${parts[1]}`;
        else if (String(sale.fecha).includes('-')) {
          const p = String(sale.fecha).split('-');
          if (p.length >= 2) saleMonth = `${p[0]}${p[1]}`;
        }
      }
      if (saleMonth && saleMonth !== viewingPeriod) return null;

      const comisionReal = getSaleCommission(sale, {
        catalogs,
        dashRowsPlus: pymeRows,
        dashRowsBasico: captadorRows,
        viewingPeriod
      });
      return { ...sale, comisionReal };
    }).filter(Boolean) as any[]

    const result = Object.entries(getEffectiveTiendaComerciales(tiendaHours)).map(([tiendaName, comerciales]) => {
      const rows = comerciales.map(comercial => {
        const cells = {} as Record<string, { total: number, sales: any[] }>
        TIPOS_VENTA.forEach(t => cells[t] = { total: 0, sales: [] })
        return { nombre: comercial, cells, totalGlobal: 0, totalUdsGlobal: 0 }
      })
      
      const footerTotals = {} as Record<string, { total: number, uds: number }>
      TIPOS_VENTA.forEach(t => footerTotals[t] = { total: 0, uds: 0 })

      // La tienda "O2" (Marta) pasa a ser "O2 MovilFree": consolida TODAS las ventas O2 + margen MovilFree
      const displayName = tiendaName === 'O2' ? 'O2 MovilFree' : tiendaName
      return { nombre: displayName, rows, footerTotals, totalTienda: 0, totalTiendaUds: 0 }
    })

    salesWithCommission.forEach(s => {
      const vendedor = s.vendedor || 'Desconocido'
      const det = (s.detalle || '').toLowerCase()
      const isO2 = det === 'o2'

      // Todas las ventas O2 (de cualquier vendedor) se consolidan en la tienda "O2 MovilFree"
      let tiendaObj = isO2
        ? result.find(t => t.nombre === 'O2 MovilFree')
        : result.find(t => t.rows.some(r => r.nombre.toLowerCase() === vendedor.toLowerCase()))

      if (!tiendaObj) return;

      let tipo = 'Resto BAF'
      if (det === 'ti') tipo = 'Contratos Móvil'
      else if (det === 'tma' || det === 'rent') tipo = 'Rent'
      else if (det === 'o2') tipo = 'O2 MovilFree'
      else if (det === 'seguro') tipo = 'Seguro'
      else if (det === 'mimovistar') tipo = 'miMovistar'
      else if (det === 'suscripciones tv' || det === 'suscripcion tv') tipo = 'Suscripciones TV'
      else if (det === 'prepago') tipo = 'Prepago'
      else if (det === 'varios') tipo = 'Varios'
      else if (det === 'accesorios') tipo = 'Accesorios'
      else if (det === 'repos') tipo = 'Repos'

      // O2 de un vendedor que NO es el comercial de la tienda O2 (Marta) -> se consolidan
      // TODOS en una única fila "Ventas de Otras Tiendas" (Carmen y cualquier otra tienda).
      const esComercialO2 = TIENDAS_COMERCIALES['O2'].some(c => c.toLowerCase() === vendedor.toLowerCase())
      const rowName = (isO2 && !esComercialO2) ? 'Ventas de Otras Tiendas' : vendedor
      let row = tiendaObj.rows.find(r => r.nombre.toLowerCase() === rowName.toLowerCase())
      if (!row && isO2) {
        const cells = {} as Record<string, { total: number, sales: any[] }>
        TIPOS_VENTA.forEach(t => cells[t] = { total: 0, sales: [] })
        row = { nombre: rowName, cells, totalGlobal: 0, totalUdsGlobal: 0 }
        tiendaObj.rows.push(row)
      }
      if (row && row.cells[tipo]) {
          row.cells[tipo].sales.push(s)
          row.cells[tipo].total += s.comisionReal
          row.totalGlobal += s.comisionReal
          row.totalUdsGlobal += 1
          tiendaObj.footerTotals[tipo].total += s.comisionReal
          tiendaObj.footerTotals[tipo].uds += 1
          tiendaObj.totalTienda += s.comisionReal
          tiendaObj.totalTiendaUds += 1
      }
    })

    // ── Margen MovilFree del mes (ingreso sin IVA − coste). Suma € pero NO operaciones. ──
    const mfYear = activePeriodObj?.year
    const mfMonth = activePeriodObj?.month
    let movilFreeReal = 0
    if (mfYear && mfMonth) {
      movilFreeReal = movilFreeSales
        .filter((s: any) => {
          const d = new Date(s.fechaVenta)
          return s.estado === 'COMPLETADA' && d.getFullYear() === mfYear && (d.getMonth() + 1) === mfMonth
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
    }

    const o2Store = result.find(t => t.nombre === 'O2 MovilFree')
    if (o2Store && movilFreeReal !== 0) {
      const cells = {} as Record<string, { total: number, sales: any[] }>
      TIPOS_VENTA.forEach(t => cells[t] = { total: 0, sales: [] })
      cells['O2 MovilFree'].total = movilFreeReal
      // Es margen, no operaciones: totalUdsGlobal = 0 para no inflar el conteo de ventas
      o2Store.rows.push({ nombre: 'MovilFree Ventas', cells, totalGlobal: movilFreeReal, totalUdsGlobal: 0, esMargen: true } as any)
      o2Store.footerTotals['O2 MovilFree'].total += movilFreeReal
      o2Store.totalTienda += movilFreeReal
    }

    // ── PRV Territorial O2 (bono O2 del mes): fila propia, mismo valor que el "PRV Territorial
    // O2" del Resumen de Métricas MOD (computeBonosO2 sobre ventas raw). No suma operaciones. ──
    const bonosO2 = computeBonosO2(sales, territorialO2Rules)
    if (o2Store && bonosO2 !== 0) {
      const cells = {} as Record<string, { total: number, sales: any[] }>
      TIPOS_VENTA.forEach(t => cells[t] = { total: 0, sales: [] })
      cells['O2 MovilFree'].total = bonosO2
      o2Store.rows.push({ nombre: 'PRV Territorial O2', cells, totalGlobal: bonosO2, totalUdsGlobal: 0, esMargen: true } as any)
      o2Store.footerTotals['O2 MovilFree'].total += bonosO2
      o2Store.totalTienda += bonosO2
    }

    result.sort((a, b) => b.totalTienda - a.totalTienda)
    return result
  }, [sales, pymeRows, captadorRows, catalogs, activePeriodObj, movilFreeSales, movilFreeProducts, territorialO2Rules, tiendaHours])

  const globalTotal = matrixData.reduce((s, t) => s + t.totalTienda, 0)
  const globalUds = matrixData.reduce((s, t) => s + t.totalTiendaUds, 0)
  const nTiendasActivas = matrixData.filter(t => t.totalTiendaUds > 0).length
  const topTienda = matrixData[0]

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--mercedes-cyan)', fontWeight: 'bold' }}>Cargando Rentabilidad por Tiendas...</div>
  }

  return (
    <div style={{ padding: 20 }}>
      <PageHeader 
        title="Rentabilidad por Tiendas" 
        subtitle="Métricas globales de ventas y comisiones por sede."
        showBack={true}
        backFallback="/liquidacion"
      />

      {/* ── KPIs globales premium ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginTop: 20 }}>
        {[
          { icon: <Wallet size={24} color="#fff" />, label: 'Comisiones totales', value: formatEuro(globalTotal), grad: 'linear-gradient(135deg, #10b981, #059669)', glow: 'rgba(16,185,129,0.40)' },
          { icon: <ShoppingBag size={24} color="#fff" />, label: 'Ventas totales', value: String(globalUds), sub: 'operaciones', grad: 'linear-gradient(135deg, #0ea5e9, #2563eb)', glow: 'rgba(14,165,233,0.40)' },
          { icon: <Building2 size={24} color="#fff" />, label: 'Tiendas activas', value: String(nTiendasActivas), sub: `de ${matrixData.length}`, grad: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', glow: 'rgba(139,92,246,0.40)' },
          { icon: <Trophy size={24} color="#fff" />, label: 'Tienda líder', value: topTienda ? topTienda.nombre : '—', sub: topTienda ? formatEuro(topTienda.totalTienda) : '', subColor: '#f59e0b', grad: 'linear-gradient(135deg, #f59e0b, #d97706)', glow: 'rgba(245,158,11,0.40)' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -28, right: -28, width: 90, height: 90, borderRadius: '50%', background: k.glow, filter: 'blur(10px)', opacity: 0.55, pointerEvents: 'none' }} />
            <div style={{ width: 48, height: 48, borderRadius: 14, background: k.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 8px 18px -6px ${k.glow}` }}>{k.icon}</div>
            <div style={{ minWidth: 0, position: 'relative' }}>
              <div style={{ fontSize: 11, color: 'var(--medium-gray)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--light-text)', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.value}</div>
              {k.sub && <div style={{ fontSize: 12, color: k.subColor || 'var(--medium-gray)', fontWeight: 700 }}>{k.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {matrixData.map((tienda, idx) => {
          const share = globalTotal > 0 ? (tienda.totalTienda / globalTotal) * 100 : 0
          const medal = ['🥇', '🥈', '🥉'][idx]
          const rankBg = idx === 0 ? 'rgba(245,158,11,0.16)' : idx === 1 ? 'rgba(148,163,184,0.20)' : idx === 2 ? 'rgba(180,83,9,0.16)' : 'var(--section-bg)'
          const accent = idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : '#10b981'
          const open = expandedTiendas[tienda.nombre]
          // O2 MovilFree: solo columnas con datos (las 9 palancas genéricas no aplican a su negocio).
          const cols = tienda.nombre === 'O2 MovilFree'
            ? TIPOS_VENTA.filter(t => tienda.footerTotals[t].total !== 0 || tienda.footerTotals[t].uds !== 0)
            : TIPOS_VENTA
          return (
          <div key={tienda.nombre} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${accent}` }}>
            <div
              onClick={() => toggleTienda(tienda.nombre)}
              style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: open ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.01))' : 'transparent', borderBottom: open ? '1px solid var(--border-color)' : 'none', transition: 'background 0.2s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: medal ? 20 : 15, fontWeight: 900, background: rankBg, color: 'var(--medium-gray)', flexShrink: 0 }}>
                  {medal || `#${idx + 1}`}
                </div>
                <Building2 size={20} color="var(--medium-gray)" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--light-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tienda.nombre}</h3>
                  <div style={{ marginTop: 7, height: 5, width: '100%', maxWidth: 240, background: 'var(--section-bg)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(share, 100)}%`, background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{formatEuro(tienda.totalTienda)}</div>
                  <div style={{ fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600, marginTop: 3 }}>{tienda.totalTiendaUds} ventas · {share.toFixed(0)}% del total</div>
                </div>
                {open ? <ChevronUp size={22} color="#10b981" /> : <ChevronDown size={22} color="var(--medium-gray)" />}
              </div>
            </div>

            {expandedTiendas[tienda.nombre] && (
              <div style={{ overflowX: 'auto', padding: '10px 20px 20px 20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: cols.length >= 5 ? 1000 : 'auto' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--light-text)', position: 'sticky', left: 0, backgroundColor: 'var(--bg-card)', zIndex: 2 }}>Comercial</th>
                      {cols.map(t => (
                        <th key={t} style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--medium-gray)', fontWeight: 600 }}>{t}</th>
                      ))}
                      <th style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--light-text)', fontWeight: 800 }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tienda.rows.map(row => (
                      <React.Fragment key={row.nombre}>
                        <tr style={{ borderBottom: '1px solid var(--border-light)', transition: 'background-color 0.2s' }} className="table-row-hover">
                          <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--mercedes-cyan)', position: 'sticky', left: 0, backgroundColor: 'var(--bg-card)', zIndex: 1, borderRight: '1px solid var(--border-light)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <User size={14} />
                              {row.nombre}
                            </div>
                          </td>
                          {cols.map(t => {
                            const cell = row.cells[t]
                            const hasSales = cell.sales.length > 0
                            const cellKey = `${tienda.nombre}-${row.nombre}-${t}`
                            return (
                              <td 
                                key={t} 
                                onClick={() => hasSales ? toggleCell(cellKey) : null}
                                style={{ 
                                  padding: '12px 8px', 
                                  textAlign: 'right', 
                                  color: hasSales ? 'var(--light-text)' : 'var(--text-muted)',
                                  cursor: hasSales ? 'pointer' : 'default',
                                  fontWeight: hasSales ? 600 : 400,
                                  backgroundColor: expandedCell === cellKey ? 'rgba(0,173,239,0.1)' : 'transparent'
                                }}
                                title={hasSales ? 'Clic para ver operaciones' : ''}
                              >
                                {hasSales ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cell.sales.length} uds</span>
                                    <span>{formatEuro(cell.total)}</span>
                                  </div>
                                ) : '-'}
                              </td>
                            )
                          })}
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: '#3b82f6', borderLeft: '1px solid var(--border-light)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.totalUdsGlobal} uds</span>
                              <span>{formatEuro(row.totalGlobal)}</span>
                            </div>
                          </td>
                        </tr>
                        {cols.map(t => {
                          const cellKey = `${tienda.nombre}-${row.nombre}-${t}`
                          if (expandedCell === cellKey && row.cells[t].sales.length > 0) {
                            return (
                              <tr key={`expanded-${cellKey}`}>
                                <td colSpan={cols.length + 2} style={{ padding: 0 }}>
                                  <div style={{ padding: '16px 24px', backgroundColor: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-light)' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 14 }}>
                                      Operaciones de {row.nombre} en {t}
                                    </h4>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                      <thead>
                                        <tr style={{ color: 'var(--medium-gray)', borderBottom: '1px solid var(--border-light)' }}>
                                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Fecha</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Producto</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Anotaciones</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Estado</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Rentabilidad</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {row.cells[t].sales.map((v, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{v.fecha}</td>
                                            <td style={{ padding: '6px 8px', color: 'var(--light-text)' }}>{v.producto}</td>
                                            <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{v.anotaciones || '-'}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                              {v.estado === 'NULL' ? (
                                                <span style={{ color: '#FF453A', fontSize: 11, fontWeight: 700 }}>NULL</span>
                                              ) : v.estado === 'PED' ? (
                                                <span style={{ color: '#FF9500', fontSize: 11, fontWeight: 700 }}>PED</span>
                                              ) : (
                                                <span style={{ color: '#34C759', fontSize: 11, fontWeight: 700 }}>OK</span>
                                              )}
                                            </td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}>{formatEuro(v.comisionReal)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )
                          }
                          return null
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--light-text)', position: 'sticky', left: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>TOTAL TIENDA</td>
                      {cols.map(t => (
                        <td key={t} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--light-text)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tienda.footerTotals[t].uds} uds</span>
                            <span>{formatEuro(tienda.footerTotals[t].total)}</span>
                          </div>
                        </td>
                      ))}
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tienda.totalTiendaUds} uds</span>
                          <span>{formatEuro(tienda.totalTienda)}</span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          )
        })}
      </div>
    </div>
  )
}
