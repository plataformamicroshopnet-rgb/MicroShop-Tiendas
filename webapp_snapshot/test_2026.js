const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.gastoMensual.findMany({ where: { year: 2026 }, select: { grupo: true, concepto: true } });
  console.log('2026 records:', records.length);
  const iva = records.filter(r => r.grupo === 'IVA');
  const gastos = records.filter(r => r.grupo !== 'IVA');
  console.log('2026 IVA records:', iva.length);
  console.log('2026 Gastos records:', gastos.length);
  if (gastos.length > 0) {
    console.log('Sample Gastos 2026:', gastos.slice(0, 3));
  }
}
main().finally(() => prisma.$disconnect());
