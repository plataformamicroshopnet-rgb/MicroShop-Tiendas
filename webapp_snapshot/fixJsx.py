import re

filepath = 'src/app/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("1ª venta < 10h", "1ª venta &lt; 10h")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed JSX syntax error")
