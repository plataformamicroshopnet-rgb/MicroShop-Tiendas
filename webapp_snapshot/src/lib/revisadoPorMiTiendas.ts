// ─────────────────────────────────────────────────────────────────────────────
// «YA LO HE REVISADO» — TIENDAS (hermano del de FFVV).
//
// El paso «Extras y bonos» del hub avisa en ámbar cuando hay bonos vivos sin una
// regla activa que los respalde: es la firma de bonos que sobrevivieron de un
// mes anterior. Pero si el dueño LOS HA MIRADO y decide que deben seguir, ese
// ámbar no se apaga solo — y un aviso que no puedes apagar enseña a ignorar los
// avisos. Este sello dice «he mirado ESTO»: guarda una HUELLA de los bonos y las
// reglas de hoy, así que en cuanto un bono o una regla cambie, la huella deja de
// cuadrar y el aviso vuelve solo. Queda con quién y cuándo. Nunca sella el futuro.
//
// La huella se calcula en UN solo sitio (aquí) y la usan los dos lados: el que
// pinta el semáforo y el que sella. Si cada uno la calculara a su modo, un día
// dejarían de cuadrar y el sello no valdría.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto'

/** Los pasos que admiten sello. Ningún otro puede darse por revisado.
 *  'palancas' se añadió en T5: su ámbar («no encuentro Repos (Arpu) / Repo
 *  Fútbol por nombre») puede ser un renombrado a propósito; el sello lo apaga
 *  y vuelve solo si cambia el juego de palancas del mes. El rojo del versus
 *  (dinero en pérdida al cierre) NO se puede sellar a propósito. */
export const PASOS_CON_SELLO = ['extras', 'palancas'] as const
export type PasoConSello = (typeof PASOS_CON_SELLO)[number]

export const esPasoConSello = (id: any): id is PasoConSello =>
  (PASOS_CON_SELLO as readonly string[]).includes(String(id))

export const claveSelloRevision = (pasoId: string, periodKey: string) =>
  `revisado_tiendas_${pasoId}_${periodKey}`

export interface SelloRevision {
  cuando: string
  quien: string
  huella: string
}

/** Huella de un conjunto de firmas; se ordenan para que el orden no la rompa. */
export function huellaDeContenido(firmas: string[]): string {
  return createHash('sha256').update([...firmas].sort().join('§')).digest('hex').slice(0, 32)
}

const num = (v: any) => (v === null || v === undefined || v === '' ? '' : String(Number(v)))

/** Firma de una regla de extras: lo que de verdad paga. */
export const firmaReglaExtra = (r: any) => [
  String(r.name ?? '').trim(),
  r.isActive ? 'ON' : 'OFF',
  num(r.telecomRewardAmount), num(r.sellerRewardAmount),
  num(r.minOccurrences), num(r.maxPayoutUnits),
].join('|')

/** Firma de un bono asignado: a quién y cuánto. */
export const firmaBono = (a: any) => [
  String(a.triggerKey ?? '').trim(),
  String(a.sourceType ?? '').trim(),
  num(a.telecomRewardAmount), num(a.sellerRewardAmount),
].join('|')

/**
 * La huella de lo que hay HOY en el mes para ese paso. null si el paso no
 * admite sello o el mes no existe.
 */
export async function huellaDelPaso(prisma: any, pasoId: string, periodKey: string): Promise<string | null> {
  const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } })
  if (!wp) return null

  if (pasoId === 'extras') {
    const [reglas, bonos] = await Promise.all([
      prisma.extraRule.findMany({ where: { isActive: true } }),
      prisma.extraAssignment.findMany({ where: { periodId: wp.id } }),
    ])
    return huellaDeContenido([
      ...reglas.map((r: any) => `R|${firmaReglaExtra(r)}`),
      ...bonos.map((a: any) => `B|${firmaBono(a)}`),
    ])
  }

  if (pasoId === 'palancas') {
    // Lo revisado son los NOMBRES de las palancas del mes (el aviso es «no
    // encuentro Repos (Arpu)/Fútbol por nombre»): si el juego de nombres
    // cambia, el sello caduca y el aviso vuelve solo.
    const reglas = await prisma.tiendaCommissionRule.findMany({ where: { periodKey } })
    return huellaDeContenido(reglas.map((r: any) => `P|${String(r.nombre ?? '').trim()}`))
  }

  return null
}

/** Lee el sello guardado y dice si SIGUE VALIENDO para lo que hay hoy. */
export function leerSello(valor: any, huellaAhora: string | null): { sello: SelloRevision | null; vigente: boolean } {
  if (!valor) return { sello: null, vigente: false }
  try {
    const s = JSON.parse(String(valor)) as SelloRevision
    if (!s || !s.cuando) return { sello: null, vigente: false }
    return { sello: s, vigente: !!huellaAhora && s.huella === huellaAhora }
  } catch {
    return { sello: null, vigente: false }
  }
}

/** «8 de agosto de 2026 a las 21:14» */
export const cuandoEnCristiano = (iso: string) => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  })
}
