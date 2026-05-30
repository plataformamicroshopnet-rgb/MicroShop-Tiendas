import os

root_dir = r"c:\Proyecto Tiendas\MicroShop Tiendas\webapp_snapshot\src"
search_term = "Suscripciones"

found = []
for dirpath, _, filenames in os.walk(root_dir):
    for filename in filenames:
        if filename.endswith(('.tsx', '.ts', '.js', '.jsx', '.css')):
            filepath = os.path.join(dirpath, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if search_term in content:
                        found.append(filepath)
            except Exception as e:
                pass

print("Found files:")
for path in found:
    print(path)
