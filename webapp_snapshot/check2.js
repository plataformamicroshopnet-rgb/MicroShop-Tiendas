const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  
  const names = {};
  items.forEach(i => {
    names[i.producto] = (names[i.producto] || 0) + 1;
  });
  
  const dupNames = Object.entries(names).filter(([k,v]) => v > 1);
  console.log('Products with multiple entries (ignoring date):', dupNames.length);
  console.log('Some examples:', dupNames.slice(0, 10));

  if (dupNames.length > 0) {
      const sampleItem = items.filter(i => i.producto === dupNames[0][0]);
      console.log('Sample duplicate details:', sampleItem.map(i => ({ d: i.validFrom, c: i.comision, a: i.anual })));
  }
}

main().finally(() => prisma.$disconnect());
