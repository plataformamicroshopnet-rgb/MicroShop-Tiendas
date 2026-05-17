const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.sale.findMany({ 
    where: { detalle: 'Seguro' }, 
    take: 5, 
    orderBy: { createdAt: 'desc' } 
}).then(s => console.log(JSON.stringify(s, null, 2)))
  .catch(e => console.log(e))
  .finally(() => p.$disconnect());
