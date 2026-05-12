import re

filepath = 'src/app/operaciones/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add the helper function inside the component or just outside
if "const toTitleCase" not in content:
    content = content.replace(
        "export default function OperacionesPage() {",
        "const toTitleCase = (str: string) => {\n  if (!str) return '-';\n  return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');\n};\n\nexport default function OperacionesPage() {"
    )

# Replace the occurrences
content = content.replace("{sale.nombreCliente || '-'}", "{toTitleCase(sale.nombreCliente)}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Operaciones updated")
