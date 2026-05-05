const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const period = await prisma.workPeriod.findMany({ orderBy: { id: 'desc' }, take: 1 });
    console.log("PERIOD", period[0].name);
    const condiciones = JSON.parse(period[0].condiciones);
    condiciones.forEach(row => {
        const prod = String(row['Grupo Productos'] || row['Productos FFVV'] || '').toUpperCase();
        if (prod.includes('TMA') || prod.includes('MIC')) {
            console.log(prod, '-> Objetivo1 Plus:', row['Objetivo1 Plus'], 'Objetivo2 Plus:', row['Objetivo2 Plus']);
        }
    });
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
