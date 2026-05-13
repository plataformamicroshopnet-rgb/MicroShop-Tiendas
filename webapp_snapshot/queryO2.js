const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const activePeriod = await prisma.workPeriod.findFirst({
        where: { status: 'ACTIVE' }
    });
    
    const records = await prisma.productCatalog.findMany({
        where: { 
            categoria: 'O2',
            periodId: activePeriod ? activePeriod.id : null
        }
    });
    console.log(`Found ${records.length} O2 products in active period`);
    for (const r of records) {
        console.log(`ID: ${r.id}, subcategoria: ${r.subcategoria}, producto: ${r.producto}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
