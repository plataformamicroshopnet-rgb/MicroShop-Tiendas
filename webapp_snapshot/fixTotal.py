import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    ">{totalImporte.toFixed(2)} €</td>",
    ">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalImporte)}</td>"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("totalImporte formatted")
