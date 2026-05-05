import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { assignments } = body
        
        if (!assignments || !Array.isArray(assignments)) {
            return NextResponse.json({ success: false, error: 'Lista de bonos inválida.' }, { status: 400 })
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
                        ruleId: act.ruleId,
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
                        status: 'LIQUIDATED' // Por defecto, si se superó la barrera en un momento del mes, sumamos directamente
                    }
                });
                inserted++;
            } else {
                skipped++;
            }
        }

        return NextResponse.json({ success: true, inserted, skipped })
    } catch (error) {
        console.error('[API KPI-Sync] Ocurrió un error guardando el bono KPI:', error)
        return NextResponse.json({ success: false, error: 'Fallo interno guardando datos KPI.' }, { status: 500 })
    }
}
