import { PrismaClient } from '@prisma/client'

// EL EXTRA DEL FÚTBOL DE SEPTIEMBRE-2026, ESTA VEZ EN LA FILA QUE LEE EL PROGRAMA.
//
// LO QUE PASÓ (01-sep-2026). El comunicado Nacional sube el extra de
// reposicionamiento destino Fútbol/LaLiga/Champions (NC142Y) de 10 € a 20 €.
// Por la mañana se subió a 20 la fila «Extra Repos up destino Fútbol» (categoría
// Repos)… que es una fila RETIRADA que no lee nadie. La revisión de la noche lo
// destapó: cinco extras de fútbol tecleados ese mismo día seguían a 10 €, tres de
// ellos creados DESPUÉS del despliegue.
//
// DE DÓNDE SALE EL PRECIO DE VERDAD. El extra lo crea solo la API de Nueva Venta
// (src/app/api/sales/unified/route.ts) como línea hermana del repo de 78 €, y lo
// estampa en la CUOTA de esa línea. El precio lo busca en el catálogo por
// { categoria: 'Repo Fútbol', producto: 'Repo Up Destino Fútbol' } y, si no hay
// fila, cae a un 10 € fijo. Esa fila NO HA EXISTIDO NUNCA — ni en agosto ni en
// septiembre —, así que siempre ha valido el 10 del código. El propio comentario
// de la ruta lo dice: «si algún día hay que cambiarlo basta con crear la fila».
// Y la comisión (src/lib/saleCommission.ts) para «Repo Fútbol» devuelve
// sale.cuota tal cual: lo que se estampa es lo que se cobra.
//
// TRES COSAS, todas idempotentes:
//  1) CREAR esa fila en el catálogo de septiembre a 20 €. La búsqueda de la ruta
//     no filtra por periodo y coge la más reciente, así que desde ahora todo
//     extra nuevo —Fútbol Total, LaLiga y Champions comparten precio— sale a 20.
//  2) RE-ESTAMPAR a 20 € las líneas de extra de SEPTIEMBRE que se quedaron a 10.
//     Solo las que están exactamente a 10 (no se pisa nada tecleado a mano) y
//     solo septiembre: agosto cobró a 10 y así se queda.
//  3) DESHACER el cambio de la mañana: la fila retirada vuelve a 10 €. No la lee
//     nadie, pero un dato falso en el catálogo es una trampa para el siguiente.
//     (El paso 1 de septiembre2026Fix.ts queda desactivado para que no la vuelva
//     a subir en cada arranque.)

const MES = '2026_09'
const PALANCA = 'Repo Fútbol'
const PRODUCTO = 'Repo Up Destino Fútbol'
const HERMANOS = [PRODUCTO, 'Repo Up Destino LaLiga', 'Repo Up Destino Champions']
const PRECIO = '20.00'

export async function fixFutbolSeptiembre2026() {
  const prisma = new PrismaClient()
  try {
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: MES } })
    if (!wp) {
      console.log('[futbol2026_09] el mes', MES, 'no existe todavía: no se toca nada')
      return
    }

    // ── 1 · la fila que lee la API de Nueva Venta ──────────────────────────
    const fila = await prisma.productCatalog.findFirst({
      where: { periodId: wp.id, categoria: PALANCA, producto: PRODUCTO },
      orderBy: { createdAt: 'desc' },
    })
    if (!fila) {
      await prisma.productCatalog.create({
        data: {
          periodId: wp.id, categoria: PALANCA, producto: PRODUCTO,
          mensual: '0', anual: '0', comision: PRECIO, comisionConCoste: '0',
          validFrom: '01/09/2026',
        },
      })
      console.log(`[futbol2026_09] creada la fila «${PRODUCTO}» (${PALANCA}) a ${PRECIO} € — antes no existía y valía el 10 € fijo del código`)
    } else if (String(fila.comision || '') !== PRECIO) {
      await prisma.productCatalog.update({ where: { id: fila.id }, data: { comision: PRECIO } })
      console.log(`[futbol2026_09] «${PRODUCTO}» (${PALANCA}): ${fila.comision} → ${PRECIO} €`)
    }

    // ── 2 · las líneas de extra de septiembre que se quedaron a 10 ─────────
    const lineas = await prisma.sale.findMany({
      where: {
        detalle: PALANCA,
        producto: { in: HERMANOS },
        OR: [{ periodId: wp.id }, { fecha: { contains: '/09/2026' } }],
      },
      select: { id: true, cuota: true, producto: true },
    })
    let reestampadas = 0
    for (const l of lineas) {
      if (Number(l.cuota) === 10) {
        await prisma.sale.update({ where: { id: l.id }, data: { cuota: Number(PRECIO) } })
        reestampadas++
      }
    }
    if (reestampadas) console.log(`[futbol2026_09] ${reestampadas} extra(s) de fútbol de septiembre re-estampados de 10 € a ${PRECIO} €`)

    // ── 3 · deshacer el cambio de la mañana en la fila retirada ────────────
    const retiradas = await prisma.productCatalog.findMany({
      where: { periodId: wp.id, categoria: 'Repos', producto: 'Extra Repos up destino Fútbol', comision: PRECIO },
    })
    for (const r of retiradas) {
      await prisma.productCatalog.update({ where: { id: r.id }, data: { comision: '10.00' } })
      console.log('[futbol2026_09] «Extra Repos up destino Fútbol» (Repos, retirada) devuelta a 10 €: no la lee nadie y estaba mal')
    }
    if (!reestampadas && fila && String(fila.comision) === PRECIO && retiradas.length === 0) {
      console.log('[futbol2026_09] todo ya estaba en su sitio')
    }
  } catch (e: any) {
    console.error('[futbol2026_09] aviso:', e?.message || e)
  } finally {
    await prisma.$disconnect().catch(() => { })
  }
}
