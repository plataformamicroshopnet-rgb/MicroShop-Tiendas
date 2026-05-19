const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const records = await prisma.productCatalog.findMany();
  const cats = [...new Set(records.map(x => x.categoria).filter(c => c && c.toLowerCase().includes('traslado')))];
  console.log('Categories with Traslado:', cats);
}
run().finally(() => prisma.$disconnect());
