with open('src/app/cristina-admin/vencimientos/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find("<Bar dataKey=")
if start_idx != -1:
    print(content[start_idx:start_idx+500])
