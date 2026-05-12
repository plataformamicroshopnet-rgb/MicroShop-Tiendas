import re

filepath = 'src/app/admin/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove Extras Plus y Básico
content = re.sub(r"\s*\{\s*title: 'Extras Plus y B.sico',[\s\S]*?icon: Settings,\s*onClick: \(\) => setCurrentView\('extras'\)\s*\},", "", content)

# Remove Revista Corporativa
content = re.sub(r"\s*\{\s*title: 'Revista Corporativa',[\s\S]*?icon: BookOpen,\s*onClick: \(\) => router\.push\('/admin/revistas'\)\s*\},", "", content)

# Remove Catálogo Dispositivos
content = re.sub(r"\s*\{\s*title: 'Cat.logo Dispositivos',[\s\S]*?icon: Smartphone,\s*onClick: \(\) => router\.push\('/admin/catalogos'\)\s*\},", "", content)

# Remove Dosier Empresas
content = re.sub(r"\s*\{\s*title: 'Dosier Empresas',[\s\S]*?icon: Briefcase,\s*onClick: \(\) => router\.push\('/admin/dosier'\)\s*\},", "", content)

# Remove Modo Día/Noche
content = re.sub(r"\s*\{\s*title: theme === 'dark' \? 'Modo D.a' : 'Modo Noche',[\s\S]*?icon: theme === 'dark' \? Sun : Moon,\s*onClick: toggleTheme\s*\},", "", content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed specified cards")
