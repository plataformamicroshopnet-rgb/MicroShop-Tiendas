import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { claveSelloRevision, esPasoConSello, huellaDelPaso, type SelloRevision } from '@/lib/revisadoPorMiTiendas'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/salud-mes/revisado — «Ya lo he revisado» de un paso del hub Tiendas.
//
// Es el visto bueno de una PERSONA, así que aquí NO vale el secreto de servidor
// que abre el resto del hub: tiene que haber sesión de dirección o admin. Se
// guarda quién, cuándo y una HUELLA de lo revisado (calculada AQUÍ, nunca la que
// mande el navegador), para que el aviso vuelva solo si el contenido cambia.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const session = await getSession()
    const role = String(session?.user?.role || '').toUpperCase()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Necesitas iniciar sesión.' }, { status: 401 })
    }
    if (role !== 'ADMIN' && role !== 'JEFE_TIENDAS' && role !== 'DIRECCION') {
      return NextResponse.json({ success: false, error: 'Este visto bueno es de dirección.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({} as any))
    const periodKey = String(body?.periodKey || '')
    const paso = String(body?.paso || '')

    if (!/^\d{4}_\d{2}$/.test(periodKey)) {
      return NextResponse.json({ success: false, error: 'Mes inválido (se espera YYYY_MM).' }, { status: 400 })
    }
    if (!esPasoConSello(paso)) {
      return NextResponse.json({ success: false, error: 'Ese paso no admite visto bueno.' }, { status: 400 })
    }

    const huella = await huellaDelPaso(prisma, paso, periodKey)
    if (!huella) {
      return NextResponse.json({ success: false, error: 'No hay nada que revisar en ese mes todavía.' }, { status: 400 })
    }

    const sello: SelloRevision = {
      cuando: new Date().toISOString(),
      quien: String((session.user as any).username || (session.user as any).name || 'alguien'),
      huella,
    }
    const key = claveSelloRevision(paso, periodKey)
    const value = JSON.stringify(sello)
    await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } })

    return NextResponse.json({ success: true, sello })
  } catch (e: any) {
    console.error('[POST /api/salud-mes/revisado tiendas]', e)
    return NextResponse.json({ success: false, error: 'No se pudo guardar el visto bueno.' }, { status: 500 })
  }
}
