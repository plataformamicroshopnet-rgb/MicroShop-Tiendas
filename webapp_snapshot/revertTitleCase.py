import re

# 1. Revert in Operaciones
filepath = 'src/app/operaciones/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the toTitleCase helper
helper_regex = r"const toTitleCase = \(str: string\) => \{\n  if \(\!str\) return '-';\n  return str\.toLowerCase\(\)\.split\(' '\)\.map\(w => w\.charAt\(0\)\.toUpperCase\(\) \+ w\.slice\(1\)\)\.join\(' '\);\n\};\n\n"
content = re.sub(helper_regex, "", content)
content = content.replace("{toTitleCase(sale.nombreCliente)}", "{sale.nombreCliente || '-'}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

# 2. Revert in Operaciones Grupo Cliente
filepath = 'src/app/operaciones-grupo-cliente/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the toTitleCase helper
helper_regex2 = r"const toTitleCase = \(str: string\) => \{\n  if \(\!str\) return '—';\n  return str\.toLowerCase\(\)\.split\(' '\)\.map\(w => w\.charAt\(0\)\.toUpperCase\(\) \+ w\.slice\(1\)\)\.join\(' '\);\n\};\n\n"
content = re.sub(helper_regex2, "", content)

# But keep the column name as "Nombre del Cliente"!
# Just revert the value rendering
content = content.replace("{toTitleCase(group.nombre)}", "{group.nombre || '—'}")
content = content.replace("{toTitleCase(ea.customerName)}", "{ea.customerName || '—'}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Reverted to raw input rendering")
