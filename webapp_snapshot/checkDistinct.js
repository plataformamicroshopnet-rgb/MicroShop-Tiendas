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
    
    const distinct = [...new Set(records.map(p => p.producto).filter(Boolean))].sort();
    console.log(`Distinct products count: ${distinct.length}`);
    for (const d of distinct) {
        console.log(`- ${d}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
