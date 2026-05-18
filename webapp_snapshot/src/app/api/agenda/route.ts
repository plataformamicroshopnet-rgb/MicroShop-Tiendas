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
        const { can } = await import('@/lib/permissions')
        
        if (!session || (!can(session.user, 'MODULE_JEFE_TIENDAS') && !can(session.user, 'MODULE_DIRECCION') && !can(session.user, 'MODULE_BACK_OFFICE') && session.user.role !== 'ROOT')) {
            return NextResponse.json({ error: 'No autorizado para editar la Agenda' }, { status: 403 })
        }

        const body = await request.json()
        const { agendaKey, fecha, ventas, visitas, teams, demos, estado, observaciones } = body

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
                demos: demos !== undefined ? Number(demos) : undefined,
                estado: estado !== undefined ? estado : undefined,
                observaciones: observaciones !== undefined ? observaciones : undefined
            },
            create: {
                codigoComercial: agendaKey,
                fecha: targetDate,
                ventas: Number(ventas) || 0,
                visitas: Number(visitas) || 0,
                teams: Number(teams) || 0,
                demos: Number(demos) || 0,
                estado: estado || 'ACTIVO',
                observaciones: observaciones || null
            }
        })

        return NextResponse.json({ success: true, entry })
    } catch (error: any) {
        require('fs').appendFileSync('agenda_error.log', new Date().toISOString() + ' ' + (error.stack || error) + '\n')
        console.error('Error saving AgendaEntry:', error)
        return NextResponse.json({ error: error.message || 'Failed to save AgendaEntry', stack: error.stack }, { status: 500 })
    }
}
