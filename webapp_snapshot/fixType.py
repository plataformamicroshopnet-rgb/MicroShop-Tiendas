import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "type Product = { id: string; nombre: string; categoria: string; precio: number; coste: number; stock: number; createdAt: string }",
    "type Product = { id: string; nombre: string; categoria: string; precio: number; coste: number; stock: number; createdAt: string; imei?: string }"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated inline Product interface")
