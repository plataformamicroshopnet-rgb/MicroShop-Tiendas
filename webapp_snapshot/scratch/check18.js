const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activePeriod = await prisma.workPeriod.findFirst({ where: { status: 'ACTIVE' } });
  const items = await prisma.productCatalog.findMany({ 
    where: { periodId: activePeriod.id, categoria: 'RENT' } 
  });
  console.log(`Total RENT items: ${items.length}`);
  if (items.length > 0) {
      console.log(`Sample 1: ${items[0].producto}`);
      console.log(`Sample 2: ${items[items.length - 1].producto}`);
  }
}
main().finally(() => prisma.$disconnect());
