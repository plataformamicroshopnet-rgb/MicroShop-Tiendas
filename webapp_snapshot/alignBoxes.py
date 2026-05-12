import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the old metrics container
old_container = """                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#f8f9fa', padding: '8px 16px', borderRadius: 8, border: '1px solid #ddd' }}>
                    <span style={{ fontSize: 13, fontWeight: 'bold', color: '#666' }}>Desde:</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#333' }} />
                    <span style={{ fontSize: 13, fontWeight: 'bold', color: '#666', marginLeft: 10 }}>Hasta:</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#333' }} />
                  </div>
                  
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ background: '#FFF0F9', padding: '8px 16px', borderRadius: 8, border: '1px solid #fdd8e7' }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#E91E97', fontWeight: 'bold' }}>Total Ventas (IVA inc.)</div>
                      <div style={{ fontSize: 18, fontWeight: '900', color: '#E91E97' }}>
                        {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                          sales.filter(s => s.estado === 'COMPLETADA' && (!dateFrom || new Date(s.fechaVenta) >= new Date(dateFrom)) && (!dateTo || new Date(s.fechaVenta) <= new Date(dateTo + 'T23:59:59')))
                          .reduce((acc, s) => acc + s.importeTotal, 0)
                        )}
                      </div>
                    </div>
                    
                    <div style={{ background: '#e8f5e9', padding: '8px 16px', borderRadius: 8, border: '1px solid #c8e6c9' }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#2e7d32', fontWeight: 'bold' }}>Ganancias (Sin IVA)</div>
                      <div style={{ fontSize: 18, fontWeight: '900', color: '#2e7d32' }}>
                        {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                          sales.filter(s => s.estado === 'COMPLETADA' && (!dateFrom || new Date(s.fechaVenta) >= new Date(dateFrom)) && (!dateTo || new Date(s.fechaVenta) <= new Date(dateTo + 'T23:59:59')))
                          .reduce((acc, s) => {
                            try {
                              const list = JSON.parse(s.listaProductos);
                              const cost = list.reduce((cAcc: number, item: any) => cAcc + ((item.coste !== undefined ? item.coste : (products.find(p => p.id === item.id)?.coste || 0)) * item.cantidad), 0);
                              return acc + ((s.importeTotal / 1.21) - cost);
                            } catch(e) { return acc; }
                          }, 0)
                        )}
                      </div>
                    </div>
                  </div>
                </div>"""

new_container = """                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'stretch' }}>
                  <div style={{ background: 'white', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', marginBottom: 8 }}>Desde Fecha</div>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ border: 'none', background: '#f1f5f9', padding: '8px 12px', borderRadius: 6, outline: 'none', fontSize: 14, color: '#334155', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  
                  <div style={{ background: 'white', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', marginBottom: 8 }}>Hasta Fecha</div>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ border: 'none', background: '#f1f5f9', padding: '8px 12px', borderRadius: 6, outline: 'none', fontSize: 14, color: '#334155', width: '100%', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ background: '#FFF0F9', padding: '16px', borderRadius: 12, border: '1px solid #fdd8e7', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#E91E97', fontWeight: 'bold', marginBottom: 8 }}>Total Ventas (IVA inc.)</div>
                    <div style={{ fontSize: 24, fontWeight: '900', color: '#E91E97' }}>
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                        sales.filter(s => s.estado === 'COMPLETADA' && (!dateFrom || new Date(s.fechaVenta) >= new Date(dateFrom)) && (!dateTo || new Date(s.fechaVenta) <= new Date(dateTo + 'T23:59:59')))
                        .reduce((acc, s) => acc + s.importeTotal, 0)
                      )}
                    </div>
                  </div>
                  
                  <div style={{ background: '#e8f5e9', padding: '16px', borderRadius: 12, border: '1px solid #c8e6c9', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#2e7d32', fontWeight: 'bold', marginBottom: 8 }}>Ganancias (Sin IVA)</div>
                    <div style={{ fontSize: 24, fontWeight: '900', color: '#2e7d32' }}>
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                        sales.filter(s => s.estado === 'COMPLETADA' && (!dateFrom || new Date(s.fechaVenta) >= new Date(dateFrom)) && (!dateTo || new Date(s.fechaVenta) <= new Date(dateTo + 'T23:59:59')))
                        .reduce((acc, s) => {
                          try {
                            const list = JSON.parse(s.listaProductos);
                            const cost = list.reduce((cAcc: number, item: any) => cAcc + ((item.coste !== undefined ? item.coste : (products.find(p => p.id === item.id)?.coste || 0)) * item.cantidad), 0);
                            return acc + ((s.importeTotal / 1.21) - cost);
                          } catch(e) { return acc; }
                        }, 0)
                      )}
                    </div>
                  </div>
                </div>"""

content = content.replace(old_container, new_container)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Aligned into 4 boxes")
