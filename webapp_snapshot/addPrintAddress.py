import re

filepath = 'src/app/movilfree/print/[id]/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace client-box content to include the missing fields
new_client_box = """      <div className="client-box" style={{ gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div><strong>Nombre:</strong> {client ? client.nombre : sale.nombreCliente}</div>
        <div><strong>DNI/CIF:</strong> {client ? client.nif : sale.nifCliente}</div>
        <div style={{ gridColumn: 'span 2' }}>
          <strong>Dirección:</strong> {client && client.direccion ? client.direccion : '---'}
          {client && (client.cp || client.poblacion || client.provincia) ? ` - ${client.cp || ''} ${client.poblacion || ''} ${client.provincia ? '('+client.provincia+')' : ''}` : ''}
        </div>
        <div><strong>Teléfono:</strong> {client ? (client.movil || client.fijo || '---') : '---'}</div>
        <div><strong>E-mail:</strong> {client ? (client.email || '---') : '---'}</div>
      </div>"""

content = re.sub(
    r"      <div className=\"client-box\">.*?<\/div>\s*<\/div>",
    new_client_box,
    content,
    flags=re.DOTALL
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added direction to print layout")
