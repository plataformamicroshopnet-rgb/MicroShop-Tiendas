const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.gastoMensual.findMany({ 
    where: { year: 2026, concepto: 'Comisiones Bancarias' },
    orderBy: { month: 'asc' }
  });
  console.log('Comisiones Bancarias 2026 FULL:', records);
}
main().finally(() => prisma.$disconnect());
