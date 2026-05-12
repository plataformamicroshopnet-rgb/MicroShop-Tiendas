import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "fetch('/api/movilfree/products').then(r => r.json()).then(setProducts)",
    "fetch('/api/movilfree/products').then(r => r.json()).then(d => { if(Array.isArray(d)) setProducts(d); else console.error('API Error:', d) })"
)
content = content.replace(
    "fetch('/api/movilfree/clients').then(r => r.json()).then(setClients)",
    "fetch('/api/movilfree/clients').then(r => r.json()).then(d => { if(Array.isArray(d)) setClients(d); else console.error('API Error:', d) })"
)
content = content.replace(
    "fetch('/api/movilfree/sales').then(r => r.json()).then(setSales)",
    "fetch('/api/movilfree/sales').then(r => r.json()).then(d => { if(Array.isArray(d)) setSales(d); else console.error('API Error:', d) })"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed frontend crash on API error")
