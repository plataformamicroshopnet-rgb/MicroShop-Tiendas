'use client'

import React, { useState, useEffect } from 'react'
import { Package, ArrowLeft, Save, FileText, Search, RefreshCw, Smartphone, MonitorSmartphone, Euro, HardDrive, Tag, Edit2, Trash2, X, Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'

const CATEGORIES = [
  "Importes", 
  "Rent", 
  "Dispositivos Urgente Vender", 
  "Accesorios", 
  "Demos"
]

export default function StockPage() {
  const [activeTab, setActiveTab] = useState('Importes')
  const [stockItems, setStockItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [bulkText, setBulkText] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [search, setSearch] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  const fetchStock = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stock')
      const data = await res.json()
      if (data.success) {
        setStockItems(data.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStock()
  }, [])

  const parseNumber = (val: string) => {
    if (!val) return 0
    let s = val.replace(/[€%\s]/g, '').trim()
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    
    if (lastComma > -1 && lastDot > -1) {
      if (lastComma > lastDot) {
        s = s.replace(/\./g, '').replace(/,/g, '.')
      } else {
        s = s.replace(/,/g, '')
      }
    } else if (lastComma > -1) {
      s = s.replace(/,/g, '.')
    } else if (lastDot > -1) {
      const parts = s.split('.')
      if (parts.length === 2 && parts[1].length === 3) {
        s = s.replace(/\./g, '')
      }
    }
    const num = parseFloat(s)
    return isNaN(num) ? 0 : num
  }

  const parseIntSafe = (val: string) => {
    if (!val) return 0
    const clean = val.replace(/\s/g, '')
    const num = parseInt(clean, 10)
    return isNaN(num) ? 0 : num
  }

  const handleBulkImport = async () => {
    if (!bulkText.trim()) return
    setSaving(true)
    
    const lines = bulkText.split('\n').filter(l => l.trim())
    if (lines.length === 0) {
      setSaving(false)
      return
    }
    
    // Detect headers from the first line
    const firstLine = lines[0] || ''
    const headerParts = firstLine.split('\t').map(p => p.trim().toLowerCase())
    const hasHeader = headerParts.some(p => 
      p.includes('marca') || p.includes('modelo') || p.includes('terminal') || 
      p.includes('producto') || p.includes('pvd') || p.includes('coste')
    )

    let colMap: any = {}
    if (hasHeader) {
      headerParts.forEach((part, idx) => {
        if (part.includes('marca') || part.includes('modelo') || part.includes('terminal') || part.includes('producto')) {
          colMap.producto = idx
        } else if (part.includes('pvd') || part.includes('coste')) {
          colMap.pvd = idx
        } else if (part.includes('pvp')) {
          colMap.pvp = idx
        } else if (part.includes('correhuela')) {
          colMap.correhuela = idx
        } else if (part.includes('auxiliadora')) {
          colMap.auxiliadora = idx
        } else if (part.includes('bejar') || part.includes('béjar')) {
          colMap.bejar = idx
        } else if (part.includes('villamayor')) {
          colMap.villamayor = idx
        } else if (part.includes('movilfree') || part.includes('o2')) {
          colMap.movilfree = idx
        } else if (part.includes('observaciones') || part.includes('obs')) {
          colMap.observaciones = idx
        }
      })
    }

    const startIdx = hasHeader ? 1 : 0
    const newItems: any[] = []

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i]
      const parts = line.split('\t')
      if (parts.length < 2) continue 
      
      let item: any = {
        tabCategory: activeTab,
        producto: 'Desconocido',
        pvd: 0,
        pvp: 0,
        udsCorrehuela: 0,
        udsAuxiliadora: 0,
        udsBejar: 0,
        udsVillamayor: 0,
        udsMovilfree: 0,
        observaciones: ''
      }

      if (activeTab === 'Accesorios') {
        const tienda = parts[0]?.toUpperCase() || ''
        item.producto = parts[1]
        item.pvd = parseNumber(parts[3])
        item.pvp = parseNumber(parts[7])
        
        const cant = parseIntSafe(parts[2])
        if (tienda.includes('CORREHUELA')) item.udsCorrehuela = cant
        else if (tienda.includes('AUXILIADORA')) item.udsAuxiliadora = cant
        else if (tienda.includes('BEJAR')) item.udsBejar = cant
        else if (tienda.includes('VILLAMAYOR')) item.udsVillamayor = cant
        else item.udsCorrehuela = cant 

        // Guardar Comisión y Material en JSON
        const comisionStr = parts[9] || '0,00 €'
        const materialStr = parts[10] || ''
        item.observaciones = JSON.stringify({ comision: comisionStr, material: materialStr })
      } else {
        // Dynamic column mapping for other tabs
        let idxProducto = colMap.producto !== undefined ? colMap.producto : 0
        let idxPVD = colMap.pvd !== undefined ? colMap.pvd : 1
        let idxPVP = colMap.pvp !== undefined ? colMap.pvp : -1
        let idxCorrehuela = colMap.correhuela !== undefined ? colMap.correhuela : -1
        let idxAuxiliadora = colMap.auxiliadora !== undefined ? colMap.auxiliadora : -1
        let idxBejar = colMap.bejar !== undefined ? colMap.bejar : -1
        let idxVillamayor = colMap.villamayor !== undefined ? colMap.villamayor : -1
        let idxMovilfree = colMap.movilfree !== undefined ? colMap.movilfree : -1
        let idxObservaciones = colMap.observaciones !== undefined ? colMap.observaciones : -1

        // Fallbacks if no header was detected or store columns weren't matched
        if (idxCorrehuela === -1 || idxAuxiliadora === -1 || idxBejar === -1 || idxVillamayor === -1) {
          if (activeTab === 'Dispositivos Urgente Vender') {
            idxCorrehuela = 2
            idxAuxiliadora = 3
            idxBejar = 4
            idxVillamayor = 5
          } else if (activeTab === 'Rent') {
            if (parts.length >= 8 && parts.length < 10) {
              idxCorrehuela = 2
              idxAuxiliadora = 3
              idxBejar = 4
              idxVillamayor = 5
            } else {
              idxCorrehuela = 4
              idxAuxiliadora = 5
              idxBejar = 6
              idxVillamayor = 7
            }
          } else if (activeTab === 'Demos') {
            idxCorrehuela = 3
            idxAuxiliadora = 4
            idxBejar = 5
            idxVillamayor = 6
            if (idxObservaciones === -1) idxObservaciones = 8
            if (idxPVP === -1) idxPVP = 10
          }
        }

        item.producto = parts[idxProducto] || 'Desconocido'
        item.pvd = parseNumber(parts[idxPVD])
        if (idxPVP !== -1) item.pvp = parseNumber(parts[idxPVP])

        if (idxCorrehuela !== -1) item.udsCorrehuela = parseIntSafe(parts[idxCorrehuela])
        if (idxAuxiliadora !== -1) item.udsAuxiliadora = parseIntSafe(parts[idxAuxiliadora])
        if (idxBejar !== -1) item.udsBejar = parseIntSafe(parts[idxBejar])
        if (idxVillamayor !== -1) item.udsVillamayor = parseIntSafe(parts[idxVillamayor])
        if (idxMovilfree !== -1) item.udsMovilfree = parseIntSafe(parts[idxMovilfree])
        if (idxObservaciones !== -1) item.observaciones = parts[idxObservaciones] || ''
      }

      // Filter out header row if it is still here or placeholder rows
      const prodLower = (item.producto || '').toLowerCase()
      if (
        prodLower && 
        prodLower !== 'marca y modelo' && 
        prodLower !== 'marca y modelo de terminal' && 
        prodLower !== 'accesorios' && 
        prodLower !== 'desconocido' &&
        prodLower !== 'producto'
      ) {
        newItems.push(item)
      }
    }

    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk', tabCategory: activeTab, items: newItems })
      })
      if (res.ok) {
        setBulkText('')
        setShowBulk(false)
        await fetchStock()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item: any) => {
      setEditingId(item.id)
      setEditForm({ ...item })
  }

  const handleCancel = () => {
      if (editingId === 'new') {
          setStockItems(prev => prev.filter(i => i.id !== 'new'))
      }
      setEditingId(null)
      setEditForm({})
  }

  const handleSaveRow = async () => {
      try {
          if (editingId === 'new') {
              const res = await fetch('/api/stock', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'create', item: { ...editForm, tabCategory: activeTab } })
              })
              const data = await res.json()
              if (data.success) {
                  setStockItems(prev => prev.map(i => i.id === 'new' ? data.data : i))
                  setEditingId(null)
              }
          } else {
              const res = await fetch('/api/stock', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(editForm)
              })
              if (res.ok) {
                  setStockItems(prev => prev.map(i => i.id === editingId ? { ...i, ...editForm } : i))
                  setEditingId(null)
              }
          }
      } catch (e) {
          console.error(e)
      }
  }

  const handleDelete = async (id: string) => {
      if (!window.confirm('¿Seguro que quieres eliminar este artículo?')) return
      if (id === 'new') {
          setStockItems(prev => prev.filter(i => i.id !== 'new'))
          return
      }
      try {
          const res = await fetch(`/api/stock?id=${id}`, { method: 'DELETE' })
          if (res.ok) {
              setStockItems(prev => prev.filter(i => i.id !== id))
          }
      } catch (e) {
          console.error(e)
      }
  }

  const handleAddRow = () => {
      const newItem = {
          id: 'new',
          tabCategory: activeTab,
          producto: '',
          pvd: 0,
          pvp: 0,
          udsCorrehuela: 0,
          udsAuxiliadora: 0,
          udsBejar: 0,
          udsVillamayor: 0,
          observaciones: activeTab === 'Accesorios' ? JSON.stringify({ comision: '1,00 €', material: '' }) : ''
      }
      setStockItems([newItem, ...stockItems])
      setEditingId('new')
      setEditForm(newItem)
  }

  const filteredItems = stockItems.filter(item => 
    item.tabCategory === activeTab && 
    (search ? item.producto.toLowerCase().includes(search.toLowerCase()) : true)
  )

  const getTotalsByStoreAndCategory = () => {
    const cats = ['Accesorios', 'Rent', 'Demos', 'Dispositivos Urgente Vender']
    let matrix: Record<string, any> = {}
    cats.forEach(c => {
      matrix[c] = { Uds: 0, Valor: 0, Correhuela: 0, Auxiliadora: 0, Bejar: 0, Villamayor: 0, UdsC: 0, UdsA: 0, UdsB: 0, UdsV: 0 }
    })

    stockItems.forEach(item => {
      let cat = item.tabCategory
      if (!matrix[cat]) return

      const udsC = item.udsCorrehuela || 0
      const udsA = item.udsAuxiliadora || 0
      const udsB = item.udsBejar || 0
      const udsV = item.udsVillamayor || 0
      const udsTotal = udsC + udsA + udsB + udsV

      matrix[cat].Uds += udsTotal
      matrix[cat].Valor += udsTotal * (item.pvd || 0)
      
      matrix[cat].Correhuela += udsC * (item.pvd || 0)
      matrix[cat].Auxiliadora += udsA * (item.pvd || 0)
      matrix[cat].Bejar += udsB * (item.pvd || 0)
      matrix[cat].Villamayor += udsV * (item.pvd || 0)

      matrix[cat].UdsC += udsC
      matrix[cat].UdsA += udsA
      matrix[cat].UdsB += udsB
      matrix[cat].UdsV += udsV
    })
    return matrix
  }

  const totalsMatrix = getTotalsByStoreAndCategory()
  const formatEuro = (val: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val)

  return (
    <div style={{ padding: 20, minHeight: '100vh', background: 'var(--bg-app)' }}>
      <PageHeader 
        title="Control de Stock" 
        subtitle="Gestión del inventario de terminales y accesorios por tienda."
        showBack={true}
        backFallback="/cristina-admin"
      />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px', flexWrap: 'nowrap' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => { setActiveTab(cat); setEditingId(null); setShowBulk(false); }}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === cat ? 'var(--mercedes-cyan)' : '#E2E8F0',
              color: activeTab === cat ? '#FFF' : '#475569',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              boxShadow: activeTab === cat ? '0 4px 6px rgba(0, 173, 239, 0.2)' : 'none'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden', padding: '24px' }}>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}><RefreshCw size={32} className="spin" style={{ marginBottom: 16 }}/><br/>Cargando inventario...</div>
        ) : activeTab === 'Importes' ? (
          <div>
             <h2 style={{ margin: '0 0 24px 0', color: '#1B3D6A', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Euro size={24} color="#10b981" /> Dashboard Global de Stock
             </h2>
             
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ background: '#84CC16', color: '#FFF', padding: '12px 16px', fontWeight: 'bold' }}>Valor Accesorios por Tienda</div>
                    <div style={{ padding: '16px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                           <span style={{ color: '#475569' }}>Accesorios Venta Rápida (Total)</span>
                           <span style={{ fontWeight: 'bold' }}>{formatEuro(totalsMatrix['Accesorios'].Valor)}</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                           <span style={{ color: '#475569' }}>Villamayor</span>
                           <span style={{ fontWeight: 'bold', color: '#0EA5E9' }}>{formatEuro(totalsMatrix['Accesorios'].Villamayor)}</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                           <span style={{ color: '#475569' }}>Auxiliadora</span>
                           <span style={{ fontWeight: 'bold', color: '#0EA5E9' }}>{formatEuro(totalsMatrix['Accesorios'].Auxiliadora)}</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                           <span style={{ color: '#475569' }}>Correhuela</span>
                           <span style={{ fontWeight: 'bold', color: '#0EA5E9' }}>{formatEuro(totalsMatrix['Accesorios'].Correhuela)}</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                           <span style={{ color: '#475569' }}>Béjar</span>
                           <span style={{ fontWeight: 'bold', color: '#0EA5E9' }}>{formatEuro(totalsMatrix['Accesorios'].Bejar)}</span>
                       </div>
                    </div>
                </div>

                <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ background: '#3B82F6', color: '#FFF', padding: '12px 16px', fontWeight: 'bold' }}>Resumen Totales Globales</div>
                    <div style={{ padding: '16px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F1F5F9', background: '#DBEAFE', borderRadius: 4, paddingLeft: 8, paddingRight: 8, marginBottom: 4 }}>
                           <span style={{ color: '#1E3A8A', fontWeight: 'bold' }}>Total Accesorios</span>
                           <span style={{ fontWeight: 'bold', color: '#1E3A8A' }}>{totalsMatrix['Accesorios'].Uds} uds / {formatEuro(totalsMatrix['Accesorios'].Valor)}</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F1F5F9', background: '#DBEAFE', borderRadius: 4, paddingLeft: 8, paddingRight: 8, marginBottom: 4 }}>
                           <span style={{ color: '#1E3A8A', fontWeight: 'bold' }}>Total Dispositivos OJO</span>
                           <span style={{ fontWeight: 'bold', color: '#1E3A8A' }}>{totalsMatrix['Dispositivos Urgente Vender'].Uds} uds / {formatEuro(totalsMatrix['Dispositivos Urgente Vender'].Valor)}</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F1F5F9', background: '#2563EB', borderRadius: 4, paddingLeft: 8, paddingRight: 8, marginBottom: 4, color: '#FFF' }}>
                           <span style={{ fontWeight: 'bold' }}>Total Teléfonos RENT</span>
                           <span style={{ fontWeight: 'bold' }}>{totalsMatrix['Rent'].Uds} uds / {formatEuro(totalsMatrix['Rent'].Valor)}</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F1F5F9', background: '#2563EB', borderRadius: 4, paddingLeft: 8, paddingRight: 8, marginBottom: 4, color: '#FFF' }}>
                           <span style={{ fontWeight: 'bold' }}>Teléfonos en Demo</span>
                           <span style={{ fontWeight: 'bold' }}>{totalsMatrix['Demos'].Uds} uds / {formatEuro(totalsMatrix['Demos'].Valor)}</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', background: '#0EA5E9', borderRadius: 4, paddingLeft: 8, paddingRight: 8, color: '#FFF', marginTop: 12 }}>
                           <span style={{ fontWeight: 'bold', fontSize: 18 }}>TOTAL</span>
                           <span style={{ fontWeight: 'bold', fontSize: 18 }}>
                               {totalsMatrix['Accesorios'].Uds + totalsMatrix['Dispositivos Urgente Vender'].Uds + totalsMatrix['Rent'].Uds + totalsMatrix['Demos'].Uds} uds / 
                               {formatEuro(totalsMatrix['Accesorios'].Valor + totalsMatrix['Dispositivos Urgente Vender'].Valor + totalsMatrix['Rent'].Valor + totalsMatrix['Demos'].Valor)}
                           </span>
                       </div>
                    </div>
                </div>

             </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ position: 'relative', flexGrow: 1, maxWidth: '400px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94A3B8' }} />
                <input 
                  type="text" 
                  placeholder="Buscar producto..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '14px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #10B981', color: '#047857', fontWeight: 'bold' }}>
                  Total Pestaña: {totalsMatrix[activeTab]?.Valor ? formatEuro(totalsMatrix[activeTab].Valor) : '0,00 €'}
                </div>
                <button 
                  onClick={handleAddRow}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#3B82F6', color: '#FFF', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Plus size={18} /> Añadir Fila
                </button>
                <button 
                  onClick={() => setShowBulk(!showBulk)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFF', color: '#1E293B', fontWeight: 600, cursor: 'pointer' }}
                >
                  <FileText size={18} /> {showBulk ? 'Ocultar Importación' : 'Importar Excel'}
                </button>
              </div>
            </div>

            {showBulk && (
              <div style={{ marginBottom: '24px', padding: '16px', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#334155' }}>Pegar datos desde Excel ({activeTab})</h4>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748B' }}>
                  Selecciona la tabla entera en tu Excel (sin la fila de Totales del final), cópiala (Ctrl+C) y pégala aquí (Ctrl+V).<br/>
                  <strong>¡Ojo!</strong> Al procesar los datos, se borrará el inventario antiguo de esta pestaña y se guardará el nuevo.
                </p>
                <textarea 
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder="Pega aquí las filas de Excel..."
                  style={{ width: '100%', height: '150px', padding: '12px', borderRadius: '6px', border: '1px solid #E2E8F0', fontFamily: 'monospace', fontSize: '12px', marginBottom: '12px' }}
                />
                <button 
                  onClick={handleBulkImport}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', border: 'none', background: saving ? '#94A3B8' : '#10b981', color: '#FFF', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? <RefreshCw size={18} className="spin" /> : <Save size={18} />} 
                  {saving ? 'Guardando...' : 'Procesar Datos'}
                </button>
              </div>
            )}

            {activeTab === 'Rent' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                  { name: 'Villamayor', uds: totalsMatrix['Rent'].UdsV, valor: totalsMatrix['Rent'].Villamayor, color: '#3B82F6' },
                  { name: 'Auxiliadora', uds: totalsMatrix['Rent'].UdsA, valor: totalsMatrix['Rent'].Auxiliadora, color: '#8B5CF6' },
                  { name: 'Correhuela', uds: totalsMatrix['Rent'].UdsC, valor: totalsMatrix['Rent'].Correhuela, color: '#F59E0B' },
                  { name: 'Béjar', uds: totalsMatrix['Rent'].UdsB, valor: totalsMatrix['Rent'].Bejar, color: '#10B981' }
                ].map(store => (
                  <div key={store.name} style={{ background: '#FFF', border: `1px solid ${store.color}40`, borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: `${store.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: store.color }}>
                      <Smartphone size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>{store.name}</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1E293B' }}>{store.uds} uds</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: store.color }}>{formatEuro(store.valor)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              {activeTab === 'Accesorios' ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1100px' }}>
                    <thead>
                      <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #E2E8F0' }}>
                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px' }}>Tienda</th>
                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', width: '20%' }}>Accesorio</th>
                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Uds</th>
                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'right' }}>Precio Compra</th>
                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'right' }}>Valor Actual</th>
                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'right' }}>% Ganancia</th>
                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'right' }}>PVP (sin IVA)</th>
                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'right' }}>PVP</th>
                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'right' }}>Ganancia</th>
                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'right' }}>Comisión</th>
                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px' }}>MATERIAL</th>
                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={12} style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B' }}>
                            No hay accesorios guardados. Usa "Importar Excel" o "Añadir Fila".
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map(item => {
                          const isEditing = editingId === item.id
                          const currentItem = isEditing ? editForm : item
                          
                          const totalUds = parseIntSafe(currentItem.udsCorrehuela?.toString()||'0') + parseIntSafe(currentItem.udsAuxiliadora?.toString()||'0') + parseIntSafe(currentItem.udsBejar?.toString()||'0') + parseIntSafe(currentItem.udsVillamayor?.toString()||'0')
                          const tiendaName = currentItem.udsCorrehuela > 0 ? 'CORREHUELA' : currentItem.udsAuxiliadora > 0 ? 'AUXILIADORA' : currentItem.udsBejar > 0 ? 'BEJAR' : currentItem.udsVillamayor > 0 ? 'VILLAMAYOR' : 'VARIAS'
                          
                          const pvd = parseFloat(currentItem.pvd?.toString()||'0') || 0
                          const pvp = parseFloat(currentItem.pvp?.toString()||'0') || 0
                          const valorActual = totalUds * pvd
                          const pvpSinIva = pvp / 1.21
                          const ganancia = pvpSinIva - pvd
                          const porcentaje = pvd > 0 ? (ganancia / pvd) * 100 : 0
                          
                          let extraData = { comision: '1,00 €', material: '' }
                          try {
                              if (currentItem.observaciones && currentItem.observaciones.startsWith('{')) {
                                  extraData = JSON.parse(currentItem.observaciones)
                              }
                          } catch(e) {}
                 
                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid #E2E8F0', background: isEditing ? '#F8FAFC' : '#FFF' }}>
                              <td style={{ padding: '4px 8px', fontWeight: 600, color: '#334155', fontSize: '12px' }}>
                                 {isEditing ? (
                                   <select value={tiendaName} onChange={(e) => {
                                       const t = e.target.value
                                       setEditForm({...editForm, 
                                           udsCorrehuela: t === 'CORREHUELA' ? totalUds : 0,
                                           udsAuxiliadora: t === 'AUXILIADORA' ? totalUds : 0,
                                           udsBejar: t === 'BEJAR' ? totalUds : 0,
                                           udsVillamayor: t === 'VILLAMAYOR' ? totalUds : 0
                                       })
                                   }} style={{ padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px' }}>
                                       <option value="CORREHUELA">CORREHUELA</option>
                                       <option value="AUXILIADORA">AUXILIADORA</option>
                                       <option value="BEJAR">BEJAR</option>
                                       <option value="VILLAMAYOR">VILLAMAYOR</option>
                                       <option value="VARIAS">VARIAS</option>
                                   </select>
                                 ) : tiendaName}
                              </td>
                              <td style={{ padding: '4px 8px', fontWeight: 500, color: '#1E293B', fontSize: '12px' }}>
                                 {isEditing ? (
                                     <input type="text" value={editForm.producto || ''} onChange={e => setEditForm({...editForm, producto: e.target.value})} style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px' }} />
                                 ) : currentItem.producto}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                                 {isEditing ? (
                                     <input type="number" value={totalUds} onChange={e => {
                                         const cant = parseInt(e.target.value)||0;
                                         setEditForm({...editForm, 
                                           udsCorrehuela: tiendaName === 'CORREHUELA' ? cant : 0,
                                           udsAuxiliadora: tiendaName === 'AUXILIADORA' ? cant : 0,
                                           udsBejar: tiendaName === 'BEJAR' ? cant : 0,
                                           udsVillamayor: tiendaName === 'VILLAMAYOR' ? cant : 0
                                       })
                                     }} style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', textAlign: 'center', fontSize: '12px' }} />
                                 ) : totalUds}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#64748B', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                 {isEditing ? (
                                     <input type="number" step="0.01" value={editForm.pvd || 0} onChange={e => setEditForm({...editForm, pvd: parseFloat(e.target.value)||0})} style={{ width: '70px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', textAlign: 'right', fontSize: '12px' }} />
                                 ) : `${pvd.toFixed(2)} €`}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', color: '#334155', fontSize: '12px', whiteSpace: 'nowrap' }}>{valorActual.toFixed(2)} €</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', color: porcentaje > 50 ? '#10B981' : '#F59E0B', fontSize: '12px', whiteSpace: 'nowrap' }}>{porcentaje.toFixed(2)}%</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#64748B', fontSize: '12px', whiteSpace: 'nowrap' }}>{pvpSinIva.toFixed(2)} €</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', color: '#0EA5E9', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                 {isEditing ? (
                                     <input type="number" step="0.01" value={editForm.pvp || 0} onChange={e => setEditForm({...editForm, pvp: parseFloat(e.target.value)||0})} style={{ width: '70px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', textAlign: 'right', fontSize: '12px' }} />
                                 ) : `${pvp.toFixed(2)} €`}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#10B981', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap' }}>{ganancia.toFixed(2)} €</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#8B5CF6', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                  {isEditing ? (
                                     <input type="text" value={extraData.comision} onChange={e => {
                                         const newExt = {...extraData, comision: e.target.value};
                                         setEditForm({...editForm, observaciones: JSON.stringify(newExt)})
                                     }} style={{ width: '70px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', textAlign: 'right', fontSize: '12px' }} />
                                  ) : extraData.comision}
                              </td>
                              <td style={{ padding: '4px 8px', color: '#64748B', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                  {isEditing ? (
                                     <input type="text" value={extraData.material} onChange={e => {
                                         const newExt = {...extraData, material: e.target.value};
                                         setEditForm({...editForm, observaciones: JSON.stringify(newExt)})
                                     }} style={{ width: '80px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '11px' }} />
                                  ) : extraData.material}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                  {isEditing ? (
                                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                          <button onClick={handleSaveRow} style={{ background: '#10b981', border: 'none', borderRadius: '4px', padding: '4px 6px', color: '#fff', cursor: 'pointer' }}><Save size={16}/></button>
                                          <button onClick={handleCancel} style={{ background: '#94A3B8', border: 'none', borderRadius: '4px', padding: '4px 6px', color: '#fff', cursor: 'pointer' }}><X size={16}/></button>
                                      </div>
                                  ) : (
                                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                          <button onClick={() => handleEdit(item)} style={{ background: 'transparent', border: 'none', color: '#3B82F6', cursor: 'pointer' }}><Edit2 size={16}/></button>
                                          <button onClick={() => handleDelete(item.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                                      </div>
                                  )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #E2E8F0' }}>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', width: '25%' }}>Marca y Modelo</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'right', width: '10%' }}>PVD / Coste</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'center', width: '8%' }}>Correhuela</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'center', width: '8%' }}>Auxiliadora</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'center', width: '8%' }}>Béjar</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'center', width: '8%' }}>Villamayor</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'center', width: '8%' }}>Total Uds</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'right', width: '10%' }}>Valor Total</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'center', width: '7%' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B' }}>
                          No hay productos guardados en {activeTab}. Usa "Importar Excel" o "Añadir Fila".
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map(item => {
                        const isEditing = editingId === item.id
                        const currentItem = isEditing ? editForm : item
                        
                        const totalUds = parseIntSafe(currentItem.udsCorrehuela?.toString()||'0') + parseIntSafe(currentItem.udsAuxiliadora?.toString()||'0') + parseIntSafe(currentItem.udsBejar?.toString()||'0') + parseIntSafe(currentItem.udsVillamayor?.toString()||'0')
                        const valorTotal = totalUds * (parseFloat(currentItem.pvd?.toString()||'0') || 0)
                        
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #E2E8F0', background: isEditing ? '#F8FAFC' : '#FFF' }}>
                            <td style={{ padding: '4px 8px', fontWeight: 500, color: '#1E293B', fontSize: '12px' }}>
                                {isEditing ? (
                                    <input type="text" value={editForm.producto || ''} onChange={e => setEditForm({...editForm, producto: e.target.value})} style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px' }} />
                                ) : item.producto}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', color: '#64748B', fontSize: '12px' }}>
                                {isEditing ? (
                                    <input type="number" step="0.01" value={editForm.pvd || 0} onChange={e => setEditForm({...editForm, pvd: parseFloat(e.target.value)||0})} style={{ width: '70px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', textAlign: 'right', fontSize: '12px' }} />
                                ) : `${item.pvd.toFixed(2)} €`}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: '12px' }}>
                                {isEditing ? (
                                    <input type="number" value={editForm.udsCorrehuela || 0} onChange={e => setEditForm({...editForm, udsCorrehuela: parseInt(e.target.value)||0})} style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', textAlign: 'center', fontSize: '12px' }} />
                                ) : (
                                  <span style={{ display: 'inline-block', width: '30px', padding: '2px', background: item.udsCorrehuela > 0 ? '#FEF08A' : 'transparent', borderRadius: '4px', fontWeight: item.udsCorrehuela > 0 ? 'bold' : 'normal', color: item.udsCorrehuela > 0 ? '#1E293B' : '#94A3B8' }}>
                                    {item.udsCorrehuela || '-'}
                                  </span>
                                )}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: '12px' }}>
                                {isEditing ? (
                                    <input type="number" value={editForm.udsAuxiliadora || 0} onChange={e => setEditForm({...editForm, udsAuxiliadora: parseInt(e.target.value)||0})} style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', textAlign: 'center', fontSize: '12px' }} />
                                ) : (
                                  <span style={{ display: 'inline-block', width: '30px', padding: '2px', background: item.udsAuxiliadora > 0 ? '#FEF08A' : 'transparent', borderRadius: '4px', fontWeight: item.udsAuxiliadora > 0 ? 'bold' : 'normal', color: item.udsAuxiliadora > 0 ? '#1E293B' : '#94A3B8' }}>
                                    {item.udsAuxiliadora || '-'}
                                  </span>
                                )}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: '12px' }}>
                                {isEditing ? (
                                    <input type="number" value={editForm.udsBejar || 0} onChange={e => setEditForm({...editForm, udsBejar: parseInt(e.target.value)||0})} style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', textAlign: 'center', fontSize: '12px' }} />
                                ) : (
                                  <span style={{ display: 'inline-block', width: '30px', padding: '2px', background: item.udsBejar > 0 ? '#FEF08A' : 'transparent', borderRadius: '4px', fontWeight: item.udsBejar > 0 ? 'bold' : 'normal', color: item.udsBejar > 0 ? '#1E293B' : '#94A3B8' }}>
                                    {item.udsBejar || '-'}
                                  </span>
                                )}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: '12px' }}>
                                {isEditing ? (
                                    <input type="number" value={editForm.udsVillamayor || 0} onChange={e => setEditForm({...editForm, udsVillamayor: parseInt(e.target.value)||0})} style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', textAlign: 'center', fontSize: '12px' }} />
                                ) : (
                                  <span style={{ display: 'inline-block', width: '30px', padding: '2px', background: item.udsVillamayor > 0 ? '#FEF08A' : 'transparent', borderRadius: '4px', fontWeight: item.udsVillamayor > 0 ? 'bold' : 'normal', color: item.udsVillamayor > 0 ? '#1E293B' : '#94A3B8' }}>
                                    {item.udsVillamayor || '-'}
                                  </span>
                                )}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', color: '#0EA5E9', borderLeft: '1px solid #E2E8F0', fontSize: '12px' }}>
                              {totalUds > 0 ? totalUds : '-'}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', color: '#10B981', background: '#F0FDF4', fontSize: '12px' }}>
                              {valorTotal > 0 ? valorTotal.toFixed(2) + ' €' : '-'}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                {isEditing ? (
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                        <button onClick={handleSaveRow} style={{ background: '#10b981', border: 'none', borderRadius: '4px', padding: '4px 6px', color: '#fff', cursor: 'pointer' }} title="Guardar"><Save size={16}/></button>
                                        <button onClick={handleCancel} style={{ background: '#94A3B8', border: 'none', borderRadius: '4px', padding: '4px 6px', color: '#fff', cursor: 'pointer' }} title="Cancelar"><X size={16}/></button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                        <button onClick={() => handleEdit(item)} style={{ background: 'transparent', border: 'none', color: '#3B82F6', cursor: 'pointer' }} title="Editar"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDelete(item.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }} title="Eliminar"><Trash2 size={16}/></button>
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
          </>
        )}
      </div>
    </div>
  )
}
