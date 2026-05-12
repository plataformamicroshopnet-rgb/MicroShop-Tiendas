'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit, ArrowLeftRight, Package, Users, ShoppingCart, RefreshCcw, Save, X, Search } from 'lucide-react'

// --- Types ---
type Product = { id: string; nombre: string; categoria: string; precio: number; coste: number; stock: number; createdAt: string }
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
  const [newProd, setNewProd] = useState({ nombre: '', categoria: 'Accesorio', precio: 0, coste: 0, stock: 0 })
  const handleCreateProduct = async () => {
    if(!newProd.nombre) return alert('El nombre es obligatorio')
    const res = await fetch('/api/movilfree/products', { method: 'POST', body: JSON.stringify(newProd) })
    const created = await res.json()
    setProducts([created, ...products])
    setNewProd({ nombre: '', categoria: 'Accesorio', precio: 0, coste: 0, stock: 0 })
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
  const [saleVendedor, setSaleVendedor] = useState('')
  
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
    const cl = clients.find(c => c.nif === selectedClient)
    
    const payload = {
      vendedor: saleVendedor || 'Marta',
      nifCliente: selectedClient || 'CONTADO',
      nombreCliente: cl ? cl.nombre : 'Cliente Contado',
      importeTotal: total,
      listaProductos: cart.map(c => ({ id: c.product.id, nombre: c.product.nombre, cantidad: c.cantidad, precio: c.product.precio * 1.21 }))
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

        {/* TABS */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
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
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Cliente (NIF opcional)</label>
                  <input type="text" value={selectedClient} onChange={e => setSelectedClient(e.target.value)} placeholder="Ej: 12345678Z" style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Vendedor</label>
                  <input type="text" value={saleVendedor} onChange={e => setSaleVendedor(e.target.value)} placeholder="Ej: Marta" style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', marginTop: 4 }} />
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
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr auto', gap: 12, marginBottom: 24, background: '#f8f9fa', padding: 16, borderRadius: 12, alignItems: 'end' }}>
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
                <button onClick={handleCreateProduct} style={{ background: fuchsia, color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40 }}>Añadir</button>
              </div>

              {newProd.precio > 0 && newProd.coste > 0 && (
                <div style={{ marginBottom: 24, fontSize: 14, color: '#555', background: '#e6fffa', padding: '8px 16px', borderRadius: 8, display: 'inline-block' }}>
                  Ganancia neta aproximada (Sin IVA): <strong style={{ color: '#276749', fontSize: 16 }}>{formatMoney(newProd.precio - newProd.coste)}</strong>
                </div>
              )}


              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  
                  <tr style={{ background: lightPink, color: fuchsia }}>
                    <th style={{ padding: 12, borderRadius: '8px 0 0 8px' }}>Producto</th>
                    <th style={{ padding: 12 }}>Categoría</th>
                    <th style={{ padding: 12 }}>Coste</th>
                    <th style={{ padding: 12 }}>Precio (s/IVA)</th>
                    <th style={{ padding: 12 }}>P.V.P (c/IVA)</th>
                    <th style={{ padding: 12 }}>Ganancia</th>
                    <th style={{ padding: 12, borderRadius: '0 8px 8px 0' }}>Stock (Uds)</th>
                  </tr>

                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                      
                      <td style={{ padding: 12, fontWeight: 'bold' }}>{p.nombre}</td>
                      <td style={{ padding: 12, color: '#666' }}>
                        <span style={{ background: '#eee', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>{p.categoria}</span>
                      </td>
                      <td style={{ padding: 12, color: '#888' }}>{formatMoney(p.coste)}</td>
                      <td style={{ padding: 12 }}>{formatMoney(p.precio)}</td>
                      <td style={{ padding: 12, fontWeight: 'bold', color: fuchsia }}>{formatMoney(p.precio * 1.21)}</td>
                      <td style={{ padding: 12, fontWeight: 'bold', color: '#276749' }}>{formatMoney(p.precio - p.coste)}</td>
                      <td style={{ padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button onClick={() => updateStock(p.id, p.stock - 1)} style={{ width: 28, height: 28, borderRadius: 14, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>-</button>
                          <span style={{ fontWeight: 'bold', width: 20, textAlign: 'center', color: p.stock === 0 ? 'red' : 'inherit' }}>{p.stock}</span>
                          <button onClick={() => updateStock(p.id, p.stock + 1)} style={{ width: 28, height: 28, borderRadius: 14, border: 'none', background: fuchsia, color: 'white', cursor: 'pointer' }}>+</button>
                        </div>
                      </td>
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
                  <input placeholder="12345678Z" value={newClient.nif} onChange={e=>setNewClient({...newClient, nif: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
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
                  {clients.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 12, fontWeight: 'bold', color: '#555' }}>{c.nif}</td>
                      <td style={{ padding: 12, fontWeight: 'bold' }}>{c.nombre}</td>
                      <td style={{ padding: 12, color: '#666' }}>
                        {c.movil && <div>📱 {c.movil}</div>}
                        {c.fijo && <div>📞 {c.fijo}</div>}
                        {c.email && <div>✉️ {c.email}</div>}
                      </td>
                      <td style={{ padding: 12, color: '#666' }}>
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
                  {sales.map(s => {
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
