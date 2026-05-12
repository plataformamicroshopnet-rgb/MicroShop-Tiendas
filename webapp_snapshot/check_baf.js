const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.sale.findMany()
  .then(r => {
    const m = new Map();
    r.forEach(s => {
      const k = `detalle: ${s.detalle} | grupo: ${s.grupo} | producto: ${s.producto}`;
      m.set(k, (m.get(k) || 0) + 1);
    });
    console.log(Array.from(m.entries()).filter(([k,v]) => k.includes('BAF')));
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect());
