const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.gastoMensual.findMany({ select: { year: true, concepto: true, grupo: true } });
  console.log('Total records:', records.length);
  const years = new Set(records.map(r => r.year));
  console.log('Years in DB:', Array.from(years));
  const ivaYears = new Set(records.filter(r => r.grupo === 'IVA').map(r => r.year));
  console.log('IVA Years:', Array.from(ivaYears));
  const gastosYears = new Set(records.filter(r => r.grupo !== 'IVA').map(r => r.year));
  console.log('Gastos Years:', Array.from(gastosYears));
}
main().finally(() => prisma.$disconnect());
