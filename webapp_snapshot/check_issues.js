const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const rules = await prisma.tiendaCommissionRule.findMany();
    console.table(rules.map(r => ({ nombre: r.nombre, productosCuentan: r.productosCuentan })));

    const laraSales = await prisma.sale.findMany({ where: { vendedor: 'Lara' } });
    console.log("\nLARA SALES:");
    console.table(laraSales.map(s => ({ producto: s.producto, detalle: s.detalle })));

    const carlosSales = await prisma.sale.findMany({ where: { vendedor: 'Carlos' } });
    console.log("\nCARLOS SALES:");
    console.table(carlosSales.map(s => ({ producto: s.producto, detalle: s.detalle })));

    await prisma.$disconnect();
}
check();
