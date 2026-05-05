const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.productCatalog.count();
  console.log('Total ProductCatalog count:', count);
  
  const allGroups = await prisma.productCatalog.groupBy({
    by: ['categoria']
  });
  console.log('Categories:', allGroups);
}
main().finally(() => prisma.$disconnect());
