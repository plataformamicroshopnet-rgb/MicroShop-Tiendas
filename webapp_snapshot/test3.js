const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const periods = await prisma.workPeriod.findMany({ orderBy: { id: 'desc' }, take: 3 });
    for (const period of periods) {
        console.log("PERIOD", period.periodKey, period.isActive);
        try {
            const condiciones = JSON.parse(period.condicionesExtra || period.condiciones || "[]");
            condiciones.forEach(row => {
                const prod = String(row['Grupo Productos'] || row['Productos FFVV'] || '').toUpperCase();
                if (prod.includes('TMA') || prod.includes('MIC')) {
                    console.log('  ', prod, '-> Obj1 Plus:', row['Objetivo1 Plus'], 'Obj2 Plus:', row['Objetivo2 Plus']);
                }
            });
        } catch (e) {}
    }
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
