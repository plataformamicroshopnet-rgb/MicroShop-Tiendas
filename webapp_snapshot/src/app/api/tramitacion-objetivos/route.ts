import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { can, canView } from '@/lib/permissions'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodKey = searchParams.get('periodKey')

    if (!periodKey) {
      return NextResponse.json({ success: false, error: 'Falta periodKey' }, { status: 400 })
    }

    const objectives = await prisma.tiendaStoreObjective.findMany({
      where: { periodKey }
    })

    return NextResponse.json({ success: true, objectives })
  } catch (error) {
    console.error('Error GET tramitacion-objetivos:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener objetivos de tienda' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Dos llaves: la sesión de siempre (pantalla y pegado) o el secreto
    // compartido del feed — el ERP publica aquí los objetivos oficiales del
    // Excel de Telefónica (objetivos_tiendas_feed) cada vez que se sube el
    // comunicado del mes. Mismo patrón que cobrado-feed / prv-feed.
    const secreto = process.env.PRV_FEED_SECRET
    const conSecreto = !!secreto && request.headers.get('x-prv-secret') === secreto
    if (!conSecreto) {
      const session = await getSession()
      const user = session?.user
      if (!user || (!canView(user, 'MODULE_TIENDAS') && !can(user, 'ACTION_ADMIN'))) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }
    }

    const body = await request.json()
    const { periodKey, objectives } = body

    if (!periodKey || !Array.isArray(objectives)) {
      return NextResponse.json({ success: false, error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const results = []

    // Las 10 columnas de objetivos por tienda. El UPDATE solo escribe las que
    // VIENEN en el envío: antes se ponían todas con `|| 0`, así que editar UNA
    // casilla (la pantalla manda 8 de 10) machacaba a 0 seguros/dispUnidades/
    // movil, que ni salen en el formulario. Los ausentes se dejan como estaban.
    const CAMPOS = ['bafConvMS','bafNoTrasl','tvFutbol','alarmas','dispSegEuros','dispUnidades','seguros','movil','repos','fttr'] as const
    const num = (v: any) => { const n = Number(v); return isFinite(n) ? n : 0 }

    for (const obj of objectives) {
      // Required storeName
      if (!obj.storeName) continue;

      const soloLosQueVienen: Record<string, number> = {}
      for (const c of CAMPOS) {
        if (obj[c] !== undefined && obj[c] !== null) soloLosQueVienen[c] = num(obj[c])
      }

      const record = await prisma.tiendaStoreObjective.upsert({
        where: {
          periodKey_storeName: {
            periodKey,
            storeName: obj.storeName
          }
        },
        // Al crear una fila nueva sí se rellenan todos (los ausentes, a 0);
        // al actualizar, solo los que llegan (no se pisa lo que no se toca).
        update: soloLosQueVienen,
        create: {
          periodKey,
          storeName: obj.storeName,
          ...Object.fromEntries(CAMPOS.map(c => [c, num(obj[c])])),
        } as any
      })
      results.push(record)
    }

    return NextResponse.json({ success: true, count: results.length })
  } catch (error) {
    console.error('Error POST tramitacion-objetivos:', error)
    return NextResponse.json({ success: false, error: 'Error al guardar objetivos de tienda' }, { status: 500 })
  }
}
