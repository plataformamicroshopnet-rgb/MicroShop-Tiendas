import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ----------------------------------------------------------------------
// HELPER: Convertir mes YYYYMM -> YYYY_MM (clave del periodo)
// ----------------------------------------------------------------------
function formatPeriodKey(monthStr: string) {
  if (monthStr && monthStr.length === 6) {
    return `${monthStr.substring(0, 4)}_${monthStr.substring(4, 6)}`
  }
  return monthStr
}

// ----------------------------------------------------------------------
// HELPER: Extraer lista de meses blindados (HISTORIC) en formato "YYYYMM"
// ----------------------------------------------------------------------
async function getHistoricMonths() {
  const historicPeriods = await prisma.workPeriod.findMany({
    where: { status: 'HISTORIC' }
  })
  return historicPeriods.map(p => p.period_key.replace('_', ''))
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(request.url)
  const queryPeriodKey = url.searchParams.get('periodKey')
  const strictPeriod = url.searchParams.get('strictPeriod') === '1'

  let records: any[] = []

  if (queryPeriodKey && strictPeriod) {
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: queryPeriodKey } })
    if (wp) {
      records = await prisma.objective.findMany({
        where: { periodId: wp.id },
        orderBy: { createdAt: 'asc' }
      })
    }
  } else {
    // Si la UI NO usa strictPeriod (Legacy: Liquidaciones, Ventas...)
    records = await prisma.objective.findMany({
      orderBy: { createdAt: 'asc' }
    })
  }
  
  const objetivos: Record<string, any> = {
    "Pyme": {},
    "Captador": {}
  }
  
  const grupos: Record<string, Record<string, string>> = {
    "Pyme": {}, "Captador": {}
  }

  for (const record of records) {
    const r = record as any
    if (!objetivos[r.profile]) objetivos[r.profile] = {}
    if (!objetivos[r.profile][r.month]) objetivos[r.profile][r.month] = {}
    objetivos[r.profile][r.month][r.objKey] = r.value
    
    if (r.grupo) {
       if (!grupos[r.profile]) grupos[r.profile] = {}
       grupos[r.profile][r.objKey] = r.grupo
    }
  }

  return NextResponse.json({ success: true, objetivos, grupos })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || !canEdit(session.user, 'MODULE_LIQUIDACION')) {
    return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 403 })
  }

  try {
    const { objetivos, grupos } = await request.json()
    if (!objetivos || typeof objetivos !== 'object') {
       return NextResponse.json({ success: false, error: 'Formato inválido' }, { status: 400 })
    }

    // 1. Extraer meses afectados en el payload
    const affectedMonths = new Set<string>()
    for (const [profile, months] of Object.entries(objetivos)) {
      for (const [month] of Object.entries(months as any)) {
         affectedMonths.add(month as string)
      }
    }
    const monthsArray = Array.from(affectedMonths)

    // 2. Extraer periodIDs reales mapeando la clave natural "YYYY_MM"
    const periodKeys = monthsArray.map(m => formatPeriodKey(m))
    const workPeriods = await prisma.workPeriod.findMany({
       where: { period_key: { in: periodKeys } }
    })
    const periodMap = new Map(workPeriods.map(wp => [wp.period_key, wp.id]))

    // 3. Obtener meses históricos blindados para evitar borrarlos jamás
    const historicMonths = await getHistoricMonths()

    // 4. Preparar payload de Inserción
    const toInsert = []
    for (const [profile, months] of Object.entries(objetivos)) {
      for (const [month, objGroup] of Object.entries(months as any)) {
         
         const pKey = formatPeriodKey(month as string)
         const pId = periodMap.get(pKey) || null
         
         for (const [objKey, value] of Object.entries(objGroup as any)) {
            const grupoValue = grupos?.[profile]?.[objKey] || null
            toInsert.push({
                profile,
                month: month as string,
                objKey,
                value: Number(value) || 0,
                grupo: grupoValue,
                periodId: pId
            })
         }
      }
    }

    // 5. TRANSACCION ATOMICA: Borrar SOLO los meses que llegan en el payload, y SOLO si NO son Históricos.
    await prisma.$transaction([
      prisma.objective.deleteMany({
        where: { 
          month: { 
            in: monthsArray,
            notIn: historicMonths 
          } 
        }
      }),
      ...(toInsert.length > 0 ? [prisma.objective.createMany({ data: toInsert })] : [])
    ])
    
    return NextResponse.json({ success: true })
  } catch(e) {
    console.error('Error guardando objetivos via Prisma', e)
    return NextResponse.json({ success: false, error: 'Error del servidor al guardar' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session || !canEdit(session.user, 'MODULE_LIQUIDACION')) {
    return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 403 })
  }

  try {
    const { profile, objKey, months, grupo } = await request.json()
    if (!profile || !objKey) {
       return NextResponse.json({ success: false, error: 'Faltan datos clave' }, { status: 400 })
    }

    const payloadMonths = Object.keys(months || {})
    
    const periodKeys = payloadMonths.map(m => formatPeriodKey(m))
    const workPeriods = await prisma.workPeriod.findMany({
       where: { period_key: { in: periodKeys } }
    })
    const periodMap = new Map(workPeriods.map(wp => [wp.period_key, wp.id]))

    const historicMonths = await getHistoricMonths()

    const toInsert = []
    for (const [month, value] of Object.entries(months || {})) {
        const pKey = formatPeriodKey(month as string)
        const pId = periodMap.get(pKey) || null

        toInsert.push({
            profile,
            month: month as string,
            objKey,
            value: Number(value) || 0,
            grupo: grupo || null,
            periodId: pId
        })
    }
    
    // TRANSACCIÓN: Borrar una fila específica PERO respetando sus versiones pasadas (Históricas)
    await prisma.$transaction([
      prisma.objective.deleteMany({
        where: { 
          profile, 
          objKey,
          month: {
            in: payloadMonths,
            notIn: historicMonths
          }
        }
      }),
      ...(toInsert.length > 0 ? [prisma.objective.createMany({ data: toInsert })] : [])
    ])

    return NextResponse.json({ success: true })
  } catch(e) {
    console.error('Error PUT objetivos', e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session || !canEdit(session.user, 'MODULE_LIQUIDACION')) {
    return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const profile = url.searchParams.get('profile')
    const objKey = url.searchParams.get('objKey')

    if (!profile || !objKey) {
       return NextResponse.json({ success: false, error: 'Faltan profile o objKey' }, { status: 400 })
    }

    const historicMonths = await getHistoricMonths()

    // TRANSACCION / BORRADO BLINDADO: Se elimina para siempre de Borradores y Actuales, pero se conserva en Históricos
    await prisma.objective.deleteMany({
       where: { 
         profile, 
         objKey,
         month: {
            notIn: historicMonths
         }
       }
    })

    return NextResponse.json({ success: true })
  } catch(e) {
    console.error('Error DELETE objetivos', e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
