const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.gastoMensual.create({
    data: {
      year: 2026,
      month: 1,
      grupo: 'Gastos Variables',
      concepto: 'Material de Oficina',
      importe_c: 0,
      importe_r: 0,
      importe_dif: 0,
      importe_total: 0
    }
  });
}
main().finally(() => prisma.$disconnect());
