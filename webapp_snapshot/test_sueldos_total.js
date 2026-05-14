const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.gastoMensual.findMany({ where: { concepto: 'Sueldos' }, select: { year: true, importe_total: true } });
  console.log(records);
}
main().finally(() => prisma.$disconnect());
