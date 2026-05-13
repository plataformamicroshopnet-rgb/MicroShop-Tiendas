with open('src/app/cristina-admin/stock/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "activeTab === 'Accesorios' ? ("
end_marker = ") : ("

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    accesorios_block = content[start_idx:end_idx]
    
    # Reduce padding further to 2px
    new_accesorios_block = accesorios_block.replace("padding: '4px 8px'", "padding: '2px 8px'")
    
    # Reduce font size from 11px to 10px
    new_accesorios_block = new_accesorios_block.replace("fontSize: '11px'", "fontSize: '10px'")
    
    new_content = content[:start_idx] + new_accesorios_block + content[end_idx:]
    with open('src/app/cristina-admin/stock/page.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Reduced to padding 2px and fontSize 10px in Accesorios.")
else:
    print("Could not find Accesorios block.")
