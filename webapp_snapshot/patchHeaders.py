import os

files = [
    'src/app/cristina-admin/page.tsx',
    'src/app/cristina-admin/stock/page.tsx',
    'src/app/cristina-admin/gastos/page.tsx'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove icon prop from PageHeader
    import re
    content = re.sub(r'icon=\{<[^>]+>\}\s*', '', content)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched {file}")
