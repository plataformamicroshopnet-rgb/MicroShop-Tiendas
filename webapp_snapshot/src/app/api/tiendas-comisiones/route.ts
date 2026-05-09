import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const periodKey = searchParams.get('periodKey')

  if (!periodKey) {
    return NextResponse.json({ success: false, error: 'Falta periodKey' }, { status: 400 })
  }

  try {
    const rules = await prisma.tiendaCommissionRule.findMany({
      where: { periodKey },
      orderBy: { createdAt: 'asc' }
    })

    const hours = await prisma.tiendaComercialHour.findMany({
      where: { periodKey },
      orderBy: { comercial: 'asc' }
    })

    return NextResponse.json({ success: true, rules, hours })
  } catch (error) {
    console.error('Error GET tiendas comisiones:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener datos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { periodKey, rules, hours } = data

    if (!periodKey) {
      return NextResponse.json({ success: false, error: 'Falta periodKey' }, { status: 400 })
    }

    // Usaremos una transacción para asegurar consistencia
    await prisma.$transaction([
      prisma.tiendaCommissionRule.deleteMany({ where: { periodKey } }),
      prisma.tiendaComercialHour.deleteMany({ where: { periodKey } }),
      
      prisma.tiendaCommissionRule.createMany({
        data: (rules || []).map((r: any) => ({
          periodKey,
          nombre: r.nombre || '',
          productosCuentan: r.productosCuentan || '',
          objPrimerTramo: r.objPrimerTramo !== undefined && r.objPrimerTramo !== '' ? Number(r.objPrimerTramo) : null,
          importePrimerTramo: r.importePrimerTramo || '',
          objSegundoTramo: r.objSegundoTramo !== undefined && r.objSegundoTramo !== '' ? Number(r.objSegundoTramo) : null,
          importeSegundoTramo: r.importeSegundoTramo || '',
          condicionantes: r.condicionantes || '',
          totalHoras: r.totalHoras !== undefined && r.totalHoras !== '' ? Number(r.totalHoras) : null,
        }))
      }),

      prisma.tiendaComercialHour.createMany({
        data: (hours || []).map((h: any) => ({
          periodKey,
          comercial: h.comercial || '',
          horario: h.horario !== undefined && h.horario !== '' ? Number(h.horario) : 0,
        }))
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error POST tiendas comisiones:', error)
    return NextResponse.json({ success: false, error: 'Error al guardar datos' }, { status: 500 })
  }
}
