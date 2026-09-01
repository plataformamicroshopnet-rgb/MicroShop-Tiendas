export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { claveFactoresRepoArpu, leeFactoresRepoArpu, FACTORES_REPO_ARPU_DEFECTO } from '@/lib/salesUtils'
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

    // Los multiplicadores del repo de ARPU del mes viajan aquí para que Nueva
    // Venta enseñe en el cuadro verde EXACTAMENTE lo que se va a grabar. Si la
    // pantalla usara los de siempre y el mes tuviera otros, el comercial vería
    // un importe y se guardaría otro.
    const cfgArpu = await prisma.appSetting.findUnique({
      where: { key: claveFactoresRepoArpu(periodKey) },
    })
    const repoArpuFactores = cfgArpu?.value
      ? leeFactoresRepoArpu(cfgArpu.value)
      : FACTORES_REPO_ARPU_DEFECTO

    return NextResponse.json({ success: true, rules, hours, repoArpuFactores })
  } catch (error) {
    console.error('Error GET tiendas comisiones:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener datos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // ── CANDADOS DEL GUARDADO (30-ago-2026, encargo del dueño: «que no se
    // copien de un mes a otro salvo que yo lo autorice») ─────────────────────
    // 1) Solo ADMIN guarda reglas — igual que el reorder de al lado. Este POST
    //    estaba abierto: cualquiera que alcanzara la URL podía borrar y
    //    reescribir las reglas de cualquier mes.
    const session = await getSession()
    if (!session?.user?.username) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }
    const dbUser = await prisma.user.findUnique({
      where: { username: session.user.username },
      select: { role: true },
    })
    if (!dbUser || normalizeRole(dbUser.role) !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }

    const data = await request.json()
    const { periodKey, rules, hours, sourcePeriodKey, confirmarCopia, autorizoMesCerrado } = data

    if (!periodKey) {
      return NextResponse.json({ success: false, error: 'Falta periodKey' }, { status: 400 })
    }

    // 2) La pantalla declara DE QUÉ MES cargó las filas (sourcePeriodKey). Si
    //    no coincide con el mes al que van, esto es una COPIA entre meses y se
    //    para en seco salvo autorización expresa. Sin este candado, un fetch
    //    caído al cambiar de mes dejaba en pantalla las reglas del mes anterior
    //    y el guardado (que borra y recrea el mes entero) las volcaba al otro
    //    mes sin que nadie lo viera. Las llamadas viejas sin sourcePeriodKey
    //    pasan como siempre.
    if (sourcePeriodKey && sourcePeriodKey !== periodKey && confirmarCopia !== true) {
      return NextResponse.json({
        success: false, esCopiaEntreMeses: true, sourcePeriodKey,
        error: `Estas reglas se cargaron de ${sourcePeriodKey} y se iban a guardar en ${periodKey}: copia entre meses sin autorizar.`,
      }, { status: 409 })
    }

    // 3) Un mes CERRADO no se reescribe sin decirlo en voz alta (el isHistoric
    //    de la pantalla se cae si la lista de periodos no llegó: aquí en el
    //    servidor no se cae).
    const wp = await prisma.workPeriod.findFirst({ where: { period_key: periodKey } })
    if (wp?.status === 'HISTORIC' && autorizoMesCerrado !== true) {
      return NextResponse.json({
        success: false, esMesCerrado: true,
        error: `${periodKey} está CERRADO: guardar encima requiere autorización expresa.`,
      }, { status: 409 })
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
          // Se normaliza al guardar (sin espacios y en minusculas) porque un
          // correo con una mayuscula o un espacio delante se envia igual de mal
          // que uno mal escrito, y ahi no hay aviso que valga.
          email: String(h.email || '').trim().toLowerCase() || null,
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
