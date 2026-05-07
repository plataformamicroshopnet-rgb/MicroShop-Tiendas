const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  
  const emptyFab = items.filter(i => !i.fabricante || i.fabricante.trim() === '');
  console.log('Items with empty Fabricante:', emptyFab.length);
  if (emptyFab.length > 0) {
      console.log('Sample:', emptyFab[0].producto);
  }
}
main().finally(() => prisma.$disconnect());
