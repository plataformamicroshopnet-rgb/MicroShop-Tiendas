import re

filepath = 'src/app/catalogos/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Import
import_statement = "import ComisionesO2Tab from './ComisionesO2Tab'"
if import_statement not in content:
    # Find last import
    last_import_index = content.rfind("import ")
    if last_import_index != -1:
        end_of_line = content.find("\n", last_import_index)
        content = content[:end_of_line+1] + import_statement + "\n" + content[end_of_line+1:]

# 2. Add to Tab list
tab_str = "{ cat: 'Comisiones O2 y MovilFree', tip: 'Configuracin del motor matemtico de comisiones y bonos especficos para O2 y MovilFree.' },"
if "Comisiones O2 y MovilFree" not in content:
    # Find the array of tabs
    target = "{ cat: 'Productos que Comisionan', tip: 'Configura las reglas globales y objetivos que aplicarn a los comerciales de la tienda en este mes.' },"
    target_idx = content.find(target)
    if target_idx != -1:
        content = content[:target_idx + len(target)] + "\n          " + tab_str + content[target_idx + len(target):]
    else:
        print("Could not find tab array target")

# 3. Add to isProductTab logic
if "activeTab !== 'Comisiones O2 y MovilFree'" not in content:
    target2 = "activeTab !== 'Productos que Comisionan'"
    content = content.replace(target2, "activeTab !== 'Productos que Comisionan' && activeTab !== 'Comisiones O2 y MovilFree'")

# 4. Add the component render at the end
render_str = "{!isProductTab && activeTab === 'Comisiones O2 y MovilFree' && <ComisionesO2Tab />}"
if "ComisionesO2Tab />" not in content:
    target3 = "{!isProductTab && activeTab !== 'Productos que Comisionan' && activeTab !== 'Comisiones O2 y MovilFree' && <ObjetivosTab"
    # wait, target3 might not match exactly. Let's just find the end of the return statement
    
    target_render = "{!isProductTab && activeTab === 'Productos que Comisionan' && <ProductosComisionanTab />}"
    if target_render in content:
        content = content.replace(target_render, target_render + "\n      " + render_str)
    else:
        print("Could not find render target")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added ComisionesO2Tab to catalogos/page.tsx")
