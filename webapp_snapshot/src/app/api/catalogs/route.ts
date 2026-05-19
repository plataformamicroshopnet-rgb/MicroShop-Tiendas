import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(request.url)
  const queryPeriodKey = url.searchParams.get('periodKey')

  let records: any[] = []

  // Si la UI pide explícitamente el Legacy Original
  const legacyOnly = url.searchParams.get('legacyOnly') === '1'

  // Si la UI sabe de periodos y pide strictPeriod (catalogos/page.tsx pide el suyo explícitamente)
  const strictPeriod = url.searchParams.get('strictPeriod') === '1'

  if (legacyOnly) {
    records = await prisma.productCatalog.findMany({
      where: { periodId: null },
      orderBy: { createdAt: 'asc' }
    })
  }
  else if (queryPeriodKey && strictPeriod) {
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: queryPeriodKey } })
    if (wp) {
      records = await prisma.productCatalog.findMany({
        where: { periodId: wp.id },
        orderBy: { createdAt: 'asc' }
      })
    }
    // Si no encuentra datos para ese periodo, records se queda como [] y NO hay fallback.
  } 
  // Si la UI NO usa strictPeriod (Legacy: Nueva Venta, Operaciones, Liquidaciones... o peticiones viejas)
  else {
    const activePeriod = await prisma.workPeriod.findFirst({
      where: { status: 'ACTIVE' }
    })
    
    if (activePeriod) {
      records = await prisma.productCatalog.findMany({
        where: { periodId: activePeriod.id },
        orderBy: { createdAt: 'asc' }
      })
    }

    // FALLBACK INEQUÍVOCO: Si no hay mes ACTIVE, o si el mes ACTIVE tiene el catálogo vacío,
    // Devolvemos EXCLUSIVAMENTE el legado (periodId: null) sin mezclar datos.
    if (records.length === 0) {
      records = await prisma.productCatalog.findMany({
        where: { periodId: null },
        orderBy: { createdAt: 'asc' }
      })
    }
  }

    const catalogs: Record<string, any[]> = { "Fija": [], "Móvil": [], "Ti": [], "Rent": [], "Micro": [], "O2": [], "Seguro": [], "miMovistar": [], "Traslado miMovistar": [], "Suscripciones TV": [], "Prepago": [], "Varios": [], "Repos": [], "Resto BAF": [] }
    for (const r of records) {
    if (!catalogs[r.categoria]) {
      catalogs[r.categoria] = []
    }
    catalogs[r.categoria].push({
      producto: r.producto,
      mensual: r.mensual,
      anual: r.anual,
      subcategoria: r.subcategoria,
      fabricante: r.fabricante,
      gama: r.gama,
      validFrom: r.validFrom,
      validTo: r.validTo,
      comision: r.comision,
      comisionConCoste: r.comisionConCoste,
      id: r.id // Enviamos ID por si hiciera falta luego
    })
  }

  return NextResponse.json({ success: true, catalogs })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || !['ADMIN', 'JEFE DE VENTAS'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 401 })
  }

  let toInsert: any[] = []
  try {
    const { catalogs, periodKey } = await request.json()
    
    if (!catalogs || typeof catalogs !== 'object') {
       return NextResponse.json({ success: false, error: 'Formato de catálogos inválido' }, { status: 400 })
    }

    let targetPeriodId = null

    if (periodKey) {
       const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } })
       if (!wp) {
           return NextResponse.json({ success: false, error: 'El WorkPeriod indicado no existe' }, { status: 404 })
       }
       // BLINDAJE BACKEND: Prohibido sobreescribir un mes histórico
       if (wp.status === 'HISTORIC') {
           return NextResponse.json({ success: false, error: 'Operación RECHAZADA: El periodo indicado está cerrado (HISTORIC).' }, { status: 403 })
       }
       targetPeriodId = wp.id
    }

    toInsert = []
    for (const [categoria, prods] of Object.entries(catalogs)) {
      for (const p of (prods as any[])) {
        toInsert.push({
          categoria,
          producto: p.producto,
          mensual: String(p.mensual || ''),
          anual: String(p.anual || ''),
          subcategoria: p.subcategoria || null,
          fabricante: p.fabricante || null,
          gama: p.gama || null,
          validFrom: p.validFrom || null,
          validTo: p.validTo || null,
          comision: p.comision || null,
          comisionConCoste: p.comisionConCoste || null,
          periodId: targetPeriodId
        })
      }
    }

    // TRANSACCION ATÓMICA: Borrar SOLO la porción del mes actual y encajar la nueva parrilla
    await prisma.$transaction([
      prisma.productCatalog.deleteMany({
        where: { periodId: targetPeriodId }
      }),
      ...(toInsert.length > 0 ? [prisma.productCatalog.createMany({ data: toInsert })] : [])
    ])
    
    return NextResponse.json({ success: true })

  } catch(e: any) {
    console.error('=================== ERROR CRÍTICO GUARDANDO CATÁLOGO ===================');
    console.error('Payload toInsert[0]:', toInsert[0]);
    console.error('Mensaje de error:', e.message);
    console.error('Stack:', e.stack);
    console.error('========================================================================');
    return NextResponse.json({ success: false, error: 'Error del servidor al guardar: ' + e.message }, { status: 500 })
  }
}
