import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# I will find the start of the broken part and replace it entirely up to the end.
start_marker = "        {/* RETURN MODAL */}"
index = content.find(start_marker)

correct_end = """        {/* RETURN MODAL */}
        {returnModalSale && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: 'white', padding: 32, borderRadius: 16, width: '100%', maxWidth: 500 }}>
              <h2 style={{ margin: '0 0 16px 0', color: '#e91e63' }}>Gestionar Devolución</h2>
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
                        <button onClick={() => setReturnQty({...returnQty, [p.id]: Math.min(maxDevolver, (returnQty[p.id] || 0) + 1)})} style={{ width: 28, height: 28, borderRadius: 14, border: 'none', background: '#e91e63', color: 'white', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <input placeholder="Motivo (opcional)" value={returnReason} onChange={e => setReturnReason(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd', marginBottom: 24 }} />

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={() => setReturnModalSale(null)} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#eee', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button onClick={submitFullReturn} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#e53e3e', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Devolver Todo</button>
                <button onClick={submitPartialReturn} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#e91e63', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Devolver Selección</button>
              </div>
            </div>
          </div>
        )}

        {/* PRINT MODAL */}
        {printModalSale && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: 'white', padding: 32, borderRadius: 16, width: '100%', maxWidth: 400, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: '#c6f6d5', color: '#276749', borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <span style={{ fontSize: 32 }}>✓</span>
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
      </div>
    </div>
  )
}
"""

new_content = content[:index] + correct_end

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Fixed JSX Syntax")
