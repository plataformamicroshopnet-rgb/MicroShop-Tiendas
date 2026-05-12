const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.catalog.findMany()
  .then(r => console.log([...new Set(r.map(c => c.category))]))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
