'use client'

import { useState, useEffect } from 'react'

import { Save, Plus, Trash2, FileText, AlertCircle } from 'lucide-react'
import { usePeriod } from '@/components/PeriodProvider'
import RuleConditionBuilder from '@/components/RuleConditionBuilder'
import ProductTreeSelector from '@/components/ProductTreeSelector'
import { TIENDAS_FISICAS, tiendaDeComercial } from '@/lib/comercialRoster'

export default function ProductosComisionanTab() {
  const { activePeriodKey, availablePeriods, isLoadingPeriods } = usePeriod()
  const activePeriodObj = availablePeriods.find(p => p.period_key === activePeriodKey)
  const isHistoric = activePeriodObj?.status === 'HISTORIC'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [rules, setRules] = useState<any[]>([])
  const [hours, setHours] = useState<any[]>([])
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')

  useEffect(() => {
    if (!activePeriodKey) return
    setLoading(true)
    fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setRules(res.rules || [])
          // Rellenar la tienda de filas antiguas (sin ella) con el mapa de siempre
          setHours((res.hours || []).map((h: any) => ({
            ...h,
            tienda: (h.tienda && String(h.tienda).trim()) || tiendaDeComercial(h.comercial || '')
          })))
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
         // Si el servidor ha rescatado condicionantes que llegaban vacíos, se
         // DICE: un rescate silencioso vuelve a esconder el problema. Quien
         // quiera de verdad quitarlos, que los quite desde su desplegable
         // (eso viaja como '[]' y el servidor lo respeta).
         alert('✅ Reglas de comisiones y horarios guardados correctamente.'
           + (apiRes.avisoCondicionantes ? `\n\n⚠️ ${apiRes.avisoCondicionantes}` : ''))
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
      objTercerTramo: '',
      importeTercerTramo: '',
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

  const handleBulkPaste = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.split('\n').filter(l => l.trim().length > 0);
    const newRules: any[] = [];
    
    // LOS CONDICIONANTES NO VIENEN EN EL EXCEL, Y NO SE PUEDEN PERDER.
    // Son configuración que solo vive en el programa (el 100 % de Dispositivos
    // de ARPU, el 80 % de BAF y los 30 por tienda del Fútbol). Al pegar la tabla
    // llegaban vacíos y, como guardar borra y recrea, se llevaban por delante
    // los candados que había: el segundo tramo se pagaba sin exigir nada y
    // NADIE lo decía. Si la palanca pegada ya existe con ese nombre, se le
    // devuelven los suyos; si el pegado trae la columna 9 con algo, esa manda.
    const condDeAntes = new Map<string, string>();
    rules.forEach((r: any) => {
      const c = String(r?.condicionantes || '').trim();
      if (c) condDeAntes.set(String(r?.nombre || '').trim().toLowerCase(), c);
    });
    const conservados: string[] = [];

    lines.forEach((line) => {
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length > 0 && parts[0]) {
        const heredado = condDeAntes.get(String(parts[0]).trim().toLowerCase()) || '';
        if (!parts[8] && heredado) conservados.push(parts[0]);
        newRules.push({
          id: Date.now().toString() + Math.random().toString(),
          nombre: parts[0] || '',
          productosCuentan: parts[1] || '',
          objPrimerTramo: parts[2] ? parseFloat(parts[2].replace(',', '.')) || '' : '',
          importePrimerTramo: parts[3] || '',
          objSegundoTramo: parts[4] ? parseFloat(parts[4].replace(',', '.')) || '' : '',
          importeSegundoTramo: parts[5] || '',
          objTercerTramo: parts[6] ? parseFloat(parts[6].replace(',', '.')) || '' : '',
          importeTercerTramo: parts[7] || '',
          condicionantes: parts[8] || heredado,
          totalHoras: parts[9] ? parseFloat(parts[9].replace(',', '.')) || '' : ''
        });
      }
    });

    if (newRules.length > 0) {
      setRules([...rules, ...newRules]);
      setPasteText('');
      setShowPasteModal(false);
      if (conservados.length > 0) {
        alert(`⚠️ El Excel no trae condicionantes: se conservan los que ya tenían ${Array.from(new Set(conservados)).join(', ')}.`)
      }
    }
  }

  // ¿Hay algo escrito que no parece un correo? Vacío NO es raro: es lo normal
  // mientras no se hayan ido rellenando. Solo se avisa de lo que está a medias.
  const emailRaro = (v: any) => {
    const s = String(v || '').trim()
    return s !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)
  }

  // ---- HOURS HANDLERS ----
  const addHour = () => {
    setHours([...hours, {
      id: Date.now().toString(),
      comercial: '',
      tienda: '',
      horario: '',
      email: ''
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
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowPasteModal(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, backgroundColor: '#E91E97', color: 'white', border: 'none' }}>
                  <FileText size={16} /> Importar Lista
                </button>
                <button onClick={addRule} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <Plus size={16} /> Añadir Regla
                </button>
              </div>
            )}
          </div>
          
          {showPasteModal && (
            <div style={{ background: '#FFF0F9', padding: 16, borderRadius: 12, marginBottom: 16, border: '1px solid #E91E97' }}>
              <h4 style={{ marginTop: 0, color: '#E91E97' }}>Importar Lista desde Excel</h4>
              <p style={{ fontSize: 13, color: '#333' }}>Copia las filas desde tu Excel respetando el orden de estas 10 columnas: <strong>Nombre Comisión, Tipo de Venta, Obj. Primer Tramo, Importe 1º, Obj. Segundo Tramo, Importe 2º, Obj. 3º Tramo, Importe 3º, Condicionantes, Total Horas</strong>. Pégalas aquí:</p>
              <textarea 
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                style={{ width: '100%', height: 120, padding: 10, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'monospace', whiteSpace: 'pre' }}
                placeholder="Ejemplo:&#10;Alta BAF&#9;Alta BAF Total&#9;15&#9;10€&#9;25&#9;15€&#9;&#9;262"
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={handleBulkPaste} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Procesar y Añadir</button>
                <button onClick={() => setShowPasteModal(false)} style={{ background: '#ccc', color: '#333', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          )}
          
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
                  <th style={{ padding: '12px 8px' }}>Obj. 3º Tramo</th>
                  <th style={{ padding: '12px 8px' }}>Importe 3º</th>
                  <th style={{ padding: '12px 8px', cursor: 'help' }} title="Vacío = paga POR UNIDAD al precio del tramo alcanzado (lo normal). Solo para casos especiales: tramos acumulativos, bono fijo + extra, objetivos de equipo.">Condicionantes ⓘ</th>
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
                        const predefined = ["Alta BAF Total", "Alta BAF Convergente", "Dispositivos + Seguro", "MPA", "FTTR", "ARPU", "Repo Fútbol"];
                        const isFormulaLibre = rule.productosCuentan?.includes('FORMULA_LIBRE');
                        return (
                          <>
                            <ProductTreeSelector 
                              value={rule.productosCuentan || ''}
                              onChange={val => updateRule(idx, 'productosCuentan', val)}
                              disabled={isHistoric}
                            />
                            {isFormulaLibre && (
                              <textarea 
                                disabled={isHistoric} 
                                value={rule.productosCuentan || ''} 
                                onChange={e => updateRule(idx, 'productosCuentan', e.target.value)} 
                                style={{ marginTop: 8, width: 180, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4, resize: 'vertical', minHeight: 32 }} 
                                placeholder="Fórmula (ej: MPA + FTTR)..." 
                              />
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
                      <input type="number" step="0.01" disabled={isHistoric} value={rule.objTercerTramo ?? ''} onChange={e => updateRule(idx, 'objTercerTramo', e.target.value)} style={{ width: 80, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }} />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="text" disabled={isHistoric} value={rule.importeTercerTramo || ''} onChange={e => updateRule(idx, 'importeTercerTramo', e.target.value)} style={{ width: 80, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="€ o %" />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <RuleConditionBuilder
                        disabled={isHistoric} 
                        value={rule.condicionantes || ''} 
                        onChange={val => updateRule(idx, 'condicionantes', val)} 
                        availableGroups={rules.map(r => r.nombre).filter(Boolean)}
                      />
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
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--active-bg)', borderRadius: 8, fontSize: 12.5, color: 'var(--light-text)', lineHeight: 1.55 }}>
            💡 <strong>Cómo se paga cada tramo:</strong> por defecto (<strong>Condicionantes vacío</strong>) la comisión se paga <strong>POR UNIDAD al precio del tramo alcanzado</strong>.
            <br />Ej. tramos 1→20€, 2→30€, 3→40€ &nbsp;→&nbsp; 1 venta = 20€ · 2 ventas = 60€ (30€ c/u) · 3 ventas = 120€ (40€ c/u) · 4+ = a 40€ c/u.
            <br />Los <strong>Condicionantes</strong> solo se usan para casos especiales (acumulativos, bono fijo + extra, objetivos de equipo…).
          </div>
        </div>

        {/* TABLA 2: HORARIOS COMERCIALES */}
        <div className="card" style={{ padding: 20, maxWidth: 1020 }}>
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
                <th style={{ padding: '12px 8px' }}>Tienda</th>
                <th style={{ padding: '12px 8px' }}>Horario (Horas/Semana o Mes)</th>
                <th style={{ padding: '12px 8px' }}>Correo</th>
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
                    <select disabled={isHistoric} value={hour.tienda || ''} onChange={e => updateHour(idx, 'tienda', e.target.value)} style={{ width: '100%', padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }}>
                      <option value="">— Elegir tienda —</option>
                      {TIENDAS_FISICAS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input type="number" step="0.5" disabled={isHistoric} value={hour.horario ?? ''} onChange={e => updateHour(idx, 'horario', e.target.value)} style={{ width: 120, padding: 6, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }} placeholder="Ej: 39" />
                  </td>
                  {/* CORREO. Es el sitio natural: quien esta en esta tabla ES comercial
                      del mes, y a quien es comercial se le puede escribir. Vacio es
                      valido — simplemente esa persona no recibe avisos. El borde se
                      pone ambar si hay algo escrito que no parece un correo, con el
                      mismo criterio del semaforo de llaves: avisar en el sitio donde
                      se teclea, no cuando ya es tarde. */}
                  <td style={{ padding: '8px' }}>
                    <input
                      type="email"
                      disabled={isHistoric}
                      value={hour.email || ''}
                      onChange={e => updateHour(idx, 'email', e.target.value)}
                      style={{
                        width: '100%', minWidth: 190, padding: 6,
                        backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)',
                        color: 'var(--light-text)',
                        border: isHistoric ? 'none' : `1px solid ${emailRaro(hour.email) ? '#F57C00' : 'var(--border-color)'}`,
                        borderRadius: 4
                      }}
                      placeholder="nombre@correo.com"
                      title={emailRaro(hour.email) ? 'Esto no parece un correo' : 'Para los avisos automáticos'}
                    />
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
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--medium-gray)' }}>No hay comerciales configurados.</td></tr>
              )}
            </tbody>
          </table>

          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--medium-gray)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>Esta tabla es la <strong>plantilla del mes</strong>: quien esté aquí cuenta como comercial en todas las pantallas (Comisiones, Torneos, Rentabilidad, MOD…). Si <strong>borras</strong> a alguien desaparece solo de este mes en adelante (su histórico de meses anteriores se conserva). Para <strong>dar de alta</strong> a uno nuevo, añádelo y elígele su Tienda. Los objetivos se prorratean dividiendo el Objetivo Global entre el Total de Horas y multiplicándolo por el Horario de cada comercial. El <strong>Correo</strong> es a dónde le llegarán los avisos automáticos (por ejemplo, una venta a la que le falta el Nº de Pedido): si lo dejas vacío, esa persona sencillamente no recibe ninguno.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
