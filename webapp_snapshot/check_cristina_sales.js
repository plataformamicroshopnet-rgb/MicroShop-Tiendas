const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const sales = await prisma.sale.findMany({
        where: { vendedor: 'Cristina' }
    });
    console.log(sales);
    await prisma.$disconnect();
}
check();
