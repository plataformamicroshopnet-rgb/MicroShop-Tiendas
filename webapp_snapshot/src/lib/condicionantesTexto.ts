/**
 * EL «OJO» DE CADA PALANCA, EN CRISTIANO.
 *
 * Convierte los condicionantes de una regla de comisión en frases que entienda
 * quien cobra. Va en el Panel de Comisiones (lo ven los comerciales y el jefe).
 *
 * ⚠️ SE GENERA DESDE LA REGLA, NUNCA SE ESCRIBE A MANO. Es la única forma de que
 * el aviso no mienta: si el aviso fuera un texto fijo y alguien cambiara la
 * configuración —o nunca llegara a ponerla—, la pantalla estaría prometiendo una
 * condición que el programa no aplica, o callando una que sí. Aquí, lo que se lee
 * es exactamente lo que se paga.
 *
 * El aviso dice lo que HACE FALTA. Cuando una condición se incumple de verdad y
 * baja el tramo, el propio Panel lo marca aparte con «Tramo 1 por condición» y su
 * motivo (topeAplicado / topeMotivo del motor).
 */

const num = (v: any) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}
const esImporte = (rule: any) => String(rule?.importePrimerTramo || '').includes('%')
const fmt = (v: any, rule: any) => {
  const n = num(v)
  if (!n) return '0'
  return esImporte(rule)
    ? `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`
    : String(Math.round(n))
}

/**
 * Frases del «OJO» de una regla. Array vacío = esta palanca no tiene letra
 * pequeña y no hay que enseñar nada.
 */
export function textoCondicionantes(rule: any): string[] {
  if (!rule) return []
  const out: string[] = []

  const o1 = num(rule.objPrimerTramo)
  const o2 = num(rule.objSegundoTramo)
  const o3 = num(rule.objTercerTramo)

  let conds: any[] = []
  const raw = String(rule.condicionantes || '')
  if (raw.startsWith('[')) {
    try { conds = JSON.parse(raw) || [] } catch { conds = [] }
  }
  const tipos = new Set(conds.map((c: any) => c?.type))
  const equipo2 = tipos.has('REQUIRE_TEAM_OBJ2') || tipos.has('REQUIRE_TEAM_OBJ23')
  const equipo3 = tipos.has('REQUIRE_TEAM_OBJ3') || tipos.has('REQUIRE_TEAM_OBJ23')

  // ── Los objetivos, dichos de una vez ──────────────────────────────────────
  const metas: string[] = []
  if (o1 > 0) metas.push(`el 1.º con ${fmt(o1, rule)}`)
  if (o2 > 0) metas.push(`el 2.º con ${fmt(o2, rule)}${equipo2 ? ' entre todo el equipo' : ''}`)
  if (o3 > 0) metas.push(`el 3.º con ${fmt(o3, rule)}${equipo3 ? ' entre todo el equipo' : ''}`)
  if (metas.length > 1) out.push(`Se sube de tramo ${metas.join(', ')}.`)

  // ── Lo que EXIGEN otras palancas ──────────────────────────────────────────
  for (const c of conds) {
    const grupo = String(c?.targetGroup || '').trim()
    const valor = num(c?.value)
    if (!grupo || valor <= 0) continue

    if (c.type === 'REQUIRE_GROUP_PCT_TRAMO2') {
      out.push(`Del 2.º tramo en adelante hace falta además que «${grupo}» llegue al ${valor} % de su objetivo; si no, se paga al 1.º.`)
    } else if (c.type === 'REQUIRE_STORE_QTY_TRAMO2') {
      out.push(`Del 2.º tramo en adelante hacen falta además ${valor} de «${grupo}» en CADA tienda; si una sola se queda corta, se paga al 1.º.`)
    } else if (c.type === 'REQUIRE_GROUP_PCT') {
      out.push(`Esta palanca no se cobra si «${grupo}» no llega al ${valor} % de su objetivo.`)
    } else if (c.type === 'REQUIRE_GROUP_QTY') {
      // El caso más común es que la regla se apunte a SÍ MISMA (un mínimo propio).
      const propia = grupo.toLowerCase() === String(rule.nombre || '').toLowerCase()
      out.push(propia
        ? `No se cobra nada hasta llegar a ${valor}.`
        : `Esta palanca no se cobra si no hay al menos ${valor} de «${grupo}».`)
    }
  }

  if (tipos.has('ACCUMULATIVE_TRAMOS')) {
    out.push('Los tramos se suman: las primeras unidades se pagan al 1.º y el resto al 2.º.')
  }
  if (tipos.has('ACCUMULATIVE_FIXED_BASE')) {
    out.push('Se cobra un importe fijo al llegar al objetivo, y las unidades de más aparte.')
  }

  return out
}
