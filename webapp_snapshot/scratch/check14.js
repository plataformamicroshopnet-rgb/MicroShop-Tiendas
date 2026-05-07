const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  
  const itemsWithComision = items.filter(i => i.comision && i.comision.length > 0);
  console.log('Total RENT items:', items.length);
  console.log('Items with comision already populated:', itemsWithComision.length);
  if (itemsWithComision.length > 0) {
      console.log('Sample comision:', itemsWithComision[0].comision);
  }
}
main().finally(() => prisma.$disconnect());
