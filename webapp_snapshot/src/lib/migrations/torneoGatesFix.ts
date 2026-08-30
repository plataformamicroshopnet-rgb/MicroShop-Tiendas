import { PrismaClient } from '@prisma/client'

// Arreglo IDEMPOTENTE de arranque (30-ago-2026, orden del dueño: «hay que
// dejarlo montado ahora — las unidades son orientativas, pueden dar bajas y
// después tramitarlas; la manera de que no ocurra es con los porcentajes»):
// los dos torneos de agosto llevaban su candado del 100% como NOTA A MANO
// (sin comprobar). Ahora el motor lo comprueba (gatePctPalanca): se pone el
// 100 y se retira la nota, que pasa a generarse sola con «lo comprueba el
// programa».
//
// GUARDA: solo se toca el concurso cuya nota siga siendo EXACTAMENTE la de
// entonces y que aún no tenga el candado — si el dueño cambió algo, no se pisa.
const CANDADOS: Array<{ id: string; nota: string }> = [
  { id: 'c1', nota: 'imprescindible llegar al 100% Altas BAF Movistar Conv.' },
  { id: 'c1787674935013', nota: 'imprescindible llegar al 100% Total Altas BAF (No trasl.)' },
]

export async function fixTorneoGates() {
  const prisma = new PrismaClient()
  try {
    const fila = await prisma.appSetting.findUnique({ where: { key: 'torneos_config_2026_08' } })
    if (!fila?.value) return
    const cfg = JSON.parse(fila.value)
    let tocados = 0
    for (const cand of CANDADOS) {
      const con = (cfg?.concursos || []).find((x: any) => x?.id === cand.id)
      if (!con || Number(con.gatePctPalanca) > 0) continue
      if (String(con.notas || '').trim() !== cand.nota) continue
      con.gatePctPalanca = 100
      con.notas = ''
      tocados++
    }
    if (tocados > 0) {
      await prisma.appSetting.update({
        where: { key: 'torneos_config_2026_08' },
        data: { value: JSON.stringify(cfg) },
      })
      console.log(`[torneoGatesFix] ${tocados} torneo(s) de agosto con el candado del 100% en el MOTOR (nota a mano retirada)`)
    } else {
      console.log('[torneoGatesFix] nada que hacer')
    }
  } catch (e) {
    console.error('[torneoGatesFix] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
