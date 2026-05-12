const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.sale.findMany()
  .then(r => console.log([...new Set(r.map(s => s.detalle))]))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
