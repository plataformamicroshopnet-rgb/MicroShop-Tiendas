const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.productCatalog.findMany({ where: { producto: { contains: 'Traslado' } } })
  .then(c => console.log([...new Set(c.map(x => x.producto))]))
  .finally(() => prisma.$disconnect());
