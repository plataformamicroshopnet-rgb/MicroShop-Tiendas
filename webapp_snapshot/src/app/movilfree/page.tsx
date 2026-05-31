'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ShoppingCart, X, Users, ArrowLeftRight, RefreshCcw, Package, Edit, Save, Search, Edit2, Wrench, UploadCloud, Printer } from 'lucide-react'
import './MovilFree.css'

// --- Types ---
type Product = { id: string; nombre: string; categoria: string; precio: number; coste: number; stock: number; createdAt: string; imei?: string }
type Client = { id: string; nif: string; nombre: string; direccion?: string; poblacion?: string; provincia?: string; cp?: string; movil?: string; fijo?: string; email: string; totalComprado: number }
type Sale = { id: string; numeroFactura?: number; vendedor: string; nifCliente: string; nombreCliente: string; listaProductos: string; importeTotal: number; estado: string; fechaVenta: string; motivoDevolucion: string }
type Reparacion = { id?: string; numero: number; nombreApellidos: string; direccion?: string; dniNif?: string; telefono?: string; marca?: string; modelo?: string; imei?: string; fechaRecepcion?: string; observaciones?: string; motivo?: string; fechaEntrega?: string; garantia?: string; informe?: string; repara?: string; costePvd?: number; pvp?: number; createdAt?: string; }
type BudgetLine = { id: string; desc: string; qty: number; price: number }

