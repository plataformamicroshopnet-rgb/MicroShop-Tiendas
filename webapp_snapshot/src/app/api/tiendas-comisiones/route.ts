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

    // ── LOS CONDICIONANTES NO SE PIERDEN POR EL CAMINO ──────────────────────
    //
    // Este guardado BORRA las reglas del mes y las vuelve a crear con lo que
    // manda la pantalla. Eso significa que cualquier camino que llegue sin los
    // condicionantes se los lleva por delante — y pasó: al pegar la tabla desde
    // Excel, la columna de condicionantes viene vacía (no está en el Excel: es
    // configuración que solo vive aquí), así que al guardar se borraron los
    // candados de ARPU y de Repo Fútbol. Y un candado borrado no avisa: el
    // segundo tramo se paga sin exigir lo que tenía que exigir.
    //
    // Regla: si una palanca llega con los condicionantes VACÍOS pero la que
    // había guardada con ese mismo nombre tenía, se conservan los de antes.
    // OJO A LA DIFERENCIA, que es la que hace que esto no sea un candado tonto:
    //   ''    = no venían (se perdieron por el camino)  → se conservan
    //   '[]'  = el dueño los ha quitado a mano en el desplegable → se respeta
    const previas = await prisma.tiendaCommissionRule.findMany({
      where: { periodKey },
      select: { nombre: true, condicionantes: true },
    })
    const condPrevias = new Map<string, string>()
    previas.forEach(p => {
      const c = String(p.condicionantes || '').trim()
      if (c && c !== '[]') condPrevias.set(String(p.nombre || '').trim().toLowerCase(), c)
    })
    const rescatadas: string[] = []
    const condicionantesDe = (r: any) => {
      const viene = String(r?.condicionantes ?? '').trim()
      if (viene) return viene
      const antes = condPrevias.get(String(r?.nombre || '').trim().toLowerCase())
      if (antes) { rescatadas.push(String(r?.nombre || '')); return antes }
      return ''
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
          condicionantes: condicionantesDe(r),
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

    // Se dice lo que se ha rescatado: un rescate silencioso volvería a esconder
    // el problema, que es justo lo que pasó la primera vez.
    return NextResponse.json({
      success: true,
      ...(rescatadas.length > 0
        ? { avisoCondicionantes: `Se han conservado los condicionantes que ya tenían: ${Array.from(new Set(rescatadas)).join(', ')}.` }
        : {}),
    })
  } catch (error) {
    console.error('Error POST tiendas comisiones:', error)
    return NextResponse.json({ success: false, error: 'Error al guardar datos' }, { status: 500 })
  }
}
