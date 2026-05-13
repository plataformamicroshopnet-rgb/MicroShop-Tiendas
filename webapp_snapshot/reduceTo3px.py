with open('src/app/cristina-admin/stock/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "activeTab === 'Accesorios' ? ("
end_marker = ") : ("

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    accesorios_block = content[start_idx:end_idx]
    
    # We previously set tbody padding to 6px. Now we change it to 3px.
    new_accesorios_block = accesorios_block.replace("padding: '6px 16px'", "padding: '3px 16px'")
    
    # Let's also reduce the font size inside tbody slightly if it helps it fit better, 
    # but the user specifically asked for "3px" which implies the padding or spacing.
    # Let's stick to just the padding reduction.
    
    new_content = content[:start_idx] + new_accesorios_block + content[end_idx:]
    with open('src/app/cristina-admin/stock/page.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Reduced tbody padding to 3px.")
else:
    print("Could not find Accesorios block.")
