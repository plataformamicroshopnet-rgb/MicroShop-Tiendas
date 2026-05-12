import os

filepath = 'prisma/schema.prisma'
with open(filepath, 'r', encoding='utf-8-sig') as f:
    content = f.read()

with open(filepath, 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Removed BOM")
