import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'

const prisma = new PrismaClient()

export async function POST(request: Request) {
    const session = await getSession()
    if (!session || !canEdit(session.user, 'MODULE_JEFE_TIENDAS')) {
        return NextResponse.json({ error: 'No autorizado para ejecutar clonaciones.' }, { status: 403 })
    }

    const { month, year } = await request.json()

    if (!month || !year) {
        return NextResponse.json({ error: 'Falta mes/año para clonar.' }, { status: 400 })
    }

    // Calcular el mes M-1
    let prevMonth = month - 1
    let prevYear = year
    if (prevMonth === 0) {
        prevMonth = 12
        prevYear = year - 1
    }

    // Buscar la estructura del mes anterior
    const prevPeriod = await prisma.trackingPeriod.findUnique({
        where: { month_year: { month: prevMonth, year: prevYear } },
        include: {
            groups: {
                include: { rows: { orderBy: { order: 'asc' } } },
                orderBy: { order: 'asc' }
            }
        }
    })

    if (!prevPeriod || prevPeriod.groups.length === 0) {
        return NextResponse.json({ error: `No hay Segumiento Diario guardado en ${prevMonth}/${prevYear} para clonar.` }, { status: 404 })
    }

    // Limpiar el periodo actual si existiese algo (protección idempotente)
    let currentPeriod = await prisma.trackingPeriod.findUnique({
        where: { month_year: { month, year } }
    })
    
    if (!currentPeriod) {
        currentPeriod = await prisma.trackingPeriod.create({
            data: { month, year }
        })
    } else {
        await prisma.trackingGroup.deleteMany({ where: { periodId: currentPeriod.id } })
    }

    // Copiar la estructura jerárquica
    await prisma.trackingPeriod.update({
        where: { id: currentPeriod.id },
        data: {
            groups: {
                create: prevPeriod.groups.map(g => ({
                    name: g.name,
                    order: g.order,
                    // Opcionalmente se podrían resetear o mantener estos promedios macro. Los reseteamos por sanidad:
                    pymeVal: null,
                    basicoVal: null,
                    rows: {
                        create: g.rows.map(r => ({
                            comercialName: r.comercialName,
                            order: r.order,
                            objectiveMonth: r.objectiveMonth, // Mantenemos el objetivo por defecto
                            week1: 0,
                            week2: 0,
                            week3: 0,
                            week4: 0
                        }))
                    }
                }))
            }
        }
    })

    // Devolver el panorama resultante actualizado para re-renderizado
    const updatedPeriod = await prisma.trackingPeriod.findUnique({
        where: { id: currentPeriod.id },
        include: { 
            groups: { 
                include: { rows: { orderBy: { order: 'asc' } } }, 
                orderBy: { order: 'asc' } 
            } 
        }
    })

    return NextResponse.json({ success: true, period: updatedPeriod })
}
