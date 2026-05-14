const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const r2026 = await prisma.gastoMensual.findFirst({ where: { year: 2026, concepto: 'Sueldos' } });
  const r2025 = await prisma.gastoMensual.findFirst({ where: { year: 2025, concepto: 'Sueldos' } });
  console.log('2026 grupo:', r2026?.grupo);
  console.log('2025 grupo:', r2025?.grupo);
}
main().finally(() => prisma.$disconnect());
