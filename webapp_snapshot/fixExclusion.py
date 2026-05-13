import re

filepath = 'src/app/catalogos/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = "activeTab !== 'Objetivos Tiendas'"
if "activeTab !== 'Objetivos Tiendas' && activeTab !== 'Comisiones O2 y MovilFree'" not in content:
    content = content.replace("activeTab !== 'Objetivos Tiendas'", "activeTab !== 'Objetivos Tiendas' && activeTab !== 'Comisiones O2 y MovilFree'")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Ensured tab exclusion logic")
