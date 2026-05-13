import re

filepath = 'src/app/catalogos/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the bad import
content = content.replace("import ComisionesO2Tab from './ComisionesO2Tab'\n", "")

# Add it at the top
content = "import ComisionesO2Tab from './ComisionesO2Tab'\n" + content

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed import")
