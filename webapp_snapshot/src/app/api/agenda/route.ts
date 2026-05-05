import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Missing startDate or endDate' }, { status: 400 })
        }

        const start = new Date(startDate)
        const end = new Date(endDate)

        const entries = await prisma.agendaEntry.findMany({
            where: {
                fecha: {
                    gte: start,
                    lte: end
                }
            }
        })

        return NextResponse.json(entries)
    } catch (error) {
        console.error('Error fetching Agenda:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session || (session.user.role !== 'JEFE DE VENTAS' && session.user.role !== 'ROOT' && session.user.role !== 'ADMIN' && session.user.role !== 'BACK OFFICE')) {
            return NextResponse.json({ error: 'No autorizado para editar la Agenda' }, { status: 403 })
        }

        const body = await request.json()
        const { agendaKey, fecha, ventas, visitas, teams, estado, observaciones } = body

        if (!agendaKey || !fecha) {
            return NextResponse.json({ error: 'agendaKey and fecha are required' }, { status: 400 })
        }

        const targetDate = new Date(fecha)

        // IMPORTANTE: En el modelo AgendaEntry, la columna física original sigue llamándose 
        // 'codigoComercial' por diseño de esquema. Sin embargo, lógicamente está actuando
        // EXCLUSIVAMENTE como el 'agendaKey' estable para la persistencia global de Agenda, 
        // sin contaminarse con el código corporativo puro del sistema.
        const entry = await prisma.agendaEntry.upsert({
            where: {
                codigoComercial_fecha: {
                    codigoComercial: agendaKey,
                    fecha: targetDate
                }
            },
            update: {
                ventas: ventas !== undefined ? Number(ventas) : undefined,
                visitas: visitas !== undefined ? Number(visitas) : undefined,
                teams: teams !== undefined ? Number(teams) : undefined,
                estado: estado !== undefined ? estado : undefined,
                observaciones: observaciones !== undefined ? observaciones : undefined
            },
            create: {
                codigoComercial: agendaKey,
                fecha: targetDate,
                ventas: Number(ventas) || 0,
                visitas: Number(visitas) || 0,
                teams: Number(teams) || 0,
                estado: estado || 'ACTIVO',
                observaciones: observaciones || null
            }
        })

        return NextResponse.json({ success: true, entry })
    } catch (error) {
        console.error('Error saving AgendaEntry:', error)
        return NextResponse.json({ error: 'Failed to save AgendaEntry' }, { status: 500 })
    }
}
