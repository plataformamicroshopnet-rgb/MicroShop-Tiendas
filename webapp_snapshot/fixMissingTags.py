import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the header and catalog section
fixed_header_and_catalog = """        {/* HEADER */}
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
                  ))}"""

content = re.sub(
    r"        \{\/\* HEADER \*\/\}.*?(\s*\{products\.filter.*?\.length === 0)",
    fixed_header_and_catalog + r"\1",
    content,
    flags=re.DOTALL
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed JSX missing opening tag")
