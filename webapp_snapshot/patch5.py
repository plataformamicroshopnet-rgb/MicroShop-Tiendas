import re

with open('src/app/liquidacion/rentabilidad-tiendas/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the row and footer initialization to include units
init_old = """      const rows = comerciales.map(comercial => {
        const cells = {} as Record<string, { total: number, sales: any[] }>
        TIPOS_VENTA.forEach(t => cells[t] = { total: 0, sales: [] })
        return { nombre: comercial, cells, totalGlobal: 0 }
      })
      
      const footerTotals = {} as Record<string, number>
      TIPOS_VENTA.forEach(t => footerTotals[t] = 0)
      
      return { nombre: tiendaName, rows, footerTotals, totalTienda: 0 }"""

init_new = """      const rows = comerciales.map(comercial => {
        const cells = {} as Record<string, { total: number, sales: any[] }>
        TIPOS_VENTA.forEach(t => cells[t] = { total: 0, sales: [] })
        return { nombre: comercial, cells, totalGlobal: 0, totalUdsGlobal: 0 }
      })
      
      const footerTotals = {} as Record<string, { total: number, uds: number }>
      TIPOS_VENTA.forEach(t => footerTotals[t] = { total: 0, uds: 0 })
      
      return { nombre: tiendaName, rows, footerTotals, totalTienda: 0, totalTiendaUds: 0 }"""

content = content.replace(init_old, init_new)

# 2. Update the tracking loop
loop_old = """      if (row && row.cells[tipo]) {
          row.cells[tipo].sales.push(s)
          row.cells[tipo].total += s.comisionReal
          row.totalGlobal += s.comisionReal
          tiendaObj.footerTotals[tipo] += s.comisionReal
          tiendaObj.totalTienda += s.comisionReal
      }"""

loop_new = """      if (row && row.cells[tipo]) {
          row.cells[tipo].sales.push(s)
          row.cells[tipo].total += s.comisionReal
          row.totalGlobal += s.comisionReal
          row.totalUdsGlobal += 1
          tiendaObj.footerTotals[tipo].total += s.comisionReal
          tiendaObj.footerTotals[tipo].uds += 1
          tiendaObj.totalTienda += s.comisionReal
          tiendaObj.totalTiendaUds += 1
      }"""

content = content.replace(loop_old, loop_new)

# 3. Update Tienda card header
header_old = """<div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{formatEuro(tienda.totalTienda)}</div>"""
header_new = """<div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{formatEuro(tienda.totalTienda)}</div>
                <div style={{ fontSize: 13, color: 'var(--medium-gray)', fontWeight: 600 }}>{tienda.totalTiendaUds} VENTAS</div>"""

content = content.replace(header_old, header_new)

# 4. Update the cell rendering
cell_old = """{hasSales ? formatEuro(cell.total) : '-'}"""
cell_new = """{hasSales ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cell.sales.length} uds</span>
                                    <span>{formatEuro(cell.total)}</span>
                                  </div>
                                ) : '-'}"""

content = content.replace(cell_old, cell_new)

# 5. Update row total rendering
row_total_old = """{formatEuro(row.totalGlobal)}"""
row_total_new = """<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.totalUdsGlobal} uds</span>
                              <span>{formatEuro(row.totalGlobal)}</span>
                            </div>"""

content = content.replace(row_total_old, row_total_new)

# 6. Update footer totals rendering
footer_totals_old = """{formatEuro(tienda.footerTotals[t])}"""
footer_totals_new = """<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tienda.footerTotals[t].uds} uds</span>
                            <span>{formatEuro(tienda.footerTotals[t].total)}</span>
                          </div>"""

content = content.replace(footer_totals_old, footer_totals_new)

# 7. Update grand total footer rendering
grand_total_old = """{formatEuro(tienda.totalTienda)}"""
grand_total_new = """<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tienda.totalTiendaUds} uds</span>
                          <span>{formatEuro(tienda.totalTienda)}</span>
                        </div>"""

# Replace ONLY the last occurrence for grand total, since it matches the header technically but the header format is different
content = content.replace(grand_total_old, grand_total_new)
# Actually the header was already replaced in step 3 so it's not going to conflict.

with open('src/app/liquidacion/rentabilidad-tiendas/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated matrix to show units")
