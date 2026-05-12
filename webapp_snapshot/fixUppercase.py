import os

filepath = 'src/app/comisiones/simulador/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(".toUpperCase().includes('Rent')", ".toUpperCase().includes('RENT')")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed uppercase check in simulador/page.tsx")
