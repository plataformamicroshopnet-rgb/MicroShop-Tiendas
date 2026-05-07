const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  console.log(`Total RENT items: ${items.length}`);
  
  const duplicates = {};
  items.forEach(i => {
    const key = i.producto + '|' + i.validFrom;
    duplicates[key] = (duplicates[key] || 0) + 1;
  });
  
  console.log(`Unique products: ${Object.keys(duplicates).length}`);
  const dupList = Object.entries(duplicates).filter(([k, v]) => v > 1).slice(0, 5);
  console.log('Some duplicates:', dupList);
  
  const sample = items.filter(i => i.producto.includes('AirPods')).slice(0, 5);
  console.log('Sample items:', sample.map(i => ({ p: i.producto, v: i.validFrom, c: i.comision, a: i.anual })));
}

main().finally(() => prisma.$disconnect());
