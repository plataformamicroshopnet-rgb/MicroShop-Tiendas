import re

filepath = 'src/app/api/movilfree/products/route.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_post = """export async function POST(req: Request) {
  try {
    const data = await req.json()
    if (Array.isArray(data)) {
      await prisma.movilFreeProduct.createMany({ data })
      return NextResponse.json({ success: true, count: data.length })
    }
    const item = await prisma.movilFreeProduct.create({
      data: {
        nombre: data.nombre,
        categoria: data.categoria,
        precio: data.precio,
        coste: data.coste,
        stock: data.stock
      }
    })
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}"""

content = re.sub(
    r"export async function POST\(req: Request\) \{.*?return NextResponse\.json\(\{ error: e\.message \}, \{ status: 500 \}\)\n  \}\n\}",
    new_post,
    content,
    flags=re.DOTALL
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Products API for bulk insert")
