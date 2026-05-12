'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ShoppingCart, X, Users, ArrowLeftRight, RefreshCcw, Package, Edit, Save, Search, Edit2 } from 'lucide-react'

// --- Types ---
type Product = { id: string; nombre: string; categoria: string; precio: number; coste: number; stock: number; createdAt: string; imei?: string }
type Client = { id: string; nif: string; nombre: string; direccion?: string; poblacion?: string; provincia?: string; cp?: string; movil?: string; fijo?: string; email: string; totalComprado: number }
type Sale = { id: string; numeroFactura?: number; vendedor: string; nifCliente: string; nombreCliente: string; listaProductos: string; importeTotal: number; estado: string; fechaVenta: string; motivoDevolucion: string }

export default function MovilFreeApp() {
  const [activeTab, setActiveTab] = useState<'ventas'|'productos'|'clientes'|'devoluciones'>('ventas')
  
  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [sales, setSales] = useState<Sale[]>([])

  // Load data
  useEffect(() => {
    fetch('/api/movilfree/products').then(r => r.json()).then(d => { if(Array.isArray(d)) setProducts(d); else console.error('API Error:', d) })
    fetch('/api/movilfree/clients').then(r => r.json()).then(d => { if(Array.isArray(d)) setClients(d); else console.error('API Error:', d) })
    fetch('/api/movilfree/sales').then(r => r.json()).then(d => { if(Array.isArray(d)) setSales(d); else console.error('API Error:', d) })
  }, [activeTab])

  // Helpers
  const formatMoney = (val: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val)

  // --- Subcomponents ---
  
  // 1. INVENTARIO
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
      return {
        nombre: cols[0] ? cols[0].trim() : 'Desconocido',
        categoria: cols[1] ? cols[1].trim() : 'Terminal',
        coste: parseFloat((cols[2] || '0').replace(',', '.')) || 0,
        precio: parseFloat((cols[3] || '0').replace(',', '.')) || 0,
        stock: parseInt((cols[5] || '1'), 10) || 1,
        imei: cols[6] ? cols[6].trim() : ''
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
    setClients([created, ...clients])
    setNewClient({ nif: '', nombre: '', direccion: '', poblacion: '', provincia: '', cp: '', movil: '', fijo: '', email: '' })
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

  // UI Theme
  const fuchsia = '#E91E97'
  const lightPink = '#FFF0F9'

  return (
    <div style={{ minHeight: '100vh', background: lightPink, padding: 32, fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
                {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, background: 'white', padding: 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(233,30,151,0.08)' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 16 }}>
          <button onClick={() => setActiveTab('ventas')} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: activeTab === 'ventas' ? '#E91E97' : 'white', color: activeTab === 'ventas' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'ventas' ? '0 4px 12px rgba(233,30,151,0.2)' : 'none' }}>
            <ShoppingCart size={18} /> Punto de Venta
          </button>
          <button onClick={() => setActiveTab('productos')} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: activeTab === 'productos' ? '#E91E97' : 'white', color: activeTab === 'productos' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'productos' ? '0 4px 12px rgba(233,30,151,0.2)' : 'none' }}>
            <Package size={18} /> Inventario
          </button>
          <button onClick={() => setActiveTab('clientes')} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: activeTab === 'clientes' ? '#E91E97' : 'white', color: activeTab === 'clientes' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'clientes' ? '0 4px 12px rgba(233,30,151,0.2)' : 'none' }}>
            <Users size={18} /> Clientes
          </button>
          <button onClick={() => setActiveTab('devoluciones')} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: activeTab === 'devoluciones' ? '#E91E97' : 'white', color: activeTab === 'devoluciones' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'devoluciones' ? '0 4px 12px rgba(233,30,151,0.2)' : 'none' }}>
            <RefreshCcw size={18} /> Histórico & Devoluciones
          </button>
          </div>

          <div style={{ position: 'relative', width: '450px' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: 13, color: '#0284c7' }} />
            {activeTab === 'ventas' && (
              <input placeholder="Buscar producto en Punto de Venta..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 14 }} />
            )}
            {activeTab === 'productos' && (
              <input placeholder="Buscar producto en Inventario..." value={searchInvProducts} onChange={e=>setSearchInvProducts(e.target.value)} style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 14 }} />
            )}
            {activeTab === 'clientes' && (
              <input placeholder="Buscar cliente por NIF o Nombre..." value={searchClients} onChange={e=>setSearchClients(e.target.value)} style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 14 }} />
            )}
            {activeTab === 'devoluciones' && (
              <input placeholder="Buscar venta (NIF, Factura, Vendedor, Estado)..." value={searchSales} onChange={e=>setSearchSales(e.target.value)} style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 14 }} />
            )}
          </div>
        </div>

        {/* CONTENIDO TABS */}
        <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}>
          
          {/* TAB: VENTAS */}
          {activeTab === 'ventas' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
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
                      <option value="Reparación">Reparación</option>
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
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: 14 }}>{c.product.nombre}</div>
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
                          
                          <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>x {formatMoney(c.product.precio * 1.21)}</span>
                        </div>
                      </div>
                      <div style={{ fontWeight: 'bold', color: fuchsia }}>{formatMoney(c.product.precio * 1.21 * c.cantidad)}</div>
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
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 1.2fr auto', gap: 12, marginBottom: 24, background: '#f8f9fa', padding: 16, borderRadius: 12, alignItems: 'end' }}>
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
                    <option>Reparación</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Coste (Sin IVA)</label>
                  <input type="number" placeholder="Coste" value={newProd.coste || ''} onChange={e=>setNewProd({...newProd, coste: Number(e.target.value)})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Precio (Sin IVA)</label>
                  <input type="number" placeholder="Precio" value={newProd.precio || ''} onChange={e=>setNewProd({...newProd, precio: Number(e.target.value)})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: fuchsia}}>P.V.P (Con IVA)</label>
                  <input type="number" placeholder="Con IVA" value={newProd.precio ? Number((newProd.precio * 1.21).toFixed(2)) : ''} onChange={e=>setNewProd({...newProd, precio: Number((Number(e.target.value) / 1.21).toFixed(2))})} style={{ width: '100%', padding: 10, borderRadius: 6, border: `2px solid ${fuchsia}`, marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Stock</label>
                  <input type="number" placeholder="Uds." value={newProd.stock || ''} onChange={e=>setNewProd({...newProd, stock: Number(e.target.value)})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleCreateProduct} style={{ background: fuchsia, color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Añadir</button>
                  <button onClick={() => setShowPasteModal(true)} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Excel 📋</button>
                </div>
              </div>

              {showPasteModal && (
                <div style={{ background: '#e8f5e9', padding: 16, borderRadius: 12, marginBottom: 24, border: '1px solid #4CAF50' }}>
                  <h3 style={{ marginTop: 0, color: '#2e7d32' }}>Importar desde Excel</h3>
                  <p style={{ fontSize: 13, color: '#333' }}>Copia las filas desde tu Excel respetando el orden de estas 6 columnas: <strong>Nombre, Categoría, Coste, Precio, PVP, Stock</strong>. Pégalas aquí:</p>
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
                  Ganancia neta aproximada (Sin IVA): <strong style={{ color: '#276749', fontSize: 16 }}>{formatMoney(newProd.precio - newProd.coste)}</strong>
                </div>
              )}


              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                <thead>
                  
                  <tr style={{ background: lightPink, color: fuchsia }}>
                    <th style={{ padding: 10, borderRadius: '8px 0 0 8px', width: 'auto' }}>Producto</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Categoría</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Coste</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Precio (s/IVA)</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>P.V.P (c/IVA)</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Ganancia</th>
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
                          <td style={{ padding: 10 }}><input value={editProdData?.nombre || ''} onChange={e => setEditProdData({...editProdData, nombre: e.target.value})} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <select value={editProdData?.categoria || ''} onChange={e => setEditProdData({...editProdData, categoria: e.target.value})} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }}>
                              <option>Terminal</option><option>Accesorio</option><option>Servicio</option><option>Reparación</option>
                            </select>
                          </td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}><input type="number" value={editProdData?.coste || 0} onChange={e => setEditProdData({...editProdData, coste: Number(e.target.value)})} style={{ width: 70, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none', textAlign: 'center' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}><input type="number" value={editProdData?.precio || 0} onChange={e => setEditProdData({...editProdData, precio: Number(e.target.value)})} style={{ width: 70, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none', textAlign: 'center' }} /></td>
                          <td style={{ padding: 10, fontWeight: 'bold', color: fuchsia, whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney((editProdData?.precio || 0) * 1.21)}</td>
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
                          <td style={{ padding: 10, fontWeight: 'bold' }}>{p.nombre}</td>
                          <td style={{ padding: 10, color: '#666', whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <span style={{ background: '#eee', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>{p.categoria}</span>
                          </td>
                          <td style={{ padding: 10, color: '#888', whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney(p.coste)}</td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney(p.precio)}</td>
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
          )}

          {/* TAB: CLIENTES */}
          {activeTab === 'clientes' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24, background: '#f8f9fa', padding: 16, borderRadius: 12, alignItems: 'end' }}>
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
                <button onClick={handleCreateClient} style={{ background: '#E91E97', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40 }}>Registrar Cliente</button>
              </div>

                            <h3 style={{ margin: 0, color: '#333', marginBottom: 16 }}>Listado de Clientes</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#FFF0F9', color: '#E91E97' }}>
                    <th style={{ padding: 12, borderRadius: '8px 0 0 8px' }}>NIF</th>
                    <th style={{ padding: 12 }}>Nombre</th>
                    <th style={{ padding: 12 }}>Contacto</th>
                    <th style={{ padding: 12 }}>Ubicación</th>
                    <th style={{ padding: 12, borderRadius: '0 8px 8px 0' }}>Total Comprado</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.filter(c => c.nif.toLowerCase().includes(searchClients.toLowerCase())).map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
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
                    </tr>
                  ))}
                </tbody>
              </table>
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

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
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
