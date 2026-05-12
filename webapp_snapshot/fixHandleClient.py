import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix handleCreateClient
new_handle = """  const handleCreateClient = async () => {
    if(!newClient.nif || !newClient.nombre) return alert('NIF y Nombre obligatorios')
    const res = await fetch('/api/movilfree/clients', { method: 'POST', body: JSON.stringify(newClient) })
    const created = await res.json()
    if (!res.ok) return alert('Error: ' + (created.error || 'No se pudo crear'))
    setClients([created, ...clients])
    setNewClient({ nif: '', nombre: '', direccion: '', poblacion: '', provincia: '', cp: '', movil: '', fijo: '', email: '' })
  }"""

content = re.sub(
    r"  const handleCreateClient = async \(\) => \{.*?setNewClient\(\{.*?\}\)\n  \}",
    new_handle,
    content,
    flags=re.DOTALL
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed handleCreateClient")
