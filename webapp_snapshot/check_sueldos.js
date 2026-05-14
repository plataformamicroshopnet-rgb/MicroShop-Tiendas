const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.gastoMensual.findMany({ where: { concepto: 'Sueldos' }, select: { year: true } });
  console.log('Sueldos years:', Array.from(new Set(records.map(r => r.year))));
}
main().finally(() => prisma.$disconnect());
