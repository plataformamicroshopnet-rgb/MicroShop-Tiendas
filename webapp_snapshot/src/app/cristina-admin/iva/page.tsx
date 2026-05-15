'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Receipt, ArrowLeft, Download, Plus, Save, TrendingUp, X, Filter, BarChart2, Table as TableIcon, Edit2, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const MESES = [
  { id: 1, nombre: 'Ene' },
  { id: 2, nombre: 'Feb' },
  { id: 3, nombre: 'Mar' },
  { id: 4, nombre: 'Abr' },
  { id: 5, nombre: 'May' },
  { id: 6, nombre: 'Jun' },
  { id: 7, nombre: 'Jul' },
  { id: 8, nombre: 'Ago' },
  { id: 9, nombre: 'Sep' },
  { id: 10, nombre: 'Oct' },
  { id: 11, nombre: 'Nov' },
  { id: 12, nombre: 'Dic' }
]

const GRUPOS_PREDEFINIDOS = ['Gastos Fijos', 'Gastos Variables', 'Impuestos', 'Ingresos']

interface Gasto {
  id: string
  year: number
  month: number
  grupo: string
  concepto: string
  importe_c: number
  importe_r: number
  importe_dif: number
  importe_total: number
}

export default function IVAPage() {
  const [activeYear, setActiveYear] = useState(new Date().getFullYear())
  const [activeView, setActiveView] = useState<'matriz' | 'comparativa'>('matriz')
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)
  
  // State for Paste Modal
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteGrupo, setPasteGrupo] = useState('Gastos Fijos')
  const [pasting, setPasting] = useState(false)
  
  // Advanced Paste State
  const [colsPerMonth, setColsPerMonth] = useState(4) // El excel del usuario suele tener 4 (C, R, Dif, Total)
  const [targetColIndex, setTargetColIndex] = useState(2) // 1-based, la columna 2 o 4 (R o Total)
  const [includesConcept, setIncludesConcept] = useState(false) // Si han pegado el nombre en la misma matriz
  const [pasteNombres, setPasteNombres] = useState('') // Para pegar los nombres si no van juntos

  // State for Comparativa
  const [selectedConceptos, setSelectedConceptos] = useState<string[]>([])
  const [availableConceptos, setAvailableConceptos] = useState<string[]>([])
  const [historico, setHistorico] = useState<Gasto[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)




  // State for Add Row & Edit
  const [showAddRow, setShowAddRow] = useState(false)
  const [newRowGrupo, setNewRowGrupo] = useState('IVA')
  const [newRowConcepto, setNewRowConcepto] = useState('')
  
  const [editingConcepto, setEditingConcepto] = useState<{ grupo: string, oldConcepto: string } | null>(null)
  const [newConceptoName, setNewConceptoName] = useState('')

  const handleRenameConcepto = async () => {
    if (!editingConcepto || !newConceptoName.trim() || newConceptoName === editingConcepto.oldConcepto) {
      setEditingConcepto(null)
      return
    }
    const { grupo, oldConcepto } = editingConcepto
    const name = newConceptoName.trim()
    
    // optimistic
    setGastos(prev => prev.map(g => g.grupo === grupo && g.concepto === oldConcepto ? { ...g, concepto: name } : g))
    setEditingConcepto(null)

    try {
      await fetch('/api/gastos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: activeYear, grupo, oldConcepto, newConcepto: name })
      })
    } catch (e) { console.error(e) }
  }

  const handleAddRow = async () => {
    if (!newRowConcepto.trim()) return
    const concepto = newRowConcepto.trim()
    
    const newGasto: any = { id: Math.random().toString(), year: activeYear, month: 1, grupo: newRowGrupo, concepto, importe_c: 0, importe_r: 0, importe_dif: 0, importe_total: 0 }
    setGastos(prev => [...prev, newGasto])
    setShowAddRow(false)
    setNewRowConcepto('')
    
    try {
      await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: activeYear, month: 1, grupo: newRowGrupo, concepto, importe_total: 0 })
      })
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetchGastos()
  }, [activeYear])

    useEffect(() => {
    if (activeView === 'comparativa' && historico.length === 0) {
      fetchHistoricoTotal()
    }
  }, [activeView])

  const fetchHistoricoTotal = async () => {
    setLoadingHistorico(true)
    try {
      const res = await fetch('/api/gastos?grupo=IVA', { cache: 'no-store' })
      const data = await res.json()
      if (data.success) {
        setHistorico(data.data)
        const allConcepts = Array.from(new Set((data.data as any[]).map(g => g.concepto))).sort()
        setAvailableConceptos(allConcepts)
      }
    } catch (e) { console.error(e) } finally { setLoadingHistorico(false) }
  }

  const fetchGastos = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/gastos?year=${activeYear}`);
      const dataFiltered = (await res.json()).data?.filter((g: any) => g.grupo === 'IVA') || [];
      setGastos(dataFiltered);
      return;
      const data = await res.json()
      if (data.success) {
        setGastos(data.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  

  const handleUpdateCell = async (grupo: string, concepto: string, month: number, field: keyof Gasto, importeStr: string) => {
    let importe = parseFloat(importeStr.replace(',', '.'))
    if (isNaN(importe)) importe = 0

    // Update local state optimistic
    setGastos(prev => {
      const exists = prev.find(g => g.concepto === concepto && g.month === month && g.grupo === grupo)
      if (exists) {
        return prev.map(g => g.id === exists.id ? { ...g, [field]: importe } : g)
      } else {
        const newGasto: any = { id: Math.random().toString(), year: activeYear, month, grupo, concepto, importe_c: 0, importe_r: 0, importe_dif: 0, importe_total: 0 }
        newGasto[field] = importe
        return [...prev, newGasto as Gasto]
      }
    })

    // Persist
    try {
      await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: activeYear, month, grupo, concepto, [field]: importe })
      })
    } catch (e) {
      console.error('Error saving cell', e)
    }
  }

  const handleDeleteConcepto = async (grupo: string, concepto: string) => {
    if (!window.confirm(`¿Seguro que quieres borrar toda la partida de "${concepto}" para el año ${activeYear}?`)) return
    
    setGastos(prev => prev.filter(g => !(g.concepto === concepto && g.grupo === grupo)))
    
    try {
      await fetch('/api/gastos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: activeYear, grupo, concepto })
      })
    } catch (e) {
      console.error(e)
    }
  }

  const processPaste = async () => {
    if (!pasteText.trim()) return
    setPasting(true)
    try {
      const rows = pasteText.split('\n').filter(r => r.trim() !== '')
      const nombresRows = includesConcept ? [] : pasteNombres.split('\n').filter(r => r.trim() !== '')
      const items: any[] = []

      rows.forEach((row, rowIndex) => {
        const cols = row.split('\t')
        let concepto = ''
        let dataStartIndex = 0

        if (includesConcept) {
          concepto = cols[0]?.trim()
          dataStartIndex = 1
        } else {
          concepto = nombresRows[rowIndex]?.trim()
          dataStartIndex = 0
        }

        if (!concepto) return

        // Extraer los 12 meses basado en las columnas por mes
        for (let i = 1; i <= 12; i++) {
          const colIndex = dataStartIndex + (i - 1) * colsPerMonth + (targetColIndex - 1)
          if (cols[colIndex]) {
            let valStr = String(cols[colIndex]).replace(/\./g, '').replace(',', '.')
            valStr = valStr.replace(/[^0-9.-]/g, '')
            const importe = parseFloat(valStr)
            if (!isNaN(importe)) {
              items.push({
                year: activeYear,
                month: i,
                grupo: pasteGrupo,
                concepto,
                importe
              })
            }
          }
        }
      })

      if (items.length === 0) {
         alert('No se ha podido leer ningún dato válido. Comprueba que las columnas y filas coincidan.')
         setPasting(false)
         return
      }

      const res = await fetch('/api/gastos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      })
      const data = await res.json()
      if (data.success) {
        setShowPasteModal(false)
        setPasteText('')
        setPasteNombres('')
        fetchGastos()
      } else {
        alert('Error del servidor: ' + data.error)
      }
    } catch (e) {
      console.error(e)
      alert('Error al procesar los datos')
    } finally {
      setPasting(false)
    }
  }

  // AGRUPACIÓN DE DATOS PARA LA MATRIZ
  const matrizData = useMemo(() => {
    const agrupado: Record<string, Record<string, { c: number[], r: number[], dif: number[], total: number[] }>> = {}
    
    gastos.forEach(g => {
      if (!agrupado[g.grupo]) agrupado[g.grupo] = {}
      if (!agrupado[g.grupo][g.concepto]) {
        agrupado[g.grupo][g.concepto] = {
          c: new Array(12).fill(0),
          r: new Array(12).fill(0),
          dif: new Array(12).fill(0),
          total: new Array(12).fill(0)
        }
      }
      agrupado[g.grupo][g.concepto].c[g.month - 1] = g.importe_c
      agrupado[g.grupo][g.concepto].r[g.month - 1] = g.importe_r
      agrupado[g.grupo][g.concepto].dif[g.month - 1] = g.importe_dif
      agrupado[g.grupo][g.concepto].total[g.month - 1] = g.importe_total
    })

    // Sort grupos y conceptos
    const sortedGroups = Object.keys(agrupado).sort((a, b) => {
      const idxA = GRUPOS_PREDEFINIDOS.indexOf(a)
      const idxB = GRUPOS_PREDEFINIDOS.indexOf(b)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.localeCompare(b)
    })

    return sortedGroups.map(grupo => ({
      grupo,
      conceptos: Object.entries(agrupado[grupo]).map(([concepto, mesesObj]) => ({
        concepto,
        meses: mesesObj,
        totalAnual: mesesObj.total.reduce((a, b) => a + b, 0)
      })).sort((a, b) => a.concepto.localeCompare(b.concepto))
    }))
  }, [gastos])

  // TOTALES DEL AÑO
  const totalesAnuales = useMemo(() => {
    let ingresos = 0
    let gastosTotal = 0
    gastos.forEach(g => {
      if (g.grupo.toLowerCase().includes('ingreso') || g.grupo.toLowerCase().includes('venta')) {
        ingresos += g.importe_total
      } else {
        gastosTotal += g.importe_total
      }
    })
    return { ingresos, gastos: gastosTotal, beneficio: ingresos - gastosTotal }
  }, [gastos])


  // AGRUPACIÓN PARA COMPARATIVA HISTÓRICA
  const historicoAños = useMemo(() => {
    console.log('DEBUG: historico length:', historico.length, 'selected:', selectedConceptos);

    if (selectedConceptos.length === 0) return []
    const filteredHistorico = historico.filter(h => selectedConceptos.includes(h.concepto))
    
    const añosSet = new Set<number>()
    filteredHistorico.forEach(h => añosSet.add(h.year))
    const años = Array.from(añosSet).sort((a, b) => b - a)
    
    const tabla = años.map(year => {
      const meses = new Array(12).fill(0)
      filteredHistorico.filter(h => h.year === year).forEach(h => {
        meses[h.month - 1] += h.importe_total
      })
      return { year, meses, total: meses.reduce((a,b) => a+b, 0) }
    })
    return tabla
  }, [historico, selectedConceptos])

  const formatEuro = (val: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val)
  }

  const renderMatriz = () => (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, color: 'var(--mercedes-cyan)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TableIcon size={20} /> Matriz de {activeYear}
        </h3>
                <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={() => setShowAddRow(true)}
            className="btn"
            style={{ padding: '8px 16px', background: '#00C853', color: '#fff', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'default', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Plus size={16} /> Añadir Fila
          </button>
          <button 
            onClick={() => setShowPasteModal(true)}
            className="btn"
            style={{ padding: '8px 16px', background: 'var(--mercedes-cyan)', color: '#000', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'default', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Download size={16} /> Importar Excel
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
          <thead>
            <tr style={{ background: 'var(--active-bg)', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', position: 'sticky', left: 0, background: 'var(--active-bg)', zIndex: 10 }}>Concepto / Partida</th>
              {MESES.map(m => {
                
                return (
                  <React.Fragment key={m.id}>
                    
                    <th 
                      style={{ padding: '12px 4px', textAlign: 'center', color: 'var(--mercedes-cyan)', cursor: 'default', userSelect: 'none', minWidth: 50, background: 'rgba(0,173,239,0.03)' }}
                      
                      
                    >
                      {m.nombre}
                    </th>
                  </React.Fragment>
                )
              })}
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>Total Anual</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ac.</th>
            </tr>
          </thead>
          <tbody>
            {matrizData.length === 0 && (
              <tr><td colSpan={15} style={{ padding: 40, textAlign: 'center', color: 'var(--medium-gray)' }}>No hay datos para {activeYear}. Usa el botón "Importar Excel" para añadir datos rápidamente.</td></tr>
            )}
            
            {matrizData.map((grupo) => (
              <React.Fragment key={grupo.grupo}>
                {/* Cabecera Grupo */}
                <tr style={{ background: 'rgba(0,173,239,0.05)', borderTop: '2px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                  <td colSpan={15} style={{ padding: '10px 16px', fontWeight: 800, color: 'var(--mercedes-cyan)', position: 'sticky', left: 0 }}>
                    {grupo.grupo.toUpperCase()}
                  </td>
                </tr>
                
                {/* Filas de Conceptos */}
                {grupo.conceptos.map(concepto => (
                  <tr key={concepto.concepto} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="table-row-hover">
                    <td style={{ padding: '8px 16px', fontWeight: 600, color: 'var(--light-text)', position: 'sticky', left: 0, background: 'var(--bg-card)' }}>
                      {editingConcepto?.grupo === grupo.grupo && editingConcepto?.oldConcepto === concepto.concepto ? (
                        <input 
                          type="text"
                          value={newConceptoName}
                          onChange={e => setNewConceptoName(e.target.value)}
                          onBlur={handleRenameConcepto}
                          onKeyDown={e => e.key === 'Enter' && handleRenameConcepto()}
                          autoFocus
                          style={{ width: '100%', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--mercedes-cyan)', background: 'var(--active-bg)', color: 'var(--text-main)', fontSize: 12 }}
                        />
                      ) : (
                        concepto.concepto
                      )}
                    </td>
                    {MESES.map((m, index) => {
                      
                      const valC = concepto.meses.c[index]
                      const valR = concepto.meses.r[index]
                      const valDif = concepto.meses.dif[index]
                      const valTotal = concepto.meses.total[index]

                      return (
                        <React.Fragment key={m.id}>
                          
                          <td style={{ padding: '4px 4px', textAlign: 'right', background: 'rgba(0,173,239,0.02)' }}>
                            <input 
                              type="text" 
                              defaultValue={valTotal === 0 ? '' : valTotal}
                              placeholder="-"
                              style={{ width: '100%', textAlign: 'center', background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '4px', color: valTotal === 0 ? 'var(--medium-gray)' : 'var(--text-main)', fontSize: 12, fontWeight: 600 }}
                              onFocus={e => e.target.style.border = '1px solid var(--mercedes-cyan)'}
                              onBlur={e => {
                                e.target.style.border = '1px solid transparent'
                                if (e.target.value !== String(valTotal)) handleUpdateCell(grupo.grupo, concepto.concepto, m.id, 'importe_total', e.target.value)
                              }}
                            />
                          </td>
                        </React.Fragment>
                      )
                    })}
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>
                      {formatEuro(concepto.totalAnual)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', height: '100%' }}>
                      <button 
                        onClick={() => { setEditingConcepto({ grupo: grupo.grupo, oldConcepto: concepto.concepto }); setNewConceptoName(concepto.concepto); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--mercedes-cyan)', cursor: 'default', padding: 0 }}
                        title="Editar Nombre"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button 
                        onClick={() => handleDeleteConcepto(grupo.grupo, concepto.concepto)}
                        style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'default', padding: 0 }}
                        title="Eliminar Partida"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                
                {/* Subtotal Grupo */}
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--medium-gray)', position: 'sticky', left: 0, background: 'rgba(255,255,255,0.02)' }}>
                    Total {grupo.grupo}
                  </td>
                  {MESES.map((m, i) => {
                    
                    const totalC = grupo.conceptos.reduce((acc, c) => acc + c.meses.c[i], 0)
                    const totalR = grupo.conceptos.reduce((acc, c) => acc + c.meses.r[i], 0)
                    const totalDif = grupo.conceptos.reduce((acc, c) => acc + c.meses.dif[i], 0)
                    const totalMes = grupo.conceptos.reduce((acc, c) => acc + c.meses.total[i], 0)

                    return (
                      <React.Fragment key={m.id}>
                        
                        <td style={{ padding: '10px 4px', textAlign: 'center', fontWeight: 600, color: 'var(--medium-gray)', background: 'rgba(0,173,239,0.02)' }}>
                          {formatEuro(totalMes)}
                        </td>
                      </React.Fragment>
                    )
                  })}
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--mercedes-cyan)' }}>
                    {formatEuro(grupo.conceptos.reduce((acc, c) => acc + c.totalAnual, 0))}
                  </td>
                  <td></td>
                </tr>

                {/* Total Trimestre */}
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '2px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 800, color: 'var(--mercedes-cyan)', position: 'sticky', left: 0, background: 'rgba(255,255,255,0.04)' }}>
                    Total Trimestre
                  </td>
                  {MESES.map((m, i) => {
                    const isEndOfQuarter = (i + 1) % 3 === 0;
                    let trimTotal = 0;
                    if (isEndOfQuarter) {
                      trimTotal = grupo.conceptos.reduce((acc, c) => acc + c.meses.total[i] + c.meses.total[i-1] + c.meses.total[i-2], 0);
                    }
                    return (
                      <td key={m.id} style={{ padding: '10px 4px', textAlign: 'center', fontWeight: isEndOfQuarter ? 800 : 400, color: isEndOfQuarter ? 'var(--mercedes-cyan)' : 'transparent', background: 'rgba(0,173,239,0.03)' }}>
                        {isEndOfQuarter ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(trimTotal) : ''}
                      </td>
                    )
                  })}
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--mercedes-cyan)' }}>
                    {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grupo.conceptos.reduce((acc, c) => acc + c.totalAnual, 0))}
                  </td>
                  <td></td>
                </tr>

              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderComparativa = () => (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'flex-start', background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <Filter size={20} color="var(--mercedes-cyan)" style={{ marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--light-text)', marginBottom: 8, fontWeight: 700 }}>Selecciona las partidas para comparar históricamente:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border-color)', fontSize: 12 }}>
              <input type="checkbox" checked={selectedConceptos.length === availableConceptos.length && availableConceptos.length > 0} onChange={(e) => {
                if (e.target.checked) setSelectedConceptos(availableConceptos)
                else setSelectedConceptos([])
              }} />
              <span style={{ fontWeight: 600, color: 'var(--mercedes-cyan)' }}>Seleccionar Todas</span>
            </label>
            {availableConceptos.map(c => (
              <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: selectedConceptos.includes(c) ? 'rgba(0,173,239,0.1)' : 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 20, border: selectedConceptos.includes(c) ? '1px solid var(--mercedes-cyan)' : '1px solid var(--border-color)', fontSize: 12, color: selectedConceptos.includes(c) ? 'var(--light-text)' : 'var(--medium-gray)', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={selectedConceptos.includes(c)} onChange={(e) => {
                  if (e.target.checked) setSelectedConceptos(prev => [...prev, c])
                  else setSelectedConceptos(prev => prev.filter(x => x !== c))
                }} style={{ display: 'none' }} />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {loadingHistorico ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--mercedes-cyan)' }}>Cargando histórico...</div>
      ) : selectedConceptos.length > 0 && historicoAños.length > 0 ? (
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--active-bg)' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={20} color="var(--mercedes-cyan)" /> 
              Análisis Interanual: <span style={{ color: 'var(--mercedes-cyan)' }}>{selectedConceptos.length === availableConceptos.length ? 'Todas las Partidas' : `${selectedConceptos.length} partida(s) seleccionada(s)`}</span>
            </h3>
          </div>
          
          {/* Gráfica Recharts */}
          <div style={{ height: 320, padding: '24px 32px 12px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MESES.map((m, i) => {
                const rowObj: any = { name: m.nombre };
                [...historicoAños].sort((a,b) => a.year - b.year).forEach(row => {
                  rowObj[row.year] = row.meses[i];
                });
                return rowObj;
              })}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--medium-gray)', fontSize: 12, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--medium-gray)', fontSize: 12}} tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} dx={-10} />
                <RechartsTooltip 
                  cursor={{fill: 'rgba(0,173,239,0.05)'}} 
                  contentStyle={{background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--light-text)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                  formatter={(val: any, name: any) => [new Intl.NumberFormat('es-ES', {style: 'currency', currency: 'EUR'}).format(val), `Trimestre ${name}`]} 
                  labelStyle={{color: 'var(--medium-gray)', marginBottom: 4}}
                />
                {[...historicoAños].sort((a,b) => a.year - b.year).map((row, index) => {
                  const colors = ['#00adef', '#ff4d4f', '#52c41a', '#faad14', '#722ed1', '#eb2f96'];
                  return <Bar key={row.year} dataKey={row.year} fill={colors[index % colors.length]} radius={[4, 4, 0, 0]} barSize={20} />;
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
              <thead>
                <tr style={{ background: 'rgba(0,173,239,0.05)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 800, width: 120 }}>MES</th>
                  {historicoAños.map(row => (
                    <th key={row.year} style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, color: row.year === activeYear ? 'var(--light-text)' : 'var(--medium-gray)', fontSize: 14 }}>
                      {row.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MESES.map((m, monthIndex) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--medium-gray)' }}>{m.nombre}</td>
                    {historicoAños.map((row) => {
                      const val = row.meses[monthIndex];
                      return (
                        <td key={row.year} style={{ padding: '12px 20px', textAlign: 'right', color: val > 0 ? 'var(--light-text)' : 'var(--medium-gray)' }}>
                          {formatEuro(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Fila de Totales */}
                <tr style={{ background: 'rgba(0,173,239,0.08)', borderTop: '2px solid var(--border-color)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 800, color: 'var(--mercedes-cyan)', fontSize: 14 }}>TOTAL ANUAL</td>
                  {historicoAños.map((row) => (
                    <td key={row.year} style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 800, color: 'var(--light-text)', fontSize: 15 }}>
                      {formatEuro(row.total)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedConceptos.length > 0 ? (
         <div style={{ padding: 40, textAlign: 'center', color: 'var(--medium-gray)' }}>No hay datos históricos para esta partida.</div>
      ) : null}
    </div>
  )

  return (
    <div style={{ padding: '24px 32px', minHeight: '100vh', background: 'var(--bg-app)' }}>
      <style>{`
        .table-row-hover:hover {
          background: rgba(0,173,239,0.03) !important;
        }
        .form-select {
          background-color: var(--bg-card);
          color: var(--light-text);
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          padding: 8px 12px;
          outline: none;
        }
        .form-select:focus {
          border-color: var(--mercedes-cyan);
        }
      `}</style>

      <Link href="/cristina-admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--medium-gray)', textDecoration: 'none', marginBottom: '16px', fontSize: '14px', fontWeight: 600, transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color='var(--mercedes-cyan)'} onMouseOut={e => e.currentTarget.style.color='var(--medium-gray)'}>
        <ArrowLeft size={16} /> Volver al Hub
      </Link>
      
      <PageHeader 
        title="Informes de IVA" 
        subtitle="Control integral de partidas, ingresos y contención de gastos con comparativa histórica interanual."
      />

      {/* DASHBOARD METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', padding: '20px 24px', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600, textTransform: 'uppercase' }}>Gastos Totales ({activeYear})</p>
          <h2 style={{ margin: 0, fontSize: 28, color: 'var(--brand-danger)' }}>{formatEuro(totalesAnuales.gastos)}</h2>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '20px 24px', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600, textTransform: 'uppercase' }}>Ingresos Registrados ({activeYear})</p>
          <h2 style={{ margin: 0, fontSize: 28, color: '#10b981' }}>{formatEuro(totalesAnuales.ingresos)}</h2>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '20px 24px', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600, textTransform: 'uppercase' }}>Resultado Operativo</p>
          <h2 style={{ margin: 0, fontSize: 28, color: totalesAnuales.beneficio >= 0 ? '#10b981' : 'var(--brand-danger)' }}>{formatEuro(totalesAnuales.beneficio)}</h2>
        </div>
      </div>

      {/* NAVIGATION TABS & YEAR SELECTOR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, background: 'var(--bg-card)', padding: 6, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setActiveView('matriz')}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: activeView === 'matriz' ? 'var(--mercedes-cyan)' : 'transparent', color: activeView === 'matriz' ? '#000' : 'var(--light-text)', fontWeight: 700, cursor: 'default', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
          >
            <TableIcon size={16} /> Matriz Anual
          </button>
          <button 
            onClick={() => setActiveView('comparativa')}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: activeView === 'comparativa' ? 'var(--mercedes-cyan)' : 'transparent', color: activeView === 'comparativa' ? '#000' : 'var(--light-text)', fontWeight: 700, cursor: 'default', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
          >
            <BarChart2 size={16} /> Comparativa Histórica
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--medium-gray)' }}>Año:</span>
          <select 
            className="form-select"
            value={activeYear} 
            onChange={e => setActiveYear(parseInt(e.target.value))}
            style={{ fontWeight: 800, fontSize: 15, padding: '4px 8px', background: 'var(--active-bg)' }}
          >
            {Array.from({ length: 16 }).map((_, i) => {
              const y = 2030 - i
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Cargando matriz financiera...</div>
      ) : (
        activeView === 'matriz' ? renderMatriz() : renderComparativa()
      )}


      {/* MODAL AÑADIR FILA */}
      {showAddRow && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: 400, padding: 32, position: 'relative', background: 'var(--bg-card)', borderRadius: 20, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => { setShowAddRow(false); setNewRowConcepto(''); }}
              style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'default', color: 'var(--medium-gray)' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 20, color: 'var(--mercedes-cyan)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={24} /> Añadir Fila
            </h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--medium-gray)', marginBottom: 8, fontWeight: 600 }}>Grupo</label>
              <select 
                className="form-select" 
                style={{ width: '100%' }}
                value={newRowGrupo}
                onChange={e => setNewRowGrupo(e.target.value)}
              >
                {GRUPOS_PREDEFINIDOS.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--medium-gray)', marginBottom: 8, fontWeight: 600 }}>Nombre de la Partida</label>
              <input 
                type="text" 
                value={newRowConcepto}
                onChange={e => setNewRowConcepto(e.target.value)}
                placeholder="Ej: Suministros Extra"
                style={{ width: '100%', background: 'var(--active-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-main)', fontSize: 12 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                onClick={() => setShowAddRow(false)}
                className="btn"
                style={{ padding: '10px 20px', background: 'transparent', color: 'var(--light-text)', borderRadius: 8, fontWeight: 600, border: '1px solid var(--border-color)', cursor: 'default' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddRow}
                className="btn"
                style={{ padding: '10px 20px', background: '#00C853', color: '#fff', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'default' }}
              >
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IMPORTAR EXCEL */}
      {showPasteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: 700, padding: 32, position: 'relative', background: 'var(--bg-card)', borderRadius: 20, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => { setShowPasteModal(false); setPasteText(''); }}
              style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'default', color: 'var(--medium-gray)' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 20, color: 'var(--mercedes-cyan)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Download size={22} /> Pegar Matriz Anual ({activeYear})
            </h3>
            <p style={{ color: 'var(--medium-gray)', fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>
              Pega aquí tus datos. Si tu Excel tiene varias columnas por mes, ajusta los selectores para leer la correcta.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--light-text)', marginBottom: 4 }}>Asignar al Grupo:</label>
                <select
                  className="form-select"
                  style={{ width: '100%', fontSize: 12 }}
                  value={pasteGrupo}
                  onChange={e => setPasteGrupo(e.target.value)}
                >
                  {GRUPOS_PREDEFINIDOS.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="Impuestos Anuales">Impuestos Anuales</option>
                  <option value="Sueldos y Salarios">Sueldos y Salarios</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--light-text)', marginBottom: 4 }}>Columnas por cada Mes en tu Excel:</label>
                <select
                  className="form-select"
                  style={{ width: '100%', fontSize: 12 }}
                  value={colsPerMonth}
                  onChange={e => setColsPerMonth(parseInt(e.target.value))}
                >
                  <option value={1}>1 (Solo el Total)</option>
                  <option value={2}>2 Columnas</option>
                  <option value={3}>3 Columnas</option>
                  <option value={4}>4 Columnas (Ej. C, R, Dif, Total)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--light-text)', marginBottom: 4 }}>¿Qué columna extraer de las {colsPerMonth}?</label>
                <select
                  className="form-select"
                  style={{ width: '100%', fontSize: 12 }}
                  value={targetColIndex}
                  onChange={e => setTargetColIndex(parseInt(e.target.value))}
                  disabled={colsPerMonth === 1}
                >
                  {Array.from({length: colsPerMonth}).map((_, i) => (
                    <option key={i+1} value={i+1}>La {i+1}ª columna de cada mes</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--mercedes-cyan)', cursor: 'default' }}>
                  <input 
                    type="checkbox" 
                    checked={includesConcept} 
                    onChange={e => setIncludesConcept(e.target.checked)} 
                    style={{ cursor: 'default' }}
                  />
                  He copiado el NOMBRE de la partida junto a los números
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              {!includesConcept && (
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--brand-danger)', marginBottom: 4 }}>Nombres de los Conceptos (Uno por fila)</label>
                  <textarea
                    style={{ width: '100%', height: 180, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, padding: 12, backgroundColor: 'rgba(255,69,58,0.05)', color: 'var(--light-text)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 8, marginBottom: 20, whiteSpace: 'pre' }}
                    placeholder="Sueldos&#10;Luz&#10;Gasoil..."
                    value={pasteNombres}
                    onChange={e => setPasteNombres(e.target.value)}
                  />
                </div>
              )}

              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mercedes-cyan)', marginBottom: 4 }}>Bloque de Números (12 meses)</label>
                <textarea
                  style={{ width: '100%', height: 180, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, padding: 12, backgroundColor: 'rgba(0,173,239,0.05)', color: 'var(--light-text)', border: '1px solid rgba(0,173,239,0.2)', borderRadius: 8, marginBottom: 20, whiteSpace: 'pre' }}
                  placeholder="Pega aquí los números de los meses..."
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                style={{ padding: '10px 20px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--light-text)', cursor: 'default', fontWeight: 600 }}
                onClick={() => { setShowPasteModal(false); setPasteText('') }}
              >
                Cancelar
              </button>
              <button
                style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--mercedes-cyan)', color: '#000', border: 'none', cursor: 'default', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={processPaste}
                disabled={pasting}
              >
                {pasting ? 'Procesando...' : 'Importar Matriz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
