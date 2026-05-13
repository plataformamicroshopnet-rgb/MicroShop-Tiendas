const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const activePeriod = await prisma.workPeriod.findFirst({
        where: { status: 'ACTIVE' }
    });
    
    // Let's count O2 products in all periods
    const allRecords = await prisma.productCatalog.findMany({
        where: { categoria: 'O2' }
    });
    
    console.log(`Total O2 products across all time: ${allRecords.length}`);
    
    // Group by period
    const grouped = {};
    for(const r of allRecords) {
        const pId = r.periodId || 'Legacy';
        if (!grouped[pId]) grouped[pId] = 0;
        grouped[pId]++;
    }
    console.log(grouped);
}

main().catch(console.error).finally(() => prisma.$disconnect());
