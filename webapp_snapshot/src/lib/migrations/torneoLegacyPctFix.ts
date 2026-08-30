import { PrismaClient } from '@prisma/client'

// Arreglo IDEMPOTENTE de arranque (30-ago-2026, aviso del dueño «no está
// primando las BAF de las fechas indicadas»): al rellenar las casillas viejas
// «% → unidades», el guardado del configurador FIJÓ los mínimos del torneo con
// los objetivos de la PALANCA (mes entero): mínimo de equipo 29→67 y 2º
// objetivo 39→78 en «Altas BAF Movistar Conv.», y mínimo 27→102 en «Total
// Altas BAF (No trasl.)». Esas casillas se han retirado del código; aquí se
// restauran los números del dueño y se limpian los % viejos.
//
// GUARDA: cada número solo se restaura si conserva el valor PISADO conocido
// (67/78/102) — si el dueño ya lo arregló a mano, no se toca. Los campos
// retirados (minGrupalPct/objetivo2Pct) se ponen a 0 siempre que existan.
export async function fixTorneoLegacyPct() {
  const prisma = new PrismaClient()
  try {
    const fila = await prisma.appSetting.findUnique({ where: { key: 'torneos_config_2026_08' } })
    if (!fila?.value) return
    const cfg = JSON.parse(fila.value)
    const cambios: string[] = []

    const c1 = (cfg?.concursos || []).find((x: any) => x?.id === 'c1')
    if (c1) {
      if (Number(c1.minGrupal) === 67) { c1.minGrupal = 29; cambios.push('c1 minGrupal 67→29') }
      if (Number(c1.objetivo2Grupal) === 78) { c1.objetivo2Grupal = 39; cambios.push('c1 objetivo2 78→39') }
      if (Number(c1.minGrupalPct) > 0 || Number(c1.objetivo2Pct) > 0) {
        c1.minGrupalPct = 0; c1.objetivo2Pct = 0; cambios.push('c1 % viejos limpiados')
      }
    }
    const c2 = (cfg?.concursos || []).find((x: any) => x?.id === 'c1787674935013')
    if (c2) {
      if (Number(c2.minGrupal) === 102) { c2.minGrupal = 27; cambios.push('c2 minGrupal 102→27') }
      if (Number(c2.minGrupalPct) > 0 || Number(c2.objetivo2Pct) > 0) {
        c2.minGrupalPct = 0; c2.objetivo2Pct = 0; cambios.push('c2 % viejos limpiados')
      }
    }

    if (cambios.length) {
      await prisma.appSetting.update({
        where: { key: 'torneos_config_2026_08' },
        data: { value: JSON.stringify(cfg) },
      })
      console.log('[torneoLegacyPctFix] restaurado:', cambios)
    } else {
      console.log('[torneoLegacyPctFix] nada que restaurar')
    }
  } catch (e) {
    console.error('[torneoLegacyPctFix] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
