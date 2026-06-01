const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const records = await prisma.productCatalog.groupBy({
    by: ['categoria'],
    _count: {id: true},
    where: {periodId: null}
  });
  console.log(records);
}
main().finally(() => prisma.$disconnect());
