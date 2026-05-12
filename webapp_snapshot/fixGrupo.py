import re

filepath = 'src/app/operaciones-grupo-cliente/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add the helper function
if "const toTitleCase" not in content:
    content = content.replace(
        "export default function OperacionesGrupoClientePage() {",
        "const toTitleCase = (str: string) => {\n  if (!str) return '—';\n  return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');\n};\n\nexport default function OperacionesGrupoClientePage() {"
    )

# Rename table headers from EMPRESA to Nombre del Cliente
content = content.replace("'Empresa'", "'Nombre del Cliente'")
content = content.replace("{ label: 'EMPRESA',          right: false },", "{ label: 'Nombre del Cliente',          right: false },")

# Update rendering of the values
content = content.replace("{group.nombre || '—'}", "{toTitleCase(group.nombre)}")
content = content.replace("{ea.customerName || '—'}", "{toTitleCase(ea.customerName)}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Operaciones Grupo Cliente updated")
