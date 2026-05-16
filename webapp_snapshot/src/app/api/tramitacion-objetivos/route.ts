import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { can, canView } from '@/lib/permissions'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodKey = searchParams.get('periodKey')

    if (!periodKey) {
      return NextResponse.json({ success: false, error: 'Falta periodKey' }, { status: 400 })
    }

    const objectives = await prisma.tiendaStoreObjective.findMany({
      where: { periodKey }
    })

    return NextResponse.json({ success: true, objectives })
  } catch (error) {
    console.error('Error GET tramitacion-objetivos:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener objetivos de tienda' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    const user = session?.user
    
    if (!user || (!canView(user, 'MODULE_TIENDAS') && !can(user, 'ACTION_ADMIN'))) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json()
    const { periodKey, objectives } = body

    if (!periodKey || !Array.isArray(objectives)) {
      return NextResponse.json({ success: false, error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const results = []

    for (const obj of objectives) {
      // Required storeName
      if (!obj.storeName) continue;

      const record = await prisma.tiendaStoreObjective.upsert({
        where: {
          periodKey_storeName: {
            periodKey,
            storeName: obj.storeName
          }
        },
        update: {
          bafConvMS: obj.bafConvMS || 0,
          bafNoTrasl: obj.bafNoTrasl || 0,
          tvFutbol: obj.tvFutbol || 0,
          alarmas: obj.alarmas || 0,
          dispSegEuros: obj.dispSegEuros || 0,
          dispUnidades: obj.dispUnidades || 0,
          seguros: obj.seguros || 0,
          movil: obj.movil || 0,
          repos: obj.repos || 0,
          fttr: obj.fttr || 0
        },
        create: {
          periodKey,
          storeName: obj.storeName,
          bafConvMS: obj.bafConvMS || 0,
          bafNoTrasl: obj.bafNoTrasl || 0,
          tvFutbol: obj.tvFutbol || 0,
          alarmas: obj.alarmas || 0,
          dispSegEuros: obj.dispSegEuros || 0,
          dispUnidades: obj.dispUnidades || 0,
          seguros: obj.seguros || 0,
          movil: obj.movil || 0,
          repos: obj.repos || 0,
          fttr: obj.fttr || 0
        }
      })
      results.push(record)
    }

    return NextResponse.json({ success: true, count: results.length })
  } catch (error) {
    console.error('Error POST tramitacion-objetivos:', error)
    return NextResponse.json({ success: false, error: 'Error al guardar objetivos de tienda' }, { status: 500 })
  }
}
