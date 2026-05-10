'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { Package, ChevronLeft, Target, FilterX } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useTheme } from '@/components/ThemeProvider'
import { useRouter } from 'next/navigation'
import { usePeriod } from '@/components/PeriodProvider'
import { useComisionesData, matchTipoVenta } from '@/hooks/useComisionesData'

const formatCurrency = (val: any) => {
    if (!val) return '0,00 €'
    const num = typeof val === 'string' ? parseFloat(val.replace(/[^\d,-]/g, '').replace(',', '.')) : val
    return isNaN(num) ? '0,00 €' : num.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export default function AvancePalancasPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const { activePeriodKey } = usePeriod()
  
  const [activeLeverFilter, setActiveLeverFilter] = useState<string | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const { loading, monthSales, tiendaRules, sellerStats } = useComisionesData()

  if (loading) {
    return <div style={{ padding: 20, color: 'var(--mercedes-cyan)', fontWeight: 'bold' }}>Cargando datos del dashboard...</div>
  }

  const filteredSales = monthSales || []
  
  const getStatsForLever = (rule: any) => {
      const isMonetary = String(rule.importePrimerTramo || '').includes('%')

      let totalCount = 0
      let pendientes = 0

      // Aggregate from pre-calculated sellerStats
      sellerStats.forEach(s => {
          totalCount += (s.groupCounts[rule.nombre] || 0)
          pendientes += (s.groupPending[rule.nombre] || 0)
      })

      const finalizadas = totalCount - pendientes

      const targetT1 = rule.objPrimerTramo || 0
      const targetT2 = rule.objSegundoTramo || 0

      // Percentage and Value metrics
      let pjeT1 = targetT1 > 0 ? (totalCount / targetT1) * 100 : (totalCount > 0 ? 100 : 0)
      let pjeT2 = targetT2 > 0 ? (totalCount / targetT2) * 100 : (totalCount > 0 ? 100 : 0)
      
      return { targetT1, targetT2, totalCount, quantity: totalCount, pjeT1, pjeT2, finalizadas, pendientes, isMonetary }
  }

  const renderProgressBar = (target: number, pje: number, isMonetary: boolean, totalCount: number, color: string, label: string) => {
      if (target === 0) {
          return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 'bold' }}>
                    <span style={{ color: color }}>{label}</span>
                    <span style={{ color: 'var(--light-text)' }}>
                       {isMonetary ? formatCurrency(totalCount) : `${totalCount} uds`}
                    </span>
                 </div>
                 <div style={{ height: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: color, borderRadius: 4, opacity: 0.3 }}></div>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ color: 'var(--light-text)', fontSize: 10, fontWeight: 900 }}>
                           {pje % 1 === 0 ? pje : pje.toFixed(1)}%
                       </span>
                    </div>
                 </div>
              </div>
          )
      }

      const displayPje = Math.min(Math.round(pje), 100)
      
      return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 'bold' }}>
                <span style={{ color: color }}>{label}</span>
                <span style={{ color: 'var(--light-text)' }}>
                   {isMonetary 
                      ? `${formatCurrency(totalCount)} / ${formatCurrency(target)}` 
                      : `${totalCount} / ${target}`}
                </span>
             </div>
             
             <div style={{ height: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, position: 'relative' }}>
                <div style={{ height: '100%', width: `${Math.min(pje, 100)}%`, backgroundColor: color, borderRadius: 4, transition: 'width 0.5s ease', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: pje > 15 ? 6 : 0, overflow: 'hidden' }}>
                    {pje > 15 && (
                        <span style={{ color: '#000', fontSize: 10, fontWeight: 900 }}>
                            {pje % 1 === 0 ? pje : pje.toFixed(1)}%
                        </span>
                    )}
                </div>
                {pje <= 15 && (
                    <span style={{ position: 'absolute', left: `${Math.min(pje, 100)}%`, top: '50%', transform: 'translateY(-50%)', paddingLeft: 6, color: 'var(--light-text)', fontSize: 10, fontWeight: 800 }}>
                        {pje % 1 === 0 ? pje : pje.toFixed(1)}%
                    </span>
                )}
                {pje >= 100 && (
                     <div style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 2, backgroundColor: 'var(--bg-card)', boxShadow: '0 0 5px #fff' }}></div>
                )}
             </div>
          </div>
      )
  }

  // Active table filter data
  let activeLeverSales = filteredSales;
  
  if (activeLeverFilter) {
      const activeRule = tiendaRules.find(r => r.nombre === activeLeverFilter);
      if (activeRule) {
          activeLeverSales = activeLeverSales.filter(s => matchTipoVenta(s, activeRule.productosCuentan));
      }
  }

  return (
    <div style={{ padding: 20 }}>
      <PageHeader 
        title={<><Target className="text-cyan" size={28} /> Avance de Palancas</>}
        subtitle="Seguimiento de ventas y métricas (Finalizadas y Pendientes) frente al objetivo Tramo 1 y Tramo 2."
        showBack={true}
        backFallback="/seguimiento-ventas"
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24, marginTop: -8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Filtro gestionado por RootLayout (PeriodSelector) */}
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {tiendaRules.map((rule, idx) => {
          const stats = getStatsForLever(rule)
          const isActive = activeLeverFilter === rule.nombre

          return (
            <div 
              key={idx}
              onClick={() => {
                 setActiveLeverFilter(isActive ? null : rule.nombre);
                 if (!isActive) {
                    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                 }
              }}
              className="card" 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '16px', 
                padding: '16px 16px 0 16px', // No padding bottom, handled by footer
                border: isActive ? '2px solid var(--mercedes-cyan)' : '1px solid var(--border-color)',
                backgroundColor: isActive ? 'rgba(0,173,239,0.03)' : 'var(--card-bg)',
                boxShadow: theme === 'light' ? '0 4px 6px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = theme === 'light' ? '0 4px 6px rgba(0,0,0,0.05)' : 'none'
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: 6, fontWeight: 900, color: 'var(--light-text)', fontSize: 16 }}>
                          {rule.nombre}
                      </div>
                  </div>
                  {(() => {
                      const globalTarget = stats.targetT1; // Use Tramo 1 as the primary goal to display "Faltan"
                      const isMonetary = stats.isMonetary;
                      const remaining = globalTarget > stats.totalCount ? globalTarget - stats.totalCount : 0;
                      
                      if (globalTarget > 0) {
                          return (
                              <div style={{ 
                                  fontSize: 12, 
                                  fontWeight: 'bold', 
                                  padding: '4px 8px', 
                                  borderRadius: 4, 
                                  backgroundColor: remaining > 0 ? 'rgba(255, 149, 0, 0.1)' : 'rgba(52, 199, 89, 0.1)',
                                  color: remaining > 0 ? '#FF9500' : '#34C759'
                              }}>
                                  {remaining > 0 ? `Faltan T1: ${isMonetary ? formatCurrency(remaining) : remaining + ' uds'}` : '✓ T1 Superado'}
                              </div>
                          );
                      }
                      return null;
                  })()}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                  {/* BARRA TRAMO 2 (VERDE) */}
                  {renderProgressBar(stats.targetT2, stats.pjeT2, stats.isMonetary, stats.totalCount, '#34C759', 'TRAMO 2')}

                  {/* BARRA TRAMO 1 (AZUL) */}
                  {renderProgressBar(stats.targetT1, stats.pjeT1, stats.isMonetary, stats.totalCount, 'var(--mercedes-cyan)', 'TRAMO 1')}
              </div>

              {/* FOOTER GRIS ONELAKE STYLE */}
              <div style={{ 
                  marginTop: 'auto',
                  borderTop: '1px solid var(--border-color)', 
                  backgroundColor: 'var(--section-bg)', 
                  margin: '0 -16px 0 -16px', 
                  padding: '12px 16px', 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center'
              }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, fontSize: 11, gap: 2 }}>
                      <span style={{ fontSize: 10, color: 'var(--medium-gray)', marginBottom: 2, fontWeight: 'bold' }}>TRAMO 2</span>
                      <span style={{ color: 'var(--light-text)' }}>
                          {(stats.targetT2 || 0) > 0 
                             ? (stats.isMonetary ? `${formatCurrency(stats.totalCount)} / ${formatCurrency(stats.targetT2)}` : `${stats.totalCount} / ${stats.targetT2} uds`)
                             : (stats.isMonetary ? `${formatCurrency(stats.totalCount)}` : `${stats.totalCount} uds`)}
                      </span>
                      <span style={{ color: 'var(--light-text)' }}>
                          F: {stats.isMonetary ? formatCurrency(stats.finalizadas) : stats.finalizadas} | 
                          P: {stats.isMonetary ? formatCurrency(stats.pendientes) : stats.pendientes}
                      </span>
                      <span style={{ fontWeight: 'bold', color: stats.pjeT2 >= 100 ? '#34C759' : '#34C759' }}>
                          {stats.pjeT2 % 1 === 0 ? `${stats.pjeT2}%` : `${stats.pjeT2.toFixed(1)}%`}
                      </span>
                  </div>
                  <div style={{ width: 1, height: 45, backgroundColor: 'var(--border-color)', margin: '0 12px' }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'right', fontSize: 11, gap: 2 }}>
                      <span style={{ fontSize: 10, color: 'var(--medium-gray)', marginBottom: 2, fontWeight: 'bold' }}>TRAMO 1</span>
                      <span style={{ color: 'var(--light-text)' }}>
                          {(stats.targetT1 || 0) > 0 
                             ? (stats.isMonetary ? `${formatCurrency(stats.totalCount)} / ${formatCurrency(stats.targetT1)}` : `${stats.totalCount} / ${stats.targetT1} uds`)
                             : (stats.isMonetary ? `${formatCurrency(stats.totalCount)}` : `${stats.totalCount} uds`)}
                      </span>
                      <span style={{ color: 'var(--light-text)' }}>
                          F: {stats.isMonetary ? formatCurrency(stats.finalizadas) : stats.finalizadas} | 
                          P: {stats.isMonetary ? formatCurrency(stats.pendientes) : stats.pendientes}
                      </span>
                      <span style={{ fontWeight: 'bold', color: stats.pjeT1 >= 100 ? '#34C759' : 'var(--mercedes-cyan)' }}>
                          {stats.pjeT1 % 1 === 0 ? `${stats.pjeT1}%` : `${stats.pjeT1.toFixed(1)}%`}
                      </span>
                  </div>
              </div>
            </div>
          )
        })}
      </div>


      {/* EXPLORADOR DE OPERACIONES (DATA HUB) */}
      <div style={{ marginTop: 40 }} ref={tableRef}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package className="text-cyan" size={24} /> 
            Explorador de Operaciones {activeLeverFilter ? `- ${activeLeverFilter}` : '- Todas'}
          </h2>
          {activeLeverFilter && (
             <button 
                onClick={() => setActiveLeverFilter(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--light-text)', cursor: 'pointer', fontSize: 13, padding: '6px 12px', borderRadius: 4 }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              >
                <FilterX size={16} /> Ver todas
             </button>
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '500px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '900px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ backgroundColor: 'var(--active-bg)', boxShadow: '0 1px 0 var(--table-border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>Fecha</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>Vendedor</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>Cliente (NIF)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>Nombre del Cliente</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>Código</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>Producto</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--medium-gray)' }}>Importe/Cuota</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--medium-gray)' }}>Anotaciones</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--medium-gray)' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {activeLeverSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--medium-gray)' }}>
                      No hay operaciones para mostrar en esta vista.
                    </td>
                  </tr>
                ) : (
                  activeLeverSales.map((sale: any, i: number) => {
                     // Fast resolution of status for UI
                     const isPed = String(sale.pendiente || '').trim().toUpperCase() === 'SI' || String(sale.pendiente || '').trim().toUpperCase() === 'PED' || String(sale.estado || '').trim().toUpperCase() === 'PENDIENTE'
                     const isAnul = String(sale.anulado || '').trim().toUpperCase() === 'SI' || String(sale.pendiente || '').trim().toUpperCase() === 'ANULADO' || String(sale.estado || '').trim().toUpperCase() === 'ANULADO'
                     let statusText = 'Completado'
                     let statusBg = 'rgba(52, 199, 89, 0.1)'
                     let statusColor = '#34C759'
                     
                     if (isAnul) { statusText = 'Anulado'; statusBg = 'rgba(239, 68, 68, 0.1)'; statusColor = '#EF4444' }
                     else if (isPed) { statusText = 'Pendiente'; statusBg = 'rgba(255, 149, 0, 0.1)'; statusColor = '#FF9500' }

                     // Simple import calculation fallback for simplified view
                     let val = sale.importe || sale.cuota || 0

                     return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', verticalAlign: 'middle' }}>
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{sale.fecha}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 'bold' }}>{sale.vendedor}</td>
                        <td style={{ padding: '10px 16px' }}>{sale.nif}</td>
                        <td style={{ padding: '10px 16px' }}>{sale.nombreCliente || '-'}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--mercedes-cyan)', fontWeight: 600 }}>{sale.codigo}</td>
                        <td style={{ padding: '10px 16px' }}>{sale.producto}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', color: 'var(--light-text)' }}>
                            {formatCurrency(val)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--medium-gray)' }}>
                           <span style={{ display: 'inline-block', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sale.anotaciones}>{sale.anotaciones || '-'}</span>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: statusBg, color: statusColor, padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>
                                {statusText}
                            </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
