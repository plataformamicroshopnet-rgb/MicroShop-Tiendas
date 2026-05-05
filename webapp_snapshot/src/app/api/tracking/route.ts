import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'

const prisma = new PrismaClient()

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const month = Number(searchParams.get('month'))
    const year = Number(searchParams.get('year'))

    if (!month || !year) return NextResponse.json({ error: 'Falta mes/año' }, { status: 400 })

    let period = await prisma.trackingPeriod.findUnique({
        where: { month_year: { month, year } },
        include: { 
            groups: { 
                include: { rows: { orderBy: { order: 'asc' } } }, 
                orderBy: { order: 'asc' } 
            } 
        }
    })

    if (!period) {
        period = await prisma.trackingPeriod.create({
            data: { month, year },
            include: { groups: { include: { rows: true } } }
        })
    }

    return NextResponse.json(period)
}

export async function POST(request: Request) {
    const session = await getSession()
    if (!session || !canEdit(session.user, 'MODULE_JEFE_TIENDAS')) {
        return NextResponse.json({ error: 'No autorizado / Solo Lectura' }, { status: 403 })
    }

    const { month, year, groups } = await request.json()

    const period = await prisma.trackingPeriod.findUnique({ where: { month_year: { month, year } } })
    if (!period) return NextResponse.json({ error: 'Periodo no existe' }, { status: 404 })

    // Sobreescritura total estructurada
    await prisma.trackingGroup.deleteMany({ where: { periodId: period.id } })

    await prisma.trackingPeriod.update({
        where: { id: period.id },
        data: {
            groups: {
                create: groups.map((g: any, gIdx: number) => ({
                    name: g.name,
                    order: gIdx,
                    pymeVal: g.pymeVal || null,
                    basicoVal: g.basicoVal || null,
                    rows: {
                        create: g.rows.map((r: any, rIdx: number) => ({
                            comercialName: r.comercialName,
                            objectiveMonth: Number(r.objectiveMonth) || 0,
                            week1: Number(r.week1) || 0,
                            week2: Number(r.week2) || 0,
                            week3: Number(r.week3) || 0,
                            week4: Number(r.week4) || 0,
                            order: rIdx
                        }))
                    }
                }))
            }
        }
    })

    return NextResponse.json({ success: true })
}
