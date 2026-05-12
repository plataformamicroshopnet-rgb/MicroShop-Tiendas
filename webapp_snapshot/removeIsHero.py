import re

filepath = 'src/app/admin/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("<Icon size={isHero ? 26 : 22} strokeWidth={2.5} />", "<Icon size={22} strokeWidth={2.5} />")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed isHero reference in Icon")
