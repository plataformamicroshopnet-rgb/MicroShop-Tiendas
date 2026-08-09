import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { exigeSesion } from '@/lib/apiGuard'

const prisma = new PrismaClient()

export async function POST(request: Request) {
    try {
        // Este endpoint BORRA y crea bonos KPI. Antes entraba cualquiera sin
        // sesión, y además el navegador lo disparaba solo al abrir el Panel de
        // CUALQUIER mes — incluidos los cerrados, que se reescribían al mirarlos.
        // Dos llaves: (1) hay que estar logueado; (2) solo se toca el mes ACTIVO
        // o uno futuro — un mes histórico ya no se reescribe por abrirlo.
        const no = await exigeSesion(request); if (no) return no
        const body = await request.json()
        const { assignments, periodKey } = body

        if (!assignments || !Array.isArray(assignments)) {
            return NextResponse.json({ success: false, error: 'Lista de bonos inválida.' }, { status: 400 })
        }

        if (periodKey) {
            const period = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } });
            if (period) {
                if (period.status === 'HISTORIC') {
                    return NextResponse.json({ success: true, skipped: true, message: 'Mes cerrado: no se reescriben sus bonos.' })
                }
                // Find existing KPI automatic assignments for this period
                const existingKpis = await prisma.extraAssignment.findMany({
                    where: {
                        periodId: period.id,
                        sourceType: 'AUTOMATIC',
                        OR: [
                            { triggerKey: { contains: '-KPI_' } },
                            { triggerKey: { startsWith: 'TERRITORIAL_' } }
                        ]
                    }
                });
                
                const incomingKeys = assignments.map(a => a.triggerKey);
                const keysToDelete = existingKpis.filter(e => !incomingKeys.includes(e.triggerKey)).map(e => e.id);
                
                if (keysToDelete.length > 0) {
                    await prisma.extraAssignment.deleteMany({
                        where: { id: { in: keysToDelete } }
                    });
                    console.log(`[API KPI-Sync] Limpiados ${keysToDelete.length} bonos KPI huérfanos.`);
                }
            }
        }

        let inserted = 0;
        let skipped = 0;

        for (const act of assignments) {
            // Verificar idempotencia usando la triggerKey generada por el frontend
            const existing = await prisma.extraAssignment.findUnique({
                where: { triggerKey: act.triggerKey }
            });

            if (!existing) {
                await prisma.extraAssignment.create({
                    data: {
                        ruleId: act.ruleId?.startsWith('TERRITORIAL_') ? null : act.ruleId,
                        periodId: act.periodId,
                        sourceType: 'AUTOMATIC',
                        seller: act.seller,
                        customerName: act.customerName || 'Bono Global Mensual',
                        customerNif: act.customerNif || 'N/A',
                        triggerKey: act.triggerKey,
                        triggerSummary: act.triggerSummary,
                        sourceSaleIds: JSON.stringify(act.sourceSaleIds || []),
                        telecomRewardAmount: act.telecomRewardAmount,
                        sellerRewardAmount: act.sellerRewardAmount,
                        status: act.status || 'LIQUIDATED'
                    }
                });
                inserted++;
            } else {
                if (
                    existing.telecomRewardAmount !== act.telecomRewardAmount ||
                    existing.sellerRewardAmount !== act.sellerRewardAmount ||
                    existing.status !== (act.status || 'LIQUIDATED') ||
                    existing.triggerSummary !== act.triggerSummary
                ) {
                    await prisma.extraAssignment.update({
                        where: { id: existing.id },
                        data: {
                            telecomRewardAmount: act.telecomRewardAmount,
                            sellerRewardAmount: act.sellerRewardAmount,
                            status: act.status || 'LIQUIDATED',
                            triggerSummary: act.triggerSummary,
                            sourceSaleIds: JSON.stringify(act.sourceSaleIds || [])
                        }
                    });
                    inserted++;
                } else {
                    skipped++;
                }
            }
        }

        return NextResponse.json({ success: true, inserted, skipped })
    } catch (error) {
        console.error('[API KPI-Sync] Ocurrió un error guardando el bono KPI:', error)
        return NextResponse.json({ success: false, error: 'Fallo interno guardando datos KPI.' }, { status: 500 })
    }
}
