import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'

const prisma = new PrismaClient()

export async function GET(request: Request) {
    try {
        const session = await getSession()
        if (!session || !session.user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const quarterKey = searchParams.get('quarterKey') // Ej: "2026_Q2"

        if (!quarterKey) {
            return NextResponse.json({ success: false, error: 'quarterKey es requerido' }, { status: 400 })
        }

        const [yearStr, qStr] = quarterKey.split('_')
        const year = parseInt(yearStr)
        
        let months: string[] = []
        if (qStr === 'Q1') months = ['01', '02', '03']
        if (qStr === 'Q2') months = ['04', '05', '06']
        if (qStr === 'Q3') months = ['07', '08', '09']
        if (qStr === 'Q4') months = ['10', '11', '12']

        if (months.length === 0) {
            return NextResponse.json({ success: false, error: 'Formato de quarterKey inválido' }, { status: 400 })
        }

        // 1. Obtener los WorkPeriods de los 3 meses
        const periodKeys = months.map(m => `${year}_${m}`)
        const monthlyPeriods = await prisma.workPeriod.findMany({
            where: { period_key: { in: periodKeys } }
        })
        const monthlyPeriodIds = monthlyPeriods.map(p => p.id)

        // 3. Obtener todas las ventas de los 3 meses
        const sales = await prisma.sale.findMany({
            where: { periodId: { in: monthlyPeriodIds } }
        })

        // Agrupar ventas por mes para enviarlas al front
        const salesByMonth: Record<string, any[]> = {}
        monthlyPeriods.forEach(p => {
            salesByMonth[p.period_key] = sales.filter(s => s.periodId === p.id)
        })

        // 4. Obtener Objetivos e Importes (Pyme y Captador) para los 3 meses
        const allPeriodIdsToFetch = [...monthlyPeriodIds]
        
        const objetivosDB = await prisma.objective.findMany({
            where: { periodId: { in: allPeriodIdsToFetch } }
        })
        
        const importesPymeDB = await prisma.importePyme.findMany({
            where: { periodId: { in: allPeriodIdsToFetch } }
        })
        
        const importesPlusDB = await prisma.importePlus.findMany({
            where: { periodId: { in: allPeriodIdsToFetch } }
        })

        // Estructurar la respuesta
        return NextResponse.json({
            success: true,
            data: {
                monthlyPeriods,
                salesByMonth,
                allQuarterSales: sales,
                objetivosDB,
                importesPymeDB,
                importesPlusDB
            }
        })
    } catch (error: any) {
        console.error('[Repesca API] Error:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
