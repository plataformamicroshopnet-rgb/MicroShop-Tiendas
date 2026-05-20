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

  const renderProgressBar = (target: number, pje: number, isMonetary: boolean, totalCount: number, color: string, colorEnd: string, label: string) => {
      if (target === 0) {
          return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 'bold' }}>
                    <span style={{ color: color }}>{label}</span>
                    <span style={{ color: 'var(--light-text)' }}>
                       {isMonetary ? formatCurrency(totalCount) : `${totalCount} uds`}
                    </span>
                 </div>
                 <div style={{ height: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: color, borderRadius: 6, opacity: 0.15 }}></div>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ color: 'var(--light-text)', fontSize: 9, fontWeight: 900 }}>
                           {pje % 1 === 0 ? pje : pje.toFixed(1)}%
                       </span>
                    </div>
                 </div>
              </div>
          )
      }

      const isSuperado = pje >= 100;
      const displayPje = Math.min(Math.round(pje), 100)
      
      return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 'bold' }}>
                <span style={{ color: color, textShadow: isSuperado ? `0 0 10px ${color}60` : 'none' }}>{label}</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 800 }}>
                   {isMonetary 
                      ? `${formatCurrency(totalCount)} / ${formatCurrency(target)}` 
                      : `${totalCount} / ${target}`}
                </span>
             </div>
             
             <div style={{ height: 12, backgroundColor: 'var(--section-bg)', borderRadius: 6, position: 'relative', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ 
                    height: '100%', 
                    width: `${Math.min(pje, 100)}%`, 
                    background: `linear-gradient(90deg, ${color}, ${colorEnd})`, 
                    borderRadius: 6, 
                    transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'flex-end', 
                    paddingRight: pje > 15 ? 6 : 0, 
                    overflow: 'hidden',
                    boxShadow: isSuperado ? `0 0 12px ${color}80` : 'none'
                }}>
                </div>
                <span style={{ 
                    position: 'absolute', 
                    left: pje > 15 ? `calc(${Math.min(pje, 100)}% - 6px)` : `${Math.min(pje, 100)}%`, 
                    top: '50%', 
                    transform: pje > 15 ? 'translate(-100%, -50%)' : 'translate(6px, -50%)', 
                    color: pje > 15 ? '#000' : 'var(--text-main)', 
                    fontSize: 9, 
                    fontWeight: 900,
                    textShadow: pje > 15 ? 'none' : '0 1px 2px rgba(0,0,0,0.5)'
                }}>
                    {pje % 1 === 0 ? pje : pje.toFixed(1)}%
                </span>
                {isSuperado && (
                     <div style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 2, backgroundColor: '#fff', boxShadow: '0 0 8px #fff', borderRadius: 2 }}></div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
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
                padding: '20px', 
                border: isActive ? '1px solid var(--mercedes-cyan)' : '1px solid rgba(255,255,255,0.05)',
                backgroundColor: isActive ? 'rgba(0,173,239,0.05)' : 'var(--card-bg)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                boxShadow: isActive ? '0 0 20px rgba(0, 173, 239, 0.15)' : (theme === 'light' ? '0 8px 16px rgba(0,0,0,0.05)' : '0 8px 16px rgba(0,0,0,0.3)'),
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = theme === 'light' ? '0 12px 24px rgba(0,0,0,0.1)' : '0 12px 24px rgba(0,0,0,0.4)'
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = theme === 'light' ? '0 8px 16px rgba(0,0,0,0.05)' : '0 8px 16px rgba(0,0,0,0.3)'
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)'
                }
              }}
            >
              {/* Subtle background gradient glow */}
              <div style={{ position: 'absolute', top: -50, right: -50, width: 100, height: 100, background: 'radial-gradient(circle, rgba(0,173,239,0.1) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ backgroundColor: isActive ? 'var(--mercedes-cyan)' : 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: 8, fontWeight: 900, color: isActive ? '#000' : 'var(--medium-gray)', fontSize: 16, transition: 'all 0.3s ease' }}>
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
                                  fontSize: 11, 
                                  fontWeight: 800, 
                                  padding: '4px 10px', 
                                  borderRadius: 20, 
                                  backgroundColor: remaining > 0 ? '#EA580C' : '#16A34A',
                                  color: '#FFFFFF',
                                  boxShadow: remaining > 0 ? '0 4px 10px rgba(234, 88, 12, 0.3)' : '0 4px 10px rgba(22, 163, 74, 0.3)'
                              }}>
                                  {remaining > 0 ? `Faltan T1: ${isMonetary ? formatCurrency(remaining) : remaining + ' uds'}` : '✓ T1 Superado'}
                              </div>
                          );
                      }
                      return null;
                  })()}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 4, zIndex: 1 }}>
                  {/* BARRA TRAMO 2 (VERDE ESMERALDA) */}
                  {renderProgressBar(stats.targetT2, stats.pjeT2, stats.isMonetary, stats.totalCount, '#059669', '#10B981', 'TRAMO 2')}

                  {/* BARRA TRAMO 1 (CYAN MERCEDES) */}
                  {renderProgressBar(stats.targetT1, stats.pjeT1, stats.isMonetary, stats.totalCount, '#0284C7', '#0EA5E9', 'TRAMO 1')}
              </div>

              {/* INTEGRATED METRICS PANEL */}
              <div style={{ 
                  marginTop: 8,
                  backgroundColor: 'rgba(0,0,0,0.15)', 
                  borderRadius: 12,
                  padding: '12px', 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid rgba(255,255,255,0.03)',
                  zIndex: 1
              }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, fontSize: 11, gap: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--medium-gray)', fontWeight: 800, letterSpacing: 0.5 }}>FINALIZADAS</span>
                      <span style={{ color: 'var(--text-main)', fontSize: 14, fontWeight: 900 }}>
                          {stats.isMonetary ? formatCurrency(stats.finalizadas) : stats.finalizadas}
                      </span>
                  </div>
                  <div style={{ width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.05)', margin: '0 12px' }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'right', fontSize: 11, gap: 4 }}>
                      <span style={{ fontSize: 10, color: '#FF9500', fontWeight: 800, letterSpacing: 0.5 }}>PENDIENTES</span>
                      <span style={{ color: stats.pendientes > 0 ? '#FF9500' : 'var(--text-main)', fontSize: 14, fontWeight: 900 }}>
                          {stats.isMonetary ? formatCurrency(stats.pendientes) : stats.pendientes}
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
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--medium-gray)' }}>Anotaciones</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--medium-gray)' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {activeLeverSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--medium-gray)' }}>
                      No hay operaciones para mostrar en esta vista.
                    </td>
                  </tr>
                ) : (
                  activeLeverSales.map((sale: any, i: number) => {
                     // Fast resolution of status for UI
                     const isPed = String(sale.pendiente || '').trim().toUpperCase() === 'SI' || String(sale.pendiente || '').trim().toUpperCase() === 'PED' || String(sale.estado || '').trim().toUpperCase() === 'PENDIENTE'
                     const isAnul = String(sale.anulado || '').trim().toUpperCase() === 'SI' || String(sale.pendiente || '').trim().toUpperCase() === 'ANULADO' || String(sale.estado || '').trim().toUpperCase() === 'ANULADO'
                     let statusText = 'Completado'
                     let statusBg = 'rgba(16, 185, 129, 0.15)'
                     let statusColor = '#10B981'
                     let statusBorder = '1px solid rgba(16, 185, 129, 0.3)'
                     
                     if (isAnul) { statusText = 'Anulado'; statusBg = 'rgba(239, 68, 68, 0.15)'; statusColor = '#EF4444'; statusBorder = '1px solid rgba(239, 68, 68, 0.3)' }
                     else if (isPed) { statusText = 'Pendiente'; statusBg = 'rgba(255, 149, 0, 0.15)'; statusColor = '#FF9500'; statusBorder = '1px solid rgba(255, 149, 0, 0.3)' }

                     return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', verticalAlign: 'middle', transition: 'background-color 0.2s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{sale.fecha}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-main)' }}>{sale.vendedor}</td>
                        <td style={{ padding: '12px 16px' }}>{sale.nif}</td>
                        <td style={{ padding: '12px 16px' }}>{sale.nombreCliente || '-'}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--mercedes-cyan)', fontWeight: 800 }}>{sale.codigo}</td>
                        <td style={{ padding: '12px 16px' }}>{sale.producto}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--medium-gray)' }}>
                           <span style={{ display: 'inline-block', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sale.anotaciones}>{sale.anotaciones || '-'}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: statusBg, color: statusColor, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, border: statusBorder }}>
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
