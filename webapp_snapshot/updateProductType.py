import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "stock: number\n}",
    "stock: number\n  imei?: string\n}"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Product interface")
