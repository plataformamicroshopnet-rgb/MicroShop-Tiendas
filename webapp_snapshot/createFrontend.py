import os

page_content = """'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit, ArrowLeftRight, Package, Users, ShoppingCart, RefreshCcw, Save, X, Search } from 'lucide-react'

// --- Types ---
type Product = { id: string; nombre: string; categoria: string; precio: number; coste: number; stock: number; createdAt: string }
type Client = { id: string; nif: string; nombre: string; telefono: string; email: string; totalComprado: number }
type Sale = { id: string; vendedor: string; nifCliente: string; nombreCliente: string; listaProductos: string; importeTotal: number; estado: string; fechaVenta: string; motivoDevolucion: string }

export default function MovilFreeApp() {
  const [activeTab, setActiveTab] = useState<'ventas'|'productos'|'clientes'|'devoluciones'>('ventas')
  
  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [sales, setSales] = useState<Sale[]>([])

  // Load data
  useEffect(() => {
    fetch('/api/movilfree/products').then(r => r.json()).then(setProducts)
    fetch('/api/movilfree/clients').then(r => r.json()).then(setClients)
    fetch('/api/movilfree/sales').then(r => r.json()).then(setSales)
  }, [activeTab])

  // Helpers
  const formatMoney = (val: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val)

  // --- Subcomponents ---
  
  // 1. INVENTARIO
  const [newProd, setNewProd] = useState({ nombre: '', categoria: 'Accesorios', precio: 0, coste: 0, stock: 0 })
  const handleCreateProduct = async () => {
    if(!newProd.nombre) return alert('El nombre es obligatorio')
    const res = await fetch('/api/movilfree/products', { method: 'POST', body: JSON.stringify(newProd) })
    const created = await res.json()
    setProducts([created, ...products])
    setNewProd({ nombre: '', categoria: 'Accesorios', precio: 0, coste: 0, stock: 0 })
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
  const [newClient, setNewClient] = useState({ nif: '', nombre: '', telefono: '', email: '' })
  const handleCreateClient = async () => {
    if(!newClient.nif || !newClient.nombre) return alert('NIF y Nombre obligatorios')
    const res = await fetch('/api/movilfree/clients', { method: 'POST', body: JSON.stringify(newClient) })
    const created = await res.json()
    setClients([created, ...clients])
    setNewClient({ nif: '', nombre: '', telefono: '', email: '' })
  }

  // 3. VENTAS (NUEVA VENTA)
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
    const total = cart.reduce((acc, item) => acc + (item.product.precio * item.cantidad), 0)
    const cl = clients.find(c => c.nif === selectedClient)
    
    const payload = {
      vendedor: saleVendedor || 'Marta',
      nifCliente: selectedClient || 'CONTADO',
      nombreCliente: cl ? cl.nombre : 'Cliente Contado',
      importeTotal: total,
      listaProductos: cart.map(c => ({ id: c.product.id, nombre: c.product.nombre, cantidad: c.cantidad, precio: c.product.precio }))
    }

    const res = await fetch('/api/movilfree/sales', { method: 'POST', body: JSON.stringify(payload) })
    if (res.ok) {
      alert('Venta registrada con éxito')
      setCart([])
      fetch('/api/movilfree/sales').then(r => r.json()).then(setSales)
      fetch('/api/movilfree/products').then(r => r.json()).then(setProducts) // refresh stock
    }
  }

  // 4. DEVOLUCIONES
  const handleReturn = async (sale: Sale) => {
    const reason = prompt('Motivo de la devolución:')
    if(reason === null) return
    const res = await fetch(`/api/movilfree/sales/${sale.id}`, { method: 'PUT', body: JSON.stringify({ estado: 'DEVUELTA', motivoDevolucion: reason }) })
    if (res.ok) {
      alert('Venta devuelta correctamente. El stock se ha restaurado.')
      fetch('/api/movilfree/sales').then(r => r.json()).then(setSales)
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
          <div style={{ width: 48, height: 48, background: fuchsia, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <ShoppingCart size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, color: fuchsia, fontSize: 24, fontWeight: 800 }}>MovilFree Salamanca</h1>
            <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>Panel de Gestión y Punto de Venta</p>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {[
            { id: 'ventas', label: 'Punto de Venta', icon: ShoppingCart },
            { id: 'productos', label: 'Inventario', icon: Package },
            { id: 'clientes', label: 'Clientes', icon: Users },
            { id: 'devoluciones', label: 'Histórico & Devoluciones', icon: RefreshCcw },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 24px', borderRadius: 12, fontWeight: 'bold', fontSize: 15,
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: activeTab === t.id ? fuchsia : 'white',
                color: activeTab === t.id ? 'white' : '#555',
                boxShadow: activeTab === t.id ? '0 4px 12px rgba(233,30,151,0.3)' : '0 2px 8px rgba(0,0,0,0.05)'
              }}
            >
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{ background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          
          {/* TAB: VENTAS */}
          {activeTab === 'ventas' && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
              <div>
                <h3 style={{ color: fuchsia, margin: '0 0 16px 0' }}>Catálogo de Productos</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                  {products.filter(p => p.stock > 0).map(p => (
                    <div key={p.id} onClick={() => addToCart(p)} style={{ border: `2px solid ${lightPink}`, borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.2s' }}>
                      <div style={{ fontSize: 12, color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>{p.categoria}</div>
                      <div style={{ fontSize: 15, fontWeight: 'bold', color: '#333', margin: '4px 0 8px' }}>{p.nombre}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ color: fuchsia, fontWeight: 900, fontSize: 18 }}>{formatMoney(p.precio)}</div>
                        <div style={{ fontSize: 11, background: lightPink, color: fuchsia, padding: '2px 6px', borderRadius: 4 }}>Stock: {p.stock}</div>
                      </div>
                    </div>
                  ))}
                  {products.filter(p => p.stock > 0).length === 0 && <div style={{ color: '#888' }}>No hay productos con stock.</div>}
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
                        <div style={{ fontSize: 12, color: '#888' }}>{c.cantidad} uds. x {formatMoney(c.product.precio)}</div>
                      </div>
                      <div style={{ fontWeight: 'bold', color: fuchsia }}>{formatMoney(c.product.precio * c.cantidad)}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 'bold', color: '#555' }}>TOTAL</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#333' }}>
                    {formatMoney(cart.reduce((a, b) => a + (b.product.precio * b.cantidad), 0))}
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
              <div style={{ display: 'flex', gap: 16, marginBottom: 24, background: '#f8f9fa', padding: 16, borderRadius: 12 }}>
                <input placeholder="Nombre del producto" value={newProd.nombre} onChange={e=>setNewProd({...newProd, nombre: e.target.value})} style={{ flex: 2, padding: 10, borderRadius: 6, border: '1px solid #ddd' }} />
                <input placeholder="Categoría" value={newProd.categoria} onChange={e=>setNewProd({...newProd, categoria: e.target.value})} style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ddd' }} />
                <input type="number" placeholder="Precio" value={newProd.precio || ''} onChange={e=>setNewProd({...newProd, precio: Number(e.target.value)})} style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ddd' }} />
                <input type="number" placeholder="Stock" value={newProd.stock || ''} onChange={e=>setNewProd({...newProd, stock: Number(e.target.value)})} style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ddd' }} />
                <button onClick={handleCreateProduct} style={{ background: fuchsia, color: 'white', border: 'none', padding: '0 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Añadir</button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: lightPink, color: fuchsia }}>
                    <th style={{ padding: 12, borderRadius: '8px 0 0 8px' }}>Producto</th>
                    <th style={{ padding: 12 }}>Categoría</th>
                    <th style={{ padding: 12 }}>Precio</th>
                    <th style={{ padding: 12, borderRadius: '0 8px 8px 0' }}>Stock (Uds)</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 12, fontWeight: 'bold' }}>{p.nombre}</td>
                      <td style={{ padding: 12, color: '#666' }}>{p.categoria}</td>
                      <td style={{ padding: 12 }}>{formatMoney(p.precio)}</td>
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
              <div style={{ display: 'flex', gap: 16, marginBottom: 24, background: '#f8f9fa', padding: 16, borderRadius: 12 }}>
                <input placeholder="NIF" value={newClient.nif} onChange={e=>setNewClient({...newClient, nif: e.target.value})} style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ddd' }} />
                <input placeholder="Nombre completo" value={newClient.nombre} onChange={e=>setNewClient({...newClient, nombre: e.target.value})} style={{ flex: 2, padding: 10, borderRadius: 6, border: '1px solid #ddd' }} />
                <input placeholder="Teléfono" value={newClient.telefono} onChange={e=>setNewClient({...newClient, telefono: e.target.value})} style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ddd' }} />
                <button onClick={handleCreateClient} style={{ background: fuchsia, color: 'white', border: 'none', padding: '0 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Registrar</button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: lightPink, color: fuchsia }}>
                    <th style={{ padding: 12, borderRadius: '8px 0 0 8px' }}>NIF</th>
                    <th style={{ padding: 12 }}>Nombre</th>
                    <th style={{ padding: 12 }}>Contacto</th>
                    <th style={{ padding: 12, borderRadius: '0 8px 8px 0' }}>Total Comprado</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 12, fontWeight: 'bold', color: '#555' }}>{c.nif}</td>
                      <td style={{ padding: 12, fontWeight: 'bold' }}>{c.nombre}</td>
                      <td style={{ padding: 12, color: '#666' }}>{c.telefono || '-'}</td>
                      <td style={{ padding: 12, color: fuchsia, fontWeight: 'bold' }}>{formatMoney(c.totalComprado)}</td>
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
                          {items.map((i: any, idx: number) => <div key={idx}>{i.cantidad}x {i.nombre}</div>)}
                        </td>
                        <td style={{ padding: 12, fontWeight: 'bold', color: isDev ? '#e53e3e' : '#333' }}>
                          {isDev ? '-' : ''}{formatMoney(s.importeTotal)}
                        </td>
                        <td style={{ padding: 12 }}>
                          {isDev 
                            ? <span style={{ background: '#fed7d7', color: '#c53030', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>DEVUELTA</span>
                            : <span style={{ background: '#c6f6d5', color: '#276749', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>COMPLETADA</span>
                          }
                          {s.motivoDevolucion && <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 4 }}>Motivo: {s.motivoDevolucion}</div>}
                        </td>
                        <td style={{ padding: 12 }}>
                          {!isDev && (
                            <button onClick={() => handleReturn(s)} style={{ background: 'transparent', border: '1px solid #e53e3e', color: '#e53e3e', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', marginRight: 8 }}>
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
      </div>
    </div>
  )
}
"""

os.makedirs('src/app/movilfree', exist_ok=True)
with open('src/app/movilfree/page.tsx', 'w', encoding='utf-8') as f:
    f.write(page_content)

print("Created Frontend component")
