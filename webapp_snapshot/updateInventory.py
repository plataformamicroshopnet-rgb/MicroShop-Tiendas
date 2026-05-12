import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the newProd inputs for Category
new_inputs = """
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
"""

content = re.sub(
    r"<div style=\{\{ display: 'flex', gap: 16, marginBottom: 24, background: '#f8f9fa', padding: 16, borderRadius: 12 \}\}>.*?</button>\s*</div>",
    new_inputs,
    content,
    flags=re.DOTALL
)

# Also update the Table headers and content for Products
new_table_headers = """
                  <tr style={{ background: lightPink, color: fuchsia }}>
                    <th style={{ padding: 12, borderRadius: '8px 0 0 8px' }}>Producto</th>
                    <th style={{ padding: 12 }}>Categoría</th>
                    <th style={{ padding: 12 }}>Coste</th>
                    <th style={{ padding: 12 }}>Precio (s/IVA)</th>
                    <th style={{ padding: 12 }}>P.V.P (c/IVA)</th>
                    <th style={{ padding: 12 }}>Ganancia</th>
                    <th style={{ padding: 12, borderRadius: '0 8px 8px 0' }}>Stock (Uds)</th>
                  </tr>
"""
content = re.sub(
    r"<tr style=\{\{ background: lightPink, color: fuchsia \}\}>.*?<th style=\{\{ padding: 12, borderRadius: '0 8px 8px 0' \}\}>Stock \(Uds\)</th>\s*</tr>",
    new_table_headers,
    content,
    flags=re.DOTALL
)

new_table_row = """
                      <td style={{ padding: 12, fontWeight: 'bold' }}>{p.nombre}</td>
                      <td style={{ padding: 12, color: '#666' }}>
                        <span style={{ background: '#eee', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>{p.categoria}</span>
                      </td>
                      <td style={{ padding: 12, color: '#888' }}>{formatMoney(p.coste)}</td>
                      <td style={{ padding: 12 }}>{formatMoney(p.precio)}</td>
                      <td style={{ padding: 12, fontWeight: 'bold', color: fuchsia }}>{formatMoney(p.precio * 1.21)}</td>
                      <td style={{ padding: 12, fontWeight: 'bold', color: '#276749' }}>{formatMoney(p.precio - p.coste)}</td>
                      <td style={{ padding: 12 }}>
"""
content = re.sub(
    r"<td style=\{\{ padding: 12, fontWeight: 'bold' \}\}>\{p\.nombre\}</td>.*?<td style=\{\{ padding: 12 \}\}>\s*<div style=\{\{ display: 'flex', alignItems: 'center', gap: 12 \}\}>",
    new_table_row + "                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>",
    content,
    flags=re.DOTALL
)

# Fix Category Default
content = content.replace("categoria: 'Accesorios'", "categoria: 'Accesorio'")

# Fix API cost and category on new sale payload mapping? No, Sales doesn't need to show cost right now, 
# but wait, the Cart shows PVP (con IVA) usually to the client!
# In "Catálogo de Productos", we should show the PVP (con IVA).
content = content.replace(
    "<div style={{ color: fuchsia, fontWeight: 900, fontSize: 18 }}>{formatMoney(p.precio)}</div>",
    "<div style={{ color: fuchsia, fontWeight: 900, fontSize: 18 }}>{formatMoney(p.precio * 1.21)} <span style={{fontSize: 10, color: '#888', fontWeight: 'normal'}}>PVP</span></div>"
)

# And in Cart, the calculation should be based on PVP?
# The database sale saves `importeTotal`. If they sell it to public, it's with IVA.
content = content.replace(
    "formatMoney(c.product.precio * c.cantidad)",
    "formatMoney(c.product.precio * 1.21 * c.cantidad)"
)
content = content.replace(
    "{formatMoney(c.product.precio)}",
    "{formatMoney(c.product.precio * 1.21)}"
)
content = content.replace(
    "acc + (item.product.precio * item.cantidad)",
    "acc + (item.product.precio * 1.21 * item.cantidad)"
)
content = content.replace(
    "a + (b.product.precio * b.cantidad)",
    "a + (b.product.precio * 1.21 * b.cantidad)"
)

# Wait, if we change the payload to `precio: c.product.precio * 1.21`, we should do that so the database registers the PVP.
content = content.replace(
    "precio: c.product.precio",
    "precio: c.product.precio * 1.21"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Inventory UI")
