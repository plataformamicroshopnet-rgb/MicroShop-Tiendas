import re

def fix_route(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace PUT signature
    content = re.sub(
        r"export async function PUT\(req: Request, \{ params \}: \{ params: \{ id: string \} \}\) \{",
        "export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {\n    const resolvedParams = await params;\n    const id = resolvedParams.id;",
        content
    )
    
    # Replace DELETE signature
    content = re.sub(
        r"export async function DELETE\(req: Request, \{ params \}: \{ params: \{ id: string \} \}\) \{",
        "export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {\n    const resolvedParams = await params;\n    const id = resolvedParams.id;",
        content
    )

    # Replace params.id with id
    content = content.replace("params.id", "id")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_route('src/app/api/movilfree/products/[id]/route.ts')
fix_route('src/app/api/movilfree/sales/[id]/route.ts')

print("Fixed async params in APIs")
