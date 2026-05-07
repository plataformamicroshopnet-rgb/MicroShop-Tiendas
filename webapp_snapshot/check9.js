const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  const weirdSpaces = items.filter(i => /\s{2,}/.test(i.producto) || /\xA0/.test(i.producto));
  console.log('Items with weird spaces:', weirdSpaces.length);
}
main().finally(() => prisma.$disconnect());
