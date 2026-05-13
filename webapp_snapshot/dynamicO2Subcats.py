import re

filepath = 'src/app/nueva-venta/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Make O2 subcategories dynamic
search_target = """<option value="Alta/Porta">Alta / Porta</option>
                            <option value="Interna de Movistar">Interna de Movistar</option>"""
                            
replace_target = """{catalogs['O2']?.map(p => p.subcategoria).filter(Boolean).filter((sub, i, self) => self.indexOf(sub) === i).sort().map((sub: any) => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}"""

if search_target in content:
    content = content.replace(search_target, replace_target)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Made O2 subcategories dynamic in Nueva Venta")
else:
    print("Could not find hardcoded O2 subcategories")
