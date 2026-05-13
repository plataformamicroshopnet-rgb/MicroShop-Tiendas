with open('src/app/cristina-admin/vencimientos/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find("const handleBulkImport = async () => {")
end_idx = content.find("const availableYears =", start_idx)

if start_idx != -1 and end_idx != -1:
    print(content[start_idx:end_idx])
