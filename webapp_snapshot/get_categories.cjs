const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const groups = await prisma.productCatalog.groupBy({
    by: ['categoria'],
    _count: { categoria: true }
  });
  console.log('Categories:', groups);
}
main().finally(() => prisma.$disconnect());
