const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records2026 = await prisma.gastoMensual.findMany({ where: { year: 2026 } });
  console.log('2026 records total:', records2026.length);
  const records2025 = await prisma.gastoMensual.findMany({ where: { year: 2025 } });
  console.log('2025 records total:', records2025.length);
}
main().finally(() => prisma.$disconnect());
