'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, FileText, AlertCircle } from 'lucide-react'
import { usePeriod } from '@/components/PeriodProvider'

export default function ProductosComisionanTab() {
  const { activePeriodKey, availablePeriods, isLoadingPeriods } = usePeriod()
  const activePeriodObj = availablePeriods.find(p => p.period_key === activePeriodKey)
  const isHistoric = activePeriodObj?.status === 'HISTORIC'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [rules, setRules] = useState<any[]>([])
  const [hours, setHours] = useState<any[]>([])

  useEffect(() => {
    if (!activePeriodKey) return
    setLoading(true)
    fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setRules(res.rules || [])
          setHours(res.hours || [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [activePeriodKey])

  const handleSave = async () => {
    if (isHistoric) return alert('No puedes modificar un mes histórico.')
    setSaving(true)
    try {
      const res = await fetch('/api/tiendas-comisiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey: activePeriodKey, rules, hours })
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 20 }}>
        {!isHistoric && (
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#34C759', color: 'var(--bg-card)', border: 'none', fontWeight: 'bold' }}>
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Configuraciones'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 24, flexDirection: 'column' }}>
        {/* TABLA 1: REGLAS GLOBALES */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: 'var(--mercedes-cyan)' }}>1. Reglas Globales y Tramos de Comisiones</h3>
            {!isHistoric && (
              <button onClick={addRule} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <Plus size={16} /> Añadir Regla
              </button>
            )}
          </div>
          
          <div style={{ overflowX: 'auto' }}>
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
                  {!isHistoric && <th style={{ padding: '12px 8px', width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, idx) => (
                  <tr key={rule.id || idx} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '8px' }}>
                      <input type="text" disabled={isHistoric} value={rule.nombre || ''} onChange={e => updateRule(idx, 'nombre', e.target.value)} style={{ width: 140, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="Alta BAF..." />
                    </td>
                    <td style={{ padding: '8px' }}>
                      {(() => {
                        const predefined = ["Alta BAF Total", "Alta BAF Convergente", "Dispositivos + Seguro", "MPA", "FTTR", "Señalización Solar 360", "ARPU", "Repo Fútbol"];
                        const isPredefined = predefined.includes(rule.productosCuentan);
                        const selectValue = isPredefined ? rule.productosCuentan : (rule.productosCuentan ? 'FORMULA_LIBRE' : '');
                        return (
                          <>
                            <select disabled={isHistoric} value={selectValue} onChange={e => {
                                const val = e.target.value;
                                updateRule(idx, 'productosCuentan', val === 'FORMULA_LIBRE' ? '' : val);
                            }} style={{ width: 180, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }}>
                              <option value="">Seleccionar...</option>
                              {predefined.map(p => <option key={p} value={p}>{p}</option>)}
                              <option disabled>──────────</option>
                              <option value="FORMULA_LIBRE">Fórmula Libre (Antiguo)</option>
                            </select>
                            {selectValue === 'FORMULA_LIBRE' && (
                              <textarea disabled={isHistoric} value={rule.productosCuentan || ''} onChange={e => updateRule(idx, 'productosCuentan', e.target.value)} style={{ marginTop: 8, width: 180, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4, resize: 'vertical', minHeight: 32 }} placeholder="Fórmula..." />
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="number" step="0.01" disabled={isHistoric} value={rule.objPrimerTramo ?? ''} onChange={e => updateRule(idx, 'objPrimerTramo', e.target.value)} style={{ width: 80, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }} />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="text" disabled={isHistoric} value={rule.importePrimerTramo || ''} onChange={e => updateRule(idx, 'importePrimerTramo', e.target.value)} style={{ width: 80, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="€ o %" />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="number" step="0.01" disabled={isHistoric} value={rule.objSegundoTramo ?? ''} onChange={e => updateRule(idx, 'objSegundoTramo', e.target.value)} style={{ width: 80, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }} />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="text" disabled={isHistoric} value={rule.importeSegundoTramo || ''} onChange={e => updateRule(idx, 'importeSegundoTramo', e.target.value)} style={{ width: 80, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="€ o %" />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <textarea disabled={isHistoric} value={rule.condicionantes || ''} onChange={e => updateRule(idx, 'condicionantes', e.target.value)} style={{ width: 220, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4, resize: 'vertical', minHeight: 32 }} placeholder="Reglas..." />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="number" step="0.5" disabled={isHistoric} value={rule.totalHoras ?? ''} onChange={e => updateRule(idx, 'totalHoras', e.target.value)} style={{ width: 80, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="Ej: 262" />
                    </td>
                    {!isHistoric && (
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
            {!isHistoric && (
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
                {!isHistoric && <th style={{ padding: '12px 8px', width: 40 }}></th>}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour, idx) => (
                <tr key={hour.id || idx} style={{ borderBottom: '1px solid var(--table-border)' }}>
                  <td style={{ padding: '8px' }}>
                    <input type="text" disabled={isHistoric} value={hour.comercial || ''} onChange={e => updateHour(idx, 'comercial', e.target.value)} style={{ width: '100%', padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="Nombre del Comercial..." />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input type="number" step="0.5" disabled={isHistoric} value={hour.horario ?? ''} onChange={e => updateHour(idx, 'horario', e.target.value)} style={{ width: 120, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="Ej: 39" />
                  </td>
                  {!isHistoric && (
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
