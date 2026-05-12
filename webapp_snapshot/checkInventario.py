import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# find the inventario tab
match = re.search(r"\{\/\* TAB: INVENTARIO \*\/\}.*?(?=\s*\{\/\* TAB: CLIENTES \*\/\})", content, re.DOTALL)
if match:
    print(match.group(0)[:1500])
