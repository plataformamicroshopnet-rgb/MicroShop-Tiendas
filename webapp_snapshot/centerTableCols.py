import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. THEAD
old_thead = """                  <tr style={{ background: lightPink, color: fuchsia }}>
                    <th style={{ padding: 10, borderRadius: '8px 0 0 8px', width: 'auto' }}>Producto</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap' }}>Categoría</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap' }}>Coste</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap' }}>Precio (s/IVA)</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap' }}>P.V.P (c/IVA)</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap' }}>Ganancia</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap' }}>IMEI</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap' }}>Stock</th>
                    <th style={{ padding: 10, borderRadius: '0 8px 8px 0', textAlign: 'center', width: '1%', whiteSpace: 'nowrap' }}>Acciones</th>
                  </tr>"""
new_thead = """                  <tr style={{ background: lightPink, color: fuchsia }}>
                    <th style={{ padding: 10, borderRadius: '8px 0 0 8px', width: 'auto' }}>Producto</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Categoría</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Coste</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Precio (s/IVA)</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>P.V.P (c/IVA)</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Ganancia</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>IMEI</th>
                    <th style={{ padding: 10, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>Stock</th>
                    <th style={{ padding: 10, borderRadius: '0 8px 8px 0', textAlign: 'center', width: '1%', whiteSpace: 'nowrap' }}>Acciones</th>
                  </tr>"""
content = content.replace(old_thead, new_thead)


# 2. VIEW BLOCK
old_view_block = """                        <>
                          <td style={{ padding: 10, fontWeight: 'bold' }}>{p.nombre}</td>
                          <td style={{ padding: 10, color: '#666', whiteSpace: 'nowrap' }}>
                            <span style={{ background: '#eee', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>{p.categoria}</span>
                          </td>
                          <td style={{ padding: 10, color: '#888', whiteSpace: 'nowrap' }}>{formatMoney(p.coste)}</td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap' }}>{formatMoney(p.precio)}</td>
                          <td style={{ padding: 10, fontWeight: 'bold', color: fuchsia, whiteSpace: 'nowrap' }}>{formatMoney(p.precio * 1.21)}</td>
                          <td style={{ padding: 10, fontWeight: 'bold', color: '#276749', whiteSpace: 'nowrap' }}>{formatMoney(p.precio - p.coste)}</td>
                          <td style={{ padding: 10, color: '#555', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{p.imei || '-'}</td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>"""
new_view_block = """                        <>
                          <td style={{ padding: 10, fontWeight: 'bold' }}>{p.nombre}</td>
                          <td style={{ padding: 10, color: '#666', whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <span style={{ background: '#eee', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>{p.categoria}</span>
                          </td>
                          <td style={{ padding: 10, color: '#888', whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney(p.coste)}</td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney(p.precio)}</td>
                          <td style={{ padding: 10, fontWeight: 'bold', color: fuchsia, whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney(p.precio * 1.21)}</td>
                          <td style={{ padding: 10, fontWeight: 'bold', color: '#276749', whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney(p.precio - p.coste)}</td>
                          <td style={{ padding: 10, color: '#555', fontSize: 13, fontFamily: 'monospace', whiteSpace: 'nowrap', textAlign: 'center' }}>{p.imei || '-'}</td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>"""
content = content.replace(old_view_block, new_view_block)


# 3. EDIT BLOCK
old_edit_block = """                        <>
                          <td style={{ padding: 10 }}><input value={editProdData?.nombre || ''} onChange={e => setEditProdData({...editProdData, nombre: e.target.value})} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
                            <select value={editProdData?.categoria || ''} onChange={e => setEditProdData({...editProdData, categoria: e.target.value})} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }}>
                              <option>Terminal</option><option>Accesorio</option><option>Servicio</option><option>Reparación</option>
                            </select>
                          </td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap' }}><input type="number" value={editProdData?.coste || 0} onChange={e => setEditProdData({...editProdData, coste: Number(e.target.value)})} style={{ width: 70, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap' }}><input type="number" value={editProdData?.precio || 0} onChange={e => setEditProdData({...editProdData, precio: Number(e.target.value)})} style={{ width: 70, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 10, fontWeight: 'bold', color: fuchsia, whiteSpace: 'nowrap' }}>{formatMoney((editProdData?.precio || 0) * 1.21)}</td>
                          <td style={{ padding: 10, fontWeight: 'bold', color: '#276749', whiteSpace: 'nowrap' }}>{formatMoney((editProdData?.precio || 0) - (editProdData?.coste || 0))}</td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap' }}><input value={editProdData?.imei || ''} maxLength={15} onChange={e => setEditProdData({...editProdData, imei: e.target.value.replace(/\D/g,'')})} style={{ width: 110, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap' }}><input type="number" value={editProdData?.stock || 0} onChange={e => setEditProdData({...editProdData, stock: Number(e.target.value)})} style={{ width: 50, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>"""
new_edit_block = """                        <>
                          <td style={{ padding: 10 }}><input value={editProdData?.nombre || ''} onChange={e => setEditProdData({...editProdData, nombre: e.target.value})} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <select value={editProdData?.categoria || ''} onChange={e => setEditProdData({...editProdData, categoria: e.target.value})} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none' }}>
                              <option>Terminal</option><option>Accesorio</option><option>Servicio</option><option>Reparación</option>
                            </select>
                          </td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}><input type="number" value={editProdData?.coste || 0} onChange={e => setEditProdData({...editProdData, coste: Number(e.target.value)})} style={{ width: 70, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none', textAlign: 'center' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}><input type="number" value={editProdData?.precio || 0} onChange={e => setEditProdData({...editProdData, precio: Number(e.target.value)})} style={{ width: 70, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none', textAlign: 'center' }} /></td>
                          <td style={{ padding: 10, fontWeight: 'bold', color: fuchsia, whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney((editProdData?.precio || 0) * 1.21)}</td>
                          <td style={{ padding: 10, fontWeight: 'bold', color: '#276749', whiteSpace: 'nowrap', textAlign: 'center' }}>{formatMoney((editProdData?.precio || 0) - (editProdData?.coste || 0))}</td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}><input value={editProdData?.imei || ''} maxLength={15} onChange={e => setEditProdData({...editProdData, imei: e.target.value.replace(/\D/g,'')})} style={{ width: 110, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none', textAlign: 'center', fontSize: 13, fontFamily: 'monospace' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}><input type="number" value={editProdData?.stock || 0} onChange={e => setEditProdData({...editProdData, stock: Number(e.target.value)})} style={{ width: 50, padding: 6, borderRadius: 4, border: '1px solid #E91E97', outline: 'none', textAlign: 'center' }} /></td>
                          <td style={{ padding: 10, whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>"""
content = content.replace(old_edit_block, new_edit_block)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied 2px font increase to IMEI and centered the columns")
