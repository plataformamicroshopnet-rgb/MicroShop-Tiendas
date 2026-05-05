'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, FileText, AlertCircle, Lock } from 'lucide-react'
import { usePeriod } from '@/components/PeriodProvider' // <-- Inject Period

export default function ObjetivosTab({ activeSegment: activeSegmentProp }: { activeSegment: 'Pyme' | 'Captador' }) {
  const { activePeriodKey, availablePeriods, isLoadingPeriods } = usePeriod()
  
  // Encontrar estado del periodo maestro
  const activePeriodObj = availablePeriods.find(p => p.period_key === activePeriodKey)
  const isHistoric = activePeriodObj?.status === 'HISTORIC'

  // Helper para convertir "2026_03" a "202603"
  const activeMonthStr = activePeriodKey ? activePeriodKey.replace('_', '') : ''

  // Encontrar el periodo inmediatamente anterior cronológicamente
  const sortedPeriods = [...availablePeriods].sort((a, b) => {
     if (a.year !== b.year) return a.year - b.year
     return a.month - b.month
  })
  const currentIndex = sortedPeriods.findIndex(p => p.period_key === activePeriodKey)
  const previousPeriod = currentIndex > 0 ? sortedPeriods[currentIndex - 1] : null
  const previousMonthStr = previousPeriod ? previousPeriod.period_key.replace('_', '') : null

  const [data, setData] = useState<any>({ Pyme: {}, Captador: {} })
  const [grupos, setGrupos] = useState<any>({ Pyme: {}, Captador: {} })
  
  // Outstanding Dirty Rows tracking
  const [unsavedRows, setUnsavedRows] = useState<{ segment: 'Pyme' | 'Captador', product: string }[]>([])
  const [savingRowPulse, setSavingRowPulse] = useState<{ segment: 'Pyme' | 'Captador', product: string } | null>(null)
  
  // Track strictly deleted products to prevent DEFAULT_OBJECTIVES from resurrecting
  const [deletedProducts, setDeletedProducts] = useState<{ segment: 'Pyme' | 'Captador', product: string }[]>([])
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const activeSegment = activeSegmentProp
  
  // El control de meses ya no es un array gigante, forzamos que sea el mes del PeriodProvider
  const months = activeMonthStr ? [activeMonthStr] : [] 
  
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [pasteStartField, setPasteStartField] = useState<string>('grupo')

  useEffect(() => {
    if (!activePeriodKey) return
    setLoading(true)
    fetch(`/api/objetivos?periodKey=${activePeriodKey}&strictPeriod=1`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.objetivos) {
          setData(res.objetivos)
          if (res.grupos) setGrupos(res.grupos)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [activePeriodKey])

  const handleSave = async () => {
    if (isHistoric) return alert('No puedes modificar un mes histórico.')
    setSaving(true)
    try {
      const res = await fetch('/api/objetivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objetivos: data, grupos })
      })
      const apiRes = await res.json()
      if (apiRes.success) {
         alert('✅ Objetivos del periodo guardados')
         setUnsavedRows([])
      }
      else alert('❌ Error: ' + apiRes.error)
    } catch (e) {
      alert('Error guardando')
    }
    setSaving(false)
  }

  const updateCell = (month: string, product: string, value: string) => {
    if (isHistoric) return
    const numValue = value === '' ? '' : Number(value.replace(',', '.'))
    setData((prev: any) => ({
      ...prev,
      [activeSegment]: {
        ...prev[activeSegment],
        [month]: {
          ...(prev[activeSegment]?.[month] || {}),
          [product]: numValue
        }
      }
    }))
    
    // Mark as unsaved
    setUnsavedRows(prev => {
        if (!prev.find(ur => ur.segment === activeSegment && ur.product === product)) {
            return [...prev, { segment: activeSegment, product }]
        }
        return prev
    })
  }

  const handleGroupChange = (product: string, value: string) => {
      if (isHistoric) return
      setGrupos((prev: any) => ({
        ...prev,
        [activeSegment]: {
          ...(prev[activeSegment] || {}),
          [product]: value
        }
      }))
      
      // Mark as unsaved
      setUnsavedRows(prev => {
          if (!prev.find(ur => ur.segment === activeSegment && ur.product === product)) {
              return [...prev, { segment: activeSegment, product }]
          }
          return prev
      })
  }

  const handleSaveSingleObjective = async (product: string) => {
      if (isHistoric) return
      const monthsPayload: Record<string, number> = {}
      months.forEach(m => {
          const val = data[activeSegment]?.[m]?.[product]
          if (val !== undefined && val !== '') {
              monthsPayload[m] = val
          }
      })
      
      const grupoObj = grupos[activeSegment]?.[product] || null

      try {
          const res = await fetch('/api/objetivos', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  profile: activeSegment,
                  objKey: product,
                  months: monthsPayload,
                  grupo: grupoObj
              })
          })
          
          if (res.ok) {
              setSavingRowPulse({ segment: activeSegment, product })
              setTimeout(() => setSavingRowPulse(null), 1500)
              setUnsavedRows(prev => prev.filter(ur => !(ur.segment === activeSegment && ur.product === product)))
          } else {
              alert('Error al guardar la fila')
          }
      } catch (e) {
          console.error("Save row failed", e)
      }
  }

  const handleDeleteSingleObjective = async (product: string) => {
      if (isHistoric) return
      if (!window.confirm(`¿Seguro que quieres eliminar el objetivo "${product}"?`)) return
      
      const originalData = { ...data }
      const originalGrupos = { ...grupos }
      const originalUnsavedRows = [...unsavedRows]
      const originalDeletedProducts = [...deletedProducts]

      // Optimistic UI clear
      setDeletedProducts(prev => [...prev, { segment: activeSegment, product }])
      
      setData((prev: any) => {
          const copy = JSON.parse(JSON.stringify(prev))
          months.forEach(m => {
              if (copy[activeSegment]?.[m] && copy[activeSegment][m][product] !== undefined) {
                  delete copy[activeSegment][m][product]
              }
          })
          return copy
      })
      
      setGrupos((prev: any) => {
          const copy = JSON.parse(JSON.stringify(prev))
          if (copy[activeSegment] && copy[activeSegment][product] !== undefined) {
              delete copy[activeSegment][product]
          }
          return copy
      })
      
      setUnsavedRows(prev => prev.filter(ur => !(ur.segment === activeSegment && ur.product === product)))

      try {
          const res = await fetch(`/api/objetivos?profile=${activeSegment}&objKey=${encodeURIComponent(product)}`, {
              method: 'DELETE'
          })
          
          if (!res.ok) {
              throw new Error('Falló el borrado en servidor')
          }
      } catch (e) {
          console.error("Fallo al eliminar de BD", e)
          alert('Error al eliminar de la base de datos. Se ha restaurado la fila.')
          // Rollback
          setData(originalData)
          setGrupos(originalGrupos)
          setUnsavedRows(originalUnsavedRows)
          setDeletedProducts(originalDeletedProducts)
      }
  }

  const handleBulkImport = (actionType: 'append' | 'replace' = 'append') => {
    if (isHistoric) return
    if (actionType === 'replace') {
        if(!window.confirm("⚠️ ATENCIÓN: ¿Seguro? Se borrarán todos los objetivos de este mes en BD.")) return
    }
    
    if (!bulkText.trim()) return

    const lines = bulkText.split('\n').filter(l => l.trim().length > 0)
    let newData = { ...data }
    let newGrupos = { ...grupos }
    let newDeleted = [...deletedProducts]

    if (actionType === 'replace') {
        const currentKeys = new Set<string>()
        months.forEach(m => {
            Object.keys(data[activeSegment]?.[m] || {}).forEach(k => currentKeys.add(k))
        })
        const keysToHide = Array.from(currentKeys).map(k => ({ segment: activeSegment, product: k }))
        newDeleted = [...newDeleted, ...keysToHide]
        
        newData[activeSegment] = {}
        newGrupos[activeSegment] = {}
    }

    const importedProducts = new Set<string>()

    lines.forEach((line) => {
      const parts = line.split('\t').map(p => p.trim())
      let colIdx = 0
      let product = ''
      
      if (pasteStartField === 'grupo') {
         if (parts.length > 1) {
             const grupoStr = parts[0]
             product = parts[1]
             if (!newGrupos[activeSegment]) newGrupos[activeSegment] = {}
             newGrupos[activeSegment][product] = grupoStr
             colIdx = 2
         }
      } else {
         product = parts[0]
         colIdx = 1
      }

      if (product) {
        importedProducts.add(product)
        months.forEach((month, idx) => {
          if (parts[colIdx + idx] !== undefined) {
             const cleanStr = parts[colIdx + idx].trim().replace(/\./g, '').replace(',', '.')
             const val = Number(cleanStr)
             if (!isNaN(val)) {
               if (!newData[activeSegment]) newData[activeSegment] = {}
               if (!newData[activeSegment][month]) newData[activeSegment][month] = {}
               newData[activeSegment][month][product] = val
             }
          }
        })
      }
    })

    newDeleted = newDeleted.filter(dp => !(dp.segment === activeSegment && importedProducts.has(dp.product)))

    setData(newData)
    setGrupos(newGrupos)
    setDeletedProducts(newDeleted)
    setBulkText('')
    setShowBulk(false)
  }

  const handleCloneFromPrevious = () => {
     if (isHistoric || !previousMonthStr) return
     if (!window.confirm(`¿Seguro que quieres clonar íntegramente los objetivos Pyme y Captador desde el periodo ${previousPeriod?.period_key}?`)) return
     
     const clonedData = JSON.parse(JSON.stringify(data))
     const clonesToMark: { segment: 'Pyme' | 'Captador', product: string }[] = []
     
     const segments: ('Pyme'|'Captador')[] = ['Pyme', 'Captador']
     segments.forEach(segment => {
         const pastSegmentData = data[segment]?.[previousMonthStr] || {}
         if (!clonedData[segment]) clonedData[segment] = {}
         clonedData[segment][activeMonthStr] = { ...pastSegmentData }
         
         Object.keys(pastSegmentData).forEach(prod => {
             // Solo lo marcamos como no guardado si no estaba ya marcado y si no estaba eliminado artificialmente
             clonesToMark.push({ segment, product: prod })
         })
     })
     
     setData(clonedData)
     setUnsavedRows(prev => [...prev, ...clonesToMark])
  }

  const handleClearTable = () => {
    if (isHistoric) return
    if (!window.confirm(`⚠️ ATENCIÓN: ¿Seguro que quieres VACIAR TODA LA TABLA de Objetivos ${activeSegment} de este mes?`)) return
    
    const toBeDeleted = rowKeys.map(k => ({ segment: activeSegment, product: k }))
    setDeletedProducts(prev => [...prev, ...toBeDeleted])
    
    setData((prev: any) => ({ ...prev, [activeSegment]: {} }))
    setGrupos((prev: any) => ({ ...prev, [activeSegment]: {} }))
  }

  if (loading || isLoadingPeriods) return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', textAlign: 'center' }}>Cargando matriz de objetivos espaciotemporal...</div>

  // Recopilar productos
  const rowKeysSet = new Set<string>()
  months.forEach(m => {
    Object.keys(data[activeSegment]?.[m] || {}).forEach(k => rowKeysSet.add(k))
  })
  
  const rowKeys = Array.from(rowKeysSet).filter(k => 
      !deletedProducts.some(dp => dp.segment === activeSegment && dp.product === k)
  )

  return (
    <div style={{ paddingBottom: 60 }}>
      
      {/* BANNER DE CONTEXTO/TIEMPO */}
      <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, background: isHistoric ? 'rgba(255,255,255,0.05)' : 'rgba(0,173,239,0.1)', border: isHistoric ? '1px solid var(--border-color)' : '1px solid var(--mercedes-cyan)' }}>
        {isHistoric ? <Lock size={20} color="var(--medium-gray)" /> : <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--mercedes-cyan)', boxShadow: '0 0 10px rgba(0,173,239,0.5)' }} />}
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}>
            📍 Administrando Objetivos del Periodo: <strong style={{ color: isHistoric ? 'var(--medium-gray)' : 'var(--mercedes-cyan)' }}>{activePeriodKey}</strong>
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--medium-gray)' }}>
            Estado: {activePeriodObj?.status || 'SIN REGISTRO'} {isHistoric && '(Bloqueado por Archivo Histórico)'}
          </p>
        </div>
      </div>

      {/* HEADER LOCAL */}
      {!isHistoric && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 20 }}>
          <button onClick={() => setShowBulk(!showBulk)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={16} /> Importar Datos
          </button>
          <button onClick={handleClearTable} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #FF453A', color: '#FF453A' }}>
            <Trash2 size={16} /> Limpiar Todo
          </button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Periodo'}
          </button>
        </div>
      )}

      {showBulk && !isHistoric && (
        <div className="card" style={{ padding: 20, marginBottom: 20, border: '1px dashed var(--mercedes-cyan)' }}>
           <h4>Importar {activeSegment} - {activePeriodKey}</h4>
           <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
             <label style={{ fontSize: 13, color: 'var(--medium-gray)', fontWeight: 600 }}>La primera columna del Excel es:</label>
             <select 
               className="form-input" 
               value={pasteStartField} 
               onChange={e => setPasteStartField(e.target.value)}
               style={{ width: 150, padding: 6, fontSize: 13, backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--light-text)' }}
             >
               <option value="grupo">Grupo</option>
               <option value="producto">Producto</option>
             </select>
           </div>
           <p style={{ fontSize: 13, color: 'var(--medium-gray)', marginBottom: 8 }}>Pega desde Excel. Columnas esperadas: {pasteStartField === 'grupo' ? 'Grupo | Producto | ' : 'Producto | '} {activeMonthStr}</p>
           <textarea 
             className="form-textarea" 
             rows={6} 
             value={bulkText} 
             onChange={e => setBulkText(e.target.value)}
             placeholder={`FUSIÓN DIGITAL TOTAL\t2.4\nAltas BAF TOTAL\t1.5`}
           />
           <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
             <button onClick={() => setShowBulk(false)} className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
             <button onClick={() => handleBulkImport('append')} className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 16px', color: 'var(--mercedes-cyan)', border: '1px solid var(--mercedes-cyan)' }}>Añadir a los actuales</button>
             <button onClick={() => handleBulkImport('replace')} className="btn btn-primary" style={{ fontSize: 13, padding: '8px 16px', backgroundColor: 'var(--brand-danger)', color: 'var(--bg-card)' }}>Limpiar y Reemplazar</button>
           </div>
        </div>
      )}

      {rowKeys.length === 0 && !isHistoric ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--medium-gray)', border: '1px dashed var(--border-color)', borderRadius: 16 }}>
          <p style={{ margin: '0 0 20px 0' }}>No hay objetivos configurados para el mes seleccionado ({activePeriodKey}). Empieza añadiendo filas pegando un excel o rellenando datos.</p>
          
          {previousPeriod && (Object.keys(data.Pyme?.[previousMonthStr!] || {}).length > 0 || Object.keys(data.Captador?.[previousMonthStr!] || {}).length > 0) && (
             <button 
                onClick={handleCloneFromPrevious}
                style={{ padding: '12px 24px', background: 'var(--mercedes-cyan)', color: '#000', borderRadius: 10, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
             >
                <FileText size={18} /> Clonar Plantilla desde el Mes Anterior: {previousPeriod.period_key}
             </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto', opacity: isHistoric ? 0.7 : 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--active-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)', width: 140 }}>GRUPO</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>PRODUCTO</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--mercedes-cyan)' }}>CUOTA ({activePeriodKey})</th>
                {!isHistoric && <th style={{ padding: '12px 16px', textAlign: 'center', width: 90 }}>ACCIONES</th>}
              </tr>
            </thead>
            <tbody>
              {rowKeys.map(prod => {
                const rowIsUnsaved = unsavedRows.some(ur => ur.segment === activeSegment && ur.product === prod)
                const isSavingPulse = savingRowPulse?.segment === activeSegment && savingRowPulse?.product === prod
                
                return (
                <tr key={prod} style={{ borderBottom: '1px solid var(--table-border)', borderLeft: rowIsUnsaved ? '4px solid #FF9500' : 'none' }}>
                  <td style={{ padding: '8px 12px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input 
                      type="text"
                      disabled={isHistoric}
                      style={{ width: '100%', padding: 6, backgroundColor: 'transparent', color: isHistoric ? 'var(--medium-gray)' : 'var(--mercedes-cyan)', border: '1px solid transparent', borderRadius: 4, textTransform: 'uppercase', fontSize: 13, fontWeight: 700 }}
                      value={grupos[activeSegment]?.[prod] || ''}
                      onChange={(e) => handleGroupChange(prod, e.target.value)}
                      placeholder="Grupo..."
                    />
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}>{prod}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <input 
                      type="number"
                      step="0.1"
                      disabled={isHistoric}
                      style={{ width: 80, padding: 6, textAlign: 'center', backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', color: 'var(--light-text)', border: isHistoric ? 'none' : '1px solid var(--border-color)', borderRadius: 4 }}
                      value={data[activeSegment]?.[activeMonthStr]?.[prod] !== undefined ? data[activeSegment][activeMonthStr][prod] : ''}
                      onChange={(e) => updateCell(activeMonthStr, prod, e.target.value)}
                    />
                  </td>
                  {!isHistoric && (
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
                            {rowIsUnsaved && (
                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FF9500', marginRight: 4 }} title="Cambios sin guardar" />
                            )}
                            <button 
                                onClick={() => handleSaveSingleObjective(prod)} 
                                className="btn" 
                                style={{ 
                                    padding: '6px', 
                                    backgroundColor: isSavingPulse ? '#34C759' : 'transparent', 
                                    color: isSavingPulse ? 'var(--bg-card)' : 'var(--mercedes-cyan)', 
                                    border: `1px solid ${isSavingPulse ? '#34C759' : 'transparent'}`, 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', opacity: rowIsUnsaved || isSavingPulse ? 1 : 0.4
                                }}
                                title="Guardar Fila"
                            >
                                <Save size={16} />
                            </button>
                            <button 
                                onClick={() => handleDeleteSingleObjective(prod)} 
                                className="btn" 
                                style={{ padding: '6px', backgroundColor: 'transparent', color: '#FF453A', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8 }}
                                title="Eliminar Fila"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </td>
                  )}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
      
      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--medium-gray)', fontSize: 12, marginTop: 8 }}>
        <AlertCircle size={14} /> 
        <span>Cruzarás estos datos con las ventas reales en la pestaña Liquidación. Los objetivos ahora están sincronizados por defecto al Selector Maestro Global de la cabecera.</span>
      </div>
    </div>
  )
}
