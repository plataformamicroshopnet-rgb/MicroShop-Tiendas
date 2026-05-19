const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sale = await prisma.sale.findMany({
    where: { nif: { contains: '07978741R' } }
  });
  console.log("SALES:", sale);

  const catalogs = await prisma.productCatalog.findMany({
    where: {
       producto: { contains: 'Movistar+ Ficción Total con netflix Premium Futbol Total' }
    }
  });
  console.log("CATALOGS MATCHING:", catalogs);
}
main().finally(() => prisma.$disconnect());
