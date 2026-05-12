import re

filepath = 'src/app/api/movilfree/sales/route.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace POST creation logic
new_post_logic = """
    const lastSale = await prisma.movilFreeSale.findFirst({
      where: { numeroFactura: { not: null } },
      orderBy: { numeroFactura: 'desc' }
    })
    const newInvoiceNumber = lastSale && lastSale.numeroFactura ? lastSale.numeroFactura + 1 : 31000;

    // Create the sale
    const item = await prisma.movilFreeSale.create({
      data: {
        vendedor: data.vendedor,
        nifCliente: data.nifCliente,
        nombreCliente: data.nombreCliente,
        listaProductos: listaProductosStr,
        importeTotal: Number(data.importeTotal),
        estado: 'COMPLETADA',
        numeroFactura: newInvoiceNumber
      }
    })
"""

content = re.sub(
    r"    // Create the sale\n    const item = await prisma\.movilFreeSale\.create\(\{\n      data: \{\n        vendedor: data\.vendedor,\n        nifCliente: data\.nifCliente,\n        nombreCliente: data\.nombreCliente,\n        listaProductos: listaProductosStr,\n        importeTotal: Number\(data\.importeTotal\),\n        estado: 'COMPLETADA'\n      \}\n    \}\)",
    new_post_logic,
    content
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Sales API to include numeroFactura")
