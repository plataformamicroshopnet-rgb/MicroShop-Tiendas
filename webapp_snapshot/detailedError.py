import re

# 1. Update backend route to return and log full error
filepath_put = 'src/app/api/movilfree/products/[id]/route.ts'
with open(filepath_put, 'r', encoding='utf-8') as f:
    content_put = f.read()

content_put = content_put.replace(
    "return NextResponse.json({ error: e.message }, { status: 500 })",
    "console.error('PUT Error:', e); return NextResponse.json({ error: e.message, fullError: e }, { status: 500 })"
)

with open(filepath_put, 'w', encoding='utf-8') as f:
    f.write(content_put)

# 2. Update frontend to alert the JSON error
filepath_page = 'src/app/movilfree/page.tsx'
with open(filepath_page, 'r', encoding='utf-8') as f:
    content_page = f.read()

content_page = content_page.replace(
    "alert('Error al guardar')",
    "const errRes = await res.json(); alert('Error al guardar: ' + (errRes.error || JSON.stringify(errRes)))"
)

with open(filepath_page, 'w', encoding='utf-8') as f:
    f.write(content_page)

print("Injected detailed error handling")
