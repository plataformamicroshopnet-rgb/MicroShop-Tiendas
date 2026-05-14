const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records2026 = await prisma.gastoMensual.findMany({ where: { year: 2026 } });
  const records2025 = await prisma.gastoMensual.findMany({ where: { year: 2025 } });
  
  const s2026 = new Set(records2026.map(r => `'${r.concepto}'`));
  const s2025 = new Set(records2025.map(r => `'${r.concepto}'`));
  
  console.log('2026 conceptos:', Array.from(s2026).sort());
  console.log('2025 conceptos:', Array.from(s2025).sort());
}
main().finally(() => prisma.$disconnect());
