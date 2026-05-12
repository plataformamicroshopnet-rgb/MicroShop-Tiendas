import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add states
if 'showPasteModal' not in content:
    content = content.replace(
        "const [newProd, setNewProd] = useState({ nombre: '', categoria: 'Terminal', coste: 0, precio: 0, stock: 1 })",
        "const [newProd, setNewProd] = useState({ nombre: '', categoria: 'Terminal', coste: 0, precio: 0, stock: 1 })\n  const [showPasteModal, setShowPasteModal] = useState(false)\n  const [pasteText, setPasteText] = useState('')"
    )

# 2. Add handleBulkPaste right before handleCreateProduct
if 'handleBulkPaste' not in content:
    bulk_paste = """  const handleBulkPaste = async () => {
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
  }

  const handleCreateProduct = async () => {"""
    
    content = content.replace("  const handleCreateProduct = async () => {", bulk_paste)

# 3. Replace the add button with the dual buttons
if 'Excel 📋' not in content:
    content = re.sub(
        r"<button onClick=\{handleCreateProduct\} style=\{\{ background: fuchsia, color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40 \}\}>A.*?adir<\/button>",
        """<div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleCreateProduct} style={{ background: fuchsia, color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Añadir</button>
                  <button onClick={() => setShowPasteModal(true)} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Excel 📋</button>
                </div>""",
        content
    )

# 4. Insert Modal specifically right after the end of the form grid
if 'Importar desde Excel' not in content:
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
    content = content.replace("Excel 📋</button>\n                </div>\n              </div>", "Excel 📋</button>\n                </div>\n              </div>\n" + paste_modal)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Properly added Bulk Excel Paste")