export default function MovilFreeApp() {
  const [activeTab, setActiveTab] = useState<'ventas'|'productos'|'clientes'|'devoluciones'|'sat'>('ventas')
  
  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [reparaciones, setReparaciones] = useState<Reparacion[]>([])

  // Load data
  const loadReparaciones = () => fetch('/api/movilfree-reparaciones').then(r => r.json()).then(d => { if(Array.isArray(d)) setReparaciones(d); else console.error('API Error:', d) })

  useEffect(() => {
    fetch('/api/movilfree/products').then(r => r.json()).then(d => { if(Array.isArray(d)) setProducts(d); else console.error('API Error:', d) })
    fetch('/api/movilfree/clients').then(r => r.json()).then(d => { if(Array.isArray(d)) setClients(d); else console.error('API Error:', d) })
    fetch('/api/movilfree/sales').then(r => r.json()).then(d => { if(Array.isArray(d)) setSales(d); else console.error('API Error:', d) })
    loadReparaciones()
  }, [activeTab])

  // Helpers
  const formatMoney = (val: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val)

  // --- Subcomponents ---
  
  // 1. STOCK
  const [newProd, setNewProd] = useState({ nombre: '', categoria: 'Accesorio', precio: 0, coste: 0, stock: 0, imei: '' })
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [searchInvProducts, setSearchInvProducts] = useState('')
  const [searchClients, setSearchClients] = useState('')
  const [searchSales, setSearchSales] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const handleBulkPaste = async () => {
    if(!pasteText.trim()) return
    const rows = pasteText.split('\n').filter(r => r.trim() !== '')
    const newProducts = rows.map(r => {
      const cols = r.split('\t')
      const rawDate = cols[0] ? cols[0].trim().split(' ')[0] : ''
      return {
        createdAt: rawDate ? new Date(rawDate).toISOString() : undefined,
        nombre: cols[1] ? cols[1].trim() : 'Desconocido',
        categoria: cols[2] ? cols[2].trim() : 'Varios',
        coste: parseFloat((cols[3] || '0').replace(',', '.')) || 0,
        precio: parseFloat((cols[4] || '0').replace(',', '.')) || 0,
        imei: cols[6] ? cols[6].trim() : '',
        stock: parseInt((cols[7] || '1'), 10) || 1
      }
    })
    
    try {
      const res = await fetch('/api/movilfree/products', { method: 'POST', body: JSON.stringify(newProducts) })
      if (!res.ok) throw new Error('Error al guardar en masa')
      
      const prodsRes = await fetch('/api/movilfree/products')
      const data = await prodsRes.json()
      setProducts(data)
      
      setShowPasteModal(false)
      setPasteText('')
      alert(`¡Se han añadido ${newProducts.length} productos correctamente!`)
    } catch(e: any) {
      alert(e.message)
    }
  }

  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editProdData, setEditProdData] = useState<any>(null)

  const handleSaveEditProduct = async () => {
    if(!editProdData) return;
    try {
      const res = await fetch(`/api/movilfree/products/${editingProductId}`, { method: 'PUT', body: JSON.stringify(editProdData) })
      if(res.ok) {
        setProducts(products.map(p => p.id === editingProductId ? editProdData : p))
        setEditingProductId(null)
        setEditProdData(null)
      } else {
        const errRes = await res.json(); alert('Error al guardar: ' + (errRes.error || JSON.stringify(errRes)))
      }
    } catch(e:any) { alert(e.message) }
  }

  const handleDeleteProduct = async (id: string) => {
    if(!confirm('¿Seguro que quieres borrar este producto permanentemente?')) return;
    try {
      const res = await fetch(`/api/movilfree/products/${id}`, { method: 'DELETE' })
      if(res.ok) {
        setProducts(products.filter(p => p.id !== id))
      } else {
        alert('Error al borrar')
      }
    } catch(e:any) { alert(e.message) }
  }

  const handleCreateProduct = async () => {
    if(!newProd.nombre) return alert('El nombre es obligatorio')
    const res = await fetch('/api/movilfree/products', { method: 'POST', body: JSON.stringify(newProd) })
    const created = await res.json()
    setProducts([created, ...products])
    setNewProd({ nombre: '', categoria: 'Accesorio', precio: 0, coste: 0, stock: 0, imei: '' })
  }
  const updateStock = async (id: string, newStock: number) => {
    const p = products.find(x => x.id === id)
    if(!p) return
    const res = await fetch(`/api/movilfree/products/${id}`, { method: 'PUT', body: JSON.stringify({ ...p, stock: newStock }) })
    if(res.ok) {
      setProducts(products.map(x => x.id === id ? { ...x, stock: newStock } : x))
    }
  }

  // 2. CLIENTES
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCategory, setSearchCategory] = useState('Todas')

  const [newClient, setNewClient] = useState({ nif: '', nombre: '', direccion: '', poblacion: '', provincia: '', cp: '', movil: '', fijo: '', email: '' })
  const handleCreateClient = async () => {
    if(!newClient.nif || !newClient.nombre) return alert('NIF y Nombre obligatorios')
    const res = await fetch('/api/movilfree/clients', { method: 'POST', body: JSON.stringify(newClient) })
    const created = await res.json()
    if (!res.ok) return alert('Error: ' + (created.error || 'No se pudo crear'))
    const cliRes = await fetch('/api/movilfree/clients')
    const data = await cliRes.json()
    setClients(data)
    setNewClient({ nif: '', nombre: '', direccion: '', poblacion: '', provincia: '', cp: '', movil: '', fijo: '', email: '' })
  }

  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [editClientData, setEditClientData] = useState<any>(null)

  const handleSaveEditClient = async () => {
    if(!editClientData) return;
    try {
      const res = await fetch(`/api/movilfree/clients/${editingClientId}`, { method: 'PUT', body: JSON.stringify(editClientData) })
      if(res.ok) {
        const updated = await res.json()
        setClients(clients.map(c => c.id === editingClientId ? updated : c))
        setEditingClientId(null)
        setEditClientData(null)
      } else {
        const errRes = await res.json(); alert('Error al guardar: ' + (errRes.error || JSON.stringify(errRes)))
      }
    } catch(e:any) { alert(e.message) }
  }

  const handleDeleteClient = async (id: string) => {
    if(!confirm('¿Seguro que quieres borrar este cliente?')) return;
    try {
      const res = await fetch(`/api/movilfree/clients/${id}`, { method: 'DELETE' })
      if(res.ok) {
        setClients(clients.filter(c => c.id !== id))
      } else {
        alert('Error al borrar cliente')
      }
    } catch(e:any) { alert(e.message) }
  }

  const [showClientPasteModal, setShowClientPasteModal] = useState(false)
  const [clientPasteText, setClientPasteText] = useState('')

  const handleBulkClientPaste = async () => {
    if(!clientPasteText.trim()) return
    const rows = clientPasteText.split('\n').filter(r => r.trim() !== '')
    const newClients = rows.map(r => {
      const cols = r.split('\t')
      return {
        nif: cols[0] ? cols[0].trim() : '',
        nombre: cols[1] ? cols[1].trim() : 'Desconocido',
        direccion: cols[2] ? cols[2].trim() : '',
        poblacion: cols[3] ? cols[3].trim() : '',
        provincia: cols[4] ? cols[4].trim() : '',
        cp: cols[5] ? cols[5].trim() : '',
        movil: cols[6] ? cols[6].trim() : '',
        fijo: cols[7] ? cols[7].trim() : '',
        email: cols[8] ? cols[8].trim() : '',
        totalComprado: 0
      }
    })
    
    try {
      const res = await fetch('/api/movilfree/clients', { method: 'POST', body: JSON.stringify(newClients) })
      if (!res.ok) throw new Error('Error al guardar en masa')
      
      const cliRes = await fetch('/api/movilfree/clients')
      const data = await cliRes.json()
      setClients(data)
      
      setShowClientPasteModal(false)
      setClientPasteText('')
      alert(`¡Se han añadido ${newClients.length} clientes correctamente!`)
    } catch(e: any) {
      alert(e.message)
    }
  }

  // 3. VENTAS (NUEVA VENTA)
  const [printModalSale, setPrintModalSale] = useState<Sale | null>(null)
  const [cart, setCart] = useState<{product: Product, cantidad: number}[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [clientName, setClientName] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  const addToCart = (p: Product) => {
    if (p.stock <= 0) return alert('No hay stock de este producto')
    const existing = cart.find(x => x.product.id === p.id)
    if (existing) {
      if (existing.cantidad >= p.stock) return alert('No hay más stock disponible')
      setCart(cart.map(x => x.product.id === p.id ? { ...x, cantidad: x.cantidad + 1 } : x))
    } else {
      setCart([...cart, { product: p, cantidad: 1 }])
    }
  }

  const handleCheckout = async () => {
    if(cart.length === 0) return alert('El carrito está vacío')
    const total = cart.reduce((acc, item) => acc + (item.product.precio * 1.21 * item.cantidad), 0)
    const cl = clients.find(c => c.nif === selectedClient || c.nombre === clientName)
    
    const payload = {
      vendedor: 'Sistema',
      nifCliente: selectedClient || (cl ? cl.nif : 'CONTADO'),
      nombreCliente: clientName || (cl ? cl.nombre : 'Cliente Contado'),
      importeTotal: total,
      listaProductos: cart.map(c => ({ id: c.product.id, nombre: c.product.nombre, cantidad: c.cantidad, precio: c.product.precio * 1.21, coste: c.product.coste }))
    }

    const res = await fetch('/api/movilfree/sales', { method: 'POST', body: JSON.stringify(payload) })
    if (res.ok) {
      const createdSale = await res.json()
      setPrintModalSale(createdSale)
      setCart([])
      fetch('/api/movilfree/sales').then(r => r.json()).then(d => { if(Array.isArray(d)) setSales(d); else console.error(d) })
      fetch('/api/movilfree/products').then(r => r.json()).then(d => { if(Array.isArray(d)) setProducts(d); else console.error(d) })
    }
  }

  // 4. DEVOLUCIONES
  const [returnModalSale, setReturnModalSale] = useState<Sale | null>(null)
  const [returnQty, setReturnQty] = useState<Record<string, number>>({})
  const [returnReason, setReturnReason] = useState('')
  const handleReturnClick = (sale: Sale) => {
    setReturnModalSale(sale)
    setReturnQty({})
    setReturnReason('')
  }

  const submitPartialReturn = async () => {
    if(!returnModalSale) return
    const itemsToReturn = Object.entries(returnQty).map(([id, qty]) => ({ id, cantidad: qty })).filter(x => x.cantidad > 0)
    if(itemsToReturn.length === 0) return alert("Selecciona al menos 1 producto para devolver")
    
    const payload = {
      estado: 'DEVOLUCION_PARCIAL',
      motivoDevolucion: returnReason || 'Devolución parcial',
      returnedItems: itemsToReturn
    }
    
    const res = await fetch(`/api/movilfree/sales/${returnModalSale.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    if (res.ok) {
      alert('Devolución registrada correctamente. El stock se ha actualizado.')
      fetch('/api/movilfree/sales').then(r => r.json()).then(d => { if(Array.isArray(d)) setSales(d); else console.error(d) })
      setReturnModalSale(null)
    }
  }

  const submitFullReturn = async () => {
    if(!returnModalSale) return
    const payload = {
      estado: 'DEVUELTA',
      motivoDevolucion: returnReason || 'Devolución completa'
    }
    const res = await fetch(`/api/movilfree/sales/${returnModalSale.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    if (res.ok) {
      alert('Venta devuelta por completo.')
      fetch('/api/movilfree/sales').then(r => r.json()).then(d => { if(Array.isArray(d)) setSales(d); else console.error(d) })
      setReturnModalSale(null)
    }
  }


  const handleDeleteSale = async (id: string) => {
    if(!confirm('¿Estás seguro de eliminar esta venta por completo?')) return
    const res = await fetch(`/api/movilfree/sales/${id}`, { method: 'DELETE' })
    if(res.ok) {
      setSales(sales.filter(s => s.id !== id))
    }
  }

  // SAT Logics
  const [searchReparaciones, setSearchReparaciones] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [pasteData, setPasteData] = useState('')

  const handleBulkImport = async () => {
    if (!pasteData) return alert('Pega los datos del Excel primero')
    const rows = pasteData.split('\n').filter(r => r.trim())
    const records = rows.map(r => {
      const cols = r.split('\t')
      return {
        numero: parseInt(cols[0]) || 0,
        nombreApellidos: cols[1] || '',
        direccion: cols[2] || '',
        dniNif: cols[3] || '',
        telefono: cols[4] || '',
        marca: cols[5] || '',
        modelo: cols[6] || '',
        imei: cols[7] || '',
        fechaRecepcion: cols[8] || '',
        observaciones: cols[9] || '',
        motivo: cols[10] || '',
        fechaEntrega: cols[11] || '',
        garantia: cols[12] || '',
        informe: cols[13] || '',
        repara: cols[14] || '',
        costePvd: cols[15] ? parseFloat(cols[15].replace(',','.')) : null,
        pvp: cols[16] ? parseFloat(cols[16].replace(',','.')) : null,
      }
    })

    try {
      const res = await fetch('/api/movilfree-reparaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: true, reparaciones: records })
      })
      if (res.ok) {
        alert('Importación completada!')
        setPasteData('')
        setIsImporting(false)
        loadReparaciones()
      } else {
        const err = await res.json()
        alert('Error en importación: ' + err.error)
      }
    } catch (e) {
      alert('Error en red al importar')
    }
  }

  const handleDeleteReparacion = async (id: string) => {
    if (!confirm('Borrar reparación?')) return
    const res = await fetch(`/api/movilfree-reparaciones?id=${id}`, { method: 'DELETE' })
    if (res.ok) loadReparaciones()
  }

  const [editingSatId, setEditingSatId] = useState<string | null>(null)
  const [editSatData, setEditSatData] = useState<any>(null)

  const handleSaveEditSat = async () => {
    if(!editSatData) return;
    try {
      const res = await fetch(`/api/movilfree-reparaciones`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editSatData) })
      if(res.ok) {
        loadReparaciones()
        setEditingSatId(null)
        setEditSatData(null)
      } else {
        alert('Error al guardar')
      }
    } catch(e:any) { alert(e.message) }
  }

  const handleCreateBlankSat = async () => {
    try {
      const highestNum = reparaciones.reduce((max, r) => Math.max(max, r.numero || 0), 0)
      const res = await fetch('/api/movilfree-reparaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numero: highestNum + 1, nombreApellidos: 'Nuevo Registro', motivo: '' }) })
      if(res.ok) {
        const created = await res.json()
        setReparaciones([created, ...reparaciones])
        setEditingSatId(created.id)
        setEditSatData(created)
      }
    } catch(e) { alert('Error al crear') }
  }

  const [printModalSat, setPrintModalSat] = useState<Reparacion | null>(null)
  const [satBudgetLines, setSatBudgetLines] = useState<BudgetLine[]>([])
  const [satDeliveryDate, setSatDeliveryDate] = useState('')

  const handlePrintSat = (r: Reparacion) => {
    setPrintModalSat(r)
    if (r.pvp) {
      setSatBudgetLines([
        { id: '1', desc: 'Cambio de piezas', qty: 1, price: Math.max(0, r.pvp - 24) },
        { id: '2', desc: 'Mano de obra', qty: 1, price: 24 }
      ])
    } else {
      setSatBudgetLines([
        { id: '1', desc: 'Cambio de piezas', qty: 1, price: 0 },
        { id: '2', desc: 'Mano de obra', qty: 1, price: 0 }
      ])
    }
    
    // Predeterminamos fecha de entrega: lo que tenga, o a 30 dias vista
    if (r.fechaEntrega) {
      setSatDeliveryDate(r.fechaEntrega)
    } else {
      const future = new Date()
      future.setDate(future.getDate() + 30)
      setSatDeliveryDate(future.toLocaleDateString('es-ES'))
    }
  }

  // UI Theme
  const fuchsia = '#E91E97'
  const lightPink = '#FFF0F9'

  return (
    <div className="print-wrapper mf-main-wrapper">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        <div className="no-print">
          {/* HEADER */}
          <div className="mf-header">
          <div style={{ width: 48, height: 48, background: '#E91E97', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <ShoppingCart size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, color: '#E91E97', fontSize: 24, fontWeight: 800 }}>MovilFree Salamanca</h1>
            <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>Panel de Gestión y Punto de Venta</p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <img src="/images/media__1778608332264.png" alt="Movilfree" style={{ height: 48, objectFit: 'contain' }} />
          </div>
        </div>

        {/* TABS & SEARCH */}
        <div className="mf-tabs-bar">
          <div className="mf-tabs-buttons">
          <button onClick={() => setActiveTab('ventas')} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: activeTab === 'ventas' ? '#E91E97' : 'white', color: activeTab === 'ventas' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'ventas' ? '0 4px 12px rgba(233,30,151,0.2)' : 'none' }}>
            <ShoppingCart size={18} /> Punto de Venta
          </button>
          <button onClick={() => setActiveTab('productos')} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: activeTab === 'productos' ? '#E91E97' : 'white', color: activeTab === 'productos' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'productos' ? '0 4px 12px rgba(233,30,151,0.2)' : 'none' }}>
            <Package size={18} /> Stock
          </button>
          <button onClick={() => setActiveTab('clientes')} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: activeTab === 'clientes' ? '#E91E97' : 'white', color: activeTab === 'clientes' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'clientes' ? '0 4px 12px rgba(233,30,151,0.2)' : 'none' }}>
            <Users size={18} /> Clientes
          </button>
          <button onClick={() => setActiveTab('devoluciones')} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: activeTab === 'devoluciones' ? '#E91E97' : 'white', color: activeTab === 'devoluciones' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'devoluciones' ? '0 4px 12px rgba(233,30,151,0.2)' : 'none' }}>
            <RefreshCcw size={18} /> Ventas & Devoluciones
          </button>
          <button onClick={() => setActiveTab('sat')} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: activeTab === 'sat' ? '#E91E97' : 'white', color: activeTab === 'sat' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'sat' ? '0 4px 12px rgba(233,30,151,0.2)' : 'none' }}>
            <Wrench size={18} /> SAT
          </button>
          </div>

          <div className="mf-search-container">
            <Search size={18} style={{ position: 'absolute', left: 14, top: 13, color: '#0284c7' }} />
            {activeTab === 'ventas' && (
              <input placeholder="Buscar producto en Punto de Venta..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} style={{ width: '100%', height: 44, padding: '0 16px 0 44px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 14, boxSizing: 'border-box' }} />
            )}
            {activeTab === 'productos' && (
              <input placeholder="Buscar producto en Stock..." value={searchInvProducts} onChange={e=>setSearchInvProducts(e.target.value)} style={{ width: '100%', height: 44, padding: '0 16px 0 44px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 14, boxSizing: 'border-box' }} />
            )}
            {activeTab === 'clientes' && (
              <input placeholder="Buscar cliente por NIF o Nombre..." value={searchClients} onChange={e=>setSearchClients(e.target.value)} style={{ width: '100%', height: 44, padding: '0 16px 0 44px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 14, boxSizing: 'border-box' }} />
            )}
            {activeTab === 'devoluciones' && (
              <input placeholder="Buscar venta (NIF, Factura, Vendedor, Estado)..." value={searchSales} onChange={e=>setSearchSales(e.target.value)} style={{ width: '100%', height: 44, padding: '0 16px 0 44px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 14, boxSizing: 'border-box' }} />
            )}
            {activeTab === 'sat' && (
              <input placeholder="Buscar reparación..." value={searchReparaciones} onChange={e=>setSearchReparaciones(e.target.value)} style={{ width: '100%', height: 44, padding: '0 16px 0 44px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 14, boxSizing: 'border-box' }} />
            )}
          </div>
        </div>

        {/* CONTENIDO TABS */}
        <div className="mf-content-box">
          
          {/* TAB: VENTAS */}
          {activeTab === 'ventas' && (
            <div className="mf-pos-grid">
              <div style={{ background: '#f8f9fa', padding: 24, borderRadius: 16 }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ color: '#E91E97', margin: 0 }}>Catálogo de Productos</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} color="#888" style={{ position: 'absolute', left: 10, top: 10 }} />
                      <input 
                        placeholder="Buscar producto..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        style={{ padding: '8px 10px 8px 32px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, width: 200 }} 
                      />
                    </div>
                    <select 
                      value={searchCategory} 
                      onChange={e => setSearchCategory(e.target.value)} 
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, background: 'white' }}
                    >
                      <option value="Todas">Todas las categorías</option>
                      <option value="Terminal">Terminal</option>
                      <option value="Accesorio">Accesorio</option>
                      <option value="Servicio">Servicio</option>
                      <option value="SAT">SAT</option>
                      <option value="Paquetería">Paquetería</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {products.filter(p => p.stock > 0 && (searchCategory === 'Todas' || p.categoria === searchCategory) && p.nombre.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
                    <div key={p.id} onClick={() => addToCart(p)} style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #eee', cursor: 'pointer', transition: 'all 0.2s', ':hover': { borderColor: '#E91E97', transform: 'translateY(-2px)' } } as any}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{p.categoria}</div>
                      <div style={{ fontWeight: 'bold', color: '#333', marginBottom: 8 }}>{p.nombre}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 900, color: '#E91E97', fontSize: 18 }}>{formatMoney(p.precio * 1.21)}</div>
                        <div style={{ fontSize: 12, color: '#aaa' }}>Stock: {p.stock}</div>
                      </div>
                    </div>
                  ))}
                  {products.filter(p => p.stock > 0 && (searchCategory === 'Todas' || p.categoria === searchCategory) && p.nombre.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && <div style={{ color: '#888' }}>No se encontraron productos.</div>}
                </div>
              </div>
              <div style={{ background: '#f8f9fa', padding: 24, borderRadius: 16 }}>
                <h3 style={{ color: '#333', margin: '0 0 16px 0' }}>Carrito Actual</h3>
                
                <div style={{ marginBottom: 16, position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>NIF/CIF Opcional</label>
                      <input 
                        type="text" 
                        value={selectedClient} 
                        onChange={e => {
                          setSelectedClient(e.target.value);
                          setShowSuggestions(true);
                          const match = clients.find(c => c.nif.toLowerCase().includes(e.target.value.toLowerCase()));
                          if (match && e.target.value.length > 2) setClientName(match.nombre);
                        }} 
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="Ej: 12345678Z" 
                        maxLength={9}
                        style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', marginTop: 4 }} 
                      />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Nombre Cliente</label>
                      <input 
                        type="text" 
                        value={clientName} 
                        onChange={e => {
                          setClientName(e.target.value);
                          setShowSuggestions(true);
                          const match = clients.find(c => c.nombre.toLowerCase().includes(e.target.value.toLowerCase()));
                          if (match && e.target.value.length > 2) setSelectedClient(match.nif);
                        }} 
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="Ej: Juan Pérez" 
                        style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', marginTop: 4 }} 
                      />
                    </div>
                  </div>
                  
                  {/* Autocomplete Dropdown */}
                  {showSuggestions && (selectedClient.length > 1 || clientName.length > 1) && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #eee', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 150, overflowY: 'auto', marginTop: 4 }}>
                      {clients
                        .filter(c => (selectedClient && c.nif.toLowerCase().includes(selectedClient.toLowerCase())) || (clientName && c.nombre.toLowerCase().includes(clientName.toLowerCase())))
                        .slice(0, 5)
                        .map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => {
                              setSelectedClient(c.nif);
                              setClientName(c.nombre);
                              setShowSuggestions(false);
                            }}
                            style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f8f9fa', display: 'flex', justifyContent: 'space-between' }}
                          >
                            <strong style={{ color: '#E91E97', fontSize: 13 }}>{c.nif}</strong>
                            <span style={{ fontSize: 13, color: '#333' }}>{c.nombre}</span>
                          </div>
                      ))}
                      {clients.filter(c => (selectedClient && c.nif.toLowerCase().includes(selectedClient.toLowerCase())) || (clientName && c.nombre.toLowerCase().includes(clientName.toLowerCase()))).length === 0 && (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: '#888', textAlign: 'center' }}>
                          Nuevo cliente (se usará el nombre escrito)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ minHeight: 200, background: 'white', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid #eee' }}>
                  {cart.length === 0 && <div style={{ color: '#aaa', textAlign: 'center', marginTop: 60 }}>Carrito vacío</div>}
                  {cart.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px dashed #eee', paddingBottom: 8 }}>
                      <div style={{ flex: 1, paddingRight: 12 }}>
                        {c.product.categoria === 'Paquetería' ? (
                          <input 
                            value={c.product.nombre} 
                            onChange={(e) => setCart(cart.map(x => x.product.id === c.product.id ? { ...x, product: { ...x.product, nombre: e.target.value } } : x))}
                            style={{ fontWeight: 'bold', fontSize: 14, border: '1px solid #ddd', borderRadius: 4, padding: '2px 6px', width: '100%', marginBottom: 4 }} 
                            placeholder="Ej: SEUR"
                          />
                        ) : (
                          <div style={{ fontWeight: 'bold', fontSize: 14 }}>{c.product.nombre}</div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <button onClick={() => {
                            if (c.cantidad <= 1) setCart(cart.filter(x => x.product.id !== c.product.id))
                            else setCart(cart.map(x => x.product.id === c.product.id ? { ...x, cantidad: x.cantidad - 1 } : x))
                          }} style={{ width: 24, height: 24, borderRadius: 12, border: '1px solid #ddd', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                          
                          <input 
                            type="number" 
                            min="1" 
                            max={c.product.stock}
                            value={c.cantidad} 
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              const validVal = Math.min(Math.max(1, val), c.product.stock);
                              setCart(cart.map(x => x.product.id === c.product.id ? { ...x, cantidad: validVal } : x));
                            }}
                            style={{ width: 40, textAlign: 'center', padding: '2px 4px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}
                          />
                          
                          <button onClick={() => {
                            if (c.cantidad < c.product.stock) {
                              setCart(cart.map(x => x.product.id === c.product.id ? { ...x, cantidad: x.cantidad + 1 } : x))
                            } else {
                              alert('No hay más stock disponible')
                            }
                          }} style={{ width: 24, height: 24, borderRadius: 12, border: 'none', background: fuchsia, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                          
                          {c.product.categoria === 'Paquetería' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                              <span style={{ fontSize: 12, color: '#888' }}>Ganancia sin IVA:</span>
                              <input 
                                type="number" 
                                value={c.product.precio || ''} 
                                onChange={(e) => setCart(cart.map(x => x.product.id === c.product.id ? { ...x, product: { ...x.product, precio: Number(e.target.value) } } : x))}
                                style={{ width: 60, padding: '2px 4px', borderRadius: 4, border: '1px solid #E91E97', fontSize: 12, outline: 'none' }}
                                placeholder="0.00"
                              />
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>x {formatMoney(c.product.precio * 1.21)}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ fontWeight: 'bold', color: fuchsia, alignSelf: 'center' }}>{formatMoney(c.product.precio * 1.21 * c.cantidad)}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 'bold', color: '#555' }}>TOTAL</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#333' }}>
                    {formatMoney(cart.reduce((a, b) => a + (b.product.precio * 1.21 * b.cantidad), 0))}
                  </div>
                </div>

                <button onClick={handleCheckout} style={{ width: '100%', background: fuchsia, color: 'white', border: 'none', padding: 16, borderRadius: 12, fontWeight: 'bold', fontSize: 16, cursor: 'pointer' }}>
                  Cobrar Venta
                </button>
              </div>
            </div>
          )}

          {/* TAB: PRODUCTOS */}
          {activeTab === 'productos' && (
            <div>
              
              <div className="mf-form-grid-productos">
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Producto</label>
                  <input placeholder="Nombre" value={newProd.nombre} onChange={e=>setNewProd({...newProd, nombre: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Categoría</label>
                  <select value={newProd.categoria} onChange={e=>setNewProd({...newProd, categoria: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4, background: 'white' }}>
                    <option>Terminal</option>
                    <option>Accesorio</option>
                    <option>Servicio</option>
                    <option>SAT</option>
                    <option>Paquetería</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Coste sin IVA</label>
                  <input type="number" placeholder="Coste" value={newProd.coste || ''} onChange={e=>setNewProd({...newProd, coste: Number(e.target.value)})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: fuchsia}}>PVP</label>
                  <input type="number" placeholder="PVP" value={newProd.precio ? Number((newProd.precio * 1.21).toFixed(2)) : ''} onChange={e=>setNewProd({...newProd, precio: Number((Number(e.target.value) / 1.21).toFixed(2))})} style={{ width: '100%', padding: 10, borderRadius: 6, border: `2px solid ${fuchsia}`, marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Stock</label>
                  <input type="number" placeholder="Uds." value={newProd.stock || ''} onChange={e=>setNewProd({...newProd, stock: Number(e.target.value)})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                {newProd.categoria === 'Terminal' && (
                  <div>
                    <label style={{fontSize: 12, fontWeight: 'bold', color: '#E91E97'}}>IMEI (15 dígitos)</label>
                    <input type="text" maxLength={15} placeholder="Ej: 352456789012345" value={newProd.imei || ''} onChange={e=>setNewProd({...newProd, imei: e.target.value.replace(/\D/g, '')})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '2px solid #E91E97', marginTop: 4, fontFamily: 'monospace' }} />
                  </div>
                )}
                <div className="mf-action-buttons">
                  <button onClick={handleCreateProduct} style={{ background: fuchsia, color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Añadir</button>
                  <button onClick={() => setShowPasteModal(true)} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Excel 📋</button>
                </div>
              </div>

              {showPasteModal && (
                <div style={{ background: '#e8f5e9', padding: 16, borderRadius: 12, marginBottom: 24, border: '1px solid #4CAF50' }}>
                  <h3 style={{ marginTop: 0, color: '#2e7d32' }}>Importar desde Excel</h3>
                  <p style={{ fontSize: 13, color: '#333' }}>Copia las filas desde tu Excel respetando el orden de estas 7 columnas: <strong>Nombre, Categoría, Coste, Precio, PVP, Stock, IMEI</strong>. Pégalas aquí:</p>
                  <textarea 
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    style={{ width: '100%', height: 150, padding: 10, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'monospace', whiteSpace: 'pre' }}
                    placeholder="Ejemplo:&#10;Funda Silicona&#9;Accesorio&#9;2,50&#9;5,00&#9;6,05&#9;10&#9;123456789012345"
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button onClick={handleBulkPaste} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Procesar y Guardar</button>
                    <button onClick={() => setShowPasteModal(false)} style={{ background: '#ccc', color: '#333', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}


              {newProd.precio > 0 && newProd.coste > 0 && (
                <div style={{ marginBottom: 24, fontSize: 14, color: '#555', background: '#e6fffa', padding: '8px 16px', borderRadius: 8, display: 'inline-block' }}>
                  Beneficio: <strong style={{ color: '#276749', fontSize: 16 }}>{formatMoney(newProd.precio - newProd.coste)}</strong>
                </div>
              )}


              <div className="mf-table-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14, minWidth: 900 }}>
                <thead>
                  
                  <tr style={{ background: lightPink, color: fuchsia }}>
                    <th style={{ padding: 10, borderRadius: '8px 0 0 8px', width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Fecha</th>
                    <th style={{ padding: 10, width: 'auto' }}>Producto</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Categoría</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Coste sin IVA</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>PVP</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Beneficio</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>IMEI</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Stock</th>
                    <th style={{ padding: 10, borderRadius: '0 8px 8px 0', textAlign: 'center', width: '1%', whiteSpace: 'nowrap' }}>Acciones</th>
                  </tr>

                </thead>
                <tbody>
                  {products.filter(p => p.nombre.toLowerCase().includes(searchInvProducts.toLowerCase())).map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #eee', background: editingProductId === p.id ? '#fdf2f8' : 'transparent' }}>
                      {editingProductId === p.id ? (
                        <>
                          <td style={{ padding: 10, color: '#888', whiteSpace: 'nowrap', textAlign: 'center', fontSize: 12 }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-ES') : '-'}</td>
                          <td style={{ padding: 10 }}><input value={editProdData?.nombre || ''} onChange={e => setEditProdData({...editProdData, nombre: e.target.value})} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <select value={editProdData?.categoria || ''} onChange={e => setEditProdData({...editProdData, categoria: e.target.value})} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }}>
                              <option>Terminal</option><option>Accesorio</option><option>Servicio</option><option>SAT</option><option>Paquetería</option>
                            </select>
                          </td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}><input type="number" value={editProdData?.coste || 0} onChange={e => setEditProdData({...editProdData, coste: Number(e.target.value)})} style={{ width: 70, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none', textAlign: 'center' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}><input type="number" value={editProdData?.precio ? Number((editProdData.precio * 1.21).toFixed(2)) : 0} onChange={e => setEditProdData({...editProdData, precio: Number((Number(e.target.value) / 1.21).toFixed(2))})} style={{ width: 70, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none', textAlign: 'center', fontWeight: 'bold', color: fuchsia }} /></td>
                          <td style={{ padding: 10, fontWeight: 'bold', color: '#276749', whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney((editProdData?.precio || 0) - (editProdData?.coste || 0))}</td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}><input value={editProdData?.imei || ''} maxLength={15} onChange={e => setEditProdData({...editProdData, imei: e.target.value.replace(/\D/g,'')})} style={{ width: 110, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none', textAlign: 'center', fontSize: 13, fontFamily: 'monospace' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}><input type="number" value={editProdData?.stock || 0} onChange={e => setEditProdData({...editProdData, stock: Number(e.target.value)})} style={{ width: 50, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none', textAlign: 'center' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button onClick={handleSaveEditProduct} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: 8, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Guardar"><Save size={16} /></button>
                              <button onClick={() => { setEditingProductId(null); setEditProdData(null); }} style={{ background: '#f43f5e', color: 'white', border: 'none', padding: 8, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Cancelar"><X size={16} /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: 10, color: '#888', whiteSpace: 'nowrap', textAlign: 'center', fontSize: 12 }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-ES') : '-'}</td>
                          <td style={{ padding: 10, fontWeight: 'bold' }}>{p.nombre}</td>
                          <td style={{ padding: 10, color: '#666', whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <span style={{ background: '#eee', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>{p.categoria}</span>
                          </td>
                          <td style={{ padding: 10, color: '#888', whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney(p.coste)}</td>
                          <td style={{ padding: 10, fontWeight: 'bold', color: fuchsia, whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney(p.precio * 1.21)}</td>
                          <td style={{ padding: 10, fontWeight: 'bold', color: '#276749', whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney(p.precio - p.coste)}</td>
                          <td style={{ padding: 10, color: '#555', fontSize: 13, fontFamily: 'monospace', whiteSpace: 'nowrap', textAlign: 'center' }}>{p.imei || '-'}</td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                              <button onClick={() => updateStock(p.id, p.stock - 1)} style={{ width: 24, height: 24, borderRadius: 12, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>-</button>
                              <span style={{ fontWeight: 'bold', width: 16, textAlign: 'center', color: p.stock === 0 ? 'red' : 'inherit' }}>{p.stock}</span>
                              <button onClick={() => updateStock(p.id, p.stock + 1)} style={{ width: 24, height: 24, borderRadius: 12, border: 'none', background: fuchsia, color: 'white', cursor: 'pointer' }}>+</button>
                            </div>
                          </td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button onClick={() => { setEditingProductId(p.id); setEditProdData({...p}); }} style={{ background: 'white', color: '#0ea5e9', border: '1px solid #e0f2fe', padding: 8, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} title="Editar"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteProduct(p.id)} style={{ background: 'white', color: '#f43f5e', border: '1px solid #ffe4e6', padding: 8, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} title="Borrar"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* TAB: CLIENTES */}
          {activeTab === 'clientes' && (
            <div>
              <div className="mf-form-grid-clientes">
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>DNI/CIF</label>
                  <input placeholder="12345678Z" value={newClient.nif} maxLength={9} onChange={e=>setNewClient({...newClient, nif: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Nombre</label>
                  <input placeholder="Nombre completo" value={newClient.nombre} onChange={e=>setNewClient({...newClient, nombre: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Dirección</label>
                  <input placeholder="Calle, número, piso..." value={newClient.direccion} onChange={e=>setNewClient({...newClient, direccion: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Población</label>
                  <input placeholder="Población" value={newClient.poblacion} onChange={e=>setNewClient({...newClient, poblacion: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Provincia</label>
                  <input placeholder="Provincia" value={newClient.provincia} onChange={e=>setNewClient({...newClient, provincia: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>C.P.</label>
                  <input placeholder="Código Postal" value={newClient.cp} onChange={e=>setNewClient({...newClient, cp: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Tlfn. Móvil</label>
                  <input placeholder="Móvil" value={newClient.movil} onChange={e=>setNewClient({...newClient, movil: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Tlfn. Fijo</label>
                  <input placeholder="Fijo" value={newClient.fijo} onChange={e=>setNewClient({...newClient, fijo: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Email</label>
                  <input type="email" placeholder="correo@..." value={newClient.email} onChange={e=>setNewClient({...newClient, email: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div className="mf-action-buttons">
                  <button onClick={handleCreateClient} style={{ background: '#E91E97', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Registrar Cliente</button>
                  <button onClick={() => setShowClientPasteModal(true)} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Excel 📋</button>
                </div>
              </div>

              {showClientPasteModal && (
                <div style={{ background: '#e8f5e9', padding: 16, borderRadius: 12, marginBottom: 24, border: '1px solid #4CAF50' }}>
                  <h3 style={{ marginTop: 0, color: '#2e7d32' }}>Importar Clientes desde Excel</h3>
                  <p style={{ fontSize: 13, color: '#333' }}>Copia las filas desde tu Excel respetando el orden de estas 5 columnas: <strong>NIF, Nombre, Contacto, Dirección y Total Comprado</strong>. Pégalas aquí:</p>
                  <textarea 
                    value={clientPasteText}
                    onChange={e => setClientPasteText(e.target.value)}
                    style={{ width: '100%', height: 150, padding: 10, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'monospace', whiteSpace: 'pre' }}
                    placeholder="Ejemplo:&#10;12345678Z&#9;Juan Perez&#9;600123456&#9;Calle Mayor 1&#9;150.00"
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button onClick={handleBulkClientPaste} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Procesar y Guardar</button>
                    <button onClick={() => setShowClientPasteModal(false)} style={{ background: '#ccc', color: '#333', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}

                            <h3 style={{ margin: 0, color: '#333', marginBottom: 16 }}>Listado de Clientes</h3>
              <div className="mf-table-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: 700 }}>
                <thead>
                  <tr style={{ background: '#FFF0F9', color: '#E91E97' }}>
                    <th style={{ padding: 12, borderRadius: '8px 0 0 8px' }}>NIF</th>
                    <th style={{ padding: 12 }}>Nombre</th>
                    <th style={{ padding: 12 }}>Contacto</th>
                    <th style={{ padding: 12 }}>Dirección</th>
                    <th style={{ padding: 12 }}>Total Comprado</th>
                    <th style={{ padding: 12, borderRadius: '0 8px 8px 0', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.filter(c => c.nif.toLowerCase().includes(searchClients.toLowerCase())).map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                      {editingClientId === c.id ? (
                        <>
                          <td style={{ padding: 12 }}><input value={editClientData?.nif || ''} onChange={e=>setEditClientData({...editClientData, nif: e.target.value})} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #E91E97' }} /></td>
                          <td style={{ padding: 12 }}><input value={editClientData?.nombre || ''} onChange={e=>setEditClientData({...editClientData, nombre: e.target.value})} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #E91E97' }} /></td>
                          <td style={{ padding: 8 }}>
                            <input placeholder="Móvil" value={editClientData?.movil || ''} onChange={e=>setEditClientData({...editClientData, movil: e.target.value})} style={{ width: '100%', padding: 4, marginBottom: 4, border: '1px solid #E91E97', borderRadius: 4 }} />
                            <input placeholder="Fijo" value={editClientData?.fijo || ''} onChange={e=>setEditClientData({...editClientData, fijo: e.target.value})} style={{ width: '100%', padding: 4, marginBottom: 4, border: '1px solid #E91E97', borderRadius: 4 }} />
                            <input placeholder="Email" value={editClientData?.email || ''} onChange={e=>setEditClientData({...editClientData, email: e.target.value})} style={{ width: '100%', padding: 4, border: '1px solid #E91E97', borderRadius: 4 }} />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input placeholder="Dirección" value={editClientData?.direccion || ''} onChange={e=>setEditClientData({...editClientData, direccion: e.target.value})} style={{ width: '100%', padding: 4, marginBottom: 4, border: '1px solid #E91E97', borderRadius: 4 }} />
                            <div style={{ display: 'flex', gap: 4 }}>
                              <input placeholder="CP" value={editClientData?.cp || ''} onChange={e=>setEditClientData({...editClientData, cp: e.target.value})} style={{ width: 60, padding: 4, border: '1px solid #E91E97', borderRadius: 4 }} />
                              <input placeholder="Población" value={editClientData?.poblacion || ''} onChange={e=>setEditClientData({...editClientData, poblacion: e.target.value})} style={{ flex: 1, padding: 4, border: '1px solid #E91E97', borderRadius: 4 }} />
                              <input placeholder="Provincia" value={editClientData?.provincia || ''} onChange={e=>setEditClientData({...editClientData, provincia: e.target.value})} style={{ flex: 1, padding: 4, border: '1px solid #E91E97', borderRadius: 4 }} />
                            </div>
                          </td>
                          <td style={{ padding: 12, color: '#E91E97', fontWeight: 'bold' }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(c.totalComprado)}</td>
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button onClick={handleSaveEditClient} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: 8, borderRadius: 6, cursor: 'pointer' }}><Save size={16} /></button>
                              <button onClick={() => { setEditingClientId(null); setEditClientData(null); }} style={{ background: '#f43f5e', color: 'white', border: 'none', padding: 8, borderRadius: 6, cursor: 'pointer' }}><X size={16} /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: 12, fontWeight: 'bold', color: '#555' }}>{c.nif}</td>
                          <td style={{ padding: 12, fontWeight: 'bold' }}>{c.nombre}</td>
                          <td style={{ padding: 8, color: '#666' }}>
                            {c.movil && <div>📱 {c.movil}</div>}
                            {c.fijo && <div>📞 {c.fijo}</div>}
                            {c.email && <div>✉️ {c.email}</div>}
                          </td>
                          <td style={{ padding: 8, color: '#666' }}>
                            <div>{c.direccion || '-'}</div>
                            <div>{c.cp || ''} {c.poblacion || ''} {c.provincia ? `(${c.provincia})` : ''}</div>
                          </td>
                          <td style={{ padding: 12, color: '#E91E97', fontWeight: 'bold', fontSize: 16 }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(c.totalComprado)}</td>
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button onClick={() => { setEditingClientId(c.id); setEditClientData({...c}); }} style={{ background: 'white', color: '#0ea5e9', border: '1px solid #e0f2fe', padding: 8, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} title="Editar"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteClient(c.id)} style={{ background: 'white', color: '#f43f5e', border: '1px solid #ffe4e6', padding: 8, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} title="Borrar"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* TAB: DEVOLUCIONES E HISTORICO */}
          {activeTab === 'devoluciones' && (
            <div>
              {/* Dashboard de Beneficios, Filtro de Fechas y Búsqueda */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                <h3 style={{ margin: 0, color: '#333' }}>Histórico de Ventas</h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'stretch' }}>
                  <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: 12, border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#0284c7', fontWeight: 'bold', marginBottom: 8 }}>Desde Fecha</div>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ border: 'none', background: 'white', padding: '8px 12px', borderRadius: 6, outline: 'none', fontSize: 14, color: '#0369a1', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  
                  <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: 12, border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#0284c7', fontWeight: 'bold', marginBottom: 8 }}>Hasta Fecha</div>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ border: 'none', background: 'white', padding: '8px 12px', borderRadius: 6, outline: 'none', fontSize: 14, color: '#0369a1', width: '100%', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ background: '#FFF0F9', padding: '16px', borderRadius: 12, border: '1px solid #fdd8e7', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#E91E97', fontWeight: 'bold', marginBottom: 8 }}>Total Ventas (IVA inc.)</div>
                    <div style={{ fontSize: 24, fontWeight: '900', color: '#E91E97' }}>
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                        sales.filter(s => s.estado === 'COMPLETADA' && (!dateFrom || new Date(s.fechaVenta) >= new Date(dateFrom)) && (!dateTo || new Date(s.fechaVenta) <= new Date(dateTo + 'T23:59:59')))
                        .reduce((acc, s) => acc + s.importeTotal, 0)
                      )}
                    </div>
                  </div>
                  
                  <div style={{ background: '#e8f5e9', padding: '16px', borderRadius: 12, border: '1px solid #c8e6c9', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#2e7d32', fontWeight: 'bold', marginBottom: 8 }}>Ganancias (Sin IVA)</div>
                    <div style={{ fontSize: 24, fontWeight: '900', color: '#2e7d32' }}>
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                        sales.filter(s => s.estado === 'COMPLETADA' && (!dateFrom || new Date(s.fechaVenta) >= new Date(dateFrom)) && (!dateTo || new Date(s.fechaVenta) <= new Date(dateTo + 'T23:59:59')))
                        .reduce((acc, s) => {
                          try {
                            const list = JSON.parse(s.listaProductos);
                            const cost = list.reduce((cAcc: number, item: any) => cAcc + ((item.coste !== undefined ? item.coste : (products.find(p => p.id === item.id)?.coste || 0)) * item.cantidad), 0);
                            return acc + ((s.importeTotal / 1.21) - cost);
                          } catch(e) { return acc; }
                        }, 0)
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mf-table-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14, minWidth: 800 }}>
                <thead>
                  <tr style={{ background: lightPink, color: fuchsia }}>
                    <th style={{ padding: 12, borderRadius: '8px 0 0 8px' }}>Fecha</th>
                    <th style={{ padding: 12 }}>Cliente</th>
                    <th style={{ padding: 12 }}>Productos</th>
                    <th style={{ padding: 12 }}>Importe</th>
                    <th style={{ padding: 12 }}>Estado</th>
                    <th style={{ padding: 12, borderRadius: '0 8px 8px 0' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.filter(s => 
                    ((!dateFrom || new Date(s.fechaVenta) >= new Date(dateFrom)) && (!dateTo || new Date(s.fechaVenta) <= new Date(dateTo + 'T23:59:59'))) && 
                    ((s.nombreCliente || '').toLowerCase().includes(searchSales.toLowerCase()) ||
                    (s.nifCliente || '').toLowerCase().includes(searchSales.toLowerCase()) ||
                    (s.vendedor || '').toLowerCase().includes(searchSales.toLowerCase()) ||
                    (s.estado || '').toLowerCase().includes(searchSales.toLowerCase()) ||
                    (s.numeroFactura ? s.numeroFactura.toString() : '').includes(searchSales))
                  ).map(s => {
                    const isDev = s.estado === 'DEVUELTA'
                    const items = JSON.parse(s.listaProductos || '[]')
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #eee', background: isDev ? '#fff5f5' : 'transparent' }}>
                        <td style={{ padding: 12, color: '#888' }}>{new Date(s.fechaVenta).toLocaleString()}</td>
                        <td style={{ padding: 12 }}>
                          <div style={{ fontWeight: 'bold' }}>{s.nombreCliente}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>Vendido por: {s.vendedor || 'N/A'}</div>
                        </td>
                                                <td style={{ padding: 12, color: '#555' }}>
                          {items.map((i: any, idx: number) => (
                            <div key={idx}>
                              {i.cantidad}x {i.nombre} 
                              {i.cantidadDevuelta > 0 && <span style={{color:'#e53e3e', fontSize:11, marginLeft:4}}>(-{i.cantidadDevuelta} devueltos)</span>}
                            </div>
                          ))}
                        </td>
                        <td style={{ padding: 12, fontWeight: 'bold', color: isDev ? '#e53e3e' : '#333' }}>
                          {isDev ? '-' : ''}{formatMoney(s.importeTotal)}
                        </td>
                        <td style={{ padding: 12 }}>
                                                    {s.estado === 'DEVUELTA' && <span style={{ background: '#fed7d7', color: '#c53030', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>DEVUELTA</span>}
                          {s.estado === 'DEVOLUCION_PARCIAL' && <span style={{ background: '#feebc8', color: '#dd6b20', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>PARCIAL</span>}
                          {s.estado === 'COMPLETADA' && <span style={{ background: '#c6f6d5', color: '#276749', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>COMPLETADA</span>}
                          {s.motivoDevolucion && <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 4 }}>Motivo: {s.motivoDevolucion}</div>}
                        </td>
                        <td style={{ padding: 12 }}>
                          {s.estado !== 'DEVUELTA' && (
                            <button onClick={() => handleReturnClick(s)} style={{ background: 'transparent', border: '1px solid #e53e3e', color: '#e53e3e', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', marginRight: 8 }}>
                              Devolver
                            </button>
                          )}
                          <button onClick={() => handleDeleteSale(s.id)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', padding: 4 }}>
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {sales.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#888' }}>No hay ventas registradas</td></tr>}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* TAB SAT */}
          {activeTab === 'sat' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ color: '#333', margin: 0, fontSize: 20 }}>SAT / Reparaciones</h2>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={handleCreateBlankSat} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold' }}>
                    <Plus size={16} /> Añadir Fila
                  </button>
                  <button onClick={() => setIsImporting(!isImporting)} style={{ padding: '8px 16px', background: '#22c55e', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold' }}>
                    <UploadCloud size={16} /> Importar Excel
                  </button>
                </div>
              </div>

              {isImporting && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: 14, color: '#166534', fontWeight: 'bold' }}>Pega aquí directamente las filas copiadas de tu Excel</p>
                  <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#15803d' }}>El orden de las columnas debe ser: Número, Nombre y Apellidos, Dirección, DNI / NIF, Teléfono, Marca, Modelo, IMEI, Fecha recepción, Observaciones, Motivo, Fecha entrega, Garantía, Informe, Repara, Coste PVD, PVP</p>
                  <textarea 
                    value={pasteData}
                    onChange={(e) => setPasteData(e.target.value)}
                    style={{ width: '100%', height: 120, padding: 8, borderRadius: 6, border: '1px solid #bbf7d0', marginBottom: 12, fontSize: 12 }}
                    placeholder="Pega las filas aquí..."
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setIsImporting(false)} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={handleBulkImport} style={{ padding: '6px 12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>Guardar Todo</button>
                  </div>
                </div>
              )}

              <div className="mf-table-wrapper">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'white', minWidth: 1200 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #eee' }}>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888' }}>Nº</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888', whiteSpace: 'nowrap' }}>Cliente</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888' }}>Dirección</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888', whiteSpace: 'nowrap' }}>DNI / NIF</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888' }}>Teléfono</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888' }}>Marca</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888' }}>Modelo</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888' }}>IMEI</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888', whiteSpace: 'nowrap' }}>Fecha Rec.</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888' }}>Observaciones</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888' }}>Motivo</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888', whiteSpace: 'nowrap' }}>Fecha Entrega</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888' }}>Garantía</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888' }}>Informe</th>
                      <th style={{ padding: 12, textAlign: 'left', color: '#888' }}>Repara</th>
                      <th style={{ padding: 12, textAlign: 'right', color: '#888', whiteSpace: 'nowrap' }}>Coste PVD</th>
                      <th style={{ padding: 12, textAlign: 'right', color: '#888' }}>PVP</th>
                      <th style={{ padding: 12, textAlign: 'center', color: '#888' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reparaciones
                      .filter(r => !searchReparaciones || r.nombreApellidos.toLowerCase().includes(searchReparaciones.toLowerCase()) || (r.imei && r.imei.includes(searchReparaciones)) || (r.modelo && r.modelo.toLowerCase().includes(searchReparaciones.toLowerCase())))
                      .map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #eee', background: editingSatId === r.id ? '#fdf2f8' : 'transparent' }}>
                        {editingSatId === r.id ? (
                          <>
                            <td style={{ padding: '6px 4px' }}><input type="number" value={editSatData?.numero || ''} onChange={e => setEditSatData({...editSatData, numero: Number(e.target.value)})} style={{ width: '40px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input value={editSatData?.nombreApellidos || ''} onChange={e => setEditSatData({...editSatData, nombreApellidos: e.target.value})} style={{ width: '120px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input value={editSatData?.direccion || ''} onChange={e => setEditSatData({...editSatData, direccion: e.target.value})} style={{ width: '100px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input value={editSatData?.dniNif || ''} onChange={e => setEditSatData({...editSatData, dniNif: e.target.value})} style={{ width: '80px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input value={editSatData?.telefono || ''} onChange={e => setEditSatData({...editSatData, telefono: e.target.value})} style={{ width: '80px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input value={editSatData?.marca || ''} onChange={e => setEditSatData({...editSatData, marca: e.target.value})} style={{ width: '70px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input value={editSatData?.modelo || ''} onChange={e => setEditSatData({...editSatData, modelo: e.target.value})} style={{ width: '70px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input value={editSatData?.imei || ''} onChange={e => setEditSatData({...editSatData, imei: e.target.value})} style={{ width: '90px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input type="date" value={editSatData?.fechaRecepcion || ''} onChange={e => setEditSatData({...editSatData, fechaRecepcion: e.target.value})} style={{ width: '100px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none', fontSize: 11 }} /></td>
                            <td style={{ padding: '6px 4px' }}><input value={editSatData?.observaciones || ''} onChange={e => setEditSatData({...editSatData, observaciones: e.target.value})} style={{ width: '100px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input value={editSatData?.motivo || ''} onChange={e => setEditSatData({...editSatData, motivo: e.target.value})} style={{ width: '100px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input type="date" value={editSatData?.fechaEntrega || ''} onChange={e => setEditSatData({...editSatData, fechaEntrega: e.target.value})} style={{ width: '100px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none', fontSize: 11 }} /></td>
                            <td style={{ padding: '6px 4px' }}><input value={editSatData?.garantia || ''} onChange={e => setEditSatData({...editSatData, garantia: e.target.value})} style={{ width: '60px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input value={editSatData?.informe || ''} onChange={e => setEditSatData({...editSatData, informe: e.target.value})} style={{ width: '100px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input value={editSatData?.repara || ''} onChange={e => setEditSatData({...editSatData, repara: e.target.value})} style={{ width: '60px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input type="number" step="0.01" value={editSatData?.costePvd ?? ''} onChange={e => setEditSatData({...editSatData, costePvd: e.target.value ? Number(e.target.value) : null})} style={{ width: '50px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px' }}><input type="number" step="0.01" value={editSatData?.pvp ?? ''} onChange={e => setEditSatData({...editSatData, pvp: e.target.value ? Number(e.target.value) : null})} style={{ width: '50px', padding: '4px', border: '1px solid #E91E97', borderRadius: 4, outline: 'none' }} /></td>
                            <td style={{ padding: '6px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <button onClick={handleSaveEditSat} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: 6, borderRadius: 6, cursor: 'pointer', marginRight: 4 }} title="Guardar"><Save size={14} /></button>
                              <button onClick={() => { setEditingSatId(null); setEditSatData(null); }} style={{ background: '#f43f5e', color: 'white', border: 'none', padding: 6, borderRadius: 6, cursor: 'pointer' }} title="Cancelar"><X size={14} /></button>
                            </td>
                          </>
                        ) : (
                          <>
                        <td onClick={() => handlePrintSat(r)} style={{ padding: 12, fontWeight: 'bold', cursor: 'pointer', color: '#0284c7' }} title="Imprimir SAT">{r.numero}</td>
                        <td onClick={() => handlePrintSat(r)} style={{ padding: 12, fontWeight: 'bold', color: '#E91E97', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline' }} title="Imprimir SAT">{r.nombreApellidos}</td>
                        <td style={{ padding: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.direccion}>{r.direccion}</td>
                        <td style={{ padding: 12, whiteSpace: 'nowrap' }}>{r.dniNif}</td>
                        <td style={{ padding: 12, whiteSpace: 'nowrap' }}>{r.telefono}</td>
                        <td style={{ padding: 12 }}>{r.marca}</td>
                        <td style={{ padding: 12 }}>{r.modelo}</td>
                        <td style={{ padding: 12, whiteSpace: 'nowrap' }}>{r.imei}</td>
                        <td style={{ padding: 12, whiteSpace: 'nowrap' }}>{r.fechaRecepcion}</td>
                        <td style={{ padding: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.observaciones}>{r.observaciones}</td>
                        <td style={{ padding: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.motivo}>{r.motivo}</td>
                        <td style={{ padding: 12, whiteSpace: 'nowrap' }}>{r.fechaEntrega}</td>
                        <td style={{ padding: 12 }}>{r.garantia}</td>
                        <td style={{ padding: 12, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.informe}>{r.informe}</td>
                        <td style={{ padding: 12 }}>{r.repara}</td>
                        <td style={{ padding: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>{r.costePvd !== null ? `${r.costePvd}€` : '-'}</td>
                        <td style={{ padding: 12, textAlign: 'right', fontWeight: 'bold' }}>{r.pvp !== null ? `${r.pvp}€` : '-'}</td>
                        <td style={{ padding: 12, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button onClick={() => { setEditingSatId(r.id || null); setEditSatData({...r}); }} style={{ background: 'white', color: '#0ea5e9', border: '1px solid #e0f2fe', padding: 6, borderRadius: 6, cursor: 'pointer', marginRight: 4 }} title="Editar"><Edit2 size={16} /></button>
                          <button onClick={() => handlePrintSat(r)} style={{ background: 'white', border: '1px solid #f1f5f9', cursor: 'pointer', color: '#0284c7', marginRight: 4, padding: 6, borderRadius: 6 }} title="Imprimir Ticket">
                            <Printer size={16} />
                          </button>
                          <button onClick={() => handleDeleteReparacion(r.id!)} style={{ background: 'white', border: '1px solid #ffe4e6', cursor: 'pointer', color: '#ef4444', padding: 6, borderRadius: 6 }} title="Borrar">
                            <Trash2 size={16} />
                          </button>
                        </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {reparaciones.length === 0 && (
                      <tr><td colSpan={18} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No hay reparaciones registradas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* RETURN MODAL */}
        {returnModalSale && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: 'white', padding: 32, borderRadius: 16, width: '100%', maxWidth: 500 }}>
              <h2 style={{ margin: '0 0 16px 0', color: '#e91e63' }}>Gestionar Devolución</h2>
              <p style={{ color: '#555', marginBottom: 24 }}>Venta a: <strong>{returnModalSale.nombreCliente}</strong></p>
              
              <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 12, marginBottom: 24 }}>
                {JSON.parse(returnModalSale.listaProductos).map((p: any) => {
                  const devueltos = p.cantidadDevuelta || 0
                  const maxDevolver = p.cantidad - devueltos
                  if (maxDevolver <= 0) return <div key={p.id} style={{ color: '#aaa', marginBottom: 8, fontSize: 13 }}>{p.nombre} (Ya devuelto)</div>
                  
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{p.nombre}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>Vendidos: {p.cantidad} (Disp. para devolver: {maxDevolver})</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => setReturnQty({...returnQty, [p.id]: Math.max(0, (returnQty[p.id] || 0) - 1)})} style={{ width: 28, height: 28, borderRadius: 14, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>-</button>
                        <span style={{ fontWeight: 'bold', width: 20, textAlign: 'center' }}>{returnQty[p.id] || 0}</span>
                        <button onClick={() => setReturnQty({...returnQty, [p.id]: Math.min(maxDevolver, (returnQty[p.id] || 0) + 1)})} style={{ width: 28, height: 28, borderRadius: 14, border: 'none', background: '#e91e63', color: 'white', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <input placeholder="Motivo (opcional)" value={returnReason} onChange={e => setReturnReason(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd', marginBottom: 24 }} />

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={() => setReturnModalSale(null)} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#eee', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button onClick={submitFullReturn} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#e53e3e', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Devolver Todo</button>
                <button onClick={submitPartialReturn} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#e91e63', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Devolver Selección</button>
              </div>
            </div>
          </div>
        )}

        {/* SAT PRINT MODAL */}
        {printModalSat && (
          <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, overflowY: 'auto', padding: 20 }}>
            <div style={{ background: '#f8fafc', padding: 24, borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0, color: '#333', fontSize: 20 }}>Ajustar Presupuesto a Imprimir</h2>
                <button onClick={() => setPrintModalSat(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="#666"/></button>
              </div>

              <div style={{ background: 'white', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Motivo / Fallo</label>
                    <input value={printModalSat.motivo || ''} onChange={(e) => setPrintModalSat({...printModalSat, motivo: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Fecha Prevista de Entrega</label>
                    <input value={satDeliveryDate} onChange={(e) => setSatDeliveryDate(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12, borderBottom: '2px solid #f1f5f9', paddingBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 14, color: '#334155' }}>Líneas del Presupuesto</h3>
                  <button onClick={() => setSatBudgetLines([...satBudgetLines, { id: Math.random().toString(), desc: '', qty: 1, price: 0 }])} style={{ padding: '4px 12px', background: '#e0f2fe', color: '#0284c7', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}>+ Añadir Fila</button>
                </div>

                {satBudgetLines.map((line, idx) => (
                  <div key={line.id} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ flex: 3 }}>
                      <input placeholder="Descripción..." value={line.desc} onChange={(e) => { const n = [...satBudgetLines]; n[idx].desc = e.target.value; setSatBudgetLines(n) }} style={{ width: '100%', padding: 6, border: '1px solid #cbd5e1', borderRadius: 4 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input type="number" placeholder="Cant." value={line.qty} onChange={(e) => { const n = [...satBudgetLines]; n[idx].qty = Number(e.target.value); setSatBudgetLines(n) }} style={{ width: '100%', padding: 6, border: '1px solid #cbd5e1', borderRadius: 4, textAlign: 'center' }} />
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input type="number" placeholder="Precio" value={line.price} onChange={(e) => { const n = [...satBudgetLines]; n[idx].price = Number(e.target.value); setSatBudgetLines(n) }} style={{ width: '100%', padding: 6, border: '1px solid #cbd5e1', borderRadius: 4, textAlign: 'right', paddingRight: 24 }} />
                      <span style={{ position: 'absolute', right: 8, top: 7, color: '#94a3b8', fontSize: 13 }}>€</span>
                    </div>
                    <button onClick={() => { const n = [...satBudgetLines]; n.splice(idx, 1); setSatBudgetLines(n) }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}><Trash2 size={16} /></button>
                  </div>
                ))}

                <div style={{ textAlign: 'right', marginTop: 16, fontSize: 18, fontWeight: 'bold', color: '#E91E97' }}>
                  Total (IVA incl.): {satBudgetLines.reduce((acc, l) => acc + (l.price * l.qty), 0).toFixed(2)}€
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={() => setPrintModalSat(null)} style={{ padding: '12px 24px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'white', color: '#64748b', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button onClick={() => window.print()} style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: '#E91E97', color: 'white', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Printer size={18} /> Imprimir Hoja SAT
                </button>
              </div>
            </div>
          </div>
        )}
        </div>

      {/* ELEMENTOS SOLO PARA IMPRIMIR */}
      <style dangerouslySetInnerHTML={{__html: `
        .print-sat-container { display: none; max-width: 800px; margin: 0 auto; color: #2d3748; font-family: 'Inter', 'Segoe UI', sans-serif; background: #fff; }
        
        @media print {
          .no-print { display: none !important; }
          .print-wrapper { background: white !important; padding: 0 !important; }
          .print-sat-container { display: flex !important; flex-direction: column; position: absolute; left: 0; top: 0; width: 100%; min-height: 297mm; box-sizing: border-box; padding: 40px 50px !important; }
          @page { margin: 0; size: A4 portrait; }
        }
        
        /* Modern Header Grid */
        .print-sat-container .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; }
        .print-sat-container .company-info { color: #718096; font-size: 13px; line-height: 1.6; }
        .print-sat-container .company-info strong { color: #2d3748; font-weight: 600; }
        .print-sat-container .invoice-title-block { text-align: right; }
        .print-sat-container .invoice-title-block h1 { margin: 0 0 8px 0; color: #E91E97; font-size: 28px; font-weight: 800; letter-spacing: -1px; text-transform: uppercase; }
        .print-sat-container .invoice-meta { display: grid; grid-template-columns: auto auto; gap: 6px 20px; text-align: right; font-size: 13.5px; color: #4a5568; }
        .print-sat-container .invoice-meta strong { color: #2d3748; }

        /* Client Block */
        .print-sat-container .client-block { background: #f8fafc; border-radius: 12px; padding: 20px 24px; margin-bottom: 30px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; gap: 20px; }
        .print-sat-container .client-block h3 { margin: 0 0 10px 0; font-size: 12.5px; text-transform: uppercase; letter-spacing: 1px; color: #E91E97; font-weight: 800; }
        .print-sat-container .client-details { font-size: 13.5px; line-height: 1.7; color: #2d3748; }
        .print-sat-container .client-details strong { font-weight: 600; color: #718096; display: inline-block; width: 110px; }

        /* Modern Table */
        .print-sat-container .modern-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 30px; }
        .print-sat-container .modern-table th { background: #fff5f9; color: #E91E97; font-weight: 600; text-transform: uppercase; font-size: 11.5px; padding: 12px 14px; text-align: left; letter-spacing: 0.5px; border-bottom: 2px solid #fdd8e7; }
        .print-sat-container .modern-table th.text-right { text-align: right; }
        .print-sat-container .modern-table td { padding: 14px 14px; border-bottom: 1px solid #edf2f7; font-size: 13.5px; color: #4a5568; }
        .print-sat-container .modern-table td.text-right { text-align: right; }
        .print-sat-container .modern-table tr:last-child td { border-bottom: none; }
        .print-sat-container .modern-table tbody tr:nth-child(even) { background: #fafafa; }

        /* Spacer to push footer down */
        .print-sat-container .content-spacer { flex: 1; }

        /* Totals Block */
        .print-sat-container .totals-wrapper { display: flex; justify-content: flex-end; margin-bottom: 30px; }
        .print-sat-container .totals-block { width: 320px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .print-sat-container .totals-row { display: flex; justify-content: space-between; padding: 10px 18px; font-size: 13.5px; color: #4a5568; border-bottom: 1px solid #edf2f7; }
        .print-sat-container .totals-row.grand-total { background: #E91E97; color: white; border-bottom: none; font-size: 17px; font-weight: 800; padding: 14px 18px; }

        /* Signatures */
        .print-sat-container .signatures { display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 40px; }
        .print-sat-container .sig-box { width: 30%; text-align: center; border-top: 2px solid #cbd5e1; padding-top: 8px; font-size: 11.5px; font-weight: 600; color: #4a5568; }

        /* Legal Footer */
        .print-sat-container .legal-footer { border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 9.5px; color: #a0aec0; text-align: justify; line-height: 1.45; margin-bottom: 20px; }
        .print-sat-container .legal-footer strong { color: #718096; display: block; text-align: center; margin-top: 14px; font-size: 10.5px; }
      `}} />

      {/* DOCUMENTO SAT (MODO IMPRESIÓN) */}
      {printModalSat && (
        <div className="print-sat-container">
          
          {/* HEADER SECTION */}
          <div className="invoice-header">
            <div>
              <img src="/images/media__1778608332264.png" alt="Movilfree" style={{ height: '70px', marginBottom: '16px' }} />
              <div className="company-info">
                <strong>Micro-Infor Salamanca, S.L.</strong><br/>
                C.I.F.: B37290293<br/>
                C/ Alarcón, 2 Bajo<br/>
                37007 - Salamanca<br/>
                TLF: 923 214 407
              </div>
            </div>
            <div className="invoice-title-block">
              <h1>SAT / REPARACIÓN</h1>
              <div className="invoice-meta">
                <span>Número:</span>
                <strong>#{printModalSat.numero}</strong>
                <span>Fecha:</span>
                <strong>{new Date().toLocaleDateString('es-ES')}</strong>
                <span>Validez:</span>
                <strong>30 días desde recepción</strong>
              </div>
            </div>
          </div>

          {/* CLIENT & DIAGNOSTIC SECTION */}
          <div className="client-block">
            <div style={{ flex: 1 }}>
              <h3>Información del Cliente</h3>
              <div className="client-details">
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#E91E97', marginBottom: '8px' }}>{printModalSat.nombreApellidos}</div>
                <div><strong>Teléfono:</strong> {printModalSat.telefono || '---'}</div>
                <div><strong>DNI/NIF:</strong> {printModalSat.dniNif || '---'}</div>
                <div><strong>Domicilio:</strong> {printModalSat.direccion || '---'}</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <h3>Diagnóstico del Dispositivo</h3>
              <div className="client-details">
                <div><strong>Marca/Modelo:</strong> {printModalSat.marca} {printModalSat.modelo}</div>
                <div><strong>IMEI:</strong> {printModalSat.imei || '---'}</div>
                <div><strong>Fallo/Motivo:</strong> {printModalSat.motivo || '---'}</div>
                <div><strong>Fecha Entrega:</strong> {satDeliveryDate}</div>
              </div>
              <div className="client-details" style={{ marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                <strong style={{ width: 'auto', display: 'block', marginBottom: '4px' }}>Informe / Observaciones:</strong>
                {printModalSat.informe || printModalSat.observaciones || 'Sin observaciones previas.'}
              </div>
            </div>
          </div>

          {/* BUDGET TABLE */}
          <table className="modern-table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th className="text-right" style={{ width: '120px' }}>Precio ud.</th>
                <th className="text-right" style={{ width: '80px' }}>Cant.</th>
                <th className="text-right" style={{ width: '120px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {satBudgetLines.map((line, idx) => (
                <tr key={idx}>
                  <td>{line.desc}</td>
                  <td className="text-right">{line.price.toFixed(2)} €</td>
                  <td className="text-right">{line.qty}</td>
                  <td className="text-right" style={{ fontWeight: 'bold' }}>{(line.price * line.qty).toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="content-spacer"></div>

          {/* TOTALS SECTION */}
          <div className="totals-wrapper">
            <div className="totals-block">
              <div className="totals-row grand-total">
                <span>TOTAL (IVA INCL.)</span>
                <span>{satBudgetLines.reduce((acc, l) => acc + (l.price * l.qty), 0).toFixed(2)} €</span>
              </div>
              <div style={{ padding: '12px 20px', fontSize: '11px', color: '#718096', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                El cliente acepta el presupuesto final en las condiciones descritas.
              </div>
            </div>
          </div>

          {/* SIGNATURES */}
          <div className="signatures">
            <div className="sig-box">El Cliente</div>
            <div className="sig-box">¿En garantía?</div>
            <div className="sig-box">Responsable del SAT</div>
          </div>

          {/* FOOTER SECTION */}
          <div className="legal-footer">
            La garantía en caso de cambio de placa principal o terminal nuevo, continua la misma según fecha de compra. No nos hacemos responsables de la pérdida de datos, el cliente debe hacer una copia de sus datos. No nos hacemos responsables de los fallos ocultos o que dejen de funcionar componentes que funcionan total o parcialmente, partes que ya están dañadas o rotas, pudiendo aumentar el daño o rotura al montar o desmontar.
            <br/><br/>
            1.- Los datos de carácter personal serán tratados por MICRO INFOR SALAMANCA S.L. con la finalidad de gestionar la relación contractual derivada de la reparación. El plazo de conservación será de 8 años.<br/>
            2.- Para el ejercicio de los derechos de acceso, rectificación, supresión y portabilidad el interesado podrá dirigir escrito a MICRO INFOR SALAMANCA S.L. C/ Alarcón 2, 37007 Salamanca.<br/>
            3.- La garantía recae sobre el producto que consta en esta hoja. Será de 3 meses sobre pieza reparada.
            <strong>** CONSERVE ESTE RESGUARDO PARA RECOGER SU DISPOSITIVO **</strong>
          </div>
        </div>
      )}


        {/* PRINT MODAL */}
        {printModalSale && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: 'white', padding: 32, borderRadius: 16, width: '100%', maxWidth: 400, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: '#c6f6d5', color: '#276749', borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <span style={{ fontSize: 32 }}>✓</span>
              </div>
              <h2 style={{ margin: '0 0 8px 0', color: '#333' }}>¡Venta Completada!</h2>
              <p style={{ color: '#555', marginBottom: 24 }}>Factura #{printModalSale.numeroFactura || '---'}</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button onClick={() => window.open(`/movilfree/print/${printModalSale.id}?type=ticket`, '_blank')} style={{ padding: '14px', borderRadius: 8, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  📄 Imprimir Ticket (Simplificada)
                </button>
                <button onClick={() => window.open(`/movilfree/print/${printModalSale.id}?type=factura`, '_blank')} style={{ padding: '14px', borderRadius: 8, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  📝 Imprimir Factura (A4)
                </button>
                <button onClick={() => setPrintModalSale(null)} style={{ padding: '14px', borderRadius: 8, border: 'none', background: '#eee', cursor: 'pointer', fontWeight: 'bold', marginTop: 8, fontSize: 15 }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
