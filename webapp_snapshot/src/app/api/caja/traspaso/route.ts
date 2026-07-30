import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { getSession } from '@/lib/auth'
import { canView } from '@/lib/permissions'
import { TIENDAS_COMERCIALES } from '@/lib/constants'
import {
  CONCEPTO_TRASPASO_SALIDA,
  CONCEPTO_TRASPASO_ENTRADA,
  TIENDAS_CON_CAJA,
  destinosDesde,
  esDestinoExterno,
  cajaDeUsuario,
} from '@/lib/caja'

// ─────────────────────────────────────────────────────────────────────────────
// TRASPASO DE EFECTIVO entre cajas.
//
// El agujero que tapa: hasta ahora, cuando una tienda entregaba dinero (por
// ejemplo Auxiliadora se lo daba a Angel Luis para llevarlo a Central), el
// programa imprimia un justificante en papel y NO GUARDABA NADA. Ni bajaba de
// la tienda ni subia en ningun sitio: el dinero se evaporaba.
//
// Aqui un traspaso son DOS apuntes hermanos creados a la vez y con el mismo
// traspasoId:
//    · la SALIDA en la tienda de origen, en negativo
//    · la ENTRADA en la caja de destino, en positivo
// Los dos nacen en ROJO (entregado, sin confirmar) y pasan a VERDE cuando el
// destino da el visto bueno; el semaforo viaja siempre en pareja.
//
// Si el destino es «Fuera de las cajas» (banco, proveedor, gasto) NO se crea
// pata de entrada: ese dinero sale de verdad del circuito y apuntarlo en algun
// sitio seria inventarselo.
//
// POST body: { tiendaOrigen, tiendaDestino, fecha, importe, receptor,
//               entregadoPor, detalle }
// ─────────────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100

export async function POST(request: Request) {
  try {
    const session = await getSession().catch(() => null)
    const user = session?.user
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canView(user, 'CARD_CAJA')) {
      return NextResponse.json({ error: 'Sin permiso de Caja' }, { status: 403 })
    }

    const body = await request.json()
    const fecha = String(body?.fecha || '').trim()
    const receptor = String(body?.receptor || '').trim()
    const entregadoPor = String(body?.entregadoPor || '').trim()
    const detalle = String(body?.detalle || '').trim()
    const importe = Number(body?.importe)
    let tiendaOrigen = String(body?.tiendaOrigen || '').trim()
    let tiendaDestino = String(body?.tiendaDestino || '').trim()

    if (tiendaOrigen === 'O2') tiendaOrigen = 'MovilFree'
    if (tiendaDestino === 'O2') tiendaDestino = 'MovilFree'

    // ── Validaciones ────────────────────────────────────────────────────────
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: 'Fecha con formato YYYY-MM-DD' }, { status: 400 })
    }
    if (!isFinite(importe) || importe <= 0) {
      return NextResponse.json({ error: 'El importe tiene que ser mayor que cero' }, { status: 400 })
    }
    if (!receptor) {
      return NextResponse.json({ error: 'Falta decir a quien se le entrega el dinero' }, { status: 400 })
    }
    if (!entregadoPor) {
      return NextResponse.json({ error: 'Falta decir quien entrega el dinero' }, { status: 400 })
    }
    if (!TIENDAS_CON_CAJA.includes(tiendaOrigen)) {
      return NextResponse.json({ error: `Origen desconocido: ${tiendaOrigen}` }, { status: 400 })
    }
    const esExterno = esDestinoExterno(tiendaDestino)
    // Los destinos validos dependen del origen: desde Central el dinero solo
    // sale a Banco o a Varios, no vuelve a bajar a las tiendas.
    if (!destinosDesde(tiendaOrigen).includes(tiendaDestino)) {
      return NextResponse.json({
        error: tiendaOrigen === 'Central'
          ? 'Desde Central las salidas solo pueden ir a Banco o a Varios'
          : `Destino no válido para ${tiendaOrigen}: ${tiendaDestino}`,
      }, { status: 400 })
    }

    // Solo se puede sacar dinero de la caja propia (o de cualquiera si mandas
    // sobre todas). Sin esta comprobacion, una peticion a mano permitiria vaciar
    // la caja de otra tienda.
    const suya = cajaDeUsuario(user, TIENDAS_COMERCIALES, {
      mandaSobreTodas: canView(user, 'HUB_CRISTINA'),
      puedeCaja: canView(user, 'CARD_CAJA'),
    })
    if (suya !== 'ADMIN' && suya !== tiendaOrigen) {
      return NextResponse.json(
        { error: `Solo puedes registrar salidas de tu propia caja (${suya || 'sin tienda asignada'})` },
        { status: 403 })
    }

    // ── Los dos apuntes, o ninguno ──────────────────────────────────────────
    const traspasoId = randomUUID()
    const comun = {
      fecha,
      traspasoId,
      entregadoPor,
      receptor,
      vendedor: user.username,
      // El semaforo solo tiene sentido cuando hay alguien al otro lado que
      // pueda decir «recibido». Lo que va al banco o a un gasto no lo va a
      // confirmar nadie nunca: naceria en ROJO y se quedaria engordando el
      // «En transito» de por vida.
      estadoTrazabilidad: esExterno ? null : ('ROJO' as const),
    }
    const pieDetalle = esExterno
      ? `Entregado por ${entregadoPor} a ${receptor} · ${tiendaDestino}${detalle ? ` · ${detalle}` : ''}`
      : `Entregado por ${entregadoPor} a ${receptor} para ${tiendaDestino}${detalle ? ` · ${detalle}` : ''}`

    const salida = {
      ...comun,
      tienda: tiendaOrigen,
      concepto: CONCEPTO_TRASPASO_SALIDA,
      detalle: pieDetalle,
      importe: -r2(importe),
      tipo: 'TRASPASO_SALIDA',
      tiendaDestino,
    }

    const apuntes = esExterno ? [salida] : [
      salida,
      {
        ...comun,
        tienda: tiendaDestino,
        concepto: CONCEPTO_TRASPASO_ENTRADA,
        detalle: `Recibido de ${tiendaOrigen} en mano de ${receptor}${detalle ? ` · ${detalle}` : ''}`,
        importe: r2(importe),
        tipo: 'TRASPASO_ENTRADA',
        tiendaOrigen,
      },
    ]

    const creados = await prisma.$transaction(
      apuntes.map(a => prisma.cajaEntry.create({ data: a as any }))
    )

    return NextResponse.json({
      success: true,
      traspasoId,
      entries: creados,
      // Para que la pantalla sepa si hubo pata de entrada o no.
      externo: esExterno,
    })
  } catch (error) {
    console.error('Error POST caja/traspaso:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
