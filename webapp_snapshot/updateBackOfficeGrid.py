import re

filepath = 'src/app/back-office/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',", "gridTemplateColumns: '1fr',")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Forced 1 column grid in Back Office")
