import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/arranque — ¿cuándo arrancó este proceso?
 *
 * El ERP no se entera de que Tiendas se ha desplegado (Railway no le avisa), y
 * eso el 01-sep-2026 dejó el Dashboard con los objetivos de agosto medio día:
 * el arreglo entró AQUÍ, pero el correo del ritual ya había salido a las 07:05 y
 * nadie volvió a mirar. Con esto el ERP pregunta cada pocos minutos «¿cuándo
 * arrancaste?», y si la respuesta cambia, manda el correo de «qué ha cambiado».
 *
 * Solo con el secreto compartido del feed. No expone nada más que una hora.
 */
const BOOT_TIME = new Date().toISOString()

export async function GET(request: Request) {
  const secreto = process.env.PRV_FEED_SECRET
  if (!secreto || request.headers.get('x-prv-secret') !== secreto) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  return NextResponse.json({ success: true, bootTime: BOOT_TIME })
}
