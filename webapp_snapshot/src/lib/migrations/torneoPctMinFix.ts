import { PrismaClient } from '@prisma/client'

// Arreglo IDEMPOTENTE de arranque (30-ago-2026, orden del dueño): el torneo de
// agosto «Altas BAF Movistar Conv.» (id c1, 24-31/08) estrena la coletilla del
// cartel «mínimo el 120%» en la frase del 2º objetivo (39 ventas → 10 €/venta).
// El campo objetivo2PctMin es solo de CARTEL: la condición la vigila el dueño
// al pagar, igual que su nota del 100% — el motor sigue contando ventas.
//
// GUARDA: solo se escribe si el concurso c1 existe con el 2º objetivo a 39 y
// aún no tiene el campo — si el dueño ya lo puso (o cambió el torneo), no se pisa.
export async function fixTorneoPctMin() {
  const prisma = new PrismaClient()
  try {
    const fila = await prisma.appSetting.findUnique({ where: { key: 'torneos_config_2026_08' } })
    if (!fila?.value) return
    const cfg = JSON.parse(fila.value)
    const con = (cfg?.concursos || []).find((x: any) => x?.id === 'c1')
    if (!con || Number(con.objetivo2Grupal) !== 39 || Number(con.objetivo2PctMin) > 0) {
      console.log('[torneoPctMinFix] nada que hacer (sin c1/39, o ya puesto)')
      return
    }
    con.objetivo2PctMin = 120
    await prisma.appSetting.update({
      where: { key: 'torneos_config_2026_08' },
      data: { value: JSON.stringify(cfg) },
    })
    console.log('[torneoPctMinFix] torneo c1 de agosto: cartel del 2º objetivo con «mínimo el 120%»')
  } catch (e) {
    console.error('[torneoPctMinFix] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
