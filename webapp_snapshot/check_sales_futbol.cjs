const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sales = await prisma.sale.findMany({ 
        where: { 
            producto: { contains: 'Fútbol' }
        } 
    });
    console.log(sales);
}
main();
