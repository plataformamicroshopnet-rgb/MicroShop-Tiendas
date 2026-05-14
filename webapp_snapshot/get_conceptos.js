const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.gastoMensual.findMany({ 
    where: { year: 2026, grupo: 'Gastos Variables' },
    distinct: ['concepto'],
    select: { concepto: true }
  });
  console.log('Conceptos en Gastos Variables 2026:');
  console.log(records.map(r => r.concepto).join('\n'));
}
main().finally(() => prisma.$disconnect());
