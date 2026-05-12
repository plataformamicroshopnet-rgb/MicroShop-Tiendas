import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add date states
content = content.replace(
    "const [searchSales, setSearchSales] = useState('')",
    "const [searchSales, setSearchSales] = useState('')\n  const [dateFrom, setDateFrom] = useState('')\n  const [dateTo, setDateTo] = useState('')"
)

# 2. Add 'coste' to handleCheckout payload
content = content.replace(
    "listaProductos: JSON.stringify(cart.map(c => ({ id: c.product.id, nombre: c.product.nombre, cantidad: c.cantidad, precio: c.product.precio * 1.21 })))",
    "listaProductos: JSON.stringify(cart.map(c => ({ id: c.product.id, nombre: c.product.nombre, cantidad: c.cantidad, precio: c.product.precio * 1.21, coste: c.product.coste })))"
)
# if it didn't match perfectly, use regex
content = re.sub(
    r"listaProductos: cart\.map\(c => \(\{ id: c\.product\.id, nombre: c\.product\.nombre, cantidad: c\.cantidad, precio: c\.product\.precio \* 1\.21 \}\)",
    r"listaProductos: cart.map(c => ({ id: c.product.id, nombre: c.product.nombre, cantidad: c.cantidad, precio: c.product.precio * 1.21, coste: c.product.coste })",
    content
)

# 3. Insert the calendar inputs and metrics in the DEVOLUCIONES tab
# We find: <h3 style={{ margin: 0, color: '#333' }}>Histórico de Ventas</h3>
metrics_ui = """<h3 style={{ margin: 0, color: '#333' }}>Histórico de Ventas</h3>
                
                {/* Dashboard de Beneficios y Filtro de Fechas */}
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
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

content = content.replace("<h3 style={{ margin: 0, color: '#333' }}>Histórico de Ventas</h3>", metrics_ui)

# 4. Apply the date filters to the table mapping as well
old_map = "sales.filter(s => \n                    (s.nombreCliente || '').toLowerCase().includes(searchSales.toLowerCase()) ||\n                    (s.nifCliente || '').toLowerCase().includes(searchSales.toLowerCase()) ||\n                    (s.vendedor || '').toLowerCase().includes(searchSales.toLowerCase()) ||\n                    (s.numeroFactura ? s.numeroFactura.toString() : '').includes(searchSales)\n                  ).map"

new_map = "sales.filter(s => \n                    ((!dateFrom || new Date(s.fechaVenta) >= new Date(dateFrom)) && (!dateTo || new Date(s.fechaVenta) <= new Date(dateTo + 'T23:59:59'))) && \n                    ((s.nombreCliente || '').toLowerCase().includes(searchSales.toLowerCase()) ||\n                    (s.nifCliente || '').toLowerCase().includes(searchSales.toLowerCase()) ||\n                    (s.vendedor || '').toLowerCase().includes(searchSales.toLowerCase()) ||\n                    (s.numeroFactura ? s.numeroFactura.toString() : '').includes(searchSales))\n                  ).map"

content = content.replace(old_map, new_map)


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added Calendar and Profit metrics")
