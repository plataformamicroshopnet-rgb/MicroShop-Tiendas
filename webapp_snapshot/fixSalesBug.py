import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "if (salesRes.success) setSales(salesRes.sales || [])",
    "if (salesRes.success) setSales(salesRes.logs || [])"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed sales API response property")
