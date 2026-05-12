import os
import re

filepath = 'src/app/liquidacion/rentabilidad-tiendas/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'icon=\{Building2\}', '', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed icon from PageHeader")
