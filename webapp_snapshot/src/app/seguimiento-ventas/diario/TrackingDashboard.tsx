"use client"
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Save, Plus, Trash2, TrendingUp, AlertCircle, Info, FileSpreadsheet, Calendar, Lock } from 'lucide-react'
import { calculateRow, calculateGroup, getPeriodBusinessDays, getMonthBusinessDays } from '@/lib/trackingCalculations'
import { usePeriod } from '@/components/PeriodProvider'
import { useComisionesData, matchTipoVenta } from '@/hooks/useComisionesData'
import { PeriodSelector } from '@/components/PeriodSelector'
import { useGuard } from '@/hooks/useGuard'
import { canEdit } from '@/lib/permissions'

export default function TrackingDashboard() {
  const router = useRouter()
  const { activePeriodKey, availablePeriods } = usePeriod()
  const activePeriodStatus = availablePeriods?.find(p => p.period_key === activePeriodKey)?.status || 'ACTIVE'
  const { sellerStats, loading: comLoading } = useComisionesData()
  
  const periodYear = activePeriodKey ? Number(activePeriodKey.split('_')[0]) : new Date().getFullYear()
  const periodMonth = activePeriodKey ? Number(activePeriodKey.split('_')[1]) : new Date().getMonth() + 1
  
  const { user } = useGuard('MODULE_JEFE_TIENDAS')
  const canEditFlag = user ? canEdit(user, 'MODULE_JEFE_TIENDAS') : false
  const isReadOnly = activePeriodStatus === 'HISTORIC' || !canEditFlag
  
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'' | 'Guardando...' | 'Guardado en Nube' | 'Borrador no guardado' | 'Error al guardar'>('')
  const [comerciales, setComerciales] = useState<any[]>([])
  const [tiendaRules, setTiendaRules] = useState<any[]>([])
  const [tiendaHours, setTiendaHours] = useState<any[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [trackRes, comRes, configRes] = await Promise.all([
        fetch(`/api/tracking?month=${periodMonth}&year=${periodYear}`),
        fetch('/api/comerciales'),
        fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`)
      ])
      
      const comData = await comRes.json()
      if (comData.success) {
        setComerciales(comData.comerciales)
      }

      const configData = await configRes.json()
      const rules = configData.success ? (configData.rules || []) : []
      const hours = configData.success ? (configData.hours || []) : []
      
      if (configData.success) {
        setTiendaRules(rules)
        setTiendaHours(hours)
      }

      const trackData = await trackRes.json()
      if (trackData.groups) {
        let clientGroups = trackData.groups.map((g: any) => ({
            ...g,
            _id: g.id || crypto.randomUUID(),
            rows: g.rows.map((r: any) => ({ ...r, _id: r.id || crypto.randomUUID() }))
        }))

        // Auto-sincronizar los objetivos desde Comisiones si coinciden los nombres
        clientGroups = clientGroups.map((g: any) => {
            const matchedRule = rules.find((r:any) => r.nombre.toLowerCase() === g.name.toLowerCase());
            if (matchedRule) {
                return {
                    ...g,
                    rows: g.rows.map((r: any) => {
                         const comercialHour = hours.find((h:any) => String(h.comercial).toLowerCase() === String(r.comercialName).toLowerCase());
                         const horario = comercialHour ? Number(comercialHour.horario) : 0;
                         let obj1 = 0;
                         const totalHoras = matchedRule.totalHoras || 0;
                         if (totalHoras > 0 && horario > 0) {
                             obj1 = (matchedRule.objPrimerTramo / totalHoras) * horario;
                         } else {
                             obj1 = matchedRule.objPrimerTramo || 0;
                         }
                         // Excluir temporalmente a Marta (Tienda O2)
                         if (String(r.comercialName).toLowerCase().includes('marta')) {
                             obj1 = 0;
                         }
                         return { ...r, objectiveMonth: Math.round(obj1 * 10) / 10 };
                    })
                };
            }
            return g;
        });

        setGroups(clientGroups)
        setInitialLoad(true)
        setTimeout(() => setInitialLoad(false), 500)
      }

    } catch(e) { console.error(e) }
    setLoading(false)
  }, [periodMonth, periodYear, activePeriodKey])

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
    const initialRows = comerciales.length > 0 
      ? comerciales.map(c => ({
          _id: crypto.randomUUID(),
          comercialName: c.name,
          objectiveMonth: 0,
          week1: 0, week2: 0, week3: 0, week4: 0
        }))
      : [{ _id: crypto.randomUUID(), comercialName: 'Nuevo Comercial', objectiveMonth: 0, week1: 0, week2: 0, week3: 0, week4: 0 }]
      
    setGroups(prev => [...prev, { _id: crypto.randomUUID(), name: 'NUEVA PALANCA', rows: initialRows }])
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
  const renderCellInput = (gId: string, rId: string, field: string, val: number, autoDisabled: boolean = false, isCurrency: boolean = false, width: number = 60) => {
    const disabled = isReadOnly || autoDisabled;
    if (disabled) {
        const valStr = val === 0 ? '-' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(val) + (isCurrency ? ' €' : '');
        return (
            <div style={{ width, padding: '4px', textAlign: 'center', fontWeight: 600, border: '1px solid var(--border-light)', borderRadius: 4, background: 'var(--active-bg)', opacity: 0.8, fontSize: 11, display: 'inline-block', boxSizing: 'border-box', color: 'var(--text-main)' }}>
                {valStr}
            </div>
        )
    }
    return (
      <div style={{ position: 'relative', width, display: 'inline-block' }}>
        <input 
          type="number" 
          disabled={disabled}
          value={val === 0 ? '' : val} 
          onChange={e => updateRow(gId, rId, field, e.target.value)}
          className="ds-input"
          style={{ width: '100%', paddingTop: '4px', paddingBottom: '4px', paddingLeft: '4px', paddingRight: (!disabled && isCurrency) ? '18px' : '4px', textAlign: 'center', fontWeight: 600, border: '1px solid var(--border-light)', borderRadius: 4, background: 'var(--bg-card)', opacity: 1, boxSizing: 'border-box', fontSize: 11 }}
        />
        {(!disabled && isCurrency) && (
          <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)', pointerEvents: 'none', fontWeight: 700 }}>
            €
          </span>
        )}
      </div>
    )
  }

  const num = (n: number, isCurrency: boolean = false) => {
    const formatted = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n);
    return isCurrency ? formatted + ' €' : formatted;
  }
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`

  const augmentedGroups = useMemo(() => {
    if (!sellerStats || sellerStats.length === 0) return groups;
    
    const { totalBusinessDays } = getPeriodBusinessDays(periodYear, periodMonth);
    const q1 = totalBusinessDays / 4;
    const q2 = totalBusinessDays / 2;
    const q3 = (totalBusinessDays * 3) / 4;

    return groups.map((g: any) => {
        const matchedRule = tiendaRules.find(rule => rule.nombre.toLowerCase() === g.name.toLowerCase());
        if (!matchedRule) return g;
        
        const isPercentage = String(matchedRule.importePrimerTramo || '').includes('%');
        
        return {
            ...g,
            isAuto: true,
            isCurrency: isPercentage,
            rows: g.rows.map((r: any) => {
                let w1 = 0, w2 = 0, w3 = 0, w4 = 0;
                
                const sStat = sellerStats.find(s => s.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === String(r.comercialName).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
                
                if (sStat && sStat.rawSales) {
                    sStat.rawSales.forEach((sale: any) => {
                        if (matchTipoVenta(sale, matchedRule.productosCuentan)) {
                            let cuotaValue = isPercentage ? (Number(sale.cuota) || 0) : 1;
                            const d = new Date(sale.timestamp);
                            const day = d.getDate();
                            const bDay = getMonthBusinessDays(periodYear, periodMonth, day);
                            
                            if (bDay <= q1) w1 += cuotaValue;
                            else if (bDay <= q2) w2 += cuotaValue;
                            else if (bDay <= q3) w3 += cuotaValue;
                            else w4 += cuotaValue;
                        }
                    });
                }
                
                return { 
                    ...r, 
                    week1: Math.round(w1 * 10) / 10, 
                    week2: Math.round(w2 * 10) / 10, 
                    week3: Math.round(w3 * 10) / 10, 
                    week4: Math.round(w4 * 10) / 10 
                };
            })
        }
    });
  }, [groups, sellerStats, tiendaRules]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', padding: 20 }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '12px 20px', borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.02)', marginBottom: 16, position: 'sticky', top: 0, zIndex: 100 }}>
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

          {/* SELECTOR DE PERIODO Y BOTON */}
          <PeriodSelector />
          
          {!isReadOnly && (
            <button onClick={addGroup} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              <Plus size={16} /> Palanca
            </button>
          )}
        </div>
      </div>

      {(loading || comLoading) ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Calculando arquitectura dimensional...</div>
      ) : augmentedGroups.length === 0 && activePeriodStatus === 'DRAFT' ? (
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
      ) : augmentedGroups.length === 0 && activePeriodStatus === 'ACTIVE' ? (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
             Este mes activo está vacío. Usa el botón [+ Palanca] del menú superior para añadir comerciales.
          </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {augmentedGroups.map((g: any, i: number) => {
            const macro = calculateGroup(g, periodYear, periodMonth)

            return (
              <div key={g._id} style={{ display: 'flex', gap: 16, background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                {/* ZONA IZQUIERDA: FILAS Y METRICAS MANUALES */}
                <div style={{ flex: 1, padding: 16, overflowX: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <input 
                       disabled={isReadOnly}
                       value={g.name} 
                       onChange={e => {
                         const newName = e.target.value;
                         const matchedRule = tiendaRules.find(r => r.nombre.toLowerCase() === newName.toLowerCase());
                         
                         setGroups(prev => prev.map(pg => {
                           if (pg._id !== g._id) return pg;
                           
                           let newRows = pg.rows;
                           if (matchedRule) {
                             newRows = pg.rows.map((r: any) => {
                               const comercialHour = tiendaHours.find((h:any) => String(h.comercial).toLowerCase() === String(r.comercialName).toLowerCase());
                               const horario = comercialHour ? Number(comercialHour.horario) : 0;
                               let obj1 = 0;
                               const totalHoras = matchedRule.totalHoras || 0;
                               if (totalHoras > 0 && horario > 0) {
                                   obj1 = (matchedRule.objPrimerTramo / totalHoras) * horario;
                               } else {
                                   obj1 = matchedRule.objPrimerTramo || 0;
                               }
                               // Excluir temporalmente a Marta (Tienda O2)
                               if (String(r.comercialName).toLowerCase().includes('marta')) {
                                   obj1 = 0;
                               }
                               return { ...r, objectiveMonth: Math.round(obj1 * 10) / 10 };
                             });
                           }
                           
                           return { ...pg, name: newName, rows: newRows };
                         }));
                       }}
                       style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', border: 'none', background: 'transparent', outline: 'none', opacity: isReadOnly ? 0.7 : 1 }}
                    />
                    {!isReadOnly && (
                      <button onClick={() => deleteGroup(g._id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    )}
                  </div>
                  
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: 'var(--header-bg)', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700 }}>
                        <td style={{ padding: '6px', textAlign: 'left' }}>COMERCIAL</td>
                        <td style={{ padding: '6px', borderRight: '2px solid #e2e8f0' }}>OBJ MES</td>
                        <td style={{ padding: '6px', color: '#94a3b8' }}>Etapa 1</td>
                        <td style={{ padding: '6px', color: '#94a3b8' }}>Etapa 2</td>
                        <td style={{ padding: '6px', color: '#94a3b8' }}>Etapa 3</td>
                        <td style={{ padding: '6px', borderRight: '2px solid #e2e8f0', color: '#94a3b8' }}>Etapa 4</td>
                        <td style={{ padding: '6px', color: 'var(--text-main)' }}>TOTAL</td>
                        <td style={{ padding: '6px', color: 'var(--text-main)' }}>QUEDAN</td>
                        <td style={{ padding: '6px', color: 'var(--text-main)' }}>AVANCE %</td>
                        <td style={{ padding: '6px' }}></td>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r: any) => {
                        const m = calculateRow(r)
                        const pColor = m.progressPercent >= 1 ? '#22c55e' : (m.progressPercent >= 0.5 ? '#eab308' : '#ef4444')

                        return (
                          <tr key={r._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px' }}>
                              <input 
                                disabled={isReadOnly}
                                value={r.comercialName} 
                                onChange={e => updateRowName(g._id, r._id, e.target.value)} 
                                style={{ width: 120, border: 'none', fontWeight: 600, color: 'var(--text-main)', opacity: isReadOnly ? 0.7 : 1, background: 'transparent' }} 
                              />
                            </td>
                            <td style={{ padding: '6px', textAlign: 'center', borderRight: '2px solid #f1f5f9' }}>
                              {renderCellInput(g._id, r._id, 'objectiveMonth', r.objectiveMonth, false, g.isCurrency, 90)}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>{renderCellInput(g._id, r._id, 'week1', r.week1, g.isAuto, false, 65)}</td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>{renderCellInput(g._id, r._id, 'week2', r.week2, g.isAuto, false, 65)}</td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>{renderCellInput(g._id, r._id, 'week3', r.week3, g.isAuto, false, 65)}</td>
                            <td style={{ padding: '6px', textAlign: 'center', borderRight: '2px solid #f1f5f9' }}>{renderCellInput(g._id, r._id, 'week4', r.week4, g.isAuto, false, 65)}</td>
                            
                            <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>{num(m.totalReal, g.isCurrency)}</td>
                            <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: m.remaining > 0 ? '#ef4444' : '#22c55e' }}>{num(m.remaining, g.isCurrency)}</td>
                            <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                               <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, background: pColor + '20', color: pColor }}>{pct(m.progressPercent)}</span>
                            </td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>
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
                <div style={{ width: 340, background: 'var(--bg-app)', borderLeft: '1px solid var(--border-light)', padding: 16, display: 'flex', flexDirection: 'column' }}>
                   <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                      RENDIMIENTO GRUPAL <span title="Cálculos dinámicos en tiempo real"><Info size={14} /></span>
                   </div>

                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                      <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8, border: '1px solid var(--border-light)' }}>
                         <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL VENTAS</div>
                         <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>{num(macro.groupTotalReal, g.isCurrency)}</div>
                      </div>
                      <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8, border: '1px solid var(--border-light)' }}>
                         <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>OBJETIVO M.</div>
                         <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>{num(macro.groupTotalObjective, g.isCurrency)}</div>
                      </div>
                   </div>

                   <div style={{ background: macro.groupRemaining <= 0 ? '#dcfce7' : '#fee2e2', padding: 10, borderRadius: 8, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: macro.groupRemaining <= 0 ? '#166534' : '#991b1b' }}>Faltan del Total</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: macro.groupRemaining <= 0 ? '#166534' : '#991b1b' }}>{num(macro.groupRemaining, g.isCurrency)}</span>
                   </div>

                   <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8, border: '1px solid var(--border-light)', marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                         <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Avance Grupo Todos</span>
                         <span style={{ fontSize: 12, fontWeight: 800, color: '#3b82f6' }}>{pct(macro.groupProgressPercent)}</span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                         <div style={{ width: Math.min(macro.groupProgressPercent * 100, 100) + '%', height: '100%', background: '#3b82f6' }} />
                      </div>
                   </div>

                   <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>PROYECCIONES A FIN DE MES</div>
                   
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #cbd5e1' }}>
                         <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Déficit a día {macro.passedBusinessDays} (s/ {macro.totalBusinessDays})</span>
                         <span style={{ fontSize: 12, fontWeight: 700, color: macro.currentDeficit > 0 ? '#ef4444' : '#10b981' }}>{num(Math.abs(macro.currentDeficit), g.isCurrency)} {macro.currentDeficit > 0 ? '⬇' : '⬆'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-strong)' }}>
                         <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Proyectamos (Volumen)</span>
                         <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>{num(macro.projectedEOM, g.isCurrency)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-strong)' }}>
                         <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Proyectamos (% Éxito)</span>
                         <span style={{ fontSize: 12, fontWeight: 800, color: macro.projectedPercent >= 1 ? '#10b981' : '#f59e0b' }}>{pct(macro.projectedPercent)}</span>
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
