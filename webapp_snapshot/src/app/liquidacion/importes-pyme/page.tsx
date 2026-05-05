'use client'

import { useEffect, useState } from 'react'
import { Save, Plus, Trash2, ArrowLeft, Euro } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'

interface ImportePyme {
  id: string
  concepto: string
  objetivoUds: number | null
  objetivoPlus100: number | null
  comisionNacionalMenos50: number | null
  comisionNacionalEntre50Y80: number | null
  comisionNacionalEntre80Y100: number | null
  comisionNacionalMas100: number | null
}

export default function ImportesPymePage() {
  const [data, setData] = useState<ImportePyme[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/importes-pyme')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRow = async () => {
    try {
      const res = await fetch('/api/importes-pyme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concepto: 'Nuevo Bloque' })
      })
      const json = await res.json()
      if (json.success) {
        setData([...data, json.data])
      }
    } catch (error) {
      console.error('Error adding row:', error)
    }
  }

  const handleDeleteRow = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este bloque?')) return
    
    try {
      const res = await fetch(`/api/importes-pyme?id=${id}`, {
        method: 'DELETE'
      })
      const json = await res.json()
      if (json.success) {
        setData(data.filter(row => row.id !== id))
      }
    } catch (error) {
      console.error('Error deleting row:', error)
    }
  }

  const handleChange = (id: string, field: keyof ImportePyme, value: string) => {
    setData(data.map(row => {
      if (row.id === id) {
        if (field === 'concepto') {
          return { ...row, [field]: value }
        }
        // Handle numerical inputs
        let parsedValue: number | null = parseFloat(value)
        if (isNaN(parsedValue)) parsedValue = null
        return { ...row, [field]: value === '' ? null : parsedValue }
      }
      return row
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all(data.map(row => 
        fetch('/api/importes-pyme', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row)
        })
      ))
      alert('Cambios guardados correctamente')
    } catch (error) {
      console.error('Error saving data:', error)
      alert('Error al guardar algunos cambios')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Cargando configuración...</div>

  return (
    <div style={{ padding: 20 }}>
      <PageHeader 
        title={<><Euro className="text-cyan" size={28} /> Importes PYME</>}
        subtitle="Configuración de objetivos y comisiones."
        showBack={true}
        backFallback="/liquidacion"
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24, marginTop: -8 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            className="btn btn-secondary"
            onClick={handleAddRow}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Plus size={18} />
            Añadir Fila
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--mercedes-cyan)', color: '#000', border: 'none' }}
          >
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 1200, width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              {/* First Header Row */}
              <tr style={{ backgroundColor: '#B5C400', color: 'var(--bg-card)' }}>
                <th style={{ padding: '12px', textAlign: 'left', minWidth: 200, borderRight: '1px solid rgba(255,255,255,0.2)' }} rowSpan={2}>BLOQUES DE COBRO PYMES</th>
                <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>OBJETIVO</th>
                <th colSpan={4} style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>COMISIÓN NACIONAL</th>
                <th style={{ padding: '8px', textAlign: 'center', width: 50 }} rowSpan={2}></th>
              </tr>
              {/* Second Header Row */}
              <tr style={{ backgroundColor: '#C4D600', color: '#333' }}>
                <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.1)' }}>Objetivo todo<br/>Plus al 100%</th>
                <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.1)' }}>Objetivo {'<50%'}<br/>(FD 45%)</th>
                <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.1)' }}>Objetivo<br/>{'>=50% <80%'}<br/>(FD -3%)</th>
                <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.1)' }}>Objetivo<br/>{'>=80% =<100%'}<br/>(FD -3%)</th>
                <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.1)' }}>Objetivo<br/>{'>100%'}<br/>(FD -3%) Maximo 120%</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={row.id} style={{ 
                  backgroundColor: index % 2 === 0 ? '#FFFF00' : '#E6F0A3', // mimicking the yellow alternating rows
                  borderBottom: '1px solid rgba(0,0,0,0.05)'
                }}>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid rgba(0,0,0,0.1)' }}>
                    <input 
                      type="text" 
                      value={row.concepto} 
                      onChange={(e) => handleChange(row.id, 'concepto', e.target.value)}
                      style={{ width: '100%', background: 'transparent', border: 'none', fontWeight: 'bold', outline: 'none' }}
                    />
                  </td>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid rgba(0,0,0,0.1)', textAlign: 'center' }}>
                    <input 
                      type="number" 
                      value={row.objetivoPlus100 === null ? '' : row.objetivoPlus100} 
                      onChange={(e) => handleChange(row.id, 'objetivoPlus100', e.target.value)}
                      style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'center', fontWeight: 'bold', outline: 'none' }}
                      step="0.01"
                    />
                  </td>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid rgba(0,0,0,0.1)', textAlign: 'center' }}>
                    <input 
                      type="number" 
                      value={row.comisionNacionalMenos50 === null ? '' : row.comisionNacionalMenos50} 
                      onChange={(e) => handleChange(row.id, 'comisionNacionalMenos50', e.target.value)}
                      style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'center', outline: 'none' }}
                      step="0.01"
                    />
                  </td>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid rgba(0,0,0,0.1)', textAlign: 'center' }}>
                    <input 
                      type="number" 
                      value={row.comisionNacionalEntre50Y80 === null ? '' : row.comisionNacionalEntre50Y80} 
                      onChange={(e) => handleChange(row.id, 'comisionNacionalEntre50Y80', e.target.value)}
                      style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'center', outline: 'none' }}
                      step="0.01"
                    />
                  </td>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid rgba(0,0,0,0.1)', textAlign: 'center' }}>
                    <input 
                      type="number" 
                      value={row.comisionNacionalEntre80Y100 === null ? '' : row.comisionNacionalEntre80Y100} 
                      onChange={(e) => handleChange(row.id, 'comisionNacionalEntre80Y100', e.target.value)}
                      style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'center', outline: 'none' }}
                      step="0.01"
                    />
                  </td>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid rgba(0,0,0,0.1)', textAlign: 'center' }}>
                    <input 
                      type="number" 
                      value={row.comisionNacionalMas100 === null ? '' : row.comisionNacionalMas100} 
                      onChange={(e) => handleChange(row.id, 'comisionNacionalMas100', e.target.value)}
                      style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'center', outline: 'none' }}
                      step="0.01"
                    />
                  </td>
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDeleteRow(row.id)}
                      style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '4px' }}
                      title="Eliminar fila"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--medium-gray)' }}>
                    No hay bloques configurados. Usa el botón "Añadir Fila" para empezar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
