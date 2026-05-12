import re

filepath = 'src/app/admin/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove "Condiciones y Extras Tiendas"
content = re.sub(r"\s*\{\s*title: 'Condiciones y Extras Tiendas',[\s\S]*?icon: Briefcase,\s*action: \(\) => router\.push\('/admin/condiciones-plus'\),[\s\S]*?permission: 'MANAGE_CATALOG'\s*\},", "", content)

# 2. Add borderLeft logic
old_style = "style={{ position: 'relative', cursor: isEditMode ? 'default' : 'pointer' }}"
new_style = "style={{ position: 'relative', cursor: isEditMode ? 'default' : 'pointer', borderLeft: `5px solid ${c.textColor}` }}"
content = content.replace(old_style, new_style)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed card and added border logic")
