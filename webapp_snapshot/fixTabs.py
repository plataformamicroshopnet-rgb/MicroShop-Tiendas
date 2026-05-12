import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken div closure
old_tabs_end = """          </button>
        </div>

        {/* CONTENIDO TABS */}"""

new_tabs_end = """          </button>
          </div>

          <div style={{ position: 'relative', width: '450px' }}>
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

        {/* CONTENIDO TABS */}"""

content = content.replace(old_tabs_end, new_tabs_end)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed tabs block closure")
