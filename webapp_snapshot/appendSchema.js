const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModel = `
model GastoMensual {
  id        String   @id @default(uuid())
  year      Int
  month     Int
  grupo     String   // e.g., 'Gastos Fijos', 'Gastos Variables', 'Impuestos', 'Ingresos'
  concepto  String
  importe   Float
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([year, month, grupo, concepto])
}
`;

if (!schema.includes('model GastoMensual')) {
    schema += newModel;
    fs.writeFileSync('prisma/schema.prisma', schema, 'utf8');
    console.log("Model appended.");
} else {
    console.log("Model already exists.");
}
