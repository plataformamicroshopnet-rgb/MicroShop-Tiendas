import re

filepath = 'src/app/back-office/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Modify the border inline style
old_style = "style={{ position: 'relative', border: c.border || '1px solid transparent' }}"
new_style = "style={{ position: 'relative', border: c.border || '1px solid transparent', borderLeft: `5px solid ${c.textColor}` }}"
content = content.replace(old_style, new_style)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added borderLeft to Back Office cards")
