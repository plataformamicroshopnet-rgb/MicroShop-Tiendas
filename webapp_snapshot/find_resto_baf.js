const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.sale.findMany()
  .then(r => {
    const bafSales = r.filter(s => 
      (s.detalle || '').toLowerCase().includes('resto baf') ||
      (s.producto || '').toLowerCase().includes('resto baf') ||
      (s.grupo || '').toLowerCase().includes('resto baf') ||
      (s.categoria || '').toLowerCase().includes('resto baf')
    );
    console.log(JSON.stringify(bafSales, null, 2));
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect());
