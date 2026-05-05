import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function dump() {
    console.log("LAST 10 EDITED SALES IN DB:");
    const s = await prisma.sale.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10
    });

    s.forEach(sale => {
        console.log(`- ID: ${sale.id} | Prod: ${sale.producto} | Fecha: '${sale.fecha}' | periodId: ${sale.periodId}`);
    });
}
dump();
