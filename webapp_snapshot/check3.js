const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  
  console.log('Total items:', items.length);
  const sample = items.slice(0, 10).map(i => ({ producto: i.producto, validFrom: i.validFrom }));
  console.log('Sample validFrom values:', sample);
}

main().finally(() => prisma.$disconnect());
