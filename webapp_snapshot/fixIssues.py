import re

# Fix uppercase in unified sales API
filepath = 'src/app/api/sales/unified/route.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "nombreCliente: data.nombreCliente.toUpperCase(),",
    "nombreCliente: data.nombreCliente,"
)

# Fix NIF uppercase? They didn't complain about NIF uppercase, usually NIF should be uppercase.
# So I leave nif as uppercase.

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)


# Fix missing client name in Territorial Tiendas modal
filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "<td style={{ padding: 8 }}>{log.cliente}</td>",
    "<td style={{ padding: 8 }}>{log.nombreCliente || '-'}</td>"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed uppercase in API and missing client name in Modal")
