const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.gastoMensual.findMany({ where: { concepto: 'IVA Móviles' }, select: { year: true } });
  const years = new Set(records.map(r => r.year));
  console.log('IVA Móviles years:', Array.from(years));
}
main().finally(() => prisma.$disconnect());
