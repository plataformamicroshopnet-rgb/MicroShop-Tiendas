const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const items = await prisma.productCatalog.findMany();
  const short = items.filter(i => (i.producto || '').length <= 10);
  for(let s of short.slice(0, 5)) {
      console.log("Short:", s.producto);
  }
}
main().finally(() => prisma.$disconnect());
