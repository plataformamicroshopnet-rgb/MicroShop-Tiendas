import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { exigeSesion } from '@/lib/apiGuard'
import { esFuturo, sesionPuedeVerFuturo } from '@/lib/visibilidadPeriodos'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/period — la lista de periodos que alimenta el selector global.
//
// Exige sesión (o el secreto del feed): la consumen PeriodProvider y las
// pantallas MOD/Territorial/Ganancias desde el navegador; comprobado que el ERP
// no la llama. Y es LA FUENTE ÚNICA de la visibilidad de meses: a quien no
// puede ver el futuro (comerciales) se le filtran AQUÍ los periodos DRAFT
// posteriores al ACTIVE — el selector pinta lo que llega, así que esconderlos
// en la fuente vale para toda la app. ADMIN, JEFE_TIENDAS y DIRECCION reciben
// todo como hasta ahora (Gestión de Periodos, hub Cambio de Mes, borradores).
// Port del cerrojo de FFVV (visibilidadPeriodos).
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const no = await exigeSesion(request)
    if (no) return no

    let periods = await prisma.workPeriod.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    // ¿quién pregunta? el feed (x-prv-secret, sin sesión) ve todo; una sesión
    // sin rol de mando ve solo el mes activo y los pasados
    let session: any = null
    try {
      session = await getSession()
    } catch {
      session = null
    }
    if (session?.user && !sesionPuedeVerFuturo(session.user)) {
      const activo = periods.find(p => p.status === 'ACTIVE') || null
      periods = periods.filter(p => !esFuturo(p, activo))
    }

    return NextResponse.json({ success: true, periods })
  } catch (error) {
    console.error('Error fetching periods:', error)
    return NextResponse.json({ success: false, error: 'Database error fetching periods' })
  }
}
