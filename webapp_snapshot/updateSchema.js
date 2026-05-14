const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

schema = schema.replace(/model GastoMensual \{[\s\S]*?\}/, `model GastoMensual {
  id        String   @id @default(uuid())
  year      Int
  month     Int
  grupo     String
  concepto  String
  importe_c Float    @default(0)
  importe_r Float    @default(0)
  importe_dif Float  @default(0)
  importe_total Float @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([year, month, grupo, concepto])
}`);

fs.writeFileSync('prisma/schema.prisma', schema, 'utf8');
