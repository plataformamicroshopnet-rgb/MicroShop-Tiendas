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

    // ── 1 · el extra del fútbol, 10 € → 20 € ── DESACTIVADO ────────────────
    // Este paso subía «Extra Repos up destino Fútbol» (categoría Repos), que es
    // una fila RETIRADA que no lee nadie: el precio del extra lo estampa la API
    // de Nueva Venta desde { categoria: 'Repo Fútbol', producto: 'Repo Up
    // Destino Fútbol' }, y esa fila no existía. Se descubrió la noche del
    // 01-sep-2026 con cinco extras del día todavía a 10 €. Lo hace bien —y
    // deshace esto— futbolSeptiembre2026Fix.ts, que corre justo después.

    // ── 2 · los multiplicadores del repo de ARPU ────────────────────────────
    const clave = claveFactoresRepoArpu(MES)
    const yaEsta = await prisma.appSetting.findUnique({ where: { key: clave } })
    if (!yaEsta) {
      await prisma.appSetting.create({
        data: { key: clave, value: JSON.stringify({ corte: 35, alto: 1.25, bajo: 1 }) },
      })
      console.log('[sept2026] repos de ARPU: ×1,25 desde 35 € y ×1 por debajo')
    }

    // ── 3 · los dispositivos CON COSTE bajan al mismo % que sin coste ───────
    //
    // El comunicado baja el DISPOSITIVO RENT CON COSTE de 6 % a 4 % (PREMIUM y
    // ALTA) y de 3 % a 2 % (el resto). El SIN COSTE ya estaba en 4 % y 2 % y no
    // se mueve — así que desde septiembre las dos cobran LO MISMO y la cuenta
    // es directa: la casilla «con coste» pasa a valer lo que la normal.
    //
    // Se hace por código y no esperando a la TABLA_DISPOSITIVOS nueva porque esa
    // tabla trae PRECIOS y altas/bajas de modelos, no los porcentajes (el dueño,
    // 01-sep-2026), y porque desde el día 1 las operaciones tienen que grabarse
    // ya con lo nuevo: si no, lo que se liquide no cuadrará con Telefónica.
    //
    // ⚠️ Y ARREGLA TAMBIÉN LO YA VENDIDO: la comisión de un Rent NO se congela en
    // la venta, se busca en el catálogo por nombre y fecha cada vez que se
    // calcula (lib/saleCommission). Al corregir el catálogo, las ventas de
    // septiembre que ya estén grabadas pasan a valer lo correcto solas.
    const rent = await prisma.productCatalog.findMany({
      where: { periodId: wp.id, categoria: 'Rent' },
      select: { id: true, comision: true, comisionConCoste: true },
    })
    const aNum = (v: any) => {
      const t = String(v ?? '').replace(',', '.').trim()
      if (!t || t === '-') return NaN
      const n = Number(t)
      return Number.isFinite(n) ? n : NaN
    }
    let bajadas = 0
    for (const p of rent) {
      const sin = aNum(p.comision)
      const con = aNum(p.comisionConCoste)
      // Guardas: solo si las dos son números, la normal es > 0 (nunca se deja un
      // aparato a cero) y la de con coste sigue por ENCIMA. Si ya están igual
      // —o alguien las ha tocado— no se hace nada: esto se puede repetir.
      if (!Number.isFinite(sin) || !Number.isFinite(con) || sin <= 0 || con <= sin) continue
      await prisma.productCatalog.update({
        where: { id: p.id },
        data: { comisionConCoste: String(p.comision) },
      })
      bajadas++
    }
    if (bajadas > 0) {
      console.log(`[sept2026] dispositivos: ${bajadas} filas de Rent con la comisión CON COSTE bajada al mismo % que sin coste (6→4 % y 3→2 %)`)
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
