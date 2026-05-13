model_str = """
model Vencimiento {
  id           String   @id @default(cuid())
  proveedor    String
  fechaFactura String
  albaran      String?
  nFactura     String?
  vencimiento  String
  pagado       Boolean  @default(false)
  recargo      Float    @default(0)
  tarjetas     Float    @default(0)
  accesorios   Float    @default(0)
  moviles      Float    @default(0)
  iva          Float    @default(0)
  totalFactura Float    @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
"""

with open('prisma/schema.prisma', 'a', encoding='utf-8') as f:
    f.write(model_str)
print("Model appended successfully")
