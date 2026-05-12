import re

filepath = 'prisma/schema.prisma'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_models = """

model MovilFreeProduct {
  id          String   @id @default(cuid())
  nombre      String
  categoria   String
  precio      Float
  coste       Float    @default(0)
  stock       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model MovilFreeClient {
  id            String   @id @default(cuid())
  nif           String   @unique
  nombre        String
  telefono      String?
  email         String?
  totalComprado Float    @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model MovilFreeSale {
  id              String   @id @default(cuid())
  vendedor        String?
  nifCliente      String
  nombreCliente   String?
  listaProductos  String   // JSON stringified array of { id, nombre, cantidad, precio, subtotal }
  importeTotal    Float
  estado          String   @default("COMPLETADA") // "COMPLETADA", "DEVUELTA", "DEVOLUCION_PARCIAL"
  fechaVenta      DateTime @default(now())
  motivoDevolucion String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
"""

if "model MovilFreeProduct" not in content:
    with open(filepath, 'a', encoding='utf-8') as f:
        f.write(new_models)
    print("Models appended to schema.")
else:
    print("Models already exist.")
