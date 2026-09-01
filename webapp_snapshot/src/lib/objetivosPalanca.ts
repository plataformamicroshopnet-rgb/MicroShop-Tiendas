import type { PrismaClient } from '@prisma/client'

/**
 * LOS OBJETIVOS DE LAS COMISIONES, DESDE LOS OBJETIVOS POR TIENDA.
 *
 * EL PROBLEMA (01-sep-2026, el dueño: «ya está septiembre y están subidos los
 * objetivos, ¿por qué no están asignados, si quedamos que esto era automático?»).
 * En Tiendas hay DOS sitios con objetivos y la cañería del ERP solo llenaba uno:
 *
 *   · `TiendaStoreObjective` (tienda × casilla) — la llena el feed del ERP desde
 *     el Excel de Telefónica. Es lo que usa el Seguimiento de Tramitación. ✅
 *   · `TiendaCommissionRule.objPrimerTramo/Segundo/Tercero` (palanca × mes) — es
 *     lo que usan LAS COMISIONES, y no lo actualizaba nadie. ❌
 *
 * No es que el programa no «detectara» los objetivos: es que nunca miró ahí. Al
 * clonar el mes se copian los objetivos del mes anterior y se quedan congelados,
 * así que en septiembre los comerciales corrían contra el objetivo de AGOSTO
 * —más bajo— y llegaban a los tramos antes de lo que les toca.
 *
 * LA CORRESPONDENCIA ESTÁ PROBADA, no supuesta: el objetivo de agosto de
 * «Dispositivos + Seguros» son 94.463 €, que es EXACTAMENTE la suma de los
 * `dispSegEuros` de las cuatro tiendas de agosto (27.073 + 19.387 + 17.610 +
 * 30.393). Lo mismo cuadra al céntimo en las otras cuatro palancas de abajo.
 *
 * ⚠️ SOLO SE TOCAN LAS CINCO PALANCAS DE LA TABLA. ARPU, FTTR, Señalización
 * Solar 360 y swap NO salen del Excel: sus objetivos los pone el dueño a mano y
 * aquí no se rozan. («Señalización Solar 360» valía 8 en agosto igual que MPA,
 * pero es casualidad: no hay casilla del Excel que le corresponda.)
 */

/** Casillas del Excel (por tienda) que forman el objetivo de cada palanca.
 *  El nombre de la izquierda es el `nombre` de la regla en Comisiones. */
const DE_DONDE_SALE: Record<string, string[]> = {
  // agosto: 31+26+19+26 = 102 ✓ (el objetivo de agosto era 102)
  'Alta BAF Total': ['bafNoTrasl'],
  // agosto: 20+17+13+17 = 67 ✓
  'Alta BAF Convergente': ['bafConvMS'],
  // agosto: 27.073+19.387+17.610+30.393 = 94.463 € ✓
  'Dispositivos + Seguros': ['dispSegEuros'],
  // agosto: 2+2+2+2 = 8 ✓
  'MPA': ['alarmas'],
  // agosto: (14+13+10+13) + (37+14+27+33) = 50 + 111 = 161 ✓
  'Repo Fútbol': ['tvFutbol', 'repos'],
}

export interface CambioObjetivo {
  palanca: string
  antes: number
  ahora: number
  tramo2?: number | null
  tramo3?: number | null
}

/**
 * Recalcula los objetivos de las palancas de UN mes a partir de los objetivos
 * por tienda que acaban de llegar.
 *
 * LOS TRAMOS 2 Y 3: el Excel solo trae UN objetivo por casilla, así que el
 * segundo y el tercer escalón no se pueden leer de ningún sitio. Se mantiene el
 * MISMO PORCENTAJE DE SUBIDA que la palanca ya trae dentro —que, en un mes recién
 * clonado, es exactamente el del mes anterior— (decisión del dueño, 01-sep-2026:
 * «coge los porcentajes de agosto, que prácticamente serán los mismos, y cuando
 * tenga los de septiembre los subo»). Si la palanca no tiene segundo tramo, se
 * queda sin él: nunca se inventa un escalón.
 *
 * Es idempotente: con los mismos objetivos por tienda escribe siempre lo mismo.
 * ⚠️ Y es AUTORITATIVO para esas cinco palancas: si alguien cambia a mano el
 * objetivo de «Alta BAF Total», el siguiente envío del ERP lo vuelve a poner.
 */
export async function recalcularObjetivosDePalanca(
  prisma: PrismaClient,
  periodKey: string,
): Promise<CambioObjetivo[]> {
  const cambios: CambioObjetivo[] = []
  try {
    const tiendas = await prisma.tiendaStoreObjective.findMany({ where: { periodKey } })
    if (tiendas.length === 0) return cambios

    const reglas = await prisma.tiendaCommissionRule.findMany({ where: { periodKey } })
    if (reglas.length === 0) return cambios

    for (const [palanca, casillas] of Object.entries(DE_DONDE_SALE)) {
      const regla = reglas.find(r => r.nombre === palanca)
      if (!regla) continue

      const suma = tiendas.reduce((acc, t: any) => acc
        + casillas.reduce((s, c) => s + (Number(t?.[c]) || 0), 0), 0)
      if (suma <= 0) continue          // sin dato del Excel no se toca nada

      const antes = Number(regla.objPrimerTramo) || 0
      const obj1 = Math.round(suma)

      // Los escalones 2 y 3, al mismo % de subida QUE YA TIENE ESTA PALANCA.
      //
      // ⚠️ Se mira la proporción de la PROPIA fila (obj2/obj1 tal y como está
      // ahora), NO la del mes anterior. Parece lo mismo y no lo es: al clonar
      // el mes, la fila llega con los tres escalones copiados del mes pasado,
      // así que su proporción YA ES la del mes pasado — que es justo lo que
      // pidió el dueño. Y además esto es idempotente: recalcular un mes que ya
      // estaba bien lo deja igual. La primera versión tomaba la proporción del
      // mes anterior y, al pasar el job por todos los meses, le movía a AGOSTO
      // sus escalones —de 108.633 € a 117.187 €— sin que nadie lo pidiera.
      const base = antes
      const proporcion = (valor: any): number | null => {
        const v = Number(valor) || 0
        if (base <= 0 || v <= 0) return null
        return Math.round(obj1 * (v / base))
      }
      const obj2 = proporcion(regla.objSegundoTramo)
      const obj3 = proporcion(regla.objTercerTramo)

      const datos: any = { objPrimerTramo: obj1 }
      if (obj2 !== null) datos.objSegundoTramo = obj2
      if (obj3 !== null) datos.objTercerTramo = obj3

      await prisma.tiendaCommissionRule.update({ where: { id: regla.id }, data: datos })
      cambios.push({ palanca, antes, ahora: obj1, tramo2: obj2, tramo3: obj3 })
    }

    if (cambios.length > 0) {
      console.log('[objetivos] %s · objetivos de palanca puestos desde el Excel: %s',
        periodKey,
        cambios.map(c => `${c.palanca} ${c.antes}→${c.ahora}`).join(' · '))
    }
  } catch (e: any) {
    // Nunca tumba el guardado de los objetivos por tienda, que es lo principal.
    console.error('[objetivos] no se pudieron recalcular los de palanca:', e?.message || e)
  }
  return cambios
}
