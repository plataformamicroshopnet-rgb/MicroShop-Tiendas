import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add states for return modal
state_injection = """  const [returnModalSale, setReturnModalSale] = useState<Sale | null>(null)
  const [returnQty, setReturnQty] = useState<Record<string, number>>({})
  const [returnReason, setReturnReason] = useState('')
"""
content = re.sub(
    r"  // 4\. DEVOLUCIONES\n",
    r"  // 4. DEVOLUCIONES\n" + state_injection,
    content
)

# Modify handleReturn
new_handle_return = """  const handleReturnClick = (sale: Sale) => {
    setReturnModalSale(sale)
    setReturnQty({})
    setReturnReason('')
  }

  const submitPartialReturn = async () => {
    if(!returnModalSale) return
    const itemsToReturn = Object.entries(returnQty).map(([id, qty]) => ({ id, cantidad: qty })).filter(x => x.cantidad > 0)
    if(itemsToReturn.length === 0) return alert("Selecciona al menos 1 producto para devolver")
    
    const payload = {
      estado: 'DEVOLUCION_PARCIAL',
      motivoDevolucion: returnReason || 'Devolución parcial',
      returnedItems: itemsToReturn
    }
    
    const res = await fetch(`/api/movilfree/sales/${returnModalSale.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    if (res.ok) {
      alert('Devolución registrada correctamente. El stock se ha actualizado.')
      fetch('/api/movilfree/sales').then(r => r.json()).then(d => { if(Array.isArray(d)) setSales(d); else console.error(d) })
      setReturnModalSale(null)
    }
  }

  const submitFullReturn = async () => {
    if(!returnModalSale) return
    const payload = {
      estado: 'DEVUELTA',
      motivoDevolucion: returnReason || 'Devolución completa'
    }
    const res = await fetch(`/api/movilfree/sales/${returnModalSale.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    if (res.ok) {
      alert('Venta devuelta por completo.')
      fetch('/api/movilfree/sales').then(r => r.json()).then(d => { if(Array.isArray(d)) setSales(d); else console.error(d) })
      setReturnModalSale(null)
    }
  }
"""

content = re.sub(
    r"  const handleReturn = async \(sale: Sale\) => \{.*?\n  \}",
    new_handle_return,
    content,
    flags=re.DOTALL
)

# Update onClick from handleReturn to handleReturnClick
content = content.replace("onClick={() => handleReturn(s)}", "onClick={() => handleReturnClick(s)}")

# Also update the table to show returned quantities
# In DEVOLUCIONES TAB:
# <td style={{ padding: 12, color: '#555' }}>
#   {items.map((i: any, idx: number) => <div key={idx}>{i.cantidad}x {i.nombre}</div>)}
# </td>
new_td_items = """                        <td style={{ padding: 12, color: '#555' }}>
                          {items.map((i: any, idx: number) => (
                            <div key={idx}>
                              {i.cantidad}x {i.nombre} 
                              {i.cantidadDevuelta > 0 && <span style={{color:'#e53e3e', fontSize:11, marginLeft:4}}>(-{i.cantidadDevuelta} devueltos)</span>}
                            </div>
                          ))}
                        </td>"""
content = re.sub(
    r"<td style=\{\{ padding: 12, color: '#555' \}\}>\s*\{items\.map\(\(i: any, idx: number\) => <div key=\{idx\}>\{i\.cantidad\}x \{i\.nombre\}</div>\)\}\s*</td>",
    new_td_items,
    content,
    flags=re.DOTALL
)

# Update the state span
new_state_span = """                          {s.estado === 'DEVUELTA' && <span style={{ background: '#fed7d7', color: '#c53030', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>DEVUELTA</span>}
                          {s.estado === 'DEVOLUCION_PARCIAL' && <span style={{ background: '#feebc8', color: '#dd6b20', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>PARCIAL</span>}
                          {s.estado === 'COMPLETADA' && <span style={{ background: '#c6f6d5', color: '#276749', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>COMPLETADA</span>}"""

content = re.sub(
    r"\{isDev\s*\?\s*<span.*?COMPLETADA</span>\s*\}",
    new_state_span,
    content,
    flags=re.DOTALL
)

# Update actions block for DEVOLUCION_PARCIAL
content = content.replace("!isDev && (", "s.estado !== 'DEVUELTA' && (")


# Append the Modal at the end of the return statement
modal_code = """
        {/* RETURN MODAL */}
        {returnModalSale && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: 'white', padding: 32, borderRadius: 16, width: '100%', maxWidth: 500 }}>
              <h2 style={{ margin: '0 0 16px 0', color: fuchsia }}>Gestionar Devolución</h2>
              <p style={{ color: '#555', marginBottom: 24 }}>Venta a: <strong>{returnModalSale.nombreCliente}</strong></p>
              
              <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 12, marginBottom: 24 }}>
                {JSON.parse(returnModalSale.listaProductos).map((p: any) => {
                  const devueltos = p.cantidadDevuelta || 0
                  const maxDevolver = p.cantidad - devueltos
                  if (maxDevolver <= 0) return <div key={p.id} style={{ color: '#aaa', marginBottom: 8, fontSize: 13 }}>{p.nombre} (Ya devuelto)</div>
                  
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{p.nombre}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>Vendidos: {p.cantidad} (Disp. para devolver: {maxDevolver})</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => setReturnQty({...returnQty, [p.id]: Math.max(0, (returnQty[p.id] || 0) - 1)})} style={{ width: 28, height: 28, borderRadius: 14, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>-</button>
                        <span style={{ fontWeight: 'bold', width: 20, textAlign: 'center' }}>{returnQty[p.id] || 0}</span>
                        <button onClick={() => setReturnQty({...returnQty, [p.id]: Math.min(maxDevolver, (returnQty[p.id] || 0) + 1)})} style={{ width: 28, height: 28, borderRadius: 14, border: 'none', background: fuchsia, color: 'white', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <input placeholder="Motivo (opcional)" value={returnReason} onChange={e => setReturnReason(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd', marginBottom: 24 }} />

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={() => setReturnModalSale(null)} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#eee', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button onClick={submitFullReturn} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#e53e3e', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Devolver Todo</button>
                <button onClick={submitPartialReturn} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: fuchsia, color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Devolver Selección</button>
              </div>
            </div>
          </div>
        )}
"""

content = re.sub(
    r"        </div>\s*</div>\s*</div>\s*\)\s*\}",
    "        </div>\n" + modal_code + "\      </div>\n    </div>\n  )\n}",
    content
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated frontend for partial returns")
