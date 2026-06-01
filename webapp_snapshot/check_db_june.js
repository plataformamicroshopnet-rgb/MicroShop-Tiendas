const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const wp = await prisma.workPeriod.findUnique({where: {period_key: '2026_06'}});
  if(!wp) return console.log('no june');
  const prods = await prisma.productCatalog.groupBy({
    by: ['categoria'],
    _count: {id: true},
    where: {periodId: wp.id}
  });
  console.log(prods);
}
main().finally(() => prisma.$disconnect());
