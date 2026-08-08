export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { ROLES, normalizeRole } from '@/lib/appConfig'

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
      orderBy: { order: 'asc' }
    })

    // ── LOS HORARIOS VAN ENTEROS PARA TODO EL MUNDO ──────────────────────────
    // Antes, a un COMERCIAL se le devolvia SOLO su propia fila. Parecia un
    // recorte inofensivo de privacidad, pero esta tabla es la PLANTILLA del mes:
    // el Panel de Comisiones saca de aqui quienes son los comerciales
    // (getEffectiveSellers). Con una sola fila, el comercial se veia unicamente a
    // si mismo: el ranking salia con el y Marta, y el «Total Comisiones» del mes
    // era su propia comision disfrazada de total del equipo.
    // El dueño quiere justo lo contrario —que se vean entre ellos, por
    // transparencia y porque se lo han pedido— asi que la lista va completa.
    // Lo que NO se abre es el «Registro Operativo» de un compañero: ahi van
    // nombres de cliente y NIF, y eso no es una comision (comisiones/page.tsx).
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
        data: (rules || []).map((r: any, index: number) => ({
          periodKey,
          nombre: r.nombre || '',
          productosCuentan: r.productosCuentan || '',
          objPrimerTramo: r.objPrimerTramo !== undefined && r.objPrimerTramo !== '' ? Number(r.objPrimerTramo) : null,
          importePrimerTramo: r.importePrimerTramo || '',
          objSegundoTramo: r.objSegundoTramo !== undefined && r.objSegundoTramo !== '' ? Number(r.objSegundoTramo) : null,
          importeSegundoTramo: r.importeSegundoTramo || '',
          objTercerTramo: r.objTercerTramo !== undefined && r.objTercerTramo !== '' ? Number(r.objTercerTramo) : null,
          importeTercerTramo: r.importeTercerTramo || '',
          condicionantes: r.condicionantes || '',
          totalHoras: r.totalHoras !== undefined && r.totalHoras !== '' ? Number(r.totalHoras) : null,
          order: index,
        }))
      }),

      prisma.tiendaComercialHour.createMany({
        data: (hours || []).map((h: any) => ({
          periodKey,
          comercial: h.comercial || '',
          tienda: h.tienda ? String(h.tienda) : null,
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
