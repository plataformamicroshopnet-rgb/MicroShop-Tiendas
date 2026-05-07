const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activePeriod = await prisma.workPeriod.findFirst({ where: { status: 'ACTIVE' } });
  if (!activePeriod) {
    console.log("No active period");
    return;
  }
  const items = await prisma.productCatalog.findMany({ 
    where: { periodId: activePeriod.id, categoria: 'RENT' } 
  });
  console.log(`RENT items in DB for active period: ${items.length}`);
  
  const itemsWithComision = items.filter(i => i.comision && i.comision.length > 0);
  console.log(`Items with comision: ${itemsWithComision.length}`);
}
main().finally(() => prisma.$disconnect());
