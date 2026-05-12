import re

filepath = 'prisma/schema.prisma'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "  stock       Int      @default(0)\n  createdAt   DateTime @default(now())",
    "  stock       Int      @default(0)\n  imei        String?  // Opcional, 15 digitos\n  createdAt   DateTime @default(now())"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated schema")
