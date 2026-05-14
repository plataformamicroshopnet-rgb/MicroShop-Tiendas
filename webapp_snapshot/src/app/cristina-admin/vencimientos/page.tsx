'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Save, RefreshCw, Trash2, Edit2, Search, X, CheckCircle, Circle, ArrowLeft, Upload, BarChart2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

const formatEuro = (amount: number) => {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

const parseIntSafe = (val: string) => parseInt(val) || 0
const parseFloatSafe = (val: string) => parseFloat(val) || 0

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function VencimientosPage() {
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [replaceData, setReplaceData] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Selection
  const currentYear = new Date().getFullYear().toString()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState('Marzo') // Defaulting based on screenshot

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vencimientos')
      const json = await res.json()
      if (json.success) {
        setItems(json.data)
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // Helper to extract Month and Year from "fechaFactura" or "vencimiento"
  // Assuming format DD-MM-YYYY or similar
  const getMonthYear = (dateStr: string) => {
    if (!dateStr) return { month: '', year: '' }
    const parts = dateStr.split(/[-/]/) // 02-03-2026 -> [02, 03, 2026]
    if (parts.length >= 3) {
      const mIndex = parseInt(parts[1]) - 1
      const m = MONTHS[mIndex] || ''
      let y = parts[2]
      if (y.length === 2) y = '20' + y
      return { month: m, year: y }
    }
    return { month: '', year: '' }
  }

  const togglePagado = async (item: any) => {
    const updated = { ...item, pagado: !item.pagado }
    setItems(items.map(i => i.id === item.id ? updated : i))
    await fetch('/api/vencimientos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, pagado: updated.pagado })
    })
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Seguro que quieres borrar este registro?")) return
    setItems(items.filter(i => i.id !== id))
    await fetch('/api/vencimientos?id=' + id, { method: 'DELETE' })
  }

  const handleEdit = (item: any) => {
    setEditingId(item.id)
    setEditForm({ ...item })
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleSaveRow = async () => {
    const isNew = editingId === 'NEW'
    const method = isNew ? 'POST' : 'PUT'
    const body = isNew ? { action: 'create', item: editForm } : editForm

    setSaving(true)
    try {
      const res = await fetch('/api/vencimientos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json()
      if (json.success) {
        if (isNew) {
          setItems([json.data, ...items])
        } else {
          setItems(items.map(i => i.id === editingId ? json.data : i))
        }
        setEditingId(null)
      }
    } catch (e) {
      alert("Error al guardar")
    }
    setSaving(false)
  }

  const handleBulkImport = async () => {
    if (!bulkText.trim()) return
    setSaving(true)

    const lines = bulkText.trim().split('\n')
    const newItems = []

    for (const line of lines) {
      const cols = line.split('\t').map(c => c.trim())
      if (cols.length < 5) continue // Relaxed from 12 to 5 to handle empty trailing columns
      if (cols[0].toUpperCase() === 'PROVEEDORES') continue // skip header

      const cleanNum = (str: string) => {
        if (!str) return 0
        let s = str.replace(/[€]/g, '').trim()
        if (s.includes(',')) {
          s = s.replace(/\./g, '')
          s = s.replace(/,/g, '.')
        }
        return parseFloatSafe(s)
      }

      newItems.push({
        proveedor: cols[0],
        fechaFactura: cols[1],
        albaran: cols[2],
        nFactura: cols[3],
        vencimiento: cols[4],
        pagado: cols[5].toUpperCase() === 'SI',
        recargo: cleanNum(cols[6]),
        tarjetas: cleanNum(cols[7]),
        accesorios: cleanNum(cols[8]),
        moviles: cleanNum(cols[9]),
        iva: cleanNum(cols[10]),
        totalFactura: cleanNum(cols[11]),
      })
    }

    if (newItems.length > 0) {
      try {
        const res = await fetch('/api/vencimientos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bulk', items: newItems, replace: replaceData })
        })
        const json = await res.json()
        if (json.success) {
          setBulkText('')
          setShowBulk(false)
          loadData()
          alert(`Importados ${json.count} registros con éxito.`)
        } else {
          alert(`Error del servidor: ${json.error}`)
        }
      } catch (e) {
        alert("Error en la importación.")
      }
    } else {
      alert("No se detectaron filas válidas.")
    }
    setSaving(false)
  }

  // Derived Data
  const availableYears = useMemo(() => {
    const ySet = new Set<string>()
    const startYear = 2010
    const endYear = parseInt(currentYear) + 2
    for (let y = endYear; y >= startYear; y--) {
      ySet.add(y.toString())
    }
    items.forEach(i => {
      const { year } = getMonthYear(i.fechaFactura) // Basamos el año en FECHA FACTURA
      if (year) ySet.add(year)
    })
    return Array.from(ySet).sort((a, b) => b.localeCompare(a))
  }, [items, currentYear])

  const chartData = useMemo(() => {
    const yearlyItems = items.filter(i => {
      const { year } = getMonthYear(i.fechaFactura)
      return year === selectedYear
    })

    const cData = MONTHS.map(m => {
      const mItems = yearlyItems.filter(i => getMonthYear(i.fechaFactura).month === m)
      const total = mItems.reduce((acc, i) => acc + (i.totalFactura || 0), 0)
      return { name: m, Total: total }
    })
    return cData
  }, [items, selectedYear])

  const annualTotal = chartData.reduce((acc, c) => acc + c.Total, 0)

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const { month, year } = getMonthYear(i.fechaFactura)
      if (year !== selectedYear || month !== selectedMonth) return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        return (i.proveedor || '').toLowerCase().includes(term) || (i.albaran || '').toLowerCase().includes(term) || (i.nFactura || '').toLowerCase().includes(term)
      }
      return true
    })
  }, [items, selectedYear, selectedMonth, searchTerm])

  const monthTotals = useMemo(() => {
    return filteredItems.reduce((acc, i) => {
      acc.recargo += i.recargo || 0
      acc.tarjetas += i.tarjetas || 0
      acc.accesorios += i.accesorios || 0
      acc.moviles += i.moviles || 0
      acc.iva += i.iva || 0
      acc.totalFactura += i.totalFactura || 0
      return acc
    }, { recargo: 0, tarjetas: 0, accesorios: 0, moviles: 0, iva: 0, totalFactura: 0 })
  }, [filteredItems])

  // Custom colors for bars based on user screenshot
  const barColors = ['#2563EB', '#DC2626', '#F59E0B', '#16A34A', '#9333EA', '#0EA5E9', '#E11D48', '#65A30D', '#DC2626', '#1E3A8A', '#7C3AED', '#0D9488']

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: '#F8FAFC', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <button onClick={() => router.push('/cristina-admin')} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer', marginBottom: '12px', padding: 0, fontWeight: 600 }}>
            <ArrowLeft size={18} /> Volver al Hub
          </button>
          <h1 style={{ margin: '0', fontSize: '28px', color: '#1E293B', fontWeight: '800', letterSpacing: '-0.5px' }}>
            Vencimientos Facturas
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowChart(!showChart)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: showChart ? '#EFF6FF' : '#FFF', border: showChart ? '1px solid #3B82F6' : '1px solid #CBD5E1', borderRadius: '8px', color: showChart ? '#1D4ED8' : '#475569', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            <BarChart2 size={18} /> {showChart ? 'Ocultar Gráfico' : 'Ver Gráfico Anual'}
          </button>
          <button
            onClick={() => setShowBulk(!showBulk)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#FFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#475569', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            <Upload size={18} /> Importar Excel
          </button>
          <button
            onClick={() => {
              setEditingId('NEW')
              setEditForm({ pagado: false })
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#10B981', border: 'none', borderRadius: '8px', color: '#FFF', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)' }}
          >
            Añadir Fila
          </button>
        </div>
      </div>

      {showBulk && (
        <div style={{ marginBottom: '24px', padding: '20px', background: '#FFF', borderRadius: '12px', border: '1px dashed #94A3B8', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#334155', fontSize: '18px' }}>Pegar datos desde Excel</h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748B' }}>
            Selecciona la tabla entera en Excel (incluyendo las 12 columnas: PROVEEDORES, FECHA FACTURA, ALBARAN, etc.), cópiala (Ctrl+C) y pégala aquí.
          </p>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder="Pega aquí las filas de Excel..."
            style={{ width: '100%', height: '150px', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontFamily: 'monospace', fontSize: '12px', marginBottom: '16px' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '12px', background: replaceData ? '#FEF2F2' : '#F0FDF4', borderRadius: '8px', border: replaceData ? '1px solid #FECACA' : '1px solid #BBF7D0' }}>
            <input
              type="checkbox"
              id="replaceData"
              checked={replaceData}
              onChange={(e) => setReplaceData(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="replaceData" style={{ fontSize: '14px', color: replaceData ? '#DC2626' : '#16A34A', fontWeight: 600, cursor: 'pointer' }}>
              {replaceData
                ? '⚠️ CUIDADO: Borrar todo el historial actual y reemplazarlo por estos datos.'
                : '✅ Seguro: Añadir estos datos al historial existente (ideal para importar años anteriores).'}
            </label>
          </div>
          <button
            onClick={handleBulkImport}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '8px', border: 'none', background: saving ? '#94A3B8' : '#3B82F6', color: '#FFF', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? <RefreshCw size={18} className="spin" /> : <Save size={18} />}
            {saving ? 'Procesando...' : 'Procesar Datos Importados'}
          </button>
        </div>
      )}

      {/* DASHBOARD CHART */}
      {showChart && (
        <div style={{ background: '#FFF', borderRadius: '16px', padding: '24px', marginBottom: '24px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#1E293B', fontWeight: 700 }}>Total Pagos Anual</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: 600, color: '#64748B' }}>Año:</span>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 600, fontSize: '15px', color: '#0F172A', cursor: 'pointer', outline: 'none' }}
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <div style={{ padding: '8px 16px', background: '#F0FDF4', color: '#16A34A', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', border: '1px solid #bbf7d0' }}>
                Total {selectedYear}: {formatEuro(annualTotal)}
              </div>
            </div>
          </div>

          <div style={{ height: 300, width: '100%', background: '#FEFCE8' /* yellowish background matching excel */ }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => `${val / 1000}k €`} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={(val: any) => formatEuro(Number(val))} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="Total" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                  ))}
                  <LabelList
                    dataKey="Total"
                    position="top"
                    formatter={(val: any) => val > 0 ? formatEuro(Number(val)) : ''}
                    style={{ fontSize: '11px', fill: '#475569', fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* DATA TABLE SECTION */}
      <div style={{ background: '#FFF', borderRadius: '16px', padding: '24px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 600, fontSize: '16px', color: '#0F172A', cursor: 'pointer', outline: 'none' }}
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#EFF6FF', fontWeight: 600, fontSize: '16px', color: '#1D4ED8', cursor: 'pointer', outline: 'none' }}
            >
              {MONTHS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Buscar proveedor o factura..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', background: '#F8FAFC', padding: '12px 24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>RECARGO</div>
              <div style={{ fontWeight: 'bold', color: '#334155' }}>{formatEuro(monthTotals.recargo)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>TARJETAS</div>
              <div style={{ fontWeight: 'bold', color: '#334155' }}>{formatEuro(monthTotals.tarjetas)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>ACCESORIOS</div>
              <div style={{ fontWeight: 'bold', color: '#334155' }}>{formatEuro(monthTotals.accesorios)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>MÓVILES</div>
              <div style={{ fontWeight: 'bold', color: '#334155' }}>{formatEuro(monthTotals.moviles)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>IVA</div>
              <div style={{ fontWeight: 'bold', color: '#334155' }}>{formatEuro(monthTotals.iva)}</div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '2px solid #CBD5E1', paddingLeft: '24px' }}>
              <div style={{ fontSize: '12px', color: '#1D4ED8', fontWeight: 800 }}>TOTAL MES</div>
              <div style={{ fontWeight: 'bold', color: '#1E40AF', fontSize: '18px' }}>{formatEuro(monthTotals.totalFactura)}</div>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>Cargando facturas...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1200px' }}>
              <thead>
                <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #CBD5E1' }}>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700 }}>PROVEEDORES</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700 }}>FECHA FAC.</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700 }}>ALBARAN</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700 }}>Nº FACTURA</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700 }}>VENCIMIENTO</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700, textAlign: 'center' }}>PAGADO</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Recargo</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Tarjetas</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Accesorios</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Móviles</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>IVA</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Factura</th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontWeight: 700, textAlign: 'center' }}>Ac.</th>
                </tr>
              </thead>
              <tbody>
                {editingId === 'NEW' && (
                  <tr style={{ background: '#F0FDF4', borderBottom: '2px solid #10B981' }}>
                    <td style={{ padding: '4px 8px' }}><input type="text" value={editForm.proveedor || ''} onChange={e => setEditForm({ ...editForm, proveedor: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #10B981', borderRadius: 4, fontSize: 12 }} /></td>
                    <td style={{ padding: '4px 8px' }}><input type="text" value={editForm.fechaFactura || ''} onChange={e => setEditForm({ ...editForm, fechaFactura: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #10B981', borderRadius: 4, fontSize: 12 }} /></td>
                    <td style={{ padding: '4px 8px' }}><input type="text" value={editForm.albaran || ''} onChange={e => setEditForm({ ...editForm, albaran: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #10B981', borderRadius: 4, fontSize: 12 }} /></td>
                    <td style={{ padding: '4px 8px' }}><input type="text" value={editForm.nFactura || ''} onChange={e => setEditForm({ ...editForm, nFactura: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #10B981', borderRadius: 4, fontSize: 12 }} /></td>
                    <td style={{ padding: '4px 8px' }}><input type="text" value={editForm.vencimiento || ''} onChange={e => setEditForm({ ...editForm, vencimiento: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #10B981', borderRadius: 4, fontSize: 12 }} /></td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      <button onClick={() => setEditForm({ ...editForm, pagado: !editForm.pagado })} style={{ background: editForm.pagado ? '#10B981' : '#F1F5F9', color: editForm.pagado ? '#FFF' : '#64748B', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {editForm.pagado ? 'SÍ' : 'NO'}
                      </button>
                    </td>
                    <td style={{ padding: '4px 8px' }}><input type="number" step="0.01" value={editForm.recargo || ''} onChange={e => setEditForm({ ...editForm, recargo: e.target.value })} style={{ width: '60px', padding: '6px', border: '1px solid #10B981', borderRadius: 4, fontSize: 12, textAlign: 'right' }} /></td>
                    <td style={{ padding: '4px 8px' }}><input type="number" step="0.01" value={editForm.tarjetas || ''} onChange={e => setEditForm({ ...editForm, tarjetas: e.target.value })} style={{ width: '60px', padding: '6px', border: '1px solid #10B981', borderRadius: 4, fontSize: 12, textAlign: 'right' }} /></td>
                    <td style={{ padding: '4px 8px' }}><input type="number" step="0.01" value={editForm.accesorios || ''} onChange={e => setEditForm({ ...editForm, accesorios: e.target.value })} style={{ width: '60px', padding: '6px', border: '1px solid #10B981', borderRadius: 4, fontSize: 12, textAlign: 'right' }} /></td>
                    <td style={{ padding: '4px 8px' }}><input type="number" step="0.01" value={editForm.moviles || ''} onChange={e => setEditForm({ ...editForm, moviles: e.target.value })} style={{ width: '60px', padding: '6px', border: '1px solid #10B981', borderRadius: 4, fontSize: 12, textAlign: 'right' }} /></td>
                    <td style={{ padding: '4px 8px' }}><input type="number" step="0.01" value={editForm.iva || ''} onChange={e => setEditForm({ ...editForm, iva: e.target.value })} style={{ width: '60px', padding: '6px', border: '1px solid #10B981', borderRadius: 4, fontSize: 12, textAlign: 'right' }} /></td>
                    <td style={{ padding: '4px 8px' }}><input type="number" step="0.01" value={editForm.totalFactura || ''} onChange={e => setEditForm({ ...editForm, totalFactura: e.target.value })} style={{ width: '70px', padding: '6px', border: '1px solid #10B981', borderRadius: 4, fontSize: 12, textAlign: 'right' }} /></td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button onClick={handleSaveRow} disabled={saving} style={{ background: '#10B981', color: '#FFF', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Save size={14} /></button>
                        <button onClick={handleCancel} style={{ background: '#94A3B8', color: '#FFF', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )}

                {filteredItems.length === 0 && editingId !== 'NEW' ? (
                  <tr><td colSpan={13} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>No hay vencimientos para {selectedMonth} de {selectedYear}.</td></tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const isEditing = editingId === item.id
                    const currentItem = isEditing ? editForm : item

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #E2E8F0', background: isEditing ? '#F8FAFC' : (idx % 2 === 0 ? '#FFF' : '#F8FAFC') }}>
                        <td style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                          {isEditing ? <input value={editForm.proveedor || ''} onChange={e => setEditForm({ ...editForm, proveedor: e.target.value })} style={{ width: '100%', padding: '4px', fontSize: 12 }} /> : item.proveedor}
                        </td>
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {isEditing ? <input value={editForm.fechaFactura || ''} onChange={e => setEditForm({ ...editForm, fechaFactura: e.target.value })} style={{ width: '100%', padding: '4px', fontSize: 12 }} /> : item.fechaFactura}
                        </td>
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {isEditing ? <input value={editForm.albaran || ''} onChange={e => setEditForm({ ...editForm, albaran: e.target.value })} style={{ width: '100%', padding: '4px', fontSize: 12 }} /> : item.albaran}
                        </td>
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {isEditing ? <input value={editForm.nFactura || ''} onChange={e => setEditForm({ ...editForm, nFactura: e.target.value })} style={{ width: '100%', padding: '4px', fontSize: 12 }} /> : item.nFactura}
                        </td>
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#1E293B', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {isEditing ? <input value={editForm.vencimiento || ''} onChange={e => setEditForm({ ...editForm, vencimiento: e.target.value })} style={{ width: '100%', padding: '4px', fontSize: 12 }} /> : item.vencimiento}
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {isEditing ? (
                            <button onClick={() => setEditForm({ ...editForm, pagado: !editForm.pagado })} style={{ background: editForm.pagado ? '#10B981' : '#F1F5F9', color: editForm.pagado ? '#FFF' : '#64748B', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                              {editForm.pagado ? 'SÍ' : 'NO'}
                            </button>
                          ) : (
                            <button onClick={() => togglePagado(item)} style={{ background: item.pagado ? '#10B981' : '#FFF', color: item.pagado ? '#FFF' : '#64748B', border: item.pagado ? 'none' : '1px solid #CBD5E1', borderRadius: '12px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 auto' }}>
                              {item.pagado ? <CheckCircle size={14} /> : <Circle size={14} />}
                              {item.pagado ? 'SÍ' : 'NO'}
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '6px 12px', fontSize: '12px', textAlign: 'right', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {isEditing ? <input type="number" step="0.01" value={editForm.recargo || ''} onChange={e => setEditForm({ ...editForm, recargo: e.target.value })} style={{ width: '60px', padding: '4px', fontSize: 12, textAlign: 'right' }} /> : formatEuro(item.recargo)}
                        </td>
                        <td style={{ padding: '6px 12px', fontSize: '12px', textAlign: 'right', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {isEditing ? <input type="number" step="0.01" value={editForm.tarjetas || ''} onChange={e => setEditForm({ ...editForm, tarjetas: e.target.value })} style={{ width: '60px', padding: '4px', fontSize: 12, textAlign: 'right' }} /> : formatEuro(item.tarjetas)}
                        </td>
                        <td style={{ padding: '6px 12px', fontSize: '12px', textAlign: 'right', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {isEditing ? <input type="number" step="0.01" value={editForm.accesorios || ''} onChange={e => setEditForm({ ...editForm, accesorios: e.target.value })} style={{ width: '60px', padding: '4px', fontSize: 12, textAlign: 'right' }} /> : formatEuro(item.accesorios)}
                        </td>
                        <td style={{ padding: '6px 12px', fontSize: '12px', textAlign: 'right', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {isEditing ? <input type="number" step="0.01" value={editForm.moviles || ''} onChange={e => setEditForm({ ...editForm, moviles: e.target.value })} style={{ width: '60px', padding: '4px', fontSize: 12, textAlign: 'right' }} /> : formatEuro(item.moviles)}
                        </td>
                        <td style={{ padding: '6px 12px', fontSize: '12px', textAlign: 'right', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {isEditing ? <input type="number" step="0.01" value={editForm.iva || ''} onChange={e => setEditForm({ ...editForm, iva: e.target.value })} style={{ width: '60px', padding: '4px', fontSize: 12, textAlign: 'right' }} /> : formatEuro(item.iva)}
                        </td>
                        <td style={{ padding: '6px 12px', fontSize: '12px', textAlign: 'right', color: '#1E293B', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          {isEditing ? <input type="number" step="0.01" value={editForm.totalFactura || ''} onChange={e => setEditForm({ ...editForm, totalFactura: e.target.value })} style={{ width: '70px', padding: '4px', fontSize: 12, textAlign: 'right' }} /> : formatEuro(item.totalFactura)}
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button onClick={handleSaveRow} disabled={saving} style={{ background: '#10B981', color: '#FFF', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Save size={14} /></button>
                              <button onClick={handleCancel} style={{ background: '#94A3B8', color: '#FFF', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><X size={14} /></button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button onClick={() => handleEdit(item)} style={{ background: 'transparent', color: '#3B82F6', border: 'none', cursor: 'pointer', padding: 0 }}><Edit2 size={16} /></button>
                              <button onClick={() => handleDelete(item.id)} style={{ background: 'transparent', color: '#EF4444', border: 'none', cursor: 'pointer', padding: 0 }}><Trash2 size={16} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
