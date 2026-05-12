import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("overflow: 'hidden'", "overflow: 'visible'")
content = content.replace("overflowX: 'auto'", "overflow: 'visible'")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("overflow removed")
