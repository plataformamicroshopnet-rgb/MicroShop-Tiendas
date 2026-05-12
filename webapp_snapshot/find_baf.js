const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.sale.findMany()
  .then(r => {
    const bafSales = r.filter(s => 
      (s.detalle || '').toLowerCase().includes('baf') ||
      (s.producto || '').toLowerCase().includes('baf') ||
      (s.grupo || '').toLowerCase().includes('baf') ||
      (s.categoria || '').toLowerCase().includes('baf')
    );
    console.log(JSON.stringify(bafSales, null, 2));
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect());
