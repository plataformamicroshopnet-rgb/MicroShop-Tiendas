'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, User, ChevronDown, ChevronUp, BarChart2, Calendar } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { usePeriod } from '@/components/PeriodProvider'
import { calculateDynamicCommission, normalizeString, renderDashboardData } from '@/lib/salesUtils'
import { TIENDAS_COMERCIALES } from '@/lib/constants'

type GroupedSale = {
  fecha: string
  producto: string
  comision: number
  varios: string
  estado: string
}

const TIPOS_VENTA = [
  'Contratos Móvil', 'Rent', 'O2 MovilFree', 'Seguro', 'miMovistar',
  'Suscripciones TV', 'Varios', 'Repos', 'Resto BAF'
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

  const [expandedTiendas, setExpandedTiendas] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.keys(TIENDAS_COMERCIALES).forEach(t => initial[t] = true);
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

        const [salesRes, catRes, pymeRes, plusRes, objRes] = await Promise.all([
          fetch(`/api/sales?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/catalogs?_t=${Date.now()}`).catch(() => null),
          fetch(`/api/importes-pyme?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/importes-plus?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/objetivos?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null)
        ])

        const salesData = salesRes && salesRes.ok ? await salesRes.json() : { logs: [] }
        const catData = catRes && catRes.ok ? await catRes.json() : {}
        const pymeData = pymeRes && pymeRes.ok ? await pymeRes.json() : {}
        const plusData = plusRes && plusRes.ok ? await plusRes.json() : {}
        const objData = objRes && objRes.ok ? await objRes.json() : {}

        const fetchedSales = salesData.logs || []
        setSales(fetchedSales)
        setCatalogs(catData.catalogs || catData || {})

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

    const salesWithCommission = sales.map(sale => {
      if (sale.anulado === 'Si' || sale.pendiente === 'Anulado') {
        return { ...sale, comisionReal: 0 }
      }

      const tipoVenta = (String(sale.sheet || '')).trim().toLowerCase()
      const codigoLower = String(sale.codigo || '').trim().toLowerCase()

      const isPlus = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7'].some(c => codigoLower.includes(c))

      let saleMonth = ''
      if (sale.fecha) {
         const parts = sale.fecha.split('/')
         if (parts.length === 3) saleMonth = `${parts[2]}${parts[1]}`
         else if (sale.fecha.includes('-')) {
             const p = sale.fecha.split('-')
             if (p.length >= 2) saleMonth = `${p[0]}${p[1]}`
         }
      }

      const getFallbackValue = () => {
           let val = sale.importe || sale.cuota || 0;
           const det = (sale.detalle || '').toLowerCase();
           if (!val && (det === 'ti' || det === 'tma' || det === 'rent' || det === 'micro')) {
               let catalogKey = '';
               if (det === 'ti') catalogKey = 'Ti';
               if (det === 'tma' || det === 'rent') catalogKey = 'Rent';
               if (det === 'micro') catalogKey = 'Micro';
               
               const list = catalogs[catalogKey] || [];
               const found = list.find((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
               if (found) {
                   val = Number(String(found.anual || 0).replace(',','.'));
               }
           }
           return val;
      }

      const parseToNumber = (val: any): number => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        const clean = String(val).replace('€', '').replace(/\s/g, '').replace(',', '.').trim();
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
      }

      if (!saleMonth) return { ...sale, comisionReal: parseToNumber(getFallbackValue()) }

      const viewingPeriod = activePeriodObj
          ? `${activePeriodObj.year}${String(activePeriodObj.month).padStart(2, '0')}`
          : getCurrentMonthString();
      
      if (saleMonth && saleMonth !== viewingPeriod) return null;
      
      const dashboardRows = isPlus ? pymeRows : captadorRows;
      const det = (sale.detalle || '').toLowerCase();
      
      const isTV = det === 'suscripciones tv' || det === 'suscripcion tv';
      if (det === 'o2' || det === 'seguro' || det === 'mimovistar' || det === 'repos' || det === 'varios' || isTV || det === 'prepago') {
          return { ...sale, comisionReal: parseToNumber(sale.importe || sale.cuota || 0) };
      }
      
      let overrideBaseValue: number | undefined = undefined;
      if (det === 'ti' || det === 'tma' || det === 'rent' || det === 'micro') {
          let catalogKey = '';
          if (det === 'ti') catalogKey = 'Ti';
          if (det === 'tma' || det === 'rent') catalogKey = 'Rent';
          if (det === 'micro') catalogKey = 'Micro';
          
          const list = catalogs[catalogKey] || [];
          const matchingProducts = list.filter((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
          
          let found = matchingProducts[0];
          if (matchingProducts.length > 1) {
              const correctlyDated = matchingProducts.find((c: any) => {
                  if (!c.validFrom) return false;
                  return true;
              });
              if (correctlyDated) {
                  found = correctlyDated;
              }
          }

          if (found) {
              overrideBaseValue = parseToNumber(found.anual);
              
              if (det === 'ti') {
                  return { ...sale, comisionReal: overrideBaseValue };
              }
              
              if (det === 'tma' || det === 'rent') {
                  const isConCoste = sale.rentConCoste && (sale.rentConCoste.toLowerCase() === 'sí' || sale.rentConCoste.toLowerCase() === 'si');
                  if (isConCoste) {
                      return { ...sale, comisionReal: parseToNumber(found.comisionConCoste) };
                  } else {
                      return { ...sale, comisionReal: parseToNumber(found.comision) };
                  }
              }
          }
      }

      const finalCommission = parseToNumber(calculateDynamicCommission(sale, dashboardRows, overrideBaseValue));
      return { ...sale, comisionReal: finalCommission }
    }).filter(Boolean) as any[]

    const result = Object.entries(TIENDAS_COMERCIALES).map(([tiendaName, comerciales]) => {
      const rows = comerciales.map(comercial => {
        const cells = {} as Record<string, { total: number, sales: any[] }>
        TIPOS_VENTA.forEach(t => cells[t] = { total: 0, sales: [] })
        return { nombre: comercial, cells, totalGlobal: 0, totalUdsGlobal: 0 }
      })
      
      const footerTotals = {} as Record<string, { total: number, uds: number }>
      TIPOS_VENTA.forEach(t => footerTotals[t] = { total: 0, uds: 0 })
      
      return { nombre: tiendaName, rows, footerTotals, totalTienda: 0, totalTiendaUds: 0 }
    })

    salesWithCommission.forEach(s => {
      const vendedor = s.vendedor || 'Desconocido'
      let tiendaObj = result.find(t => t.rows.some(r => r.nombre.toLowerCase() === vendedor.toLowerCase()))
      
      if (!tiendaObj) return;

      let tipo = 'Resto BAF'
      const det = (s.detalle || '').toLowerCase()
      if (det === 'ti') tipo = 'Contratos Móvil'
      else if (det === 'tma' || det === 'rent') tipo = 'Rent'
      else if (det === 'o2') tipo = 'O2 MovilFree'
      else if (det === 'seguro') tipo = 'Seguro'
      else if (det === 'mimovistar') tipo = 'miMovistar'
      else if (det === 'suscripciones tv' || det === 'suscripcion tv') tipo = 'Suscripciones TV'
      else if (det === 'prepago') tipo = 'Prepago'
      else if (det === 'varios') tipo = 'Varios'
      else if (det === 'repos') tipo = 'Repos'

      const row = tiendaObj.rows.find(r => r.nombre.toLowerCase() === vendedor.toLowerCase())
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

    result.sort((a, b) => b.totalTienda - a.totalTienda)
    return result
  }, [sales, pymeRows, captadorRows, catalogs, activePeriodObj])

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

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {matrixData.map(tienda => (
          <div key={tienda.nombre} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div 
              onClick={() => toggleTienda(tienda.nombre)}
              style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: expandedTiendas[tienda.nombre] ? 'rgba(16, 185, 129, 0.05)' : 'transparent', borderBottom: expandedTiendas[tienda.nombre] ? '1px solid var(--border-color)' : 'none', transition: 'background-color 0.2s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {expandedTiendas[tienda.nombre] ? <ChevronUp size={24} color="#10b981" /> : <ChevronDown size={24} color="var(--medium-gray)" />}
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: 'var(--light-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {tienda.nombre}
                  </h3>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tienda.totalTiendaUds} uds</span>
                          <span>{formatEuro(tienda.totalTienda)}</span>
                        </div></div>
                <div style={{ fontSize: 13, color: 'var(--medium-gray)', fontWeight: 600 }}>{tienda.totalTiendaUds} VENTAS</div>
              </div>
            </div>

            {expandedTiendas[tienda.nombre] && (
              <div style={{ overflowX: 'auto', padding: '10px 20px 20px 20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1000 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--light-text)', position: 'sticky', left: 0, backgroundColor: 'var(--bg-card)', zIndex: 2 }}>Comercial</th>
                      {TIPOS_VENTA.map(t => (
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
                          {TIPOS_VENTA.map(t => {
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
                        {TIPOS_VENTA.map(t => {
                          const cellKey = `${tienda.nombre}-${row.nombre}-${t}`
                          if (expandedCell === cellKey && row.cells[t].sales.length > 0) {
                            return (
                              <tr key={`expanded-${cellKey}`}>
                                <td colSpan={TIPOS_VENTA.length + 2} style={{ padding: 0 }}>
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
                      {TIPOS_VENTA.map(t => (
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
        ))}
      </div>
    </div>
  )
}
