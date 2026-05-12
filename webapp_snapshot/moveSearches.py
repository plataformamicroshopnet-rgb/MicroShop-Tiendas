import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. TABS container update
old_tabs_start = """        {/* TABS */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>"""

new_tabs_start = """        {/* TABS & SEARCH */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 16 }}>"""

old_tabs_end = """          </button>
        </div>

        {/* CONTENIDO PRINCIPAL */}"""

new_tabs_end = """          </button>
          </div>

          <div style={{ position: 'relative', width: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: 13, color: activeTab === 'devoluciones' ? '#0284c7' : '#888' }} />
            {activeTab === 'ventas' && (
              <input placeholder="Buscar producto en Punto de Venta..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid #ddd', fontSize: 14, background: 'white' }} />
            )}
            {activeTab === 'productos' && (
              <input placeholder="Buscar producto en Inventario..." value={searchInvProducts} onChange={e=>setSearchInvProducts(e.target.value)} style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid #ddd', fontSize: 14, background: 'white' }} />
            )}
            {activeTab === 'clientes' && (
              <input placeholder="Buscar cliente por NIF o Nombre..." value={searchClients} onChange={e=>setSearchClients(e.target.value)} style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid #ddd', fontSize: 14, background: 'white' }} />
            )}
            {activeTab === 'devoluciones' && (
              <input placeholder="Buscar venta (NIF, Factura, Vendedor, Estado)..." value={searchSales} onChange={e=>setSearchSales(e.target.value)} style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 14 }} />
            )}
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}"""

content = content.replace(old_tabs_start, new_tabs_start)
content = content.replace(old_tabs_end, new_tabs_end)

# 2. Remove the old search inputs
# Remove Ventas Search
ventas_search = """                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} color="#888" style={{ position: 'absolute', left: 10, top: 10 }} />
                      <input 
                        placeholder="Buscar producto..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        style={{ padding: '8px 8px 8px 32px', borderRadius: 8, border: '1px solid #ddd' }} 
                      />
                    </div>
                    <select value={searchCategory} onChange={e => setSearchCategory(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd', background: 'white' }}>
                      <option>Todas</option>
                      <option>Terminal</option>
                      <option>Accesorio</option>
                      <option>Servicio</option>
                    </select>
                  </div>"""

ventas_search_replacement = """                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={searchCategory} onChange={e => setSearchCategory(e.target.value)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #ddd', background: 'white', fontWeight: 'bold', color: '#555' }}>
                      <option>Todas las categorías</option>
                      <option>Terminal</option>
                      <option>Accesorio</option>
                      <option>Servicio</option>
                    </select>
                  </div>"""

content = content.replace(ventas_search, ventas_search_replacement)


# Remove the double search blocks inside Clientes tab
double_search = """              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: '#333' }}>Listado de Productos</h3>
                <div style={{ position: 'relative', width: '300px' }}>
                  <Search size={18} style={{ position: 'absolute', left: 10, top: 10, color: '#888' }} />
                  <input placeholder="Buscar producto..." value={searchInvProducts} onChange={e=>setSearchInvProducts(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid #ddd' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: '#333' }}>Listado de Clientes</h3>
                <div style={{ position: 'relative', width: '300px' }}>
                  <Search size={18} style={{ position: 'absolute', left: 10, top: 10, color: '#888' }} />
                  <input placeholder="Buscar por NIF/CIF..." value={searchClients} onChange={e=>setSearchClients(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid #ddd' }} />
                </div>
              </div>"""

content = content.replace(double_search, """              <h3 style={{ margin: 0, color: '#333', marginBottom: 16 }}>Listado de Clientes</h3>""")


# Remove search Sales from Devoluciones
devoluciones_search = """                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: '#333' }}>Histórico de Ventas</h3>
                  <div style={{ position: 'relative', width: '400px' }}>
                    <Search size={18} style={{ position: 'absolute', left: 10, top: 10, color: '#888' }} />
                    <input placeholder="Buscar por cliente, NIF, vendedor o nº factura..." value={searchSales} onChange={e=>setSearchSales(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1' }} />
                  </div>
                </div>"""

content = content.replace(devoluciones_search, """                <h3 style={{ margin: 0, color: '#333' }}>Histórico de Ventas</h3>""")


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Moved search bars to tab header")
