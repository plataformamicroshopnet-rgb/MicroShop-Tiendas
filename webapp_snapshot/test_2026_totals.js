const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.gastoMensual.findMany({ where: { year: 2026, grupo: { not: 'IVA' } } });
  const total = records.reduce((sum, r) => sum + r.importe_total, 0);
  console.log('2026 Gastos Total:', total);
}
main().finally(() => prisma.$disconnect());
