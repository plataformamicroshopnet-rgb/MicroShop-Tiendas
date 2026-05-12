import re
filepath = 'src/app/api/movilfree/clients/route.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the old telefono parsing in POST just in case there are residues
content = content.replace('telefono: data.telefono', '/* removed telefono */')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
