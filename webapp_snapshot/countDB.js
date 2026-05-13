const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const all = await prisma.vencimiento.findMany();
    console.log("Total records:", all.length);
    const months = {};
    all.forEach(i => {
        const parts = i.fechaFactura.split(/[-/]/);
        if (parts.length >= 3) {
            const m = parseInt(parts[1]);
            months[m] = (months[m] || 0) + 1;
        }
    });
    console.log("By month:", months);
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
