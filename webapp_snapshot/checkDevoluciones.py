import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r"\{\/\* TAB: DEVOLUCIONES E HISTORICO \*\/\}.*?(?=\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\n\})", content, re.DOTALL)
if match:
    print(match.group(0))
