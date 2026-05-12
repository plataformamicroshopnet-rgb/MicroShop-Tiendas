import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add Logo to the Header
new_header = """        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, background: 'white', padding: 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(233,30,151,0.08)' }}>
          <div style={{ width: 48, height: 48, background: fuchsia, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <ShoppingCart size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, color: fuchsia, fontSize: 24, fontWeight: 800 }}>MovilFree Salamanca</h1>
            <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>Panel de Gestión y Punto de Venta</p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <img src="/images/media__1778608332264.png" alt="Movilfree" style={{ height: 48, objectFit: 'contain' }} />
          </div>
        </div>"""

content = re.sub(
    r"\{\/\* HEADER \*\/\}.*?<\/div>\s*<\/div>\s*<\/div>",
    new_header,
    content,
    flags=re.DOTALL,
    count=1
)

# Print modal state
state_injection = "  const [printModalSale, setPrintModalSale] = useState<Sale | null>(null)\n"
content = re.sub(
    r"  // 3\. VENTAS \(NUEVA VENTA\)\n",
    r"  // 3. VENTAS (NUEVA VENTA)\n" + state_injection,
    content
)

# Update checkout success logic
new_checkout = """    const res = await fetch('/api/movilfree/sales', { method: 'POST', body: JSON.stringify(payload) })
    if (res.ok) {
      const createdSale = await res.json()
      setPrintModalSale(createdSale)
      setCart([])
      fetch('/api/movilfree/sales').then(r => r.json()).then(d => { if(Array.isArray(d)) setSales(d); else console.error(d) })
      fetch('/api/movilfree/products').then(r => r.json()).then(d => { if(Array.isArray(d)) setProducts(d); else console.error(d) })
    }"""

content = re.sub(
    r"    const res = await fetch\('/api/movilfree/sales', \{ method: 'POST', body: JSON\.stringify\(payload\) \}\).*?\}\s*\}",
    new_checkout + "\n  }",
    content,
    flags=re.DOTALL
)

# Append Print Modal
print_modal_code = """
        {/* PRINT MODAL */}
        {printModalSale && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: 'white', padding: 32, borderRadius: 16, width: '100%', maxWidth: 400, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: '#c6f6d5', color: '#276749', borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <ShoppingCart size={32} />
              </div>
              <h2 style={{ margin: '0 0 8px 0', color: '#333' }}>¡Venta Completada!</h2>
              <p style={{ color: '#555', marginBottom: 24 }}>Factura #{printModalSale.numeroFactura || '---'}</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button onClick={() => window.open(`/movilfree/print/${printModalSale.id}?type=ticket`, '_blank')} style={{ padding: '14px', borderRadius: 8, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  📄 Imprimir Ticket (Simplificada)
                </button>
                <button onClick={() => window.open(`/movilfree/print/${printModalSale.id}?type=factura`, '_blank')} style={{ padding: '14px', borderRadius: 8, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  📝 Imprimir Factura (A4)
                </button>
                <button onClick={() => setPrintModalSale(null)} style={{ padding: '14px', borderRadius: 8, border: 'none', background: '#eee', cursor: 'pointer', fontWeight: 'bold', marginTop: 8, fontSize: 15 }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
"""

content = re.sub(
    r"        \{\/\* RETURN MODAL \*\/\}.*?<\/div>\s*<\/div>\s*\)\s*\}",
    r"\g<0>" + print_modal_code,
    content,
    flags=re.DOTALL
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated page.tsx with Print Modal and Logo")
