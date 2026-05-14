const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.gastoMensual.findMany({ 
    where: { year: 2026, grupo: 'Gastos Variables' },
    distinct: ['concepto'],
    orderBy: { concepto: 'asc' }
  });
  console.log('Conceptos en Gastos Variables 2026 (DB sorted):');
  console.log(records.map(r => r.concepto));
}
main().finally(() => prisma.$disconnect());
