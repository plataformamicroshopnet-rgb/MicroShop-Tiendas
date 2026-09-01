import { PrismaClient } from '@prisma/client'
import { claveFactoresRepoArpu } from '../salesUtils'

// LAS CONDICIONES ECONÓMICAS DE SEPTIEMBRE-2026 (comunicado Nacional
// OFE_PDV_035_26_COM_Nacional_1_Septiembre, leído entero y comparado celda a
// celda contra el de agosto OFE_PDV_034).
//
// El Territorial (TER_PDV_014) NO cambia: de sus 13 diferencias con agosto, las
// 13 son fechas y el nombre del fichero. Aquí no hay nada que tocar por él.
//
// Del Nacional salen TRES cambios de dinero. Dos se arreglan aquí; el tercero
// entra solo:
//
//  1) EXTRA REPOSICIONAMIENTOS DESTINO FÚTBOL (NC142Y): 10 € → 20 €.
//     Es el que más mueve: con las 309 unidades de agosto son +3.090 €/mes.
//     En el catálogo es «Extra Repos up destino Fútbol» (categoría Repos), y su
//     precio vive en `comision` — OJO: `comisionConCoste` de esa tabla NO son
//     euros, es el MULTIPLICADOR (por eso «Futbol Total PROMO» pone 39 con
//     multiplicador 2 y la venta sale a 78 €). Aquí el multiplicador es 0 (=1),
//     así que basta con subir `comision`.
//
//  2) REPOS DE ARPU: la tabla cambia ENTERA y además se mueve el corte.
//        antes:  ∆ARPU >= 10 € → ×2      · < 10 € → ×1,5
//        ahora:  ∆ARPU >= 35 € → ×1,25   · el resto → ×1
//     (NC13WM <6 € ×1 · NC13WL 6-10 € ×1 · NC13WH 10-35 € ×1 · NC13WI >=35 € ×1,25)
//     Se guarda en la tabla POR MES que se estrenó para esto, así agosto
//     conserva los suyos y lo ya cobrado no se toca.
//
//  3) DISPOSITIVOS (6 % → 4 % en PREMIUM/ALTA y 3 % → 2 % en el resto, tanto en
//     VENTA como en RENT CON COSTE; el sin coste ya estaba en 4/2 y no se mueve,
//     así que a partir de ahora con coste y sin coste pagan LO MISMO).
//     Esto NO se toca por código: la comisión de cada aparato viaja en el
//     catálogo y entra sola cuando se pegue la TABLA_DISPOSITIVOS de septiembre.
//
// Y una consecuencia del punto 2 que hay que acompañar: el objetivo de la
// palanca ARPU está en EUROS DE REPO. Si el multiplicador baja a la mitad, los
// mismos repos valen la mitad, y dejar el objetivo igual haría que el comercial
// pagara la bajada DOS veces (cobra menos y además le cuesta más llegar). Se
// baja en la misma proporción: el tramo que más se usa (10-35 €) pasa de ×2 a
// ×1, o sea justo la mitad.

const MES = '2026_09'

export async function fixSeptiembre2026() {
  const prisma = new PrismaClient()
  try {
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: MES } })
    if (!wp) {
      console.log('[sept2026] el mes', MES, 'no existe todavía: no se toca nada')
      return
    }

    // ── 1 · el extra del fútbol, 10 € → 20 € ────────────────────────────────
    const extras = await prisma.productCatalog.findMany({
      where: { periodId: wp.id, producto: { contains: 'estino Fútbol' } },
      select: { id: true, producto: true, categoria: true, comision: true },
    })
    for (const p of extras) {
      const esElExtra = /extra/i.test(p.producto) || String(p.categoria || '') === 'Repos'
      const valor = String(p.comision ?? '').replace(',', '.').trim()
      // Guarda: SOLO si sigue a 10. Si ya está a 20 (o alguien puso otra cosa),
      // no se toca — así esto se puede volver a ejecutar sin miedo.
      if (esElExtra && (valor === '10' || valor === '10.00' || valor === '10.0')) {
        await prisma.productCatalog.update({ where: { id: p.id }, data: { comision: '20.00' } })
        console.log(`[sept2026] «${p.producto}» (${p.categoria}): 10 € → 20 €`)
      }
    }

    // ── 2 · los multiplicadores del repo de ARPU ────────────────────────────
    const clave = claveFactoresRepoArpu(MES)
    const yaEsta = await prisma.appSetting.findUnique({ where: { key: clave } })
    if (!yaEsta) {
      await prisma.appSetting.create({
        data: { key: clave, value: JSON.stringify({ corte: 35, alto: 1.25, bajo: 1 }) },
      })
      console.log('[sept2026] repos de ARPU: ×1,25 desde 35 € y ×1 por debajo')
    }

    // ── EL OBJETIVO DE ARPU NO SE TOCA AQUÍ, Y ES A PROPÓSITO ───────────────
    // Iba a bajarlo a la mitad (el multiplicador del tramo más usado pasa de ×2
    // a ×1, así que los mismos repos valen la mitad de euros y dejar el objetivo
    // igual haría que el comercial pagara la bajada dos veces). Pero el dueño lo
    // puso a mano el 01-sep: 7.200 / 8.600 —antes tenía los 1.100 / 1.600 de
    // agosto clonados—. Es SU número y no se pisa por código.
    //
    // Si resulta que lo calculó con los importes viejos, tocaría 3.600 / 4.300;
    // eso lo decide él, no esta migración.
  } catch (e: any) {
    console.error('[sept2026] error (no bloquea el arranque):', e?.message || e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
