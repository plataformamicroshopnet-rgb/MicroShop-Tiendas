const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const p = await prisma.productCatalog.findFirst({
        where: {
            producto: {
                contains: 'Movistar+'
            }
        }
    });
    console.log("Product in catalog:", p);

    const cats = await prisma.productCatalog.findMany({
        select: {
            categoria: true
        },
        distinct: ['categoria']
    });
    console.log("Categories:", cats);
    await prisma.$disconnect();
}
check();
