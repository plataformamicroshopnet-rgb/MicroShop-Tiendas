import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function chk() {
    const s1 = await prisma.sale.findMany({ take: 3, orderBy: { updatedAt: 'desc' } });
    s1.forEach(s => {
        console.log(`- ID: ${s.id} | Fecha String: "${s.fecha}" | WP: ${s.periodId}`);
    });
}
chk();
