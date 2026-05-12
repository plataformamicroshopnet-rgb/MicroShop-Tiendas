import re

filepath = 'prisma/schema.prisma'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "model MovilFreeSale {\n  id              String   @id @default(cuid())",
    "model MovilFreeSale {\n  id              String   @id @default(cuid())\n  numeroFactura   Int?     @unique"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated schema.prisma")
