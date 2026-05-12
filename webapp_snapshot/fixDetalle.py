import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "<td style={{ padding: 8 }}>{log.producto} {log.detalle}</td>",
    "<td style={{ padding: 8 }}>{log.producto} {log.detalle && log.detalle.toLowerCase() !== 'varios' ? `(${log.detalle})` : ''}</td>"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed Varios from detail")
