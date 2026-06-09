'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ShoppingCart, X, Users, ArrowLeftRight, RefreshCcw, Package, Edit, Save, Search, UploadCloud, Printer, ArrowRight } from 'lucide-react'
import { TIENDAS_COMERCIALES } from '@/lib/constants'
import { useGuard } from '@/hooks/useGuard'
import './MicroShopAccesorios.css'

// --- Types ---
type ProductStock = {
  id: string
  productId: string
  tienda: string
  cantidad: number
}

type Product = {
  id: string
  nombre: string
  categoria: string
  precio: number // Cost base (without IVA)
  coste: number // Cost base (without IVA)
  imei?: string
  createdAt: string
  stocks: ProductStock[]
}

type Client = {
  id: string
  nif: string
  nombre: string
  direccion?: string
  poblacion?: string
  provincia?: string
  cp?: string
  movil?: string
  fijo?: string
  email: string
  totalComprado: number
}

type Sale = {
  id: string
  numeroFactura?: number
  vendedor: string
  tienda: string
  nifCliente: string
  nombreCliente: string
  listaProductos: string
  importeTotal: number
  metodoPago?: string
  estado: string
  fechaVenta: string
  motivoDevolucion?: string
}

type Transfer = {
  id: string
  productId: string
  origen: string
  destino: string
  cantidad: number
  vendedor: string
  fecha: string
  estado: string
  product: {
    nombre: string
  }
}

