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

        const entries = await prisma.agendaCristinaEntry.findMany({
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
        const { agendaKey, fecha, campanas, clientesPropios, dispositivos, baf, repos, bdSalva, competencia, estado, observaciones } = body

        if (!agendaKey || !fecha) {
            return NextResponse.json({ error: 'agendaKey and fecha are required' }, { status: 400 })
        }

        const targetDate = new Date(fecha)

        // IMPORTANTE: En el modelo AgendaEntry, la columna física original sigue llamándose 
        // 'codigoComercial' por diseño de esquema. Sin embargo, lógicamente está actuando
        // EXCLUSIVAMENTE como el 'agendaKey' estable para la persistencia global de Agenda, 
        // sin contaminarse con el código corporativo puro del sistema.
        const entry = await prisma.agendaCristinaEntry.upsert({
            where: {
                codigoComercial_fecha: {
                    codigoComercial: agendaKey,
                    fecha: targetDate
                }
            },
            update: {
                campanas: campanas !== undefined ? Number(campanas) : undefined,
                clientesPropios: clientesPropios !== undefined ? Number(clientesPropios) : undefined,
                dispositivos: dispositivos !== undefined ? Number(dispositivos) : undefined,
                baf: baf !== undefined ? Number(baf) : undefined,
                repos: repos !== undefined ? Number(repos) : undefined,
                bdSalva: bdSalva !== undefined ? Number(bdSalva) : undefined,
                competencia: competencia !== undefined ? Number(competencia) : undefined,
                estado,
                observaciones
            },
            create: {
                codigoComercial: agendaKey,
                fecha: new Date(fecha),
                campanas: Number(campanas) || 0,
                clientesPropios: Number(clientesPropios) || 0,
                dispositivos: Number(dispositivos) || 0,
                baf: Number(baf) || 0,
                repos: Number(repos) || 0,
                bdSalva: Number(bdSalva) || 0,
                competencia: Number(competencia) || 0,
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
