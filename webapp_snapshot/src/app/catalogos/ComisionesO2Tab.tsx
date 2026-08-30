'use client'

import { useState, useEffect } from 'react'

import { Save, Plus, Trash2, FileText, AlertCircle } from 'lucide-react'
import { usePeriod } from '@/components/PeriodProvider'
import RuleConditionBuilder from '@/components/RuleConditionBuilder'
import ProductTreeSelector from '@/components/ProductTreeSelector'

export default function ComisionesO2Tab() {
  const { activePeriodKey, availablePeriods, isLoadingPeriods } = usePeriod()
  const activePeriodObj = availablePeriods.find(p => p.period_key === activePeriodKey)
  const isHistoric = activePeriodObj?.status === 'HISTORIC'
  // Opción B: permitir editar las Reglas O2 de un mes CERRADO (histórico) de forma DELIBERADA,
  // para corregir errores de configuración (p.ej. productos "Fibra Adicional" metidos por error
  // en la regla de fibra). Por defecto sigue bloqueado; el botón "Editar mes cerrado" lo abre.
  const [unlockedHistoric, setUnlockedHistoric] = useState(false)
  const editLocked = isHistoric && !unlockedHistoric

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [rules, setRules] = useState<any[]>([])
  const [hours, setHours] = useState<any[]>([])
  // true = este mes NO tiene reglas O2 guardadas (se enseña el botón de traerlas
  // del mes anterior — la copia solo con ese clic, nunca sola).
  const [sinReglas, setSinReglas] = useState(false)

  useEffect(() => {
    if (!activePeriodKey) return
    setLoading(true)
    // EL BUG DEL ARRASTRE (30-ago-2026, encargo del dueño): si el mes no tenía
    // su clave, el estado del mes ANTERIOR se quedaba en pantalla y al Guardar
    // se escribía en el mes nuevo — «se copian al ir hacia atrás». Ahora la
    // pantalla se vacía SIEMPRE al cambiar de mes; copiar del anterior es un
    // botón aparte (autorización expresa).
    setRules([]); setHours([]); setSinReglas(false)
    let vivo = true
    const mesPedido = activePeriodKey
    fetch(`/api/settings?key=o2_rules_v2_${mesPedido}`)
      .then(r => r.json())
      .then(res => {
        if (!vivo || mesPedido !== activePeriodKey) return
        if (res.success && res.value) {
          try {
            const parsed = JSON.parse(res.value);
            setRules(parsed.rules || [])
            setHours(parsed.hours || [])
          } catch(e) { setSinReglas(true) }
        } else {
          setSinReglas(true)
        }
        setLoading(false)
      })
      .catch(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [activePeriodKey])

  // Mes anterior de '2026_09' → '2026_08' (aritmética pura).
  const mesAnterior = (() => {
    const m = /^(\d{4})_(\d{2})$/.exec(String(activePeriodKey || ''))
    if (!m) return ''
    const t = Number(m[1]) * 12 + (Number(m[2]) - 1) - 1
    return `${Math.floor(t / 12)}_${String((t % 12) + 1).padStart(2, '0')}`
  })()

  const traerDelMesAnterior = async () => {
    if (!mesAnterior) return
    try {
      const res = await fetch(`/api/settings?key=o2_rules_v2_${mesAnterior}`)
      const data = await res.json()
      if (data.success && data.value) {
        const parsed = JSON.parse(data.value)
        setRules(parsed.rules || [])
        setHours(parsed.hours || [])
        setSinReglas(false)
        alert(`Reglas O2 de ${mesAnterior} traídas a la pantalla. Revisa y pulsa Guardar para dejarlas en ${activePeriodKey}.`)
      } else {
        alert(`${mesAnterior} tampoco tiene reglas O2 guardadas.`)
      }
    } catch {
      alert('No se pudieron traer las reglas del mes anterior.')
    }
  }

  const handleSave = async () => {
    if (editLocked) return alert('No puedes modificar un mes histórico.')
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: `o2_rules_v2_${activePeriodKey}`, value: JSON.stringify({ rules, hours }) })
      })
      const apiRes = await res.json()
      if (apiRes.success) {
         alert('✅ Reglas de comisiones y horarios guardados correctamente.')
      } else {
         alert('❌ Error: ' + apiRes.error)
      }
    } catch (e) {
      alert('Error guardando')
    }
    setSaving(false)
  }

  // ---- RULES HANDLERS ----
  const addRule = () => {
    setRules([...rules, { 
      id: Date.now().toString(),
      nombre: '', 
      productosCuentan: '', 
      objPrimerTramo: '', 
      importePrimerTramo: '', 
      objSegundoTramo: '', 
      importeSegundoTramo: '', 
      condicionantes: '', 
      totalHoras: '' 
    }])
  }

  const updateRule = (index: number, field: string, value: any) => {
    const newRules = [...rules]
    newRules[index] = { ...newRules[index], [field]: value }
    setRules(newRules)
  }

  const removeRule = (index: number) => {
    if (!confirm('¿Seguro que quieres eliminar esta regla?')) return
    const newRules = [...rules]
    newRules.splice(index, 1)
    setRules(newRules)
  }

  // ---- HOURS HANDLERS ----
  const addHour = () => {
    setHours([...hours, { 
      id: Date.now().toString(),
      comercial: '', 
      horario: '' 
    }])
  }

  const updateHour = (index: number, field: string, value: any) => {
    const newHours = [...hours]
    newHours[index] = { ...newHours[index], [field]: value }
    setHours(newHours)
  }

  const removeHour = (index: number) => {
    if (!confirm('¿Seguro que quieres eliminar este comercial?')) return
    const newHours = [...hours]
    newHours.splice(index, 1)
    setHours(newHours)
  }

  if (loading || isLoadingPeriods) return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', textAlign: 'center' }}>Cargando reglas...</div>

  return (
    <div style={{ paddingBottom: 60 }}>
      {sinReglas && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 16,
                      background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10 }}>
          <AlertCircle size={18} color="#d97706" />
          <span style={{ fontSize: 13.5, color: '#92400e', fontWeight: 600 }}>
            {activePeriodKey} no tiene reglas O2 guardadas todavía. Nada se copia solo:
          </span>
          {mesAnterior && !editLocked && (
            <button onClick={traerDelMesAnterior}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d97706',
                             background: '#fff7ed', color: '#b45309', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              Traer las de {mesAnterior}
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        {isHistoric && !unlockedHistoric && (
          <button
            onClick={() => { if (confirm('⚠️ Vas a EDITAR las Reglas O2 de un mes CERRADO (histórico).\n\nÚsalo SOLO para corregir un error de configuración (p.ej. quitar productos metidos por error). Al guardar, las comisiones de ese mes se recalculan.\n\n¿Continuar?')) setUnlockedHistoric(true) }}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, borderColor: '#F5A623', color: '#F5A623' }}
          >
            🔓 Editar reglas de un mes cerrado
          </button>
        )}
        {isHistoric && unlockedHistoric && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#F5A623', fontWeight: 700, fontSize: 13 }}>
            <AlertCircle size={16} /> Editando un mes CERRADO — guarda con cuidado
          </span>
        )}
        {!editLocked && (
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#34C759', color: 'var(--bg-card)', border: 'none', fontWeight: 'bold' }}>
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Configuraciones'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 24, flexDirection: 'column' }}>
        {/* TABLA 1: REGLAS GLOBALES */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: 'var(--mercedes-cyan)' }}>1. Reglas Globales O2 / MovilFree</h3>
            {!editLocked && (
              <button onClick={addRule} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <Plus size={16} /> Añadir Regla
              </button>
            )}
          </div>
          
          <div style={{ overflow: 'visible' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--active-bg)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 8px' }}>Nombre Comisión</th>
                  <th style={{ padding: '12px 8px' }}>Tipo de Venta</th>
                  <th style={{ padding: '12px 8px' }}>Obj. Primer Tramo</th>
                  <th style={{ padding: '12px 8px' }}>Importe 1º</th>
                  <th style={{ padding: '12px 8px' }}>Obj. Segundo Tramo</th>
                  <th style={{ padding: '12px 8px' }}>Importe 2º</th>
                  <th style={{ padding: '12px 8px' }}>Condicionantes</th>
                  <th style={{ padding: '12px 8px' }}>Total Horas</th>
                  {!editLocked && <th style={{ padding: '12px 8px', width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, idx) => (
                  <tr key={rule.id || idx} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '8px' }}>
                      <input type="text" disabled={editLocked} value={rule.nombre || ''} onChange={e => updateRule(idx, 'nombre', e.target.value)} style={{ width: 140, padding: 6, backgroundColor: editLocked ?'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: editLocked ?'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="Alta BAF..." />
                    </td>
                    <td style={{ padding: '8px' }}>
                      {(() => {
                        const predefined = ["Alta BAF Total", "Alta BAF Convergente", "Dispositivos + Seguro", "MPA", "FTTR", "ARPU", "Repo Fútbol"];
                        const isFormulaLibre = rule.productosCuentan?.includes('FORMULA_LIBRE');
                        return (
                          <>
                            <ProductTreeSelector 
                              value={rule.productosCuentan || ''}
                              onChange={val => updateRule(idx, 'productosCuentan', val)}
                              disabled={editLocked}
                            />
                            {isFormulaLibre && (
                              <textarea 
                                disabled={editLocked} 
                                value={rule.productosCuentan || ''} 
                                onChange={e => updateRule(idx, 'productosCuentan', e.target.value)} 
                                style={{ marginTop: 8, width: 180, padding: 6, backgroundColor: editLocked ?'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: editLocked ?'none' : '1px solid var(--border-color)', borderRadius: 4, resize: 'vertical', minHeight: 32 }} 
                                placeholder="Fórmula (ej: MPA + FTTR)..." 
                              />
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="number" step="0.01" disabled={editLocked} value={rule.objPrimerTramo ?? ''} onChange={e => updateRule(idx, 'objPrimerTramo', e.target.value)} style={{ width: 80, padding: 6, backgroundColor: editLocked ?'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: editLocked ?'none' : '1px solid var(--border-color)', borderRadius: 4 }} />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="text" disabled={editLocked} value={rule.importePrimerTramo || ''} onChange={e => updateRule(idx, 'importePrimerTramo', e.target.value)} style={{ width: 80, padding: 6, backgroundColor: editLocked ?'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: editLocked ?'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="€ o %" />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="number" step="0.01" disabled={editLocked} value={rule.objSegundoTramo ?? ''} onChange={e => updateRule(idx, 'objSegundoTramo', e.target.value)} style={{ width: 80, padding: 6, backgroundColor: editLocked ?'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: editLocked ?'none' : '1px solid var(--border-color)', borderRadius: 4 }} />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="text" disabled={editLocked} value={rule.importeSegundoTramo || ''} onChange={e => updateRule(idx, 'importeSegundoTramo', e.target.value)} style={{ width: 80, padding: 6, backgroundColor: editLocked ?'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: editLocked ?'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="€ o %" />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <RuleConditionBuilder 
                        disabled={editLocked} 
                        value={rule.condicionantes || ''} 
                        onChange={val => updateRule(idx, 'condicionantes', val)} 
                        availableGroups={rules.map(r => r.nombre).filter(Boolean)}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="number" step="0.5" disabled={editLocked} value={rule.totalHoras ?? ''} onChange={e => updateRule(idx, 'totalHoras', e.target.value)} style={{ width: 80, padding: 6, backgroundColor: editLocked ?'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: editLocked ?'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="Ej: 262" />
                    </td>
                    {!editLocked && (
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button onClick={() => removeRule(idx)} className="btn" style={{ padding: 4, color: '#FF453A', background: 'transparent', border: 'none' }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: 'var(--medium-gray)' }}>No hay reglas configuradas para este mes.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLA 2: HORARIOS COMERCIALES */}
        <div className="card" style={{ padding: 20, maxWidth: 600 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: 'var(--mercedes-cyan)' }}>2. Horarios de Comerciales</h3>
            {!editLocked && (
              <button onClick={addHour} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <Plus size={16} /> Añadir Comercial
              </button>
            )}
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--active-bg)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px' }}>Comercial</th>
                <th style={{ padding: '12px 8px' }}>Horario (Horas/Semana o Mes)</th>
                {!editLocked && <th style={{ padding: '12px 8px', width: 40 }}></th>}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour, idx) => (
                <tr key={hour.id || idx} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: '8px' }}>
                    <input type="text" disabled={editLocked} value={hour.comercial || ''} onChange={e => updateHour(idx, 'comercial', e.target.value)} style={{ width: '100%', padding: 6, backgroundColor: editLocked ?'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: editLocked ?'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="Nombre del Comercial..." />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input type="number" step="0.5" disabled={editLocked} value={hour.horario ?? ''} onChange={e => updateHour(idx, 'horario', e.target.value)} style={{ width: 120, padding: 6, backgroundColor: editLocked ?'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: editLocked ?'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="Ej: 39" />
                  </td>
                  {!editLocked && (
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button onClick={() => removeHour(idx)} className="btn" style={{ padding: 4, color: '#FF453A', background: 'transparent', border: 'none' }}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {hours.length === 0 && (
                <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: 'var(--medium-gray)' }}>No hay comerciales configurados.</td></tr>
              )}
            </tbody>
          </table>
          
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--medium-gray)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>Los objetivos individuales se prorratearán dividiendo el Objetivo Global entre el Total de Horas (de la tabla superior) y multiplicándolo por el Horario de cada comercial introducido aquí.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