export default function MicroShopAccesoriosApp() {
  const { authorized, user } = useGuard('VIEW_NUEVA_VENTA')
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'ventas' | 'productos' | 'clientes' | 'devoluciones' | 'trazabilidad'>('ventas')

  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])

  // Active store / user context
  const [userStore, setUserStore] = useState<string | null>(null)
  const [isGlobalUser, setIsGlobalUser] = useState(false)
  const [selectedTienda, setSelectedTienda] = useState<string>('Auxiliadora 45')

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCategory, setSearchCategory] = useState('Todas')
  const [searchInvProducts, setSearchInvProducts] = useState('')
  const [searchInvCategory, setSearchInvCategory] = useState('Todas')
  const [searchClients, setSearchClients] = useState('')
  const [searchSales, setSearchSales] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Cart (Punto de Venta)
  const [cart, setCart] = useState<{ product: Product; cantidad: number }[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [clientName, setClientName] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Modals/Forms
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta'>('Efectivo')
  const [printModalSale, setPrintModalSale] = useState<Sale | null>(null)

  const [newProd, setNewProd] = useState({ nombre: '', categoria: 'Accesorio', precio: 0, coste: 0, stock: 0, imei: '' })
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editProdData, setEditProdData] = useState<any>(null)

  const [newClient, setNewClient] = useState({ nif: '', nombre: '', direccion: '', poblacion: '', provincia: '', cp: '', movil: '', fijo: '', email: '' })
  const [showClientPasteModal, setShowClientPasteModal] = useState(false)
  const [clientPasteText, setClientPasteText] = useState('')
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [editClientData, setEditClientData] = useState<any>(null)

  // Transfer Modal
  const [transferProduct, setTransferProduct] = useState<Product | null>(null)
  const [transferOrigen, setTransferOrigen] = useState('')
  const [transferDestino, setTransferDestino] = useState('')
  const [transferQty, setTransferQty] = useState(1)

  // Return Modal
  const [returnModalSale, setReturnModalSale] = useState<Sale | null>(null)
  const [returnQty, setReturnQty] = useState<Record<string, number>>({})
  const [returnReason, setReturnReason] = useState('')

  // Load Data
  const loadProducts = () => {
    fetch('/api/microshop-accesorios/products')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setProducts(d)
      })
  }

  const loadClients = () => {
    fetch('/api/movilfree/clients')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setClients(d)
      })
  }

  const loadSales = () => {
    fetch('/api/microshop-accesorios/sales')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setSales(d)
      })
  }

  const loadTransfers = () => {
    fetch('/api/microshop-accesorios/transfers')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setTransfers(d)
      })
  }

  // Detect active store and role
  useEffect(() => {
    if (user) {
      const username = user.username || ''
      const role = user.role || ''

      const globalAccess =
        role === 'ADMIN' ||
        role === 'JEFE DE VENTAS' ||
        role === 'GESTORA' ||
        role === 'BACK OFFICE'

      setIsGlobalUser(globalAccess)

      // Find user store in TIENDAS_COMERCIALES mapping
      const match = Object.entries(TIENDAS_COMERCIALES).find(([store, commercials]) =>
        commercials.some((c) => c.toLowerCase() === username.toLowerCase())
      )

      if (match) {
        setUserStore(match[0])
        setSelectedTienda(match[0])
      } else {
        setUserStore(null)
        setSelectedTienda('Auxiliadora 45')
      }
    }
  }, [user])

  // Initial Fetching
  useEffect(() => {
    if (authorized) {
      loadProducts()
      loadClients()
      loadSales()
      loadTransfers()
    }
  }, [authorized, activeTab])

  if (!authorized) {
    return <div style={{ padding: 40, color: '#00adef', fontWeight: 600 }}>Cargando módulo corporativo...</div>
  }

  // Helper formatting
  const formatMoney = (val: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val)

  const getStock = (product: Product, storeName: string): number => {
    const stockItem = product.stocks?.find((s) => s.tienda === storeName)
    return stockItem ? stockItem.cantidad : 0
  }

  const getTotalStock = (product: Product): number => {
    return product.stocks?.reduce((acc, s) => acc + s.cantidad, 0) || 0
  }

  // Cart/TPV handlers
  const addToCart = (p: Product) => {
    const availableStock = getStock(p, selectedTienda)
    if (availableStock <= 0) return alert(`No hay stock de este producto en la tienda seleccionada (${selectedTienda === 'O2' ? 'Movilfree' : selectedTienda})`)

    const existing = cart.find((x) => x.product.id === p.id)
    if (existing) {
      if (existing.cantidad >= availableStock) return alert('No hay más stock disponible en esta tienda')
      setCart(cart.map((x) => (x.product.id === p.id ? { ...x, cantidad: x.cantidad + 1 } : x)))
    } else {
      setCart([...cart, { product: p, cantidad: 1 }])
    }
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('El carrito está vacío')
    const total = cart.reduce((acc, item) => acc + item.product.precio * 1.21 * item.cantidad, 0)
    const cl = clients.find((c) => c.nif === selectedClient || c.nombre === clientName)

    const payload = {
      vendedor: user?.username || 'Sistema',
      tienda: selectedTienda,
      nifCliente: selectedClient || (cl ? cl.nif : 'CONTADO'),
      nombreCliente: clientName || (cl ? cl.nombre : 'Cliente Contado'),
      importeTotal: total,
      metodoPago: paymentMethod,
      listaProductos: cart.map((c) => ({
        id: c.product.id,
        nombre: c.product.nombre,
        cantidad: c.cantidad,
        precio: c.product.precio * 1.21,
        coste: c.product.coste,
      })),
    }

    try {
      const res = await fetch('/api/microshop-accesorios/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const createdSale = await res.json()
        setPrintModalSale(createdSale)
        setCart([])
        setShowPaymentModal(false)
        loadSales()
        loadProducts()
      } else {
        const err = await res.json()
        alert('Error al procesar la venta: ' + (err.error || 'Intente de nuevo'))
      }
    } catch (e) {
      alert('Error de red al completar la venta')
    }
  }

  // Stock management handlers
  const handleCreateProduct = async () => {
    if (!newProd.nombre) return alert('El nombre es obligatorio')
    const payload = {
      ...newProd,
      tienda: selectedTienda,
    }

    try {
      const res = await fetch('/api/microshop-accesorios/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const created = await res.json()
        setProducts([created, ...products])
        setNewProd({ nombre: '', categoria: 'Accesorio', precio: 0, coste: 0, stock: 0, imei: '' })
        alert('Producto creado y stock asignado correctamente')
        loadProducts()
      } else {
        const err = await res.json()
        alert('Error: ' + err.error)
      }
    } catch (e) {
      alert('Error de conexión')
    }
  }

  const handleSaveEditProduct = async () => {
    if (!editProdData) return
    try {
      // Send selected store so quantity updates are tied to the active/selected store
      const res = await fetch(`/api/microshop-accesorios/products/${editingProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editProdData,
          tienda: selectedTienda,
        }),
      })
      if (res.ok) {
        setEditingProductId(null)
        setEditProdData(null)
        loadProducts()
      } else {
        const errRes = await res.json()
        alert('Error al guardar: ' + (errRes.error || JSON.stringify(errRes)))
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Seguro que quieres borrar este producto permanentemente de MicroShop?')) return
    try {
      const res = await fetch(`/api/microshop-accesorios/products/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setProducts(products.filter((p) => p.id !== id))
      } else {
        alert('Error al borrar producto')
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleBulkPaste = async () => {
    if (!pasteText.trim()) return
    const rows = pasteText.split('\n').filter((r) => r.trim() !== '')
    const parsedProducts = rows.map((r) => {
      const cols = r.split('\t')
      const pvp = parseFloat((cols[3] || '0').replace(',', '.')) || 0
      return {
        nombre: cols[0] ? cols[0].trim() : 'Desconocido',
        categoria: cols[1] ? cols[1].trim() : 'Accesorio',
        coste: parseFloat((cols[2] || '0').replace(',', '.')) || 0,
        precio: Number((pvp / 1.21).toFixed(2)),
        stock: parseInt((cols[4] || '1'), 10) || 1,
        imei: cols[5] ? cols[5].trim() : '',
      }
    })

    try {
      const res = await fetch('/api/microshop-accesorios/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: parsedProducts, tienda: selectedTienda }),
      })
      if (!res.ok) throw new Error('Error al guardar importación')

      setShowPasteModal(false)
      setPasteText('')
      loadProducts()
      alert(`¡Se han importado ${parsedProducts.length} productos correctamente para la tienda ${selectedTienda === 'O2' ? 'Movilfree' : selectedTienda}!`)
    } catch (e: any) {
      alert(e.message)
    }
  }

  // Stock transfer handler
  const handleOpenTransfer = (p: Product) => {
    setTransferProduct(p)
    setTransferOrigen(selectedTienda)
    const remainingStores = Object.keys(TIENDAS_COMERCIALES).filter((t) => t !== selectedTienda)
    setTransferDestino(remainingStores[0] || '')
    setTransferQty(1)
  }

  const submitTransfer = async () => {
    if (!transferProduct) return
    const payload = {
      productId: transferProduct.id,
      origen: transferOrigen,
      destino: transferDestino,
      cantidad: transferQty,
      vendedor: user?.username || 'Sistema',
    }

    try {
      const res = await fetch('/api/microshop-accesorios/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setTransferProduct(null)
        loadProducts()
        loadTransfers()
        alert('Stock traspasado con éxito.')
      } else {
        const err = await res.json()
        alert('Error: ' + err.error)
      }
    } catch (e) {
      alert('Error de red al realizar el traspaso')
    }
  }

  // Clients management handlers
  const handleCreateClient = async () => {
    if (!newClient.nif || !newClient.nombre) return alert('NIF y Nombre obligatorios')
    try {
      const res = await fetch('/api/movilfree/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      })
      const created = await res.json()
      if (!res.ok) return alert('Error: ' + (created.error || 'No se pudo crear'))
      loadClients()
      setNewClient({ nif: '', nombre: '', direccion: '', poblacion: '', provincia: '', cp: '', movil: '', fijo: '', email: '' })
      alert('Cliente registrado con éxito')
    } catch (e) {
      alert('Error al crear cliente')
    }
  }

  const handleSaveEditClient = async () => {
    if (!editClientData) return
    try {
      const res = await fetch(`/api/movilfree/clients/${editingClientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editClientData),
      })
      if (res.ok) {
        setEditingClientId(null)
        setEditClientData(null)
        loadClients()
      } else {
        const errRes = await res.json()
        alert('Error al guardar: ' + (errRes.error || JSON.stringify(errRes)))
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleDeleteClient = async (id: string) => {
    if (!confirm('¿Seguro que quieres borrar este cliente?')) return
    try {
      const res = await fetch(`/api/movilfree/clients/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setClients(clients.filter((c) => c.id !== id))
      } else {
        alert('Error al borrar cliente')
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleBulkClientPaste = async () => {
    if (!clientPasteText.trim()) return
    const rows = clientPasteText.split('\n').filter((r) => r.trim() !== '')
    const parsedClients = rows.map((r) => {
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
        totalComprado: 0,
      }
    })

    try {
      const res = await fetch('/api/movilfree/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedClients),
      })
      if (!res.ok) throw new Error('Error al guardar clientes en masa')

      setShowClientPasteModal(false)
      setClientPasteText('')
      loadClients()
      alert(`¡Se han añadido ${parsedClients.length} clientes correctamente!`)
    } catch (e: any) {
      alert(e.message)
    }
  }

  // Returns management handlers
  const handleReturnClick = (sale: Sale) => {
    setReturnModalSale(sale)
    setReturnQty({})
    setReturnReason('')
  }

  const submitPartialReturn = async () => {
    if (!returnModalSale) return
    const itemsToReturn = Object.entries(returnQty)
      .map(([id, qty]) => ({ id, cantidad: qty }))
      .filter((x) => x.cantidad > 0)
    if (itemsToReturn.length === 0) return alert('Selecciona al menos 1 producto para devolver')

    const payload = {
      estado: 'DEVOLUCION_PARCIAL',
      motivoDevolucion: returnReason || 'Devolución parcial',
      returnedItems: itemsToReturn,
    }

    try {
      const res = await fetch(`/api/microshop-accesorios/sales/${returnModalSale.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        alert('Devolución parcial registrada correctamente. El stock ha sido actualizado.')
        setReturnModalSale(null)
        loadSales()
        loadProducts()
      } else {
        const err = await res.json()
        alert('Error: ' + err.error)
      }
    } catch (e) {
      alert('Error de red al procesar devolución')
    }
  }

  const submitFullReturn = async () => {
    if (!returnModalSale) return
    const payload = {
      estado: 'DEVUELTA',
      motivoDevolucion: returnReason || 'Devolución completa',
    }

    try {
      const res = await fetch(`/api/microshop-accesorios/sales/${returnModalSale.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        alert('Venta devuelta por completo. Stock restaurado.')
        setReturnModalSale(null)
        loadSales()
        loadProducts()
      } else {
        const err = await res.json()
        alert('Error: ' + err.error)
      }
    } catch (e) {
      alert('Error de red')
    }
  }

  const handleDeleteSale = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta venta permanentemente de MicroShop? Se restaurará el stock y se ajustará la Caja.')) return
    try {
      const res = await fetch(`/api/microshop-accesorios/sales/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSales(sales.filter((s) => s.id !== id))
        loadProducts()
        alert('Venta eliminada.')
      } else {
        alert('Error al borrar la venta')
      }
    } catch (e) {
      alert('Error de red')
    }
  }

  return (
    <div className="ms-main-wrapper">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* HEADER */}
        <div className="ms-header">
          <div style={{ width: 48, height: 48, background: '#00adef', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <ShoppingCart size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, color: '#00adef', fontSize: 24, fontWeight: 800 }}>MicroShop Accesorios</h1>
            <p style={{ margin: '4px 0 0', color: '#555', fontSize: 14 }}>Gestión integral de Stock y Punto de Venta Accesorios</p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <img src="/icon.png" alt="MicroShop" style={{ height: 48, objectFit: 'contain' }} />
          </div>
        </div>

        {/* TABS & SEARCH */}
        <div className="ms-tabs-bar">
          <div className="ms-tabs-buttons">
            <button onClick={() => setActiveTab('ventas')} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: activeTab === 'ventas' ? '#00adef' : 'white', color: activeTab === 'ventas' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'ventas' ? '0 4px 12px rgba(0, 173, 239,0.2)' : 'none' }}>
              <ShoppingCart size={18} /> Punto de Venta
            </button>
            <button onClick={() => setActiveTab('productos')} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: activeTab === 'productos' ? '#00adef' : 'white', color: activeTab === 'productos' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'productos' ? '0 4px 12px rgba(0, 173, 239,0.2)' : 'none' }}>
              <Package size={18} /> Stock
            </button>
            <button onClick={() => setActiveTab('clientes')} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: activeTab === 'clientes' ? '#00adef' : 'white', color: activeTab === 'clientes' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'clientes' ? '0 4px 12px rgba(0, 173, 239,0.2)' : 'none' }}>
              <Users size={18} /> Clientes
            </button>
            <button onClick={() => setActiveTab('devoluciones')} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: activeTab === 'devoluciones' ? '#00adef' : 'white', color: activeTab === 'devoluciones' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'devoluciones' ? '0 4px 12px rgba(0, 173, 239,0.2)' : 'none' }}>
              <RefreshCcw size={18} /> Ventas & Devoluciones
            </button>
            <button onClick={() => setActiveTab('trazabilidad')} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: activeTab === 'trazabilidad' ? '#00adef' : 'white', color: activeTab === 'trazabilidad' ? 'white' : '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeTab === 'trazabilidad' ? '0 4px 12px rgba(0, 173, 239,0.2)' : 'none' }}>
              <ArrowLeftRight size={18} /> Stock (Trazabilidad)
            </button>
          </div>

          {activeTab !== 'trazabilidad' && (
            <div className="ms-search-container">
              <Search size={18} style={{ position: 'absolute', left: 14, top: 13, color: '#00adef' }} />
              {activeTab === 'ventas' && (
                <input placeholder="Buscar producto en POS..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', height: 44, padding: '0 16px 0 44px', borderRadius: 12, border: '1px solid #90caf9', background: '#e3f2fd', color: '#00adef', fontSize: 14, boxSizing: 'border-box' }} />
              )}
              {activeTab === 'productos' && (
                <input placeholder="Buscar en Stock..." value={searchInvProducts} onChange={(e) => setSearchInvProducts(e.target.value)} style={{ width: '100%', height: 44, padding: '0 16px 0 44px', borderRadius: 12, border: '1px solid #90caf9', background: '#e3f2fd', color: '#00adef', fontSize: 14, boxSizing: 'border-box' }} />
              )}
              {activeTab === 'clientes' && (
                <input placeholder="Buscar cliente..." value={searchClients} onChange={(e) => setSearchClients(e.target.value)} style={{ width: '100%', height: 44, padding: '0 16px 0 44px', borderRadius: 12, border: '1px solid #90caf9', background: '#e3f2fd', color: '#00adef', fontSize: 14, boxSizing: 'border-box' }} />
              )}
              {activeTab === 'devoluciones' && (
                <input placeholder="Buscar factura, cliente..." value={searchSales} onChange={(e) => setSearchSales(e.target.value)} style={{ width: '100%', height: 44, padding: '0 16px 0 44px', borderRadius: 12, border: '1px solid #90caf9', background: '#e3f2fd', color: '#00adef', fontSize: 14, boxSizing: 'border-box' }} />
              )}
            </div>
          )}
        </div>

        {/* TIENDA SECTOR (GLOBAL USER CONTROL) */}
        <div style={{ background: '#FFF', padding: '16px 24px', borderRadius: 16, marginBottom: 24, boxShadow: '0 4px 15px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 14, color: '#666', fontWeight: 'bold' }}>TIENDA ACTIVA: </span>
            <span style={{ fontSize: 16, color: '#00adef', fontWeight: 'bold', background: '#E3F2FD', padding: '6px 12px', borderRadius: 8 }}>{selectedTienda === 'O2' ? 'Movilfree' : selectedTienda}</span>
          </div>
          {isGlobalUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 'bold', color: '#555' }}>Cambiar Tienda Vista:</label>
              <select value={selectedTienda} onChange={(e) => setSelectedTienda(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #90caf9', fontSize: 13, background: 'white', color: '#00adef', fontWeight: 'bold' }}>
                {Object.keys(TIENDAS_COMERCIALES).map((t) => (
                  <option key={t} value={t}>{t === 'O2' ? 'Movilfree' : t}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="ms-content-box">
          
          {/* TAB: PUNTO DE VENTA */}
          {activeTab === 'ventas' && (
            <div className="ms-pos-grid">
              
              {/* Product Catalog */}
              <div style={{ background: '#f8f9fa', padding: 24, borderRadius: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ color: '#00adef', margin: 0, fontWeight: 'bold' }}>Catálogo de Productos</h3>
                  <select value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, background: 'white' }}>
                    <option value="Todas">Todas las categorías</option>
                    <option value="Terminal">Terminal</option>
                    <option value="Accesorio">Accesorio</option>
                    <option value="Servicio">Servicio</option>
                    <option value="Varios">Varios</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, maxHeight: 600, overflowY: 'auto', paddingRight: 6 }}>
                  {products
                    .filter((p) => {
                      const stockVal = getStock(p, selectedTienda)
                      return (
                        stockVal > 0 &&
                        (searchCategory === 'Todas' || p.categoria === searchCategory) &&
                        p.nombre.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                    })
                    .map((p) => (
                      <div key={p.id} onClick={() => addToCart(p)} style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #eee', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>{p.categoria}</span>
                          {p.imei && (
                            <span style={{ fontSize: 9, color: '#00adef', fontFamily: 'monospace', fontWeight: 'bold', background: '#E3F2FD', padding: '2px 4px', borderRadius: 4 }}>
                              IMEI
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 'bold', color: '#333', marginBottom: 8, minHeight: 40, fontSize: 13 }}>{p.nombre}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 900, color: '#00adef', fontSize: 16 }}>{formatMoney(p.precio * 1.21)}</div>
                          <div style={{ fontSize: 11, color: '#888', fontWeight: 'bold' }}>Stock: {getStock(p, selectedTienda)}</div>
                        </div>
                      </div>
                    ))}
                  {products.filter((p) => getStock(p, selectedTienda) > 0 && (searchCategory === 'Todas' || p.categoria === searchCategory) && p.nombre.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div style={{ color: '#888', padding: 20 }}>No hay accesorios en stock en {selectedTienda === 'O2' ? 'Movilfree' : selectedTienda}.</div>
                  )}
                </div>
              </div>

              {/* Basket */}
              <div style={{ background: '#f8f9fa', padding: 24, borderRadius: 16, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ color: '#333', margin: '0 0 16px 0', fontWeight: 'bold' }}>Carrito Actual</h3>
                
                {/* Client block */}
                <div style={{ marginBottom: 16, position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>NIF/CIF Cliente</label>
                      <input 
                        type="text" 
                        value={selectedClient} 
                        onChange={(e) => {
                          setSelectedClient(e.target.value)
                          setShowSuggestions(true)
                          const match = clients.find((c) => c.nif.toLowerCase().includes(e.target.value.toLowerCase()))
                          if (match && e.target.value.length > 2) setClientName(match.nombre)
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
                        onChange={(e) => {
                          setClientName(e.target.value)
                          setShowSuggestions(true)
                          const match = clients.find((c) => c.nombre.toLowerCase().includes(e.target.value.toLowerCase()))
                          if (match && e.target.value.length > 2) setSelectedClient(match.nif)
                        }} 
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="Ej: Juan Pérez" 
                        style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', marginTop: 4 }} 
                      />
                    </div>
                  </div>
                  
                  {/* Client suggestions */}
                  {showSuggestions && (selectedClient.length > 1 || clientName.length > 1) && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #eee', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 150, overflowY: 'auto', marginTop: 4 }}>
                      {clients
                        .filter((c) => (selectedClient && c.nif.toLowerCase().includes(selectedClient.toLowerCase())) || (clientName && c.nombre.toLowerCase().includes(clientName.toLowerCase())))
                        .slice(0, 5)
                        .map((c) => (
                          <div 
                            key={c.id} 
                            onClick={() => {
                              setSelectedClient(c.nif)
                              setClientName(c.nombre)
                              setShowSuggestions(false)
                            }}
                            style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f8f9fa', display: 'flex', justifyContent: 'space-between' }}
                          >
                            <strong style={{ color: '#00adef', fontSize: 13 }}>{c.nif}</strong>
                            <span style={{ fontSize: 13, color: '#333' }}>{c.nombre}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Items list */}
                <div style={{ minHeight: 220, background: 'white', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid #eee', overflowY: 'auto', maxHeight: 350 }}>
                  {cart.length === 0 && <div style={{ color: '#aaa', textAlign: 'center', marginTop: 80 }}>Carrito vacío</div>}
                  {cart.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px dashed #eee', paddingBottom: 8 }}>
                      <div style={{ flex: 1, paddingRight: 12 }}>
                        <div style={{ fontWeight: 'bold', fontSize: 13 }}>{c.product.nombre}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <button onClick={() => {
                            if (c.cantidad <= 1) setCart(cart.filter((x) => x.product.id !== c.product.id))
                            else setCart(cart.map((x) => (x.product.id === c.product.id ? { ...x, cantidad: x.cantidad - 1 } : x)))
                          }} style={{ width: 22, height: 22, borderRadius: 11, border: '1px solid #ddd', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>-</button>
                          
                          <span style={{ fontSize: 13, fontWeight: 'bold', minWidth: 20, textAlign: 'center' }}>{c.cantidad}</span>
                          
                          <button onClick={() => {
                            const avail = getStock(c.product, selectedTienda)
                            if (c.cantidad < avail) {
                              setCart(cart.map((x) => (x.product.id === c.product.id ? { ...x, cantidad: x.cantidad + 1 } : x)))
                            } else {
                              alert('No hay más stock disponible en esta tienda')
                            }
                          }} style={{ width: 22, height: 22, borderRadius: 11, border: 'none', background: '#00adef', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>+</button>
                          
                          <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>x {formatMoney(c.product.precio * 1.21)}</span>
                        </div>
                      </div>
                      <div style={{ fontWeight: 'bold', color: '#00adef', alignSelf: 'center', fontSize: 14 }}>{formatMoney(c.product.precio * 1.21 * c.cantidad)}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold', color: '#555' }}>TOTAL (IVA Inc.)</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#00adef' }}>
                    {formatMoney(cart.reduce((a, b) => a + b.product.precio * 1.21 * b.cantidad, 0))}
                  </div>
                </div>

                <button onClick={() => { if (cart.length === 0) return alert('El carrito está vacío'); setShowPaymentModal(true); }} style={{ width: '100%', background: '#00adef', color: 'white', border: 'none', padding: 14, borderRadius: 10, fontWeight: 'bold', fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0, 173, 239,0.2)' }}>
                  Confirmar y Cobrar
                </button>
              </div>
            </div>
          )}

          {/* TAB: STOCK */}
          {activeTab === 'productos' && (
            <div>
              <div className="ms-form-grid-productos">
                <div>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Nombre del Producto</label>
                  <input placeholder="Funda, Cargador, Protector..." value={newProd.nombre} onChange={(e) => setNewProd({ ...newProd, nombre: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Categoría</label>
                  <select value={newProd.categoria} onChange={(e) => setNewProd({ ...newProd, categoria: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4, background: 'white' }}>
                    <option>Accesorio</option>
                    <option>Terminal</option>
                    <option>Servicio</option>
                    <option>Varios</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Coste PVD (sin IVA)</label>
                  <input type="number" placeholder="Coste" value={newProd.coste || ''} onChange={(e) => setNewProd({ ...newProd, coste: Number(e.target.value) })} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#00adef' }}>PVP (con IVA)</label>
                  <input type="number" placeholder="PVP" value={newProd.precio ? Number((newProd.precio * 1.21).toFixed(2)) : ''} onChange={(e) => setNewProd({ ...newProd, precio: Number((Number(e.target.value) / 1.21).toFixed(2)) })} style={{ width: '100%', padding: 10, borderRadius: 6, border: '2px solid #00adef', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Stock Inicial</label>
                  <input type="number" placeholder="Uds." value={newProd.stock || ''} onChange={(e) => setNewProd({ ...newProd, stock: Number(e.target.value) })} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                {newProd.categoria === 'Terminal' && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 'bold', color: '#00adef' }}>IMEI (Opcional)</label>
                    <input type="text" maxLength={15} placeholder="IMEI" value={newProd.imei || ''} onChange={(e) => setNewProd({ ...newProd, imei: e.target.value.replace(/\D/g, '') })} style={{ width: '100%', padding: 10, borderRadius: 6, border: '2px solid #00adef', marginTop: 4, fontFamily: 'monospace' }} />
                  </div>
                )}
                <div className="ms-action-buttons" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={handleCreateProduct} style={{ background: '#00adef', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40 }}>Crear</button>
                  <button onClick={() => setShowPasteModal(true)} style={{ background: '#00adef', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40 }}>Excel 📋</button>
                  <div style={{ background: '#f0f4f8', border: '1px solid #00adef', borderRadius: 8, padding: '4px 12px', height: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 160, boxSizing: 'border-box' }}>
                    <span style={{ fontSize: 9, color: '#666', fontWeight: 'bold', textTransform: 'uppercase' }}>Valoración coste sin IVA</span>
                    <span style={{ fontSize: 13, fontWeight: 'bold', color: '#00adef' }}>
                      {formatMoney(
                        products
                          .filter((p) => isGlobalUser || p.stocks.some((s) => s.tienda === selectedTienda))
                          .reduce((acc, p) => acc + (p.coste * (isGlobalUser ? getTotalStock(p) : getStock(p, selectedTienda))), 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {newProd.precio > 0 && newProd.coste > 0 && (
                <div style={{ marginBottom: 24, fontSize: 14, color: '#555', background: '#e6fffa', padding: '8px 16px', borderRadius: 8, display: 'inline-block', border: '1px solid #b2f5ea', marginTop: 12 }}>
                  Beneficio: <strong style={{ color: '#276749', fontSize: 16 }}>{formatMoney(newProd.precio - newProd.coste)}</strong>
                </div>
              )}

              {showPasteModal && (
                <div style={{ background: '#e3f2fd', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid #90caf9' }}>
                  <h3 style={{ marginTop: 0, color: '#00adef' }}>Importar Catálogo/Stock desde Excel</h3>
                  <p style={{ fontSize: 13, color: '#333' }}>
                    Copia las columnas del Excel en el siguiente orden estricto (separadas por tabulador):
                    <br />
                    <strong>Nombre del producto &nbsp;|&nbsp; Categoría &nbsp;|&nbsp; Coste PVD (sin IVA) &nbsp;|&nbsp; PVP (con IVA) &nbsp;|&nbsp; Stock &nbsp;|&nbsp; IMEI</strong>
                  </p>
                  <textarea 
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    style={{ width: '100%', height: 120, padding: 10, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 12 }}
                    placeholder="Ejemplo:&#10;Funda MicroShop TPU&#9;Accesorio&#9;3,10&#9;9,99&#9;15&#9;&#10;iPhone 15 Black&#9;Terminal&#9;650,00&#9;899,00&#9;2&#9;352456789012345"
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button onClick={handleBulkPaste} style={{ background: '#00adef', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Guardar para {selectedTienda === 'O2' ? 'Movilfree' : selectedTienda}</button>
                    <button onClick={() => setShowPasteModal(false)} style={{ background: '#ccc', color: '#333', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 16 }}>
                <h3 style={{ margin: 0, color: '#00adef', fontWeight: 'bold' }}>Inventario de Stock</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 'bold', color: '#555' }}>Filtrar por Categoría:</span>
                  <select value={searchInvCategory} onChange={(e) => setSearchInvCategory(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #90caf9', fontSize: 13, background: 'white', color: '#00adef', fontWeight: 'bold', outline: 'none' }}>
                    <option value="Todas">Todas las categorías</option>
                    <option value="Terminal">Terminal</option>
                    <option value="Accesorio">Accesorio</option>
                    <option value="Servicio">Servicio</option>
                    <option value="Varios">Varios</option>
                  </select>
                </div>
              </div>

              <div className="ms-table-wrapper">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: '#e3f2fd', color: '#00adef' }}>
                      <th style={{ padding: 10, borderRadius: '8px 0 0 8px' }}>Producto</th>
                      <th style={{ padding: 10 }}>Categoría</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>Coste (PVD)</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>PVP (con IVA)</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>Beneficio Ud.</th>
                      <th style={{ padding: 10, textAlign: 'center' }}>IMEI</th>
                      {isGlobalUser ? (
                        <>
                          <th style={{ padding: 10, textAlign: 'center' }}>Auxiliadora</th>
                          <th style={{ padding: 10, textAlign: 'center' }}>Correhuela</th>
                          <th style={{ padding: 10, textAlign: 'center' }}>Villamayor</th>
                          <th style={{ padding: 10, textAlign: 'center' }}>Béjar</th>
                          <th style={{ padding: 10, textAlign: 'center' }}>Movilfree</th>
                          <th style={{ padding: 10, textAlign: 'center', fontWeight: 'bold', color: '#00adef' }}>Total Stock</th>
                        </>
                      ) : (
                        <th style={{ padding: 10, textAlign: 'center', fontWeight: 'bold' }}>{selectedTienda === 'O2' ? 'Movilfree' : selectedTienda}</th>
                      )}
                      <th style={{ padding: 10, borderRadius: '0 8px 8px 0', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products
                      .filter((p) => {
                        const matchesSearch = p.nombre.toLowerCase().includes(searchInvProducts.toLowerCase())
                        if (!matchesSearch) return false
                        if (searchInvCategory !== 'Todas' && p.categoria !== searchInvCategory) return false
                        if (isGlobalUser) return true
                        // Filter by active store stock record existence for non-global users
                        return p.stocks.some((s) => s.tienda === selectedTienda)
                      })
                      .map((p) => {
                        const isEditing = editingProductId === p.id
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: 10 }}>
                              {isEditing ? (
                                <input type="text" value={editProdData.nombre} onChange={(e) => setEditProdData({ ...editProdData, nombre: e.target.value })} style={{ padding: 4, width: '100%' }} />
                              ) : (
                                <div style={{ fontWeight: 'bold' }}>{p.nombre}</div>
                              )}
                            </td>
                            <td style={{ padding: 10 }}>
                              {isEditing ? (
                                <select value={editProdData.categoria} onChange={(e) => setEditProdData({ ...editProdData, categoria: e.target.value })} style={{ padding: 4 }}>
                                  <option>Accesorio</option>
                                  <option>Terminal</option>
                                  <option>Servicio</option>
                                  <option>Varios</option>
                                </select>
                              ) : (
                                p.categoria
                              )}
                            </td>
                            <td style={{ padding: 10, textAlign: 'right' }}>
                              {isEditing ? (
                                <input type="number" step="0.01" value={editProdData.coste} onChange={(e) => setEditProdData({ ...editProdData, coste: Number(e.target.value) })} style={{ padding: 4, width: 70 }} />
                              ) : (
                                formatMoney(p.coste)
                              )}
                            </td>
                            <td style={{ padding: 10, textAlign: 'right' }}>
                              {isEditing ? (
                                <input type="number" step="0.01" value={(editProdData.precio * 1.21).toFixed(2)} onChange={(e) => setEditProdData({ ...editProdData, precio: Number(e.target.value) / 1.21 })} style={{ padding: 4, width: 70 }} />
                              ) : (
                                formatMoney(p.precio * 1.21)
                              )}
                            </td>
                            <td style={{ padding: 10, textAlign: 'right', color: '#2e7d32', fontWeight: 'bold' }}>
                              {formatMoney((isEditing ? editProdData.precio : p.precio) - (isEditing ? editProdData.coste : p.coste))}
                            </td>
                            <td style={{ padding: 10, textAlign: 'center', fontFamily: 'monospace' }}>
                              {isEditing ? (
                                <input type="text" value={editProdData.imei || ''} onChange={(e) => setEditProdData({ ...editProdData, imei: e.target.value })} style={{ padding: 4, width: 110 }} />
                              ) : (
                                p.imei || '---'
                              )}
                            </td>
                            
                            {/* Stock Columns */}
                            {isGlobalUser ? (
                              <>
                                <td style={{ padding: 10, textAlign: 'center' }}>
                                  {isEditing && selectedTienda === 'Auxiliadora 45' ? (
                                    <input type="number" value={editProdData.stock} onChange={(e) => setEditProdData({ ...editProdData, stock: Number(e.target.value) })} style={{ width: 50 }} />
                                  ) : (
                                    getStock(p, 'Auxiliadora 45')
                                  )}
                                </td>
                                <td style={{ padding: 10, textAlign: 'center' }}>
                                  {isEditing && selectedTienda === 'Correhuela' ? (
                                    <input type="number" value={editProdData.stock} onChange={(e) => setEditProdData({ ...editProdData, stock: Number(e.target.value) })} style={{ width: 50 }} />
                                  ) : (
                                    getStock(p, 'Correhuela')
                                  )}
                                </td>
                                <td style={{ padding: 10, textAlign: 'center' }}>
                                  {isEditing && selectedTienda === 'Villamayor' ? (
                                    <input type="number" value={editProdData.stock} onChange={(e) => setEditProdData({ ...editProdData, stock: Number(e.target.value) })} style={{ width: 50 }} />
                                  ) : (
                                    getStock(p, 'Villamayor')
                                  )}
                                </td>
                                <td style={{ padding: 10, textAlign: 'center' }}>
                                  {isEditing && selectedTienda === 'Béjar' ? (
                                    <input type="number" value={editProdData.stock} onChange={(e) => setEditProdData({ ...editProdData, stock: Number(e.target.value) })} style={{ width: 50 }} />
                                  ) : (
                                    getStock(p, 'Béjar')
                                  )}
                                </td>
                                <td style={{ padding: 10, textAlign: 'center' }}>
                                  {isEditing && selectedTienda === 'O2' ? (
                                    <input type="number" value={editProdData.stock} onChange={(e) => setEditProdData({ ...editProdData, stock: Number(e.target.value) })} style={{ width: 50 }} />
                                  ) : (
                                    getStock(p, 'O2')
                                  )}
                                </td>
                                <td style={{ padding: 10, textAlign: 'center', fontWeight: 'bold', color: '#00adef', background: '#f0f9ff' }}>
                                  {getTotalStock(p)}
                                </td>
                              </>
                            ) : (
                              <td style={{ padding: 10, textAlign: 'center', fontWeight: 'bold' }}>
                                {isEditing ? (
                                  <input type="number" value={editProdData.stock} onChange={(e) => setEditProdData({ ...editProdData, stock: Number(e.target.value) })} style={{ width: 60 }} />
                                ) : (
                                  getStock(p, selectedTienda)
                                )}
                              </td>
                            )}

                            {/* Actions */}
                            <td style={{ padding: 10, textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                {isEditing ? (
                                  <>
                                    <button onClick={handleSaveEditProduct} style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}><Save size={14} /></button>
                                    <button onClick={() => { setEditingProductId(null); setEditProdData(null); }} style={{ background: '#777', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}><X size={14} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => { setEditingProductId(p.id); setEditProdData({ nombre: p.nombre, categoria: p.categoria, coste: p.coste, precio: p.precio, stock: getStock(p, selectedTienda), imei: p.imei || '' }); }} style={{ background: '#e3f2fd', color: '#00adef', border: 'none', padding: '6px', borderRadius: 4, cursor: 'pointer' }}><Edit size={14} /></button>
                                    <button onClick={() => handleOpenTransfer(p)} style={{ background: '#e0f7fa', color: '#006064', border: 'none', padding: '6px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }} title="Traspasar Stock"><ArrowLeftRight size={14} /> Traspasar</button>
                                    <button onClick={() => handleDeleteProduct(p.id)} style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '6px', borderRadius: 4, cursor: 'pointer' }}><Trash2 size={14} /></button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: CLIENTES */}
          {activeTab === 'clientes' && (
            <div>
              <div className="ms-form-grid-clientes">
                <div>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>NIF / CIF</label>
                  <input placeholder="NIF" value={newClient.nif} onChange={(e) => setNewClient({ ...newClient, nif: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Nombre Completo</label>
                  <input placeholder="Nombre" value={newClient.nombre} onChange={(e) => setNewClient({ ...newClient, nombre: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Email</label>
                  <input placeholder="correo@ejemplo.com" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Móvil</label>
                  <input placeholder="Móvil" value={newClient.movil} onChange={(e) => setNewClient({ ...newClient, movil: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Dirección</label>
                  <input placeholder="Calle, nº, piso" value={newClient.direccion} onChange={(e) => setNewClient({ ...newClient, direccion: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Población</label>
                  <input placeholder="Población" value={newClient.poblacion} onChange={(e) => setNewClient({ ...newClient, poblacion: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div className="ms-action-buttons">
                  <button onClick={handleCreateClient} style={{ background: '#00adef', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40 }}>Crear</button>
                  <button onClick={() => setShowClientPasteModal(true)} style={{ background: '#00adef', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40 }}>Excel 📋</button>
                </div>
              </div>

              {showClientPasteModal && (
                <div style={{ background: '#e3f2fd', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid #90caf9' }}>
                  <h3 style={{ marginTop: 0, color: '#00adef' }}>Importar Clientes desde Excel</h3>
                  <p style={{ fontSize: 13, color: '#333' }}>Pega las columnas desde Excel en el siguiente orden: <strong>NIF, Nombre, Dirección, Población, Provincia, CP, Móvil, Fijo, Email</strong>.</p>
                  <textarea 
                    value={clientPasteText}
                    onChange={(e) => setClientPasteText(e.target.value)}
                    style={{ width: '100%', height: 100, padding: 10, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 12 }}
                    placeholder="12345678Z&#9;Juan Pérez&#9;Calle Toro 12&#9;Salamanca&#9;Salamanca&#9;37002&#9;666777888&#9;&#9;juan@gmail.com"
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button onClick={handleBulkClientPaste} style={{ background: '#00adef', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Guardar Clientes</button>
                    <button onClick={() => setShowClientPasteModal(false)} style={{ background: '#ccc', color: '#333', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}

              <div className="ms-table-wrapper">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: '#e3f2fd', color: '#00adef' }}>
                      <th style={{ padding: 10, borderRadius: '8px 0 0 8px' }}>NIF</th>
                      <th style={{ padding: 10 }}>Nombre</th>
                      <th style={{ padding: 10 }}>Dirección / Localidad</th>
                      <th style={{ padding: 10 }}>Contacto</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>Total Comprado</th>
                      <th style={{ padding: 10, borderRadius: '0 8px 8px 0', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients
                      .filter((c) => c.nombre.toLowerCase().includes(searchClients.toLowerCase()) || c.nif.toLowerCase().includes(searchClients.toLowerCase()))
                      .map((c) => {
                        const isEditing = editingClientId === c.id
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: 10, fontWeight: 'bold', color: '#00adef' }}>
                              {isEditing ? (
                                <input type="text" value={editClientData.nif} onChange={(e) => setEditClientData({ ...editClientData, nif: e.target.value })} style={{ padding: 4, width: 90 }} />
                              ) : (
                                c.nif
                              )}
                            </td>
                            <td style={{ padding: 10 }}>
                              {isEditing ? (
                                <input type="text" value={editClientData.nombre} onChange={(e) => setEditClientData({ ...editClientData, nombre: e.target.value })} style={{ padding: 4, width: '100%' }} />
                              ) : (
                                c.nombre
                              )}
                            </td>
                            <td style={{ padding: 10 }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <input type="text" placeholder="Dirección" value={editClientData.direccion || ''} onChange={(e) => setEditClientData({ ...editClientData, direccion: e.target.value })} style={{ padding: 4, fontSize: 12 }} />
                                  <input type="text" placeholder="CP" value={editClientData.cp || ''} onChange={(e) => setEditClientData({ ...editClientData, cp: e.target.value })} style={{ padding: 4, width: 50, fontSize: 12 }} />
                                  <input type="text" placeholder="Población" value={editClientData.poblacion || ''} onChange={(e) => setEditClientData({ ...editClientData, poblacion: e.target.value })} style={{ padding: 4, fontSize: 12 }} />
                                </div>
                              ) : (
                                <div>
                                  {c.direccion || '---'}
                                  {c.poblacion && <span style={{ color: '#666', fontSize: 11 }}> ({c.cp} - {c.poblacion})</span>}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: 10 }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <input type="text" placeholder="Móvil" value={editClientData.movil || ''} onChange={(e) => setEditClientData({ ...editClientData, movil: e.target.value })} style={{ padding: 4, width: 85 }} />
                                  <input type="text" placeholder="Email" value={editClientData.email || ''} onChange={(e) => setEditClientData({ ...editClientData, email: e.target.value })} style={{ padding: 4 }} />
                                </div>
                              ) : (
                                <div>
                                  <div>{c.movil || c.fijo || '---'}</div>
                                  <div style={{ fontSize: 11, color: '#666' }}>{c.email}</div>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: 10, textAlign: 'right', fontWeight: 'bold' }}>
                              {formatMoney(c.totalComprado)}
                            </td>
                            <td style={{ padding: 10, textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                {isEditing ? (
                                  <>
                                    <button onClick={handleSaveEditClient} style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}><Save size={14} /></button>
                                    <button onClick={() => { setEditingClientId(null); setEditClientData(null); }} style={{ background: '#777', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}><X size={14} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => { setEditingClientId(c.id); setEditClientData({ ...c }); }} style={{ background: '#e3f2fd', color: '#00adef', border: 'none', padding: '6px', borderRadius: 4, cursor: 'pointer' }}><Edit size={14} /></button>
                                    <button onClick={() => handleDeleteClient(c.id)} style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '6px', borderRadius: 4, cursor: 'pointer' }}><Trash2 size={14} /></button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: DEVOLUCIONES / HISTORIAL */}
          {activeTab === 'devoluciones' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                <h3 style={{ margin: 0, color: '#00adef', fontWeight: 'bold' }}>Histórico de Ventas de Accesorios</h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: 12, border: '1px solid #90caf9' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#00adef', fontWeight: 'bold', marginBottom: 8 }}>Desde Fecha</div>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ border: 'none', background: 'white', padding: '8px 12px', borderRadius: 6, outline: 'none', fontSize: 13, color: '#00adef', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: 12, border: '1px solid #90caf9' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#00adef', fontWeight: 'bold', marginBottom: 8 }}>Hasta Fecha</div>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ border: 'none', background: 'white', padding: '8px 12px', borderRadius: 6, outline: 'none', fontSize: 13, color: '#00adef', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ background: '#e8f5e9', padding: '16px', borderRadius: 12, border: '1px solid #c8e6c9' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#2e7d32', fontWeight: 'bold', marginBottom: 8 }}>Total Facturado (IVA inc.)</div>
                    <div style={{ fontSize: 22, fontWeight: '900', color: '#2e7d32' }}>
                      {formatMoney(
                        sales
                          .filter((s) => s.estado === 'COMPLETADA' && (!dateFrom || new Date(s.fechaVenta) >= new Date(dateFrom)) && (!dateTo || new Date(s.fechaVenta) <= new Date(dateTo + 'T23:59:59')))
                          .reduce((acc, s) => acc + s.importeTotal, 0)
                      )}
                    </div>
                  </div>
                  <div style={{ background: '#f0f4f8', padding: '16px', borderRadius: 12, border: '1px solid #cfd8dc' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#37474f', fontWeight: 'bold', marginBottom: 8 }}>Ganancias (sin IVA)</div>
                    <div style={{ fontSize: 22, fontWeight: '900', color: '#37474f' }}>
                      {formatMoney(
                        sales
                          .filter((s) => s.estado === 'COMPLETADA' && (!dateFrom || new Date(s.fechaVenta) >= new Date(dateFrom)) && (!dateTo || new Date(s.fechaVenta) <= new Date(dateTo + 'T23:59:59')))
                          .reduce((acc, s) => {
                            try {
                              const list = JSON.parse(s.listaProductos)
                              const cost = list.reduce((cAcc: number, item: any) => cAcc + (item.coste * item.cantidad), 0)
                              return acc + ((s.importeTotal / 1.21) - cost)
                            } catch (e) {
                              return acc
                            }
                          }, 0)
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="ms-table-wrapper">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: '#e3f2fd', color: '#00adef' }}>
                      <th style={{ padding: 12, borderRadius: '8px 0 0 8px' }}>Fecha / Factura</th>
                      <th style={{ padding: 12 }}>Tienda / Vendedor</th>
                      <th style={{ padding: 12 }}>Cliente</th>
                      <th style={{ padding: 12 }}>Productos Vendidos</th>
                      <th style={{ padding: 12, textAlign: 'right' }}>Importe Total</th>
                      <th style={{ padding: 12 }}>Pago</th>
                      <th style={{ padding: 12 }}>Estado</th>
                      <th style={{ padding: 12, borderRadius: '0 8px 8px 0', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales
                      .filter((s) => {
                        const dateVal = new Date(s.fechaVenta)
                        const matchesDate =
                          (!dateFrom || dateVal >= new Date(dateFrom)) &&
                          (!dateTo || dateVal <= new Date(dateTo + 'T23:59:59'))
                        const matchesText =
                          (s.nombreCliente || '').toLowerCase().includes(searchSales.toLowerCase()) ||
                          (s.nifCliente || '').toLowerCase().includes(searchSales.toLowerCase()) ||
                          (s.vendedor || '').toLowerCase().includes(searchSales.toLowerCase()) ||
                          (s.estado || '').toLowerCase().includes(searchSales.toLowerCase()) ||
                          (s.numeroFactura ? s.numeroFactura.toString() : '').includes(searchSales)
                        return matchesDate && matchesText
                      })
                      .map((s) => {
                        const isDev = s.estado === 'DEVUELTA'
                        const items = JSON.parse(s.listaProductos || '[]')
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid #eee', background: isDev ? '#ffebee' : 'transparent' }}>
                            <td style={{ padding: 12 }}>
                              <div style={{ fontWeight: 'bold' }}>#{s.numeroFactura || '---'}</div>
                              <div style={{ fontSize: 11, color: '#666' }}>{new Date(s.fechaVenta).toLocaleString()}</div>
                            </td>
                            <td style={{ padding: 12 }}>
                              <div style={{ fontWeight: 'bold', color: '#00adef' }}>{s.tienda}</div>
                              <div style={{ fontSize: 11, color: '#666' }}>Vend.: {s.vendedor}</div>
                            </td>
                            <td style={{ padding: 12 }}>
                              <div style={{ fontWeight: 'bold' }}>{s.nombreCliente}</div>
                              <div style={{ fontSize: 11, color: '#666' }}>NIF: {s.nifCliente}</div>
                            </td>
                            <td style={{ padding: 12, color: '#444' }}>
                              {items.map((i: any, idx: number) => (
                                <div key={idx} style={{ fontSize: 12 }}>
                                  {i.cantidad}x {i.nombre}
                                  {i.cantidadDevuelta > 0 && (
                                    <span style={{ color: '#c62828', fontSize: 11, marginLeft: 4 }}>
                                      (-{i.cantidadDevuelta} devueltos)
                                    </span>
                                  )}
                                </div>
                              ))}
                            </td>
                            <td style={{ padding: 12, textAlign: 'right', fontWeight: 'bold', color: isDev ? '#c62828' : '#333' }}>
                              {formatMoney(s.importeTotal)}
                            </td>
                            <td style={{ padding: 12, fontSize: 12, fontWeight: 500 }}>
                              {s.metodoPago === 'Tarjeta' ? '💳 Tarjeta' : '💵 Efectivo'}
                            </td>
                            <td style={{ padding: 12 }}>
                              {s.estado === 'DEVUELTA' && <span style={{ background: '#ffebee', color: '#c62828', padding: '3px 6px', borderRadius: 4, fontSize: 10, fontWeight: 'bold' }}>DEVUELTA</span>}
                              {s.estado === 'DEVOLUCION_PARCIAL' && <span style={{ background: '#fff3e0', color: '#e65100', padding: '3px 6px', borderRadius: 4, fontSize: 10, fontWeight: 'bold' }}>PARCIAL</span>}
                              {s.estado === 'COMPLETADA' && <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 6px', borderRadius: 4, fontSize: 10, fontWeight: 'bold' }}>COMPLETADA</span>}
                              {s.motivoDevolucion && <div style={{ fontSize: 10, color: '#c62828', marginTop: 4 }}>Motivo: {s.motivoDevolucion}</div>}
                            </td>
                            <td style={{ padding: 12, textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                <button onClick={() => setPrintModalSale(s)} style={{ background: '#e3f2fd', color: '#00adef', border: 'none', padding: '6px', borderRadius: 4, cursor: 'pointer' }} title="Imprimir Ticket/Factura"><Printer size={14} /></button>
                                {s.estado !== 'DEVUELTA' && (
                                  <button onClick={() => handleReturnClick(s)} style={{ background: 'transparent', border: '1px solid #c62828', color: '#c62828', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>
                                    Devolver
                                  </button>
                                )}
                                <button onClick={() => handleDeleteSale(s.id)} style={{ background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer', padding: 4 }}><Trash2 size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    {sales.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#888' }}>No hay ventas registradas.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: TRAZABILIDAD */}
          {activeTab === 'trazabilidad' && (
            <div>
              <div style={{ marginTop: 20, background: 'white', padding: 24, borderRadius: 12, border: '1px solid #eee' }}>
                <h3 style={{ color: '#00adef', fontWeight: 'bold', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowLeftRight size={20} /> Historial de Traspasos de Stock (Trazabilidad)
                </h3>
                <div className="ms-table-wrapper">
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#e0f7fa', color: '#006064' }}>
                        <th style={{ padding: 10, borderRadius: '8px 0 0 8px' }}>Fecha</th>
                        <th style={{ padding: 10 }}>Producto</th>
                        <th style={{ padding: 10, textAlign: 'center' }}>Origen</th>
                        <th style={{ padding: 10, textAlign: 'center' }}>Destino</th>
                        <th style={{ padding: 10, textAlign: 'center' }}>Cantidad</th>
                        <th style={{ padding: 10, borderRadius: '0 8px 8px 0' }}>Traspasado Por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.filter((t) => t.origen === selectedTienda || t.destino === selectedTienda).length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No se han realizado traspasos para esta tienda aún.</td>
                        </tr>
                      ) : (
                        transfers
                          .filter((t) => t.origen === selectedTienda || t.destino === selectedTienda)
                          .map((t) => (
                            <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: 10, color: '#666' }}>{new Date(t.fecha).toLocaleString()}</td>
                              <td style={{ padding: 10, fontWeight: 'bold' }}>{t.product?.nombre || 'Desconocido'}</td>
                              <td style={{ padding: 10, textAlign: 'center' }}>
                                <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{t.origen === 'O2' ? 'Movilfree' : t.origen}</span>
                              </td>
                              <td style={{ padding: 10, textAlign: 'center' }}>
                                <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{t.destino === 'O2' ? 'Movilfree' : t.destino}</span>
                              </td>
                              <td style={{ padding: 10, textAlign: 'center', fontWeight: 'bold' }}>{t.cantidad} ud.</td>
                              <td style={{ padding: 10 }}>{t.vendedor}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* PAYMENT MODAL */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: 30, borderRadius: 16, width: 400, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#00adef', fontWeight: 'bold' }}>Método de Pago</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', background: paymentMethod === 'Efectivo' ? '#e3f2fd' : 'transparent', borderColor: paymentMethod === 'Efectivo' ? '#00adef' : '#ddd' }}>
                <input type="radio" name="paymethod" checked={paymentMethod === 'Efectivo'} onChange={() => setPaymentMethod('Efectivo')} />
                <span style={{ fontWeight: 'bold', color: '#00adef' }}>💵 Efectivo (Afecta caja física)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', background: paymentMethod === 'Tarjeta' ? '#e3f2fd' : 'transparent', borderColor: paymentMethod === 'Tarjeta' ? '#00adef' : '#ddd' }}>
                <input type="radio" name="paymethod" checked={paymentMethod === 'Tarjeta'} onChange={() => setPaymentMethod('Tarjeta')} />
                <span style={{ fontWeight: 'bold', color: '#00adef' }}>💳 Tarjeta (Solo registro sin balance)</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleCheckout} style={{ flex: 1, background: '#00adef', color: 'white', border: 'none', padding: 12, borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>Cobrar</button>
              <button onClick={() => setShowPaymentModal(false)} style={{ flex: 1, background: '#ccc', color: '#333', border: 'none', padding: 12, borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT TICKET MODAL */}
      {printModalSale && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: 30, borderRadius: 16, width: 450, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 60, height: 60, background: '#e3f2fd', color: '#00adef', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <Printer size={32} />
            </div>
            <h2 style={{ margin: 0, color: '#00adef', fontWeight: 'bold' }}>¡Venta Completada!</h2>
            <p style={{ color: '#555', margin: '8px 0 24px 0', fontSize: 14 }}>Factura de accesorios simplificada #{printModalSale.numeroFactura || '---'}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              <button onClick={() => window.open(`/microshop-accesorios/print/${printModalSale.id}?type=ticket`, '_blank')} style={{ padding: 12, borderRadius: 8, border: '1px solid #00adef', background: 'white', color: '#00adef', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Printer size={16} /> Imprimir Ticket Térmico
              </button>
              <button onClick={() => window.open(`/microshop-accesorios/print/${printModalSale.id}?type=factura`, '_blank')} style={{ padding: 12, borderRadius: 8, border: '1px solid #00adef', background: 'white', color: '#00adef', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Printer size={16} /> Imprimir Factura A4 (PDF)
              </button>
            </div>

            <button 
              onClick={() => {
                setPrintModalSale(null)
                // Redirect back to Nueva Venta after POS sale completes and print window is dismissed
                router.push('/nueva-venta')
              }} 
              style={{ width: '100%', background: '#00adef', color: 'white', border: 'none', padding: 12, borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              Cerrar y Volver a Nueva Venta <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STOCK TRANSFER MODAL */}
      {transferProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: 30, borderRadius: 16, width: 450, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#00adef', fontWeight: 'bold' }}>Traspasar Stock entre Tiendas</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 13, color: '#555' }}>
              Producto: <strong>{transferProduct.nombre}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Tienda Origen</label>
                {isGlobalUser ? (
                  <select value={transferOrigen} onChange={(e) => { setTransferOrigen(e.target.value); setTransferQty(1); }} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }}>
                    {Object.keys(TIENDAS_COMERCIALES).map((t) => (
                      <option key={t} value={t}>{t === 'O2' ? 'Movilfree' : t}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" readOnly value={transferOrigen === 'O2' ? 'Movilfree' : transferOrigen} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', marginTop: 4, background: '#f5f5f5' }} />
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Tienda Destino</label>
                <select value={transferDestino} onChange={(e) => setTransferDestino(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }}>
                  {Object.keys(TIENDAS_COMERCIALES)
                    .filter((t) => t !== transferOrigen)
                    .map((t) => (
                      <option key={t} value={t}>{t === 'O2' ? 'Movilfree' : t}</option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Cantidad a Traspasar (Max: {getStock(transferProduct, transferOrigen)})</label>
                <input 
                  type="number" 
                  min="1" 
                  max={getStock(transferProduct, transferOrigen)}
                  value={transferQty} 
                  onChange={(e) => setTransferQty(Math.min(getStock(transferProduct, transferOrigen), Math.max(1, parseInt(e.target.value) || 1)))} 
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={submitTransfer} disabled={getStock(transferProduct, transferOrigen) <= 0} style={{ flex: 1, background: '#00adef', color: 'white', border: 'none', padding: 12, borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', opacity: getStock(transferProduct, transferOrigen) <= 0 ? 0.5 : 1 }}>Traspasar Stock</button>
              <button onClick={() => setTransferProduct(null)} style={{ flex: 1, background: '#ccc', color: '#333', border: 'none', padding: 12, borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN MODAL */}
      {returnModalSale && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: 30, borderRadius: 16, width: 450, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#00adef', fontWeight: 'bold' }}>Procesar Devolución (Factura #{returnModalSale.numeroFactura})</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 13, color: '#555' }}>
              Selecciona las cantidades a devolver. El stock se ingresará de vuelta en la tienda <strong>{returnModalSale.tienda}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {JSON.parse(returnModalSale.listaProductos || '[]').map((item: any) => {
                const maxReturnable = item.cantidad - (item.cantidadDevuelta || 0)
                return (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                    <div style={{ flex: 1, fontSize: 13 }}>
                      <strong>{item.nombre}</strong>
                      <div style={{ fontSize: 11, color: '#666' }}>Vendidos: {item.cantidad} &nbsp;|&nbsp; Devueltos: {item.cantidadDevuelta || 0}</div>
                    </div>
                    {maxReturnable > 0 ? (
                      <input 
                        type="number" 
                        min="0" 
                        max={maxReturnable} 
                        value={returnQty[item.id] || 0} 
                        onChange={(e) => setReturnQty({ ...returnQty, [item.id]: Math.min(maxReturnable, Math.max(0, parseInt(e.target.value) || 0)) })} 
                        style={{ width: 50, padding: 6, textAlign: 'center' }} 
                      />
                    ) : (
                      <span style={{ fontSize: 11, color: '#c62828', fontWeight: 'bold' }}>Todo Devuelto</span>
                    )}
                  </div>
                )
              })}

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Motivo de la Devolución</label>
                <input type="text" placeholder="Ej: Defectuoso, Cambio..." value={returnReason} onChange={(e) => setReturnReason(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={submitPartialReturn} style={{ flex: 1, background: '#00adef', color: 'white', border: 'none', padding: 12, borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', fontSize: 12 }}>Devolución Parcial</button>
              <button onClick={submitFullReturn} style={{ flex: 1, background: '#c62828', color: 'white', border: 'none', padding: 12, borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', fontSize: 12 }}>Devolver Todo</button>
              <button onClick={() => setReturnModalSale(null)} style={{ background: '#ccc', color: '#333', border: 'none', padding: 12, borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
