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
      alert(`¡Se han a\u00f1adido ${newProducts.length} productos correctamente!`)
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

# 3. Add buttons and modal to the UI
old_add_button = """                <button onClick={handleCreateProd} style={{ background: '#E91E97', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Añadir al Inventario</button>"""

new_add_button = """                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleCreateProd} style={{ background: '#E91E97', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Añadir</button>
                  <button onClick={() => setShowPasteModal(true)} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40, whiteSpace: 'nowrap' }}>Excel 📋</button>
                </div>"""

content = content.replace(old_add_button, new_add_button)

paste_modal = """
              {showPasteModal && (
                <div style={{ background: '#e8f5e9', padding: 16, borderRadius: 12, marginBottom: 24, border: '1px solid #4CAF50' }}>
                  <h3 style={{ marginTop: 0, color: '#2e7d32' }}>Importar desde Excel</h3>
                  <p style={{ fontSize: 13, color: '#333' }}>Copia las filas desde tu Excel respetando el orden de estas 6 columnas: <strong>Nombre, Categoría, Coste, Precio, PVP, Stock</strong>. Pégalas aquí:</p>
                  <textarea 
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    style={{ width: '100%', height: 150, padding: 10, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'monospace', whiteSpace: 'pre' }}
                    placeholder="Ejemplo:&#10;Funda Silicona&#9;Accesorio&#9;2,50&#9;5,00&#9;6,05&#9;10&#10;iPhone 13 Pro&#9;Terminal&#9;800,00&#9;900,00&#9;1089,00&#9;5"
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button onClick={handleBulkPaste} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Procesar y Guardar</button>
                    <button onClick={() => setShowPasteModal(false)} style={{ background: '#ccc', color: '#333', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}
"""

# Insert modal after the product creation grid
content = re.sub(
    r"(<div style={{ display: 'grid'.*?<\/div>\s*<\/div>\s*<\/div>)",
    r"\1" + paste_modal,
    content,
    count=1,
    flags=re.DOTALL
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added Bulk Excel Paste functionality")
