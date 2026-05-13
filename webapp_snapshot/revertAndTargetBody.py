with open('src/app/cristina-admin/stock/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "activeTab === 'Accesorios' ? ("
end_marker = ") : ("

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    accesorios_block = content[start_idx:end_idx]
    
    # Revert everything to baseline first
    accesorios_block = accesorios_block.replace("padding: '4px 8px'", "padding: '12px 16px'")
    accesorios_block = accesorios_block.replace("padding: '2px 8px'", "padding: '12px 16px'")
    accesorios_block = accesorios_block.replace("padding: '8px 16px'", "padding: '12px 16px'")
    accesorios_block = accesorios_block.replace("fontSize: '10px'", "fontSize: '13px'")
    accesorios_block = accesorios_block.replace("fontSize: '11px'", "fontSize: '13px'")
    
    # Now, split the block into thead and tbody
    tbody_idx = accesorios_block.find("<tbody>")
    if tbody_idx != -1:
        thead_part = accesorios_block[:tbody_idx]
        tbody_part = accesorios_block[tbody_idx:]
        # Reduce padding only in tbody to 6px
        tbody_part = tbody_part.replace("padding: '12px 16px'", "padding: '6px 16px'")
        accesorios_block = thead_part + tbody_part
    
    new_content = content[:start_idx] + accesorios_block + content[end_idx:]
    with open('src/app/cristina-admin/stock/page.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Reverted header, applied padding 6px only to tbody rows.")
else:
    print("Could not find Accesorios block.")
