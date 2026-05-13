with open('src/app/cristina-admin/stock/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "activeTab === 'Accesorios' ? ("
end_marker = ") : ("

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    accesorios_block = content[start_idx:end_idx]
    # Let's print out the first 5 lines of the tbody mapping to see what the td styling looks like
    tbody_idx = accesorios_block.find("<tbody>")
    if tbody_idx != -1:
        print(accesorios_block[tbody_idx:tbody_idx+2500])
