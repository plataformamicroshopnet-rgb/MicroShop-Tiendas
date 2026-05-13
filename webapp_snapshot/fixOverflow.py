import os

files = ['src/app/catalogos/ComisionesO2Tab.tsx', 'src/app/catalogos/ProductosComisionanTab.tsx']

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace overflowX: 'auto' with overflow: 'visible'
        content = content.replace("overflowX: 'auto'", "overflow: 'visible'")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed overflow in {filepath}")
