const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.sale.findMany({where: {detalle: 'Resto BAF'}})
  .then(r => console.log(JSON.stringify(r.map(s => ({id: s.id, categoria: s.categoria, grupo: s.grupo, detalle: s.detalle, producto: s.producto, codigo: s.codigo})), null, 2)))
  .catch(console.error)
  .finally(()=>prisma.$disconnect());
