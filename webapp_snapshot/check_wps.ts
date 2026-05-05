import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function chk() {
    const p = await prisma.workPeriod.findMany();
    console.log("WORK PERIODS:");
    p.forEach(x => console.log(x.id, x.period_key, x.month, x.year));

    console.log("\nTESTING GET /api/sales WHERE CLAUSE MANUALLY:");
    // Let's test the EXACT where clause for 2026_03
    const wp = p.find(x => x.period_key === '2026_03');
    if (wp) {
        const targetMonthStr = String(wp.month).padStart(2, '0')
        const targetYearStr = String(wp.year)
        console.log(`Buscando ventas que matchean: OR [ periodId: ${wp.id}, fecha: {contains: /${targetMonthStr}/${targetYearStr}} ]`);
        const sales = await prisma.sale.findMany({
            where: {
                OR: [
                    { periodId: wp.id },
                    { fecha: { contains: `/${targetMonthStr}/${targetYearStr}` } }
                ]
            }
        });
        console.log(`Encontradas: ${sales.length} ventas.`);
        // Veamos si hay alguna con mes 4!
        const wrongDates = sales.filter(s => s.fecha && s.fecha.includes('/04/'));
        if (wrongDates.length > 0) {
            console.log(`❌ ENCONTRADAS VENTAS CON FECHA DE ABRIL EN EL GET DE MARZO:`, wrongDates.map(s => `${s.id} -> ${s.fecha} | PID: ${s.periodId}`));
        } else {
            console.log(`✅ No hay ventas de Abril coladas en el GET de Marzo.`);
        }
    }
}
chk();
