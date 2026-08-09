import { NextResponse } from 'next/server'
import { getSession } from './auth'

/**
 * GUARDIÁN DE PUERTAS (ago-2026, Fase 0 de la automatización de Tiendas).
 *
 * El middleware global excluye /api entero del control de sesión, así que cada
 * endpoint que escribe tiene que ponerse SU propia llave. Estos dos ayudantes
 * la ponen en una línea:
 *
 *   const no = await exigeAdmin();   if (no) return no
 *   const no = await exigeSesion();  if (no) return no
 *
 * Devuelven `null` si el que llama tiene permiso (sigue el endpoint), o un
 * NextResponse 401/403 listo para devolver si no lo tiene. Además aceptan el
 * secreto del feed (x-prv-secret) para las llamadas servidor-a-servidor del ERP.
 */

function conSecretoFeed(request?: Request): boolean {
  const secreto = process.env.PRV_FEED_SECRET
  return !!secreto && !!request && request.headers.get('x-prv-secret') === secreto
}

/** Deja pasar solo a un usuario con sesión ADMIN (o al feed del ERP). */
export async function exigeAdmin(request?: Request): Promise<NextResponse | null> {
  if (conSecretoFeed(request)) return null
  const session = await getSession()
  const role = String(session?.user?.role || '').toUpperCase()
  if (!session?.user) return NextResponse.json({ success: false, error: 'Necesitas iniciar sesión.' }, { status: 401 })
  if (role !== 'ADMIN') return NextResponse.json({ success: false, error: 'Solo el administrador puede hacer esto.' }, { status: 403 })
  return null
}

/** Deja pasar a cualquier usuario con sesión iniciada (o al feed del ERP). */
export async function exigeSesion(request?: Request): Promise<NextResponse | null> {
  if (conSecretoFeed(request)) return null
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ success: false, error: 'Necesitas iniciar sesión.' }, { status: 401 })
  return null
}
