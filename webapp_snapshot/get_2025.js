const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.gastoMensual.findMany({ 
    where: { year: 2025, grupo: 'Gastos Variables' },
    distinct: ['concepto'],
    orderBy: { concepto: 'asc' }
  });
  console.log(records.map(r => r.concepto));
}
main().finally(() => prisma.$disconnect());
