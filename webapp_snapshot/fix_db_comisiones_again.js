const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.gastoMensual.deleteMany({
    where: { year: 2026, concepto: 'Comisiones Bancarias' }
  });

  await prisma.gastoMensual.create({
    data: {
      year: 2026,
      month: 1, // ENERO
      grupo: 'Gastos Variables',
      concepto: 'Comisiones Bancarias',
      importe_c: 391.71,
      importe_r: 414.85,
      importe_dif: 50.39,
      importe_total: 856.95
    }
  });

  console.log('Comisiones Bancarias fixed in DB.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
