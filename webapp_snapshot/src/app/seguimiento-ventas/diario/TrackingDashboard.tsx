"use client"
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Save, Plus, Trash2, TrendingUp, AlertCircle, Info, FileSpreadsheet, Calendar, Lock } from 'lucide-react'
import { calculateRow, calculateGroup, getPeriodBusinessDays } from '@/lib/trackingCalculations'
import { usePeriod } from '@/components/PeriodProvider'
import { PeriodSelector } from '@/components/PeriodSelector'
import { useGuard } from '@/hooks/useGuard'
import { canEdit } from '@/lib/permissions'

export default function TrackingDashboard() {
  const router = useRouter()
  const { activePeriodKey, availablePeriods } = usePeriod()
  const activePeriodStatus = availablePeriods?.find(p => p.period_key === activePeriodKey)?.status || 'ACTIVE'
  
  const periodYear = activePeriodKey ? Number(activePeriodKey.split('_')[0]) : new Date().getFullYear()
  const periodMonth = activePeriodKey ? Number(activePeriodKey.split('_')[1]) : new Date().getMonth() + 1
  
  const { user } = useGuard('MODULE_JEFE_TIENDAS')
  const canEditFlag = user ? canEdit(user, 'MODULE_JEFE_TIENDAS') : false
  const isReadOnly = activePeriodStatus === 'HISTORIC' || !canEditFlag
  
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'' | 'Guardando...' | 'Guardado en Nube' | 'Borrador no guardado' | 'Error al guardar'>('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tracking?month=${periodMonth}&year=${periodYear}`)
      const data = await res.json()
      if (data.groups) {
        const clientGroups = data.groups.map((g: any) => ({
            ...g,
            _id: g.id || crypto.randomUUID(),
            rows: g.rows.map((r: any) => ({ ...r, _id: r.id || crypto.randomUUID() }))
        }))
        setGroups(clientGroups)
        setInitialLoad(true)
        setTimeout(() => setInitialLoad(false), 500)
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [periodMonth, periodYear])

  useEffect(() => { loadData() }, [loadData])

  // Motor AutoGuardado Debounced (1.5s)
  useEffect(() => {
    if (initialLoad || isReadOnly) return
    setSaveStatus('Borrador no guardado')
    const handler = setTimeout(async () => {
      setSaveStatus('Guardando...')
      try {
        await fetch('/api/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: periodMonth, year: periodYear, groups })
        })
        setSaveStatus('Guardado en Nube')
        setTimeout(() => setSaveStatus(''), 3000)
      } catch(e) { 
        console.error(e) 
        setSaveStatus('Error al guardar')
      }
    }, 1500)
    return () => clearTimeout(handler)
  }, [groups, periodMonth, periodYear, initialLoad, isReadOnly])

  // Modificadores de Estado
  const updateRow = (gId: string, rId: string, field: string, val: string) => {
    if (isReadOnly) return
    setGroups(prev => prev.map(g => {
      if (g._id !== gId) return g
      return {
        ...g,
        rows: g.rows.map((r: any) => r._id === rId ? { ...r, [field]: val === '' ? 0 : Number(val) } : r)
      }
    }))
  }

  const updateRowName = (gId: string, rId: string, val: string) => {
    if (isReadOnly) return
    setGroups(prev => prev.map(g => g._id !== gId ? g : { ...g, rows: g.rows.map((r: any) => r._id === rId ? { ...r, comercialName: val } : r) }))
  }

  const addGroup = () => {
    if (isReadOnly) return
    setGroups(prev => [...prev, { _id: crypto.randomUUID(), name: 'NUEVA PALANCA', rows: [] }])
  }

  const addRow = (gId: string) => {
    if (isReadOnly) return
    setGroups(prev => prev.map(g => g._id !== gId ? g : {
      ...g,
      rows: [...g.rows, { _id: crypto.randomUUID(), comercialName: 'Nuevo Comercial', objectiveMonth: 0, week1: 0, week2: 0, week3: 0, week4: 0 }]
    }))
  }

  const deleteRow = (gId: string, rId: string) => {
    if (isReadOnly) return
    if(!confirm('¿Eliminar esta fila?')) return
    setGroups(prev => prev.map(g => g._id !== gId ? g : { ...g, rows: g.rows.filter((r:any) => r._id !== rId) }))
  }
  
  const deleteGroup = (gId: string) => {
    if (isReadOnly) return
    if(!confirm('¿Eliminar la palanca completa?')) return
    setGroups(prev => prev.filter(g => g._id !== gId))
  }

  // Renderizadores UI Base
  const renderCellInput = (gId: string, rId: string, field: string, val: number) => (
    <input 
      type="number" 
      disabled={isReadOnly}
      value={val === 0 ? '' : val} 
      onChange={e => updateRow(gId, rId, field, e.target.value)}
      className="ds-input"
      style={{ width: 60, padding: '6px', textAlign: 'center', fontWeight: 600, border: '1px solid var(--border-light)', borderRadius: 4, background: isReadOnly ? 'var(--active-bg)' : 'var(--bg-card)', opacity: isReadOnly ? 0.6 : 1 }}
    />
  )

  const num = (n: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n)
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', padding: 20 }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.02)', marginBottom: 24, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
            <ChevronLeft size={24} />
          </button>
          <h1 style={{ margin: 0, fontSize: 20, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
             <TrendingUp size={24} color="#3b82f6" /> Seguimiento Diario
          </h1>
          {isReadOnly && <Lock size={16} color="#ef4444" style={{ marginLeft: 8 }} />}
          {saveStatus && <span style={{ fontSize: 13, fontWeight: 600, color: saveStatus === 'Guardado en Nube' ? '#10b981' : '#94a3b8', transition: 'opacity 0.3s', marginLeft: 8 }}>{saveStatus}</span>}
        </div>
        
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {/* DIAS TRABAJADOS */}
          <div title="Días laborables transcurridos vs total del mes (sin festivos Salamanca)" style={{ padding: '6px 16px', background: 'var(--bg-card)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-light)', cursor: 'help' }}>
            <Calendar size={16} color="#475569" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>DÍAS TRABAJADOS:</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-main)' }}>
              {getPeriodBusinessDays(periodYear, periodMonth).passedBusinessDays} <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>/ {getPeriodBusinessDays(periodYear, periodMonth).totalBusinessDays}</span>
            </span>
          </div>

          {/* TOTAL PUNTOS GLOBALES */}
          <div style={{ padding: '6px 16px', background: '#fef3c7', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #fde68a' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>TOTAL PUNTOS:</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#d97706' }}>
              {groups.reduce((acc, g) => acc + calculateGroup(g, periodYear, periodMonth).points, 0)}
            </span>
          </div>


          {/* SELECTOR DE PERIODO Y BOTON */}
          <PeriodSelector />
          
          {!isReadOnly && (
            <button onClick={addGroup} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              <Plus size={16} /> Palanca
            </button>
          )}
        </div>
      </div>

      {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Calculando arquitectura dimensional...</div>
      ) : groups.length === 0 && activePeriodStatus === 'DRAFT' ? (
          <div style={{ padding: 80, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border-strong)', maxWidth: 640, margin: '80px auto' }}>
            <div style={{ background: 'var(--mercedes-cyan)', width: 64, height: 64, borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <TrendingUp size={32} color="var(--bg-card)" />
            </div>
            <h2 style={{ color: 'var(--text-main)', marginBottom: 12, fontSize: 24 }}>Diario Vacío</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 16, lineHeight: 1.6 }}>
              Este periodo está en borrador y no tiene estructura de seguimiento diario inicializada. 
              Para evitar reescribir manualmente los comerciales y palancas, puedes importar la arquitectura íntegra del mes pasado.
            </p>
            {canEditFlag && (
                <button 
                   onClick={async () => {
                       if(!confirm('¿Clonar estructura del mes pasado resolviendo en ceros? Esta acción no se puede deshacer.')) return;
                   setLoading(true);
                   try {
                       const res = await fetch('/api/tracking/clone', { 
                           method: 'POST', 
                           headers: { 'Content-Type': 'application/json' },
                           body: JSON.stringify({ month: periodMonth, year: periodYear }) 
                       });
                       const json = await res.json();
                       if (res.ok) {
                         // Recargar forzosamente
                         await loadData();
                       } else {
                         alert(`Error al clonar: ${json.error || 'Revisa si el mes pasado tenía datos.'}`);
                       }
                   } catch(e) { alert('Fallo de red al solicitar clonación.'); }
                   setLoading(false);
               }}
               style={{ padding: '16px 32px', background: 'var(--text-main)', color: 'var(--bg-card)', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: 16, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            >
               <FileSpreadsheet size={24} /> IMPORTAR DEL MES ANTERIOR
            </button>
            )}
          </div>
      ) : groups.length === 0 && activePeriodStatus === 'ACTIVE' ? (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
             Este mes activo está vacío. Usa el botón [+ Palanca] del menú superior para añadir comerciales.
          </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {groups.map((g: any, i: number) => {
            const macro = calculateGroup(g, periodYear, periodMonth)

            return (
              <div key={g._id} style={{ display: 'flex', gap: 20, background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                {/* ZONA IZQUIERDA: FILAS Y METRICAS MANUALES */}
                <div style={{ flex: 1, padding: 20, overflowX: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <input 
                       disabled={isReadOnly}
                       value={g.name} 
                       onChange={e => setGroups(prev => prev.map(pg => pg._id !== g._id ? pg : {...pg, name: e.target.value}))}
                       style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', border: 'none', background: 'transparent', outline: 'none', opacity: isReadOnly ? 0.7 : 1 }}
                    />
                    {!isReadOnly && (
                      <button onClick={() => deleteGroup(g._id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    )}
                  </div>
                  
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--header-bg)', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700 }}>
                        <td style={{ padding: '8px', textAlign: 'left' }}>COMERCIAL</td>
                        <td style={{ padding: '8px', borderRight: '2px solid #e2e8f0' }}>OBJ MES</td>
                        <td style={{ padding: '8px', color: '#94a3b8' }}>S1</td>
                        <td style={{ padding: '8px', color: '#94a3b8' }}>S2</td>
                        <td style={{ padding: '8px', color: '#94a3b8' }}>S3</td>
                        <td style={{ padding: '8px', borderRight: '2px solid #e2e8f0', color: '#94a3b8' }}>S4</td>
                        <td style={{ padding: '8px', color: 'var(--text-main)' }}>TOTAL</td>
                        <td style={{ padding: '8px', color: 'var(--text-main)' }}>QUEDAN</td>
                        <td style={{ padding: '8px', color: 'var(--text-main)' }}>AVANCE %</td>
                        <td style={{ padding: '8px' }}></td>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r: any) => {
                        const m = calculateRow(r)
                        const pColor = m.progressPercent >= 1 ? '#22c55e' : (m.progressPercent >= 0.5 ? '#eab308' : '#ef4444')

                        return (
                          <tr key={r._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px' }}>
                              <input 
                                disabled={isReadOnly}
                                value={r.comercialName} 
                                onChange={e => updateRowName(g._id, r._id, e.target.value)} 
                                style={{ width: 120, border: 'none', fontWeight: 600, color: 'var(--text-main)', opacity: isReadOnly ? 0.7 : 1, background: 'transparent' }} 
                              />
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', borderRight: '2px solid #f1f5f9' }}>
                              {renderCellInput(g._id, r._id, 'objectiveMonth', r.objectiveMonth)}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>{renderCellInput(g._id, r._id, 'week1', r.week1)}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>{renderCellInput(g._id, r._id, 'week2', r.week2)}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>{renderCellInput(g._id, r._id, 'week3', r.week3)}</td>
                            <td style={{ padding: '8px', textAlign: 'center', borderRight: '2px solid #f1f5f9' }}>{renderCellInput(g._id, r._id, 'week4', r.week4)}</td>
                            
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{num(m.totalReal)}</td>
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: m.remaining > 0 ? '#ef4444' : '#22c55e' }}>{num(m.remaining)}</td>
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                               <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, background: pColor + '20', color: pColor }}>{pct(m.progressPercent)}</span>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                               {!isReadOnly && (
                                 <button onClick={() => deleteRow(g._id, r._id)} style={{ background: 'transparent', border: 'none', color: 'var(--border-strong)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                               )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  
                  {!isReadOnly && (
                    <button onClick={() => addRow(g._id)} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#3b82f6', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                      <Plus size={14} /> Fila
                    </button>
                  )}
                </div>

                {/* ZONA DERECHA: PANEL MACRO / KPI */}
                <div style={{ width: 340, background: 'var(--bg-app)', borderLeft: '1px solid var(--border-light)', padding: 20, display: 'flex', flexDirection: 'column' }}>
                   <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                      RENDIMIENTO GRUPAL <span title="Cálculos dinámicos en tiempo real"><Info size={14} /></span>
                   </div>

                   {/* PUNTOS PALANCA */}
                   <div style={{ background: '#fffbeb', padding: 12, borderRadius: 8, border: '1px solid #fde68a', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>Puntos Asignados</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>{macro.points} Puntos</span>
                   </div>
                   
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                      <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)' }}>
                         <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL VENTAS</div>
                         <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>{num(macro.groupTotalReal)}</div>
                      </div>
                      <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)' }}>
                         <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>OBJETIVO M.</div>
                         <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>{num(macro.groupTotalObjective)}</div>
                      </div>
                   </div>

                   <div style={{ background: macro.groupRemaining <= 0 ? '#dcfce7' : '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: macro.groupRemaining <= 0 ? '#166534' : '#991b1b' }}>Faltan del Total</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: macro.groupRemaining <= 0 ? '#166534' : '#991b1b' }}>{num(macro.groupRemaining)}</span>
                   </div>

                   <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)', marginBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                         <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Avance Grupo Todos</span>
                         <span style={{ fontSize: 14, fontWeight: 800, color: '#3b82f6' }}>{pct(macro.groupProgressPercent)}</span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                         <div style={{ width: Math.min(macro.groupProgressPercent * 100, 100) + '%', height: '100%', background: '#3b82f6' }} />
                      </div>
                   </div>

                   <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 12 }}>PROYECCIONES A FIN DE MES</div>
                   
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #cbd5e1' }}>
                         <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Déficit a día {macro.passedBusinessDays} (s/ {macro.totalBusinessDays})</span>
                         <span style={{ fontSize: 14, fontWeight: 700, color: macro.currentDeficit > 0 ? '#ef4444' : '#10b981' }}>{num(Math.abs(macro.currentDeficit))} {macro.currentDeficit > 0 ? '⬇' : '⬆'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--border-strong)' }}>
                         <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Proyectamos (Volumen)</span>
                         <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{num(macro.projectedEOM)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--border-strong)' }}>
                         <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Proyectamos (% Éxito)</span>
                         <span style={{ fontSize: 14, fontWeight: 800, color: macro.projectedPercent >= 1 ? '#10b981' : '#f59e0b' }}>{pct(macro.projectedPercent)}</span>
                      </div>
                   </div>

                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
