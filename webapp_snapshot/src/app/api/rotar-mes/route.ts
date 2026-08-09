import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rotar-mes — ROTACIÓN AUTOMÁTICA del mes de Tiendas (F2).
//
// La llama el ERP el día 1 de madrugada (mismo patrón que FFVV): el dueño ya no
// tiene que activar el mes a mano. Protegido con el secreto compartido
// PRV_FEED_SECRET (cabecera x-prv-secret), sin sesión; cerrado si falta la env.
//
// Qué hace:
//   1. Calcula el MES NATURAL en Europe/Madrid (el servidor puede ir en UTC).
//   2. Si el ACTIVE ya es ese mes o uno posterior → NO-OP (idempotente).
//   3. Si el ACTIVE es anterior:
//        · si el mes natural existe como BORRADOR → lo activa reproduciendo
//          EXACTAMENTE la activación manual de Gestión de Periodos: todos los
//          ACTIVE pasan a HISTORIC y luego el destino pasa a ACTIVE.
//        · si NO existe (o no es borrador) → NO rota y lo avisa. A propósito no
//          auto-clona: el hub Cambio de Mes ya avisa y tiene el botón «Pre-crear
//          el mes siguiente», y activar un mes sin preparar sería peor que no
//          rotar. El correo del ritual del día 1 canta el aviso.
//
// Devuelve siempre un informe: { success, rotado, motivo, mesAnterior, mesNuevo }.
// ─────────────────────────────────────────────────────────────────────────────

function mesNaturalMadrid(): string {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const [y, m] = hoy.split('-')
  return `${y}_${m}`
}

export async function POST(request: Request) {
  const SECRET = process.env.PRV_FEED_SECRET
  if (!SECRET || request.headers.get('x-prv-secret') !== SECRET) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  try {
    const mesNatural = mesNaturalMadrid()
    const [yNat, mNat] = mesNatural.split('_').map(Number)

    const activo = await prisma.workPeriod.findFirst({ where: { status: 'ACTIVE' } })
    if (!activo) {
      return NextResponse.json({
        success: true, rotado: false, mesAnterior: null, mesNuevo: null,
        motivo: 'No hay ningún mes ACTIVO en Tiendas: no se rota nada. Revísalo en Gestión de Periodos.',
      })
    }

    // ¿El activo ya es el mes natural o posterior? → no-op (idempotente).
    const activoEsAnterior = activo.year < yNat || (activo.year === yNat && activo.month < mNat)
    if (!activoEsAnterior) {
      return NextResponse.json({
        success: true, rotado: false, mesAnterior: activo.period_key, mesNuevo: activo.period_key,
        motivo: activo.period_key === mesNatural
          ? `El mes activo ya es el mes natural (${mesNatural}): nada que rotar.`
          : `El mes activo (${activo.period_key}) es igual o posterior al natural (${mesNatural}): no se toca.`,
      })
    }

    // El activo es anterior → hay que rotar al mes natural, si está preparado.
    const destino = await prisma.workPeriod.findUnique({ where: { period_key: mesNatural } })
    if (!destino) {
      return NextResponse.json({
        success: true, rotado: false, mesAnterior: activo.period_key, mesNuevo: null,
        motivo: `El mes ${mesNatural} todavía no existe: no se rota. Pre-créalo en el hub Cambio de Mes (botón «Pre-crear»).`,
      })
    }
    if (destino.status !== 'DRAFT') {
      return NextResponse.json({
        success: true, rotado: false, mesAnterior: activo.period_key, mesNuevo: destino.period_key,
        motivo: `El mes ${mesNatural} está en estado ${destino.status}, no en borrador: no se rota automáticamente.`,
      })
    }

    // Activación: MISMAS dos escrituras y en el mismo orden que el PUT manual.
    await prisma.workPeriod.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'HISTORIC' } })
    await prisma.workPeriod.update({ where: { id: destino.id }, data: { status: 'ACTIVE' } })

    return NextResponse.json({
      success: true, rotado: true, mesAnterior: activo.period_key, mesNuevo: destino.period_key,
      motivo: `Mes rotado: ${activo.period_key} → ${destino.period_key} (ahora activo).`,
    })
  } catch (e: any) {
    console.error('[POST /api/rotar-mes tiendas]', e)
    return NextResponse.json({ success: false, rotado: false, error: String(e?.message || e) }, { status: 500 })
  }
}
