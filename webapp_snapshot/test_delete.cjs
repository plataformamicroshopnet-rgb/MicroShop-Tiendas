const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    let targetPeriodId = null;
    await prisma.productCatalog.deleteMany({
      where: { periodId: targetPeriodId }
    });
    console.log('success');
  } catch(e) {
    console.error(e);
  }
}
main().finally(() => prisma.$disconnect());
