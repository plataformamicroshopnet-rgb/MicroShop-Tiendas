const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const activePeriod = await prisma.workPeriod.findFirst({ where: { status: 'ACTIVE' } });
    if (!activePeriod) return console.log('No active period');
    const baf = await prisma.productCatalog.findMany({ where: { categoria: 'Resto BAF', periodId: activePeriod.id } });
    console.log(baf);
}
main();
