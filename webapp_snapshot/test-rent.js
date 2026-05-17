const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.sale.findMany({ 
    where: { OR: [{ detalle: 'TMA' }, { detalle: 'Rent' }, { rentConCoste: { not: null } }] }, 
    take: 10, 
    orderBy: { createdAt: 'desc' } 
}).then(s => console.log(JSON.stringify(s, null, 2)))
  .catch(e => console.log(e))
  .finally(() => p.$disconnect());
