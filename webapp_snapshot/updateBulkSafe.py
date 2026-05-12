import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add states
content = content.replace(
    "const [newProd, setNewProd] = useState({ nombre: '', categoria: 'Terminal', coste: 0, precio: 0, stock: 1 })",
    "const [newProd, setNewProd] = useState({ nombre: '', categoria: 'Terminal', coste: 0, precio: 0, stock: 1 })\n  const [showPasteModal, setShowPasteModal] = useState(false)\n  const [pasteText, setPasteText] = useState('')"
)

# 2. Add handleBulkPaste
bulk_paste = """  const handleCreateProd = async () => {
    if(!newProd.nombre) return
    const res = await fetch('/api/movilfree/products', { method: 'POST', body: JSON.stringify(newProd) })
    const created = await res.json()
    setProducts([created, ...products])
    setNewProd({ nombre: '', categoria: 'Terminal', coste: 0, precio: 0, stock: 1 })
  }

  const handleBulkPaste = async () => {
    if(!pasteText.trim()) return
    const rows = pasteText.split('\\n').filter(r => r.trim() !== '')
    const newProducts = rows.map(r => {
      const cols = r.split('\\t')
      return {
        nombre: cols[0] ? cols[0].trim() : 'Desconocido',
        categoria: cols[1] ? cols[1].trim() : 'Terminal',
        coste: parseFloat((cols[2] || '0').replace(',', '.')) || 0,
        precio: parseFloat((cols[3] || '0').replace(',', '.')) || 0,
        stock: parseInt((cols[5] || '1'), 10) || 1
      }
    })
    
    try {
      const res = await fetch('/api/movilfree/products', { method: 'POST', body: JSON.stringify(newProducts) })
      if (!res.ok) throw new Error('Error al guardar en masa')
      
      const prodsRes = await fetch('/api/movilfree/products')
      const data = await prodsRes.json()
      setProducts(data)
      
      setShowPasteModal(false)
      setPasteText('')
      alert(`¡Se han añadido ${newProducts.length} productos correctamente!`)
    } catch(e: any) {
      alert(e.message)
    }
  }"""

content = re.sub(
    r"  const handleCreateProd = async \(\) => \{.*?setNewProd\(\{ nombre: '', categoria: 'Terminal', coste: 0, precio: 0, stock: 1 \}\)\n  \}",
    bulk_paste,
    content,
    flags=re.DOTALL
)

# 3. Add buttons
old_add_button = """<button onClick={handleCreateProd} style={{ background: '#E91E97', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Añadir al Inventario</button>"""
new_add_button = """<div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleCreateProd} style={{ background: '#E91E97', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Añadir</button>
                  <button onClick={() => setShowPasteModal(true)} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Excel 📋</button>
                </div>"""
content = content.replace(old_add_button, new_add_button)

# 4. Insert Modal specifically in PRODUCTOS tab
paste_modal = """
              {showPasteModal && (
                <div style={{ background: '#e8f5e9', padding: 16, borderRadius: 12, marginBottom: 24, border: '1px solid #4CAF50' }}>
                  <h3 style={{ marginTop: 0, color: '#2e7d32' }}>Importar desde Excel</h3>
                  <p style={{ fontSize: 13, color: '#333' }}>Copia las filas desde tu Excel respetando el orden de estas 6 columnas: <strong>Nombre, Categoría, Coste, Precio, PVP, Stock</strong>. Pégalas aquí:</p>
                  <textarea 
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    style={{ width: '100%', height: 150, padding: 10, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'monospace', whiteSpace: 'pre' }}
                    placeholder="Ejemplo:&#10;Funda Silicona&#9;Accesorio&#9;2,50&#9;5,00&#9;6,05&#9;10"
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button onClick={handleBulkPaste} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Procesar y Guardar</button>
                    <button onClick={() => setShowPasteModal(false)} style={{ background: '#ccc', color: '#333', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}
"""

# Find TAB: PRODUCTOS and insert right after its top div wrapper
tab_productos_start = content.find("{/* TAB: PRODUCTOS */}")
if tab_productos_start != -1:
    search_area = content[tab_productos_start:]
    # find the end of the form grid inside TAB: PRODUCTOS. The form grid ends with </div></div></div>
    # let's just find the first "Añadir" button div end
    add_btn_idx = search_area.find("Excel 📋</button>\n                </div>")
    if add_btn_idx != -1:
        insert_pos = tab_productos_start + add_btn_idx + len("Excel 📋</button>\n                </div>") + 14 # roughly after the next </div>
        # actually let's just replace the exact end of the form container:
        exact_target = "Excel 📋</button>\n                </div>\n              </div>"
        content = content.replace(exact_target, exact_target + paste_modal)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added Bulk Excel Paste functionality securely")
