import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add search states
search_states = """  const [searchQuery, setSearchQuery] = useState('')
  const [searchCategory, setSearchCategory] = useState('Todas')
"""
content = re.sub(
    r"  const \[newClient, setNewClient\] = useState",
    search_states + "\n  const [newClient, setNewClient] = useState",
    content
)

# Update the Catálogo de Productos header and add filters
new_catalogo_header = """                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ color: fuchsia, margin: 0 }}>Catálogo de Productos</h3>
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
                </div>"""

content = re.sub(
    r"<h3 style=\{\{ color: fuchsia, margin: '0 0 16px 0' \}\}>Catálogo de Productos</h3>",
    new_catalogo_header,
    content
)

# Filter the products in the catalog mapping
content = content.replace(
    "{products.filter(p => p.stock > 0).map(p => (",
    "{products.filter(p => p.stock > 0 && (searchCategory === 'Todas' || p.categoria === searchCategory) && p.nombre.toLowerCase().includes(searchQuery.toLowerCase())).map(p => ("
)
content = content.replace(
    "{products.filter(p => p.stock > 0).length === 0 && <div style={{ color: '#888' }}>No hay productos con stock.</div>}",
    "{products.filter(p => p.stock > 0 && (searchCategory === 'Todas' || p.categoria === searchCategory) && p.nombre.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && <div style={{ color: '#888' }}>No se encontraron productos.</div>}"
)

# Update the Cart to have quantity controls and an input
# We need to change: <div style={{ fontSize: 12, color: '#888' }}>{c.cantidad} uds. x {formatMoney(c.product.precio * 1.21)}</div>
new_cart_item = """                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
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
                        </div>"""

content = re.sub(
    r"<div style=\{\{ fontSize: 12, color: '#888' \}\}>\{c\.cantidad\} uds\. x \{formatMoney\(c\.product\.precio \* 1\.21\)\}</div>",
    new_cart_item,
    content
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated POS with search and cart quantity controls")
