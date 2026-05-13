with open('src/app/cristina-admin/stock/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('const getTotalsByStoreAndCategory')
end_idx = content.find('const totalsMatrix = getTotalsByStoreAndCategory()')

if start_idx != -1 and end_idx != -1:
    print(content[start_idx:end_idx])
