const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.productCatalog.create({
    data: {
      categoria: 'RENT',
      producto: 'APPLE iPhone 15 Pro 256GB RENT',
      mensual: '30.50',
      anual: '732',
      periodId: '5557519f-0d6a-442a-8784-12b599785218',
      fabricante: 'APPLE',
      subcategoria: 'SMARTPHONE',
      gama: 'PREMIUM'
    }
  });
  console.log("Mock iPhone injected successfully.");
}

main().finally(() => prisma.$disconnect());
