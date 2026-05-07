const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activePeriod = await prisma.workPeriod.findFirst({ where: { status: 'ACTIVE' } });
  const sales = await prisma.sale.findMany({ 
    where: { periodId: activePeriod.id, vendedor: 'Elena' } 
  });
  console.log(`Found ${sales.length} sales`);
  if (sales.length > 0) {
      console.log(sales[0]);
  }
}
main().finally(() => prisma.$disconnect());
