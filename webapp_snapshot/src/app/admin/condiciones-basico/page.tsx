'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Save, Plus, Trash2, ArrowLeft, FileSpreadsheet, PlusCircle, MinusCircle, Database } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import * as ExcelJS from 'exceljs'
import { useGuard } from '@/hooks/useGuard'

export default function CondicionesBasicoPage() {
  const { authorized } = useGuard('MODULE_ADMIN', 'MANAGE_CATALOG')
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/condiciones-basico')
      .then(res => res.json())
      .then(data => {
        setColumns(data?.columns || [])
        setRows(data?.rows || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  const handleCellChange = (rowIndex: number, colName: string, value: string) => {
    const newRows = [...rows]
    newRows[rowIndex] = { ...newRows[rowIndex], [colName]: value }
    setRows(newRows)
  }

  const handleAddRow = () => {
    const newRow: Record<string, string> = {}
    columns.forEach(col => newRow[col] = '')
    setRows([...rows, newRow])
  }

  const handleDeleteRow = (index: number) => {
    const newRows = [...rows]
    newRows.splice(index, 1)
    setRows(newRows)
  }

  const handleAddColumn = () => {
    const colName = prompt('Nombre de la nueva columna (ej: Venta Secundaria):')
    if (!colName || colName.trim() === '') return
    if (columns.includes(colName.trim())) {
      alert('Esta columna ya existe')
      return
    }
    const cleanCol = colName.trim()
    setColumns([...columns, cleanCol])
    const newRows = rows.map(r => ({ ...r, [cleanCol]: '' }))
    setRows(newRows)
  }
  
  const handleDeleteColumn = () => {
    if (columns.length === 0) return
    const colName = prompt(`Escribe exactamente el nombre de la columna a borrar:\n\n${columns.join(', ')}`)
    if (!colName || !columns.includes(colName)) return
    if (!confirm(`¿Seguro que quieres borrar la columna "${colName}" y todos sus datos?`)) return
    
    const newCols = columns.filter(c => c !== colName)
    setColumns(newCols)
    
    const newRows = rows.map(r => {
      const newR = { ...r }
      delete newR[colName]
      return newR
    })
    setRows(newRows)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/condiciones-basico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns, rows })
      })
      if (response.ok) {
        alert('Condiciones Básico guardadas correctamente.')
      } else {
        alert('Error al guardar.')
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión al guardar')
    }
    setSaving(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setLoading(true)
    try {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(await file.arrayBuffer())
      const worksheet = workbook.worksheets[0] 
      
      if (!worksheet) {
        alert('El Excel no tiene hojas válidas.')
        setLoading(false)
        return
      }

      const importedCols: string[] = []
      const importedRows: Record<string, any>[] = []
      
      const headerRow = worksheet.getRow(1)
      headerRow.eachCell((cell, colNumber) => {
        importedCols.push(cell.text?.trim() || `Columna ${colNumber}`)
      })
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return 
        
        const rowData: Record<string, any> = {}
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const colName = importedCols[colNumber - 1]
          if (colName) {
            rowData[colName] = cell.value?.toString() || ''
          }
        })
        
        if (Object.values(rowData).some(v => String(v).trim() !== '')) {
          importedRows.push(rowData)
        }
      })
      
      setColumns(importedCols)
      setRows(importedRows)
      alert(`Excel importado correctamente: ${importedCols.length} columnas y ${importedRows.length} filas.\n\nPulsa "Guardar Cambios" para subirlo definitivamente a la base de datos.`)
      
    } catch (error) {
      console.error('Error procesando excel:', error)
      alert('Hubo un error interpretando el archivo Excel.')
    }
    
    if (fileInputRef.current) fileInputRef.current.value = ''
    setLoading(false)
  }

  const isNumericValue = (val: string) => !isNaN(parseFloat(val)) && isFinite(Number(val))

  if (authorized === null || loading) {
    return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--light-text)'}}>Cargando...</div>
  }

  return (
    <div style={{ padding: 20 }}>
      {/* Hidden input for uploading XLSX */}
      <input 
        type="file" 
        accept=".xlsx" 
        style={{ display: 'none' }} 
        ref={fileInputRef}
        onChange={handleFileUpload}
      />
      
      <PageHeader 
          title={<><Database className="text-cyan" size={28} /> Condiciones y Extras Básico</>}
          subtitle="Configuración de variables del módulo Básico."
          showBack={true}
          backFallback="/admin"
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24, marginTop: -8 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet size={18} />
              Importar Lista
            </button>
            <div style={{ width: 1, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />
            <button onClick={handleAddColumn} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PlusCircle size={18} />
              Añadir Columna
            </button>
            <button onClick={handleDeleteColumn} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FF453A' }}>
              <MinusCircle size={18} />
              Eliminar Columna
            </button>
            <div style={{ width: 1, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />
            <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#34C759', color: 'var(--bg-card)', border: 'none' }}>
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
      </div>

        <div className="card" style={{ padding: 0, overflowX: 'auto', marginTop: 24 }}>
          {columns.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--medium-gray)' }}>
              No hay columnas definidas.<br/>
              Empieza añadiendo columnas manualmente o importando un Excel directamente.
            </div>
          ) : (
            <table style={{ width: '100%', minWidth: Math.max(1000, columns.length * 150), borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: 'rgb(255, 149, 0)', color: 'var(--bg-card)' }}>
                  {columns.map((col) => (
                    <th key={col} style={{ padding: '12px 16px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                      {col}
                    </th>
                  ))}
                  <th style={{ padding: '12px 16px', textAlign: 'center', width: 60 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    {columns.map((col, colIdx) => {
                      const val = row[col] || ''
                      const isNumeric = isNumericValue(val)
                      const align = colIdx === 0 ? 'left' : (isNumeric ? 'right' : 'center')
                      
                      return (
                        <td key={col} style={{ padding: 0, borderRight: '1px solid var(--border-color)' }}>
                          <input 
                            type="text" 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              padding: '12px 16px', 
                              border: 'none', 
                              background: 'transparent', 
                              outline: 'none', 
                              color: isNumeric ? 'rgb(255, 149, 0)' : 'var(--light-text)', 
                              fontSize: 13,
                              textAlign: align
                            }} 
                            value={val} 
                            onChange={e => handleCellChange(i, col, e.target.value)} 
                          />
                        </td>
                      )
                    })}
                    <td style={{ padding: 8, textAlign: 'center' }}>
                      <button onClick={() => handleDeleteRow(i)} style={{ background: 'transparent', color: '#FF453A', border: 'none', cursor: 'pointer', padding: '4px' }}>
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          <div style={{ padding: 16, borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--active-bg)' }}>
            <button onClick={handleAddRow} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} disabled={columns.length === 0}>
              <Plus size={16} />
              Añadir Fila
            </button>
          </div>
        </div>
    </div>
  )
}
