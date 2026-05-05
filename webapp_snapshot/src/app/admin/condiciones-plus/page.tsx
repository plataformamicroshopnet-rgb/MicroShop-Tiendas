'use client'

import React, { useState, useEffect } from 'react'
import { Save, Plus, Trash2, ArrowLeft, FileSpreadsheet, X, ClipboardList, Database } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { useGuard } from '@/hooks/useGuard'
import { PeriodProvider, usePeriod } from '@/components/PeriodProvider'
import { PeriodSelector } from '@/components/PeriodSelector'

// --- COLUMNAS FIJAS ESTIPULADAS ---
const FIXED_COLUMNS = [
  'Productos FFVV',
  'Objetivo1 Plus',
  'Objetivo2 Plus',
  'Objetivo1 Básico',
  'Objetivo2 Básico',
  'Comisiones Objetivo 1',
  'Comisiones Objetivo 2',
  'Extras llegando toda la Empresa',
  'Objetivos Toda la empresa'
]

// --- COLUMNAS CON ROWSPAN (BLOQUES) ---
const GROUPED_COLUMNS = [
  'Objetivo1 Plus',
  'Objetivo2 Plus',
  'Objetivo1 Básico',
  'Objetivo2 Básico',
  'Objetivos Toda la empresa'
]

