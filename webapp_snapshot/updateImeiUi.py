import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update newProd state
content = content.replace(
    "const [newProd, setNewProd] = useState({ nombre: '', categoria: 'Accesorio', precio: 0, coste: 0, stock: 0 })",
    "const [newProd, setNewProd] = useState({ nombre: '', categoria: 'Accesorio', precio: 0, coste: 0, stock: 0, imei: '' })"
)
content = content.replace(
    "setNewProd({ nombre: '', categoria: 'Accesorio', precio: 0, coste: 0, stock: 0 })",
    "setNewProd({ nombre: '', categoria: 'Accesorio', precio: 0, coste: 0, stock: 0, imei: '' })"
)

# 2. Update handleBulkPaste
old_bulk = "stock: parseInt((cols[5] || '1'), 10) || 1\n      }"
new_bulk = "stock: parseInt((cols[5] || '1'), 10) || 1,\n        imei: cols[6] ? cols[6].trim() : ''\n      }"
content = content.replace(old_bulk, new_bulk)

old_paste_placeholder = "placeholder=\"Ejemplo:&#10;Funda Silicona&#9;Accesorio&#9;2,50&#9;5,00&#9;6,05&#9;10\""
new_paste_placeholder = "placeholder=\"Ejemplo:&#10;Funda Silicona&#9;Accesorio&#9;2,50&#9;5,00&#9;6,05&#9;10&#9;123456789012345\""
content = content.replace(old_paste_placeholder, new_paste_placeholder)

old_paste_text = "<strong>Nombre, Categora, Coste, Precio, PVP, Stock</strong>"
new_paste_text = "<strong>Nombre, Categora, Coste, Precio, PVP, Stock, IMEI</strong>"
content = content.replace(old_paste_text, new_paste_text)

# 3. Update top creation form grid
content = content.replace(
    "gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr auto'",
    "gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 1.2fr auto'"
)

# Insert the IMEI input right before the buttons div
old_buttons_div = """                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleCreateProduct} style={{ background: fuchsia, color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Aadir</button>"""

new_imei_input = """                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>IMEI</label>
                  <input placeholder="Opcional (15 dgitos)" maxLength={15} value={newProd.imei || ''} onChange={e=>setNewProd({...newProd, imei: e.target.value.replace(/\D/g,'')})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleCreateProduct} style={{ background: fuchsia, color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Aadir</button>"""
content = content.replace(old_buttons_div, new_imei_input)

# 4. Update the Table structure in TAB: PRODUCTOS
content = content.replace(
    "<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>",
    "<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>"
)

# Replace the thead for Productos table
old_thead = """                  <tr style={{ background: lightPink, color: fuchsia }}>
                    <th style={{ padding: 12, borderRadius: '8px 0 0 8px' }}>Producto</th>
                    <th style={{ padding: 12 }}>Categora</th>
                    <th style={{ padding: 12 }}>Coste</th>
                    <th style={{ padding: 12 }}>Precio (s/IVA)</th>
                    <th style={{ padding: 12 }}>P.V.P (c/IVA)</th>
                    <th style={{ padding: 12 }}>Ganancia</th>
                    <th style={{ padding: 12 }}>Stock (Uds)</th>
                    <th style={{ padding: 12, borderRadius: '0 8px 8px 0', textAlign: 'center' }}>Acciones</th>
                  </tr>"""

new_thead = """                  <tr style={{ background: lightPink, color: fuchsia }}>
                    <th style={{ padding: 8, borderRadius: '8px 0 0 8px' }}>Producto</th>
                    <th style={{ padding: 8 }}>Categora</th>
                    <th style={{ padding: 8 }}>Coste</th>
                    <th style={{ padding: 8 }}>Precio (s/IVA)</th>
                    <th style={{ padding: 8 }}>P.V.P (c/IVA)</th>
                    <th style={{ padding: 8 }}>Ganancia</th>
                    <th style={{ padding: 8 }}>IMEI</th>
                    <th style={{ padding: 8 }}>Stock</th>
                    <th style={{ padding: 8, borderRadius: '0 8px 8px 0', textAlign: 'center' }}>Acciones</th>
                  </tr>"""
content = content.replace(old_thead, new_thead)


# Replace the Row mapping blocks
# The edit block:
old_edit_block = """                          <td style={{ padding: 12 }}><input type="number" value={editProdData?.stock || 0} onChange={e => setEditProdData({...editProdData, stock: Number(e.target.value)})} style={{ width: 60, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>"""
new_edit_block = """                          <td style={{ padding: 8 }}><input value={editProdData?.imei || ''} maxLength={15} onChange={e => setEditProdData({...editProdData, imei: e.target.value.replace(/\D/g,'')})} style={{ width: 110, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 8 }}><input type="number" value={editProdData?.stock || 0} onChange={e => setEditProdData({...editProdData, stock: Number(e.target.value)})} style={{ width: 50, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 8 }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>"""
content = content.replace(old_edit_block, new_edit_block)

