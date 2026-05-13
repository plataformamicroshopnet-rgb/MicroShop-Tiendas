import re

with open('src/app/cristina-admin/stock/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to find the block for Accesorios table rendering
start_marker = "activeTab === 'Accesorios' ? ("
end_marker = ") : ("

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    accesorios_block = content[start_idx:end_idx]
    # Replace padding: '12px 16px' with padding: '10px 16px' inside this block
    # Also we'll replace font-size: 13px with 12px just in case, but let's stick to padding first
    new_accesorios_block = accesorios_block.replace("padding: '12px 16px'", "padding: '8px 16px'")
    
    new_content = content[:start_idx] + new_accesorios_block + content[end_idx:]
    with open('src/app/cristina-admin/stock/page.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Padding reduced in Accesorios.")
else:
    print("Could not find Accesorios block.")
