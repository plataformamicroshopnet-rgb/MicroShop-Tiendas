import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix parseNumber for European format (dots for thousands, comma for decimals)
old_parse = "const parseNumber = (val: string) => parseFloat((val || '0').replace(/[^0-9,-.]/g, '').replace(',','.')) || 0;"
new_parse = """const parseNumber = (val: string) => {
    let s = String(val || '0').replace(/[^0-9.,\-]/g, '').trim();
    s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  }"""
content = content.replace(old_parse, new_parse)

# 2. Fix header text color to white
content = content.replace(
    "<tr style={{ background: '#7dd3fc', color: '#0f172a' }}>",
    "<tr style={{ background: '#0284c7', color: '#ffffff' }}>" # Slightly darker blue (#0284c7) so white text is readable
)
content = content.replace(
    "<tr style={{ background: '#7dd3fc', color: '#0f172a' }}>",
    "<tr style={{ background: '#0284c7', color: '#ffffff' }}>"
)

# 3. Fix Layout / Padding to make it fit better
# Reduce horizontal padding on the headers and cells
content = content.replace("padding: '12px'", "padding: '6px 4px'")
content = content.replace("padding: 8", "padding: 4")

# Widen the table wrapper to not limit the inputs
content = content.replace("minWidth: 1000", "minWidth: 1200")

# 4. Enforce € / % visuals where appropriate, maybe just format the calculated numbers better
content = content.replace("totalImporte.toFixed(2) + ' €'", "new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalImporte)")
content = content.replace("totalImporte.toFixed(2) €", "new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalImporte)")

# Also format salesAux / Cor / Vil / Bej / Tot for money types
content = content.replace("${salesAux.toFixed(2)} €", "${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(salesAux)}")
content = content.replace("${salesCor.toFixed(2)} €", "${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(salesCor)}")
content = content.replace("${salesVil.toFixed(2)} €", "${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(salesVil)}")
content = content.replace("${salesBej.toFixed(2)} €", "${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(salesBej)}")
content = content.replace("${salesTot.toFixed(2)} €", "${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(salesTot)}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("UI and formatting tweaks applied")