// Función para determinar a qué bloque pertenece cada producto (agrupador interno)
const getGroup = (producto: string) => {
  if (!producto) return null;
  const p = String(producto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (p.includes('kit') && p.includes('consulting')) return 'KIT';
  if (p.includes('migra baf')) return 'MBAF';
  if (p.includes('baf') || p.includes('respaldo 5g')) return 'BAF';
  if (p.includes('fd')) return 'FD';
  if (p.includes('fn')) return 'FN';
  if (p.includes('puesto fijo')) return 'PF';
  if (p.includes('renovacion') && p.includes('dispositivo')) return 'REN';
  if (p.includes('alta movil')) return 'ALTA';
  if (p.includes('porta movil') || p.includes('porta')) return 'PORTA';
  if (p.includes('tma')) return 'TMA';
  if (p.includes('micro')) return 'MIC';
  if (p.includes('ti') || p.includes('tgt')) return 'TI';
  if (p.includes('alarma') || p.includes('mpa')) return 'MPA';

  return p.trim();
}

export default function CondicionesPlusPage() {
  const { authorized } = useGuard('MODULE_ADMIN', 'MANAGE_CATALOG')
  const { activePeriodKey, availablePeriods } = usePeriod()
  
  const activePeriodObj = availablePeriods.find(p => p.period_key === activePeriodKey)
  const isHistoric = activePeriodObj?.status === 'HISTORIC'

  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Pegado modal
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteMode, setPasteMode] = useState<'replace' | 'append'>('replace')

  useEffect(() => {
    if (!activePeriodKey) return;
    setLoading(true)
    fetch(`/api/condiciones-plus?periodKey=${activePeriodKey}&strictPeriod=1`)
      .then(res => res.json())
      .then(data => {
        setRows(data?.rows || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [activePeriodKey])

  const handleCellChange = (rowIndex: number, colName: string, value: string, isGroupedCol: boolean, groupName: string | null) => {
    const newRows = [...rows]

    if (isGroupedCol && groupName) {
      for (let i = 0; i < newRows.length; i++) {
        const pName = newRows[i]['Productos FFVV']?.trim() || ''
        if (pName && getGroup(pName) === groupName) {
          newRows[i] = { ...newRows[i], [colName]: value }
        }
      }
    } else {
      newRows[rowIndex] = { ...newRows[rowIndex], [colName]: value }
    }
    
    setRows(newRows)
  }

  const handleAddRow = () => {
    const newRow: Record<string, string> = {}
    FIXED_COLUMNS.forEach(col => newRow[col] = '')
    setRows([...rows, newRow])
  }

  const handleDeleteRow = (index: number) => {
    const newRows = [...rows]
    newRows.splice(index, 1)
    setRows(newRows)
  }

  const handleSave = async () => {
    if (isHistoric) return alert("Este periodo es histórico y no puede modificarse.")
    setSaving(true)
    try {
      const response = await fetch(`/api/condiciones-plus?periodKey=${activePeriodKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: FIXED_COLUMNS, rows })
      })
      if (response.ok) {
        alert('Condiciones FFVV guardadas correctamente.')
      } else {
        alert('Error al guardar.')
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión al guardar')
    }
    setSaving(false)
  }

  const handlePasteParse = () => {
    if (!pasteText.trim()) {
      alert('El área de texto está vacía.')
      return
    }

    const lines = pasteText.trim().split('\n')
    const importedRows: Record<string, string>[] = []
    
    const lastGroupValues: Record<string, string> = {}
    let lastGroup: string | null = null
    
    for (let i = 0; i < lines.length; i++) {
      const rowString = lines[i]
      if (i === 0 && rowString.toLowerCase().includes('productos ffvv')) continue

      const cells = rowString.split('\t')
      const rowData: Record<string, string> = {}
      let hasData = false
      
      FIXED_COLUMNS.forEach((colName, index) => {
         const val = (cells[index] || '').toString().trim()
         rowData[colName] = val
         if (val !== '') hasData = true
      })
      
      if (hasData) {
        const prodName = rowData['Productos FFVV'] || ''
        const currentGroup = prodName ? getGroup(prodName) : `empty_paste_${i}`
        
        if (currentGroup === lastGroup && prodName) {
          GROUPED_COLUMNS.forEach(col => {
            if (!rowData[col] || rowData[col] === '') {
              rowData[col] = lastGroupValues[col] || ''
            }
          })
        }
        
        lastGroup = currentGroup
        
        GROUPED_COLUMNS.forEach(col => {
          if (rowData[col] && rowData[col] !== '') {
            lastGroupValues[col] = rowData[col]
          }
        })

        importedRows.push(rowData)
      }
    }

    if (isHistoric) return alert("Este periodo es histórico y no puede modificarse.")
    if (pasteMode === 'replace') {
      if (!confirm('Esto reemplazará y borrará tu tabla actual antes de guardar. ¿Confirmas la acción?')) return
      setRows(importedRows)
    } else {
      setRows([...rows, ...importedRows])
    }

    setShowPasteModal(false)
    setPasteText('')
  }

  const cloneCondiciones = async () => {
    if (isHistoric) return;
    try {
        const res = await fetch(`/api/condiciones-plus?legacyOnly=1`);
        const json = await res.json();
        if (json && json.rows && json.rows.length > 0) {
            setRows(json.rows);
            alert("Plantilla Base clonada en memoria exitosamente. Pulsa Guardar Cambios para fijar.");
        } else {
            alert("No hay plantilla Base originada para clonar.");
        }
    } catch (e) {
        console.error(e);
        alert("Fallo al clonar plantilla base.");
    }
  }

  const isNumericValue = (val: string) => !isNaN(parseFloat(val)) && isFinite(Number(val))

  if (authorized === null || loading) {
    return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--light-text)'}}>Cargando...</div>
  }

  return (
    <div style={{ padding: 20 }}>
      {showPasteModal && (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', 
            justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)'
        }}>
            <div className="card" style={{ width: '90%', maxWidth: 700, padding: 30, backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--light-text)' }}>
                        <ClipboardList size={22} className="mercedes-text" /> 
                        Pegar Matriz desde Excel
                    </h2>
                    <button onClick={() => setShowPasteModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--medium-gray)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>
                
                <p style={{ color: 'var(--medium-gray)', fontSize: 13, margin: 0 }}>
                    Abre tu Excel, copia las 9 columnas estipuladas y pulsa <strong>Ctrl + V</strong> (o Pegar) dentro del recuadro.<br/>
                    Recuerda que no deben copiarse otras cabeceras ajenas y debe seguir el orden exacto.
                </p>

                <textarea
                    placeholder="Pega la cuadrícula de tu Excel aquí..."
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    style={{
                        width: '100%', height: 200, padding: 15, borderRadius: 8,
                        backgroundColor: 'var(--section-bg)', color: 'var(--light-text)',
                        border: '1px solid var(--border-color)', outline: 'none',
                        fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre'
                    }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="pasteMode" 
                                checked={pasteMode === 'replace'} 
                                onChange={() => setPasteMode('replace')} 
                                style={{ accentColor: 'var(--mercedes-cyan)' }}
                            /> Reemplazar toda la tabla
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="pasteMode" 
                                checked={pasteMode === 'append'} 
                                onChange={() => setPasteMode('append')} 
                                style={{ accentColor: 'var(--mercedes-cyan)' }}
                            /> Añadir a continuación
                        </label>
                    </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button onClick={() => setShowPasteModal(false)} className="btn btn-secondary">Cancelar</button>
                    <button onClick={handlePasteParse} className="btn btn-primary" style={{ backgroundColor: 'var(--mercedes-cyan)', color: '#000', border: 'none' }}>
                        Importar Datos Pegados
                    </button>
                </div>
            </div>
        </div>
      )}

      <PageHeader 
          title={<><Database className="text-cyan" size={28} /> Condiciones y Extras FFVV</>}
          subtitle="Configuración de variables del módulo Plus."
          showBack={true}
          backFallback="/admin"
          helpContent={
            <div>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Condiciones y Extras FFVV</h4>
              <p style={{ margin: 0, lineHeight: 1.5 }}>Configurador avanzado B2B. Desde aquí gestionas el catálogo de productos extendido, márgenes de beneficios adicionales, y las reglas que determinan cómo escalan las comisiones de Pyme en base al volumen de captación y portfolio total.</p>
            </div>
          }
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24, marginTop: -8 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setShowPasteModal(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet size={18} />
              Pegar desde Excel
            </button>
            <div style={{ width: 1, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />
            <button onClick={handleSave} disabled={saving || isHistoric} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: isHistoric ? 'var(--border-color)' : '#34C759', color: 'var(--bg-card)', border: 'none', cursor: isHistoric ? 'not-allowed' : 'pointer' }}>
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
      </div>

        <div className="card" style={{ padding: 0, overflowX: 'auto', marginTop: 24 }}>
            <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: '#00ADEF', color: 'var(--bg-card)' }}>
                  {FIXED_COLUMNS.map((col, idx) => {
                    let colWidth: string | number | undefined = undefined;
                    let inlinePadding = '12px 16px';

                    if (idx === 0) colWidth = '24%'; // Productos FFVV
                    else if (idx >= 1 && idx <= 4) { colWidth = '8%'; inlinePadding = '12px 6px'; } // Objetivos
                    else if (idx >= 5 && idx <= 8) { colWidth = '11%'; inlinePadding = '12px 6px'; }
                    
                    return (
                      <th key={col} style={{ padding: inlinePadding, textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)', width: colWidth, boxSizing: 'border-box' }}>
                        {col}
                      </th>
                    )
                  })}
                  <th style={{ padding: '12px 16px', textAlign: 'center', width: 60 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={FIXED_COLUMNS.length + 1} style={{ padding: 40, textAlign: 'center', color: 'var(--medium-gray)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        La matriz está vacía.<br/>
                        Añade filas, pega desde Excel, o clona tu matriz Base histórica.
                        {!isHistoric && (
                            <button onClick={cloneCondiciones} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '8px 16px', marginTop: 12 }}>
                                <ClipboardList size={16} /> Clonar Matriz Base
                            </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => {
                    const prodName = row['Productos FFVV']?.trim() || ''
                    // Aislamos las filas vacías para evitar que se combinen accidentalmente entre sí
                    const currentGroup = prodName ? getGroup(prodName) : `empty_${i}`
                    
                    const prodNamePrev = i > 0 ? rows[i - 1]['Productos FFVV']?.trim() || '' : ''
                    const prevGroup = i > 0 ? (prodNamePrev ? getGroup(prodNamePrev) : `empty_${i - 1}`) : null
                    
                    const isGroupStart = currentGroup !== prevGroup
                    
                    let rowSpanCount = 1
                    if (isGroupStart && prodName) {
                      let j = i + 1
                      while (j < rows.length) {
                        const nextProd = rows[j]['Productos FFVV']?.trim() || ''
                        if (nextProd && getGroup(nextProd) === currentGroup) {
                          rowSpanCount++
                          j++
                        } else {
                          break
                        }
                      }
                    }

                    return (
                      <tr key={i} style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        borderTop: isGroupStart && prodName ? `2px solid rgba(0, 173, 239, 0.4)` : 'none'
                      }}>
                        {FIXED_COLUMNS.map((col, colIdx) => {
                          const isGroupedCol = GROUPED_COLUMNS.includes(col)
                          
                          if (isGroupedCol && !isGroupStart) {
                            return null
                          }

                          const val = row[col] || ''
                          const isNumeric = isNumericValue(val)
                          const align = colIdx === 0 ? 'left' : 'center'
                          
                          return (
                            <td 
                              key={col} 
                              rowSpan={isGroupedCol ? rowSpanCount : 1}
                              style={{ 
                                padding: 0, 
                                borderRight: '1px solid var(--border-color)',
                                height: isGroupedCol ? `${rowSpanCount * 44}px` : '44px',
                                verticalAlign: 'middle',
                                backgroundColor: isHistoric ? 'rgba(255,255,255,0.02)' : 'transparent'
                              }}
                            >
                              <div 
                                style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}
                                onClick={(e) => { 
                                    if(isHistoric) return;
                                    const input = e.currentTarget.querySelector('input'); 
                                    if (input) input.focus(); 
                                }}
                              >
                                  <input 
                                    type="text" 
                                    disabled={isHistoric}
                                    style={{ 
                                      width: '100%', 
                                      padding: '12px 16px', 
                                      border: 'none', 
                                      background: 'transparent', 
                                      outline: 'none', 
                                      color: isNumeric ? 'var(--mercedes-cyan)' : 'var(--light-text)', 
                                      fontSize: 13,
                                      textAlign: align,
                                      cursor: isHistoric ? 'not-allowed' : 'text'
                                    }} 
                                    value={val} 
                                    onChange={e => handleCellChange(i, col, e.target.value, isGroupedCol, currentGroup)} 
                                    placeholder={isGroupedCol && isGroupStart && prodName ? "-" : ""}
                                  />
                              </div>
                            </td>
                          )
                        })}
                        {/* La celda ACCIONES siempre se renderizará aquí, una por cada fila plana, forzando su alineación a la derecha */}
                        <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
                          <button onClick={() => handleDeleteRow(i)} style={{ background: 'transparent', color: '#FF453A', border: 'none', cursor: 'pointer', padding: '4px' }} title="Borrar Fila Individual">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          
          <div style={{ padding: 16, borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--active-bg)' }}>
            <button onClick={handleAddRow} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} />
              Añadir Fila Libre
            </button>
          </div>
        </div>
    </div>
  )
}
