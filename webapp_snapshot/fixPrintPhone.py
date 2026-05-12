import re
filepath = 'src/app/movilfree/print/[id]/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "<div>Teléfono: {client ? (client.telefono || '---') : '---'}</div>",
    "<div>Teléfono: {client ? (client.movil || client.fijo || '---') : '---'}</div>"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
