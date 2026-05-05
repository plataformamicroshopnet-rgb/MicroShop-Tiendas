const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
prisma.sale.findMany({ select: { vendedor: true, codigo: true, periodId: true, fecha: true } }).then(sales => {
  fs.writeFileSync('sales_dump.json', JSON.stringify(sales, null, 2));
  process.exit();
});
