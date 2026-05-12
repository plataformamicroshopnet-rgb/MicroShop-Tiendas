import re

filepath = 'src/components/Sidebar.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_nav_item = "    { name: 'Ventas MovilFree', href: '/movilfree', icon: Smartphone, permission: 'MODULE_ADMIN' },\n"
content = re.sub(
    r"(\{ name: 'Tiendas Hub', href: '/tiendas', icon: Briefcase, permission: 'MODULE_TIENDAS' \},\n)",
    r"\1" + new_nav_item,
    content
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Sidebar")
