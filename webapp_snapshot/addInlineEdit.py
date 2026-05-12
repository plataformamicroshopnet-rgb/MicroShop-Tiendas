import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports from lucide-react
import_match = re.search(r"import\s+\{([^}]+)\}\s+from\s+'lucide-react'", content)
if import_match:
    current_imports = import_match.group(1).replace(' ', '').split(',')
    new_imports = set(current_imports + ['Edit2', 'Save', 'Trash2', 'X'])
    content = content.replace(import_match.group(0), f"import {{ {', '.join(new_imports)} }} from 'lucide-react'")

# 2. Add new states and functions right after handleCreateProduct
states_to_add = """  const [editingProductId, setEditingProductId] = useState<string | null>(null)
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
        alert('Error al guardar')
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

  const handleCreateProduct"""

content = content.replace("  const handleCreateProduct", states_to_add)

# 3. Update Table Header
old_header = """                    <th style={{ padding: 12 }}>Ganancia</th>
                    <th style={{ padding: 12, borderRadius: '0 8px 8px 0' }}>Stock (Uds)</th>"""

new_header = """                    <th style={{ padding: 12 }}>Ganancia</th>
                    <th style={{ padding: 12 }}>Stock (Uds)</th>
                    <th style={{ padding: 12, borderRadius: '0 8px 8px 0', textAlign: 'center' }}>Acciones</th>"""
content = content.replace(old_header, new_header)

# 4. Update Table Row
old_row = """                    <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                      
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
                    </tr>"""

new_row = """                    <tr key={p.id} style={{ borderBottom: '1px solid #eee', background: editingProductId === p.id ? '#fdf2f8' : 'transparent' }}>
                      {editingProductId === p.id ? (
                        <>
                          <td style={{ padding: 12 }}><input value={editProdData?.nombre || ''} onChange={e => setEditProdData({...editProdData, nombre: e.target.value})} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 12 }}>
                            <select value={editProdData?.categoria || ''} onChange={e => setEditProdData({...editProdData, categoria: e.target.value})} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }}>
                              <option>Terminal</option><option>Accesorio</option><option>Servicio</option><option>Reparación</option>
                            </select>
                          </td>
                          <td style={{ padding: 12 }}><input type="number" value={editProdData?.coste || 0} onChange={e => setEditProdData({...editProdData, coste: Number(e.target.value)})} style={{ width: 70, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 12 }}><input type="number" value={editProdData?.precio || 0} onChange={e => setEditProdData({...editProdData, precio: Number(e.target.value)})} style={{ width: 70, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 12, fontWeight: 'bold', color: fuchsia }}>{formatMoney((editProdData?.precio || 0) * 1.21)}</td>
                          <td style={{ padding: 12, fontWeight: 'bold', color: '#276749' }}>{formatMoney((editProdData?.precio || 0) - (editProdData?.coste || 0))}</td>
                          <td style={{ padding: 12 }}><input type="number" value={editProdData?.stock || 0} onChange={e => setEditProdData({...editProdData, stock: Number(e.target.value)})} style={{ width: 60, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button onClick={handleSaveEditProduct} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: 8, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Guardar"><Save size={16} /></button>
                              <button onClick={() => { setEditingProductId(null); setEditProdData(null); }} style={{ background: '#f43f5e', color: 'white', border: 'none', padding: 8, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Cancelar"><X size={16} /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
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
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button onClick={() => { setEditingProductId(p.id); setEditProdData({...p}); }} style={{ background: 'white', color: '#0ea5e9', border: '1px solid #e0f2fe', padding: 8, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} title="Editar"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteProduct(p.id)} style={{ background: 'white', color: '#f43f5e', border: '1px solid #ffe4e6', padding: 8, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} title="Borrar"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>"""

content = content.replace(old_row, new_row)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added Inline Edit, Save, and Delete functionality")
