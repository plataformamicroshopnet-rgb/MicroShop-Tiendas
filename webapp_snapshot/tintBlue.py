import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix search bar
content = content.replace(
    """<input placeholder="Buscar por cliente, NIF, vendedor o nº factura..." value={searchSales} onChange={e=>setSearchSales(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid #ddd' }} />""",
    """<input placeholder="Buscar por cliente, NIF, vendedor o nº factura..." value={searchSales} onChange={e=>setSearchSales(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1' }} />"""
)

# Fix FECHAS boxes
old_desde = """<div style={{ background: 'white', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', marginBottom: 8 }}>Desde Fecha</div>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ border: 'none', background: '#f1f5f9', padding: '8px 12px', borderRadius: 6, outline: 'none', fontSize: 14, color: '#334155', width: '100%', boxSizing: 'border-box' }} />
                  </div>"""

new_desde = """<div style={{ background: '#f0f9ff', padding: '16px', borderRadius: 12, border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#0284c7', fontWeight: 'bold', marginBottom: 8 }}>Desde Fecha</div>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ border: 'none', background: 'white', padding: '8px 12px', borderRadius: 6, outline: 'none', fontSize: 14, color: '#0369a1', width: '100%', boxSizing: 'border-box' }} />
                  </div>"""
content = content.replace(old_desde, new_desde)


old_hasta = """<div style={{ background: 'white', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', marginBottom: 8 }}>Hasta Fecha</div>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ border: 'none', background: '#f1f5f9', padding: '8px 12px', borderRadius: 6, outline: 'none', fontSize: 14, color: '#334155', width: '100%', boxSizing: 'border-box' }} />
                  </div>"""

new_hasta = """<div style={{ background: '#f0f9ff', padding: '16px', borderRadius: 12, border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#0284c7', fontWeight: 'bold', marginBottom: 8 }}>Hasta Fecha</div>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ border: 'none', background: 'white', padding: '8px 12px', borderRadius: 6, outline: 'none', fontSize: 14, color: '#0369a1', width: '100%', boxSizing: 'border-box' }} />
                  </div>"""
content = content.replace(old_hasta, new_hasta)


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Tinted search and date boxes with light blue")
