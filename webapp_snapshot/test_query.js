const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const period = await prisma.workPeriod.findFirst({
        where: { name: 'ABRIL 2026' }
    });
    const condiciones = JSON.parse(period.condiciones);
    
    // Find TMA and MIC for Segmento Plus
    console.log("------- OBJETIVOS ABRIL 2026 --------");
    condiciones.forEach(row => {
        const prod = (row['Grupo Productos'] || row['Productos FFVV'] || '').toUpperCase();
        if (prod.includes('TMA') || prod.includes('MICRO') || prod.includes('MIC')) {
            console.log(prod, '-> Objetivo1 Plus:', row['Objetivo1 Plus'], 'Objetivo2 Plus:', row['Objetivo2 Plus']);
        }
    });

}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
