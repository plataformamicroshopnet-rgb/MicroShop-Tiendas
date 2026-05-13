with open('src/app/cristina-admin/stock/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find("            <div style={{ overflowX: 'auto' }}>")
end_idx = content.find("{activeTab === 'Accesorios' ? (", start_idx)

if start_idx != -1 and end_idx != -1:
    print(content[start_idx-200:end_idx+100])
