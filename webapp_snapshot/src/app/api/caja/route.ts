import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { canView } from '@/lib/permissions'
import { TIENDAS_COMERCIALES } from '@/lib/constants'
import { normalizarImporte, cajaDeUsuario } from '@/lib/caja'

// ─────────────────────────────────────────────────────────────────────────────
// CAJA DE TIENDAS.
//
// Tres cosas que antes no hacia y ahora si:
//
//  1. PIDE SESION. El middleware de la aplicacion protege las pantallas pero se
//     salta expresamente todo lo que empieza por /api (src/middleware.ts), asi
//     que este endpoint estaba abierto: cualquiera con la direccion podia leer
//     las cajas de las cinco tiendas, crear movimientos o borrarlos. Con
//     dinero de verdad dentro eso no se sostiene.
//     (El TPV NO pasa por aqui: escribe con prisma.cajaEntry.create desde el
//     servidor, asi que cerrar la puerta no le afecta.)
//  2. PONE EL SIGNO. El concepto manda: «(-) …» resta y «(+) …» suma, sin
//     depender de que alguien se acuerde de teclear el menos.
//  3. NO DEJA MEDIO TRASPASO. Borrar una pata borra las dos, y confirmar el
//     semaforo confirma las dos.
// ─────────────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

/**
 * Sesion + permiso de caja. Devuelve el usuario, su caja ('ADMIN' si manda
 * sobre todas) o una respuesta de error.
 */
async function exigirCaja() {
  const session = await getSession().catch(() => null)
  const user = session?.user
  if (!user) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  if (!canView(user, 'CARD_CAJA')) {
    return { error: NextResponse.json({ error: 'Sin permiso de Caja' }, { status: 403 }) }
  }
  const suya = cajaDeUsuario(user, TIENDAS_COMERCIALES, {
    mandaSobreTodas: canView(user, 'HUB_CRISTINA'),
    puedeCaja: canView(user, 'CARD_CAJA'),
  })
  return { user, suya, mandaSobreTodas: suya === 'ADMIN' }
}

export async function GET(request: Request) {
  const guarda = await exigirCaja()
  if (guarda.error) return guarda.error

  try {
    const { searchParams } = new URL(request.url);
    const tienda = searchParams.get('tienda');

    // Mapeo seguro del nombre de la tienda
    let queryTienda = tienda;
    if (tienda === 'O2') queryTienda = 'MovilFree';

    // Quien no manda sobre todas las cajas SOLO ve la suya, diga lo que diga el
    // parametro: antes bastaba con quitar el ?tienda= de la direccion para leer
    // el efectivo de las cinco tiendas y de Central.
    if (!guarda.mandaSobreTodas) {
      queryTienda = guarda.suya
      if (!queryTienda) {
        return NextResponse.json({ error: 'No tienes ninguna caja asignada' }, { status: 403 })
      }
    }

    let whereClause = {};
    if (queryTienda) {
      whereClause = { tienda: queryTienda };
    }

    const entries = await prisma.cajaEntry.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error GET caja:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guarda = await exigirCaja()
  if (guarda.error) return guarda.error

  try {
    const body = await request.json();
    const { tienda, fecha, concepto, detalle, importe, estadoTrazabilidad } = body;

    if (!tienda || !fecha || !concepto) {
      return NextResponse.json({ error: 'Faltan tienda, fecha o concepto' }, { status: 400 })
    }
    const n = Number(importe)
    if (!isFinite(n)) {
      return NextResponse.json({ error: 'Importe no valido' }, { status: 400 })
    }

    let targetTienda = tienda;
    if (targetTienda === 'O2') targetTienda = 'MovilFree';

    // Y tampoco se pueden meter apuntes en la caja de otra tienda.
    if (!guarda.mandaSobreTodas && guarda.suya !== targetTienda) {
      return NextResponse.json(
        { error: `Solo puedes apuntar en tu propia caja (${guarda.suya || 'sin caja asignada'})` },
        { status: 403 })
    }

    const entry = await prisma.cajaEntry.create({
      data: {
        tienda: targetTienda,
        fecha,
        concepto,
        detalle: detalle || '',
        // El signo lo pone el concepto, no quien teclea.
        importe: normalizarImporte(concepto, n),
        // El vendedor sale de la SESION, no del cuerpo de la peticion: es quien
        // responde del apunte y no debe poder falsearse desde fuera.
        vendedor: guarda.user.username,
        estadoTrazabilidad: estadoTrazabilidad ?? null,
      }
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Error POST caja:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const guarda = await exigirCaja()
  if (guarda.error) return guarda.error
  if (guarda.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo un administrador puede borrar movimientos' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const entry = await prisma.cajaEntry.findUnique({ where: { id } })
    if (!entry) return NextResponse.json({ error: 'No existe ese movimiento' }, { status: 404 })

    // Las dos patas de un traspaso se van juntas: borrar solo una haria
    // aparecer o desaparecer dinero de la nada.
    if (entry.traspasoId) {
      const borradas = await prisma.cajaEntry.deleteMany({ where: { traspasoId: entry.traspasoId } })
      return NextResponse.json({ success: true, borradas: borradas.count, traspaso: true })
    }

    await prisma.cajaEntry.delete({ where: { id } });
    return NextResponse.json({ success: true, borradas: 1 });
  } catch (error) {
    console.error("Error DELETE caja:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guarda = await exigirCaja()
  if (guarda.error) return guarda.error
  // Confirmar un traspaso lo hace quien manda sobre todas las cajas (dirección,
  // jefatura de ventas, back office), no solo el rol ADMIN: la pantalla les
  // enseña el semáforo pulsable a todos ellos y si aquí exigimos ADMIN el clic
  // se queda sin efecto y sin avisar.
  if (!guarda.mandaSobreTodas) {
    return NextResponse.json({ error: 'Solo quien lleva todas las cajas confirma un traspaso' }, { status: 403 })
  }

  try {
    const body = await request.json();
    const { id, estadoTrazabilidad } = body;
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const actual = await prisma.cajaEntry.findUnique({ where: { id } })
    if (!actual) return NextResponse.json({ error: 'No existe ese movimiento' }, { status: 404 })

    // Un VERDE deja constancia de quien lo dio por bueno y cuando; al salir de
    // VERDE se borra la firma, para que no quede una conciliacion fantasma.
    const datos: any = { estadoTrazabilidad }
    if (estadoTrazabilidad === 'VERDE') {
      datos.conciliadoPor = guarda.user.username
      datos.conciliadoEn = new Date()
    } else {
      datos.conciliadoPor = null
      datos.conciliadoEn = null
    }

    // Las dos patas del traspaso comparten estado: el dinero o esta confirmado
    // en los dos lados o no lo esta en ninguno.
    if (actual.traspasoId) {
      await prisma.cajaEntry.updateMany({ where: { traspasoId: actual.traspasoId }, data: datos })
      const entries = await prisma.cajaEntry.findMany({ where: { traspasoId: actual.traspasoId } })
      return NextResponse.json({ entry: entries.find(e => e.id === id) || entries[0], entries })
    }

    const entry = await prisma.cajaEntry.update({ where: { id }, data: datos });
    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Error PATCH caja:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
