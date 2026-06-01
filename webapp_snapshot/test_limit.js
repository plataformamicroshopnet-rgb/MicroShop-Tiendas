const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dummy = [];
  for (let i = 0; i < 700; i++) {
    dummy.push({
      categoria: 'Test',
      producto: 'P' + i,
      mensual: '1',
      anual: '12',
      periodId: null
    });
  }
  
  try {
    await prisma.productCatalog.createMany({ data: dummy });
    console.log('Success creating 700 records');
    await prisma.productCatalog.deleteMany({ where: { categoria: 'Test' } });
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main().finally(() => prisma.$disconnect());
