const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.productCatalog.deleteMany({
    where: { categoria: 'RENT' }
  });
  console.log('Deleted', count.count, 'RENT products');
}
main().finally(() => prisma.$disconnect());