# Replace padding 12 with padding 8 in edit block
edit_td = """<td style={{ padding: 12 }}><input value={editProdData?.nombre"""
content = content.replace(edit_td, edit_td.replace('padding: 12', 'padding: 8'))
content = content.replace("""<td style={{ padding: 12 }}>
                            <select value={editProdData?.categoria""", """<td style={{ padding: 8 }}>
                            <select value={editProdData?.categoria""")
content = content.replace("""<td style={{ padding: 12 }}><input type="number" value={editProdData?.coste""", """<td style={{ padding: 8 }}><input type="number" value={editProdData?.coste""")
content = content.replace("""<td style={{ padding: 12 }}><input type="number" value={editProdData?.precio""", """<td style={{ padding: 8 }}><input type="number" value={editProdData?.precio""")
content = content.replace("""<td style={{ padding: 12, fontWeight: 'bold', color: fuchsia }}>{formatMoney((editProdData?.precio || 0) * 1.21)}</td>""", """<td style={{ padding: 8, fontWeight: 'bold', color: fuchsia }}>{formatMoney((editProdData?.precio || 0) * 1.21)}</td>""")
content = content.replace("""<td style={{ padding: 12, fontWeight: 'bold', color: '#276749' }}>{formatMoney((editProdData?.precio || 0) - (editProdData?.coste || 0))}</td>""", """<td style={{ padding: 8, fontWeight: 'bold', color: '#276749' }}>{formatMoney((editProdData?.precio || 0) - (editProdData?.coste || 0))}</td>""")

# The view block:
old_view_block = """                          <td style={{ padding: 12, fontWeight: 'bold', color: '#276749' }}>{formatMoney(p.precio - p.coste)}</td>
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <button onClick={() => updateStock(p.id, p.stock - 1)} style={{ width: 28, height: 28, borderRadius: 14, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>-</button>
                              <span style={{ fontWeight: 'bold', width: 20, textAlign: 'center', color: p.stock === 0 ? 'red' : 'inherit' }}>{p.stock}</span>
                              <button onClick={() => updateStock(p.id, p.stock + 1)} style={{ width: 28, height: 28, borderRadius: 14, border: 'none', background: fuchsia, color: 'white', cursor: 'pointer' }}>+</button>
                            </div>
                          </td>
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>"""
new_view_block = """                          <td style={{ padding: 8, fontWeight: 'bold', color: '#276749' }}>{formatMoney(p.precio - p.coste)}</td>
                          <td style={{ padding: 8, color: '#555', fontSize: 11, fontFamily: 'monospace' }}>{p.imei || '-'}</td>
                          <td style={{ padding: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button onClick={() => updateStock(p.id, p.stock - 1)} style={{ width: 24, height: 24, borderRadius: 12, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>-</button>
                              <span style={{ fontWeight: 'bold', width: 16, textAlign: 'center', color: p.stock === 0 ? 'red' : 'inherit' }}>{p.stock}</span>
                              <button onClick={() => updateStock(p.id, p.stock + 1)} style={{ width: 24, height: 24, borderRadius: 12, border: 'none', background: fuchsia, color: 'white', cursor: 'pointer' }}>+</button>
                            </div>
                          </td>
                          <td style={{ padding: 8 }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>"""
content = content.replace(old_view_block, new_view_block)

# Replace padding 12 with padding 8 in view block
content = content.replace("""<td style={{ padding: 12, fontWeight: 'bold' }}>{p.nombre}</td>""", """<td style={{ padding: 8, fontWeight: 'bold' }}>{p.nombre}</td>""")
content = content.replace("""<td style={{ padding: 12, color: '#666' }}>""", """<td style={{ padding: 8, color: '#666' }}>""")
content = content.replace("""<td style={{ padding: 12, color: '#888' }}>{formatMoney(p.coste)}</td>""", """<td style={{ padding: 8, color: '#888' }}>{formatMoney(p.coste)}</td>""")
content = content.replace("""<td style={{ padding: 12 }}>{formatMoney(p.precio)}</td>""", """<td style={{ padding: 8 }}>{formatMoney(p.precio)}</td>""")
content = content.replace("""<td style={{ padding: 12, fontWeight: 'bold', color: fuchsia }}>{formatMoney(p.precio * 1.21)}</td>""", """<td style={{ padding: 8, fontWeight: 'bold', color: fuchsia }}>{formatMoney(p.precio * 1.21)}</td>""")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added IMEI and compacted table")
