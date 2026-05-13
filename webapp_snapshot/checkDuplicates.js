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
    
    const distinct = new Set(records.map(r => r.producto).filter(Boolean));
    console.log(`Total O2 products: ${records.length}`);
    console.log(`Distinct O2 products: ${distinct.size}`);
    
    // Find what might be missing or duplicated
    const grouped = {};
    for (const r of records) {
        if (!grouped[r.producto]) grouped[r.producto] = [];
        grouped[r.producto].push(r.subcategoria);
    }
    
    for (const [prod, subcats] of Object.entries(grouped)) {
        if (subcats.length > 1) {
            console.log(`Duplicate product name across subcategories: ${prod} -> ${subcats.join(', ')}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
