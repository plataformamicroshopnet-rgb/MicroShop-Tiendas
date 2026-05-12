const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.catalog.findMany({where: {category: 'Resto BAF'}})
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
