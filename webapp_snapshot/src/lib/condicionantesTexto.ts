/**
 * EL «OJO» DE CADA PALANCA.
 *
 * Va en el Panel de Comisiones (lo ven los comerciales y el jefe): debajo del
 * nombre de la palanca, en ámbar, con las condiciones que tiene puestas.
 *
 * HISTORIA (para que nadie lo vuelva atrás sin querer): en agosto de 2026 esto
 * se recortó a solo dos palancas (Repos ARPU y Fútbol) porque cada fila sacaba
 * su letra pequeña y ocupaba media pantalla. El dueño pidió después (12-ago)
 * volver a enseñarlo en TODAS las filas que tengan condición, con una frase
 * corta por condición. Las palancas sin condiciones siguen sin aviso: no hay
 * nada que contar y el silencio es la señal de «esta se cobra sin candados».
 *
 * ⚠️ LOS NÚMEROS SALEN DE LA REGLA, NUNCA ESCRITOS A MANO. El 80 %, los 30
 * dispositivos o el nombre de la palanca de la que se depende se leen de la
 * configuración de ese mes. Si un día cambia un objetivo, el aviso cambia con
 * él; si estuviera escrito a mano, la pantalla prometería una condición y el
 * programa aplicaría otra — y eso, en una pantalla que la gente usa para saber
 * lo que va a cobrar, es peor que no poner nada.
 *
 * ⚠️ SOLO SE CUENTAN LAS CONDICIONES COMPLETAS. Una condición sin el «sobre
 * qué» o sin valor la SALTA el motor, así que aquí tampoco se menciona: no se
 * promete un candado que no se aplica.
 */

const num = (v: any) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}
const ent = (v: any) => Math.round(num(v)).toLocaleString('es-ES')

const condicionesDe = (rule: any): any[] => {
  const raw = String(rule?.condicionantes || '')
  if (!raw.startsWith('[')) return []
  try { return JSON.parse(raw) || [] } catch { return [] }
}

/** ¿Tiene «sobre qué» y un valor mayor que 0? (las de equipo/acumulativas no
 *  necesitan ninguna de las dos cosas: son una forma de pago, no un candado). */
const completa = (c: any) => String(c?.targetGroup || '').trim() !== '' && num(c?.value) > 0

const sinAdornos = (s: any) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** La frase de UNA condición. '' = esa condición no se cuenta.
 *  `nombreRegla` sirve para detectar las condiciones que apuntan a la PROPIA
 *  palanca («swap requiere 1 de swap»), que en la pantalla del comercial no
 *  dicen nada: se traducen a «se paga a partir de N unidades» y, si es 1, se
 *  callan (que una venta necesite existir para cobrarse ya se da por hecho). */
function fraseDe(c: any, nombreRegla: string): string {
  const tipo = String(c?.type || '')
  const sobre = String(c?.targetGroup || '').trim()
  const esSiMisma = sinAdornos(sobre) === sinAdornos(nombreRegla)

  switch (tipo) {
    case 'REQUIRE_GROUP_QTY':
      if (!completa(c)) return ''
      if (esSiMisma) return num(c.value) > 1 ? `Se paga a partir de ${ent(c.value)} unidades.` : ''
      return `Condicionado a llegar a ${ent(c.value)} de ${sobre}.`
    case 'REQUIRE_GROUP_PCT':
      return completa(c) ? `Condicionado a llegar a un mínimo al ${ent(c.value)} % de ${sobre}.` : ''
    case 'REQUIRE_GROUP_PCT_TRAMO2':
      return completa(c)
        ? `Condicionado el cobro del segundo tramo a llegar al ${ent(c.value)} % en ${sobre} para Cobrar.`
        : ''
    case 'REQUIRE_STORE_QTY_TRAMO2':
      return completa(c)
        ? `Condicionado el cobro del segundo tramo a ${ent(c.value)} ${sobre} por Tienda.`
        : ''
    // Las de equipo y las acumulativas no son candados: cambian CÓMO se paga.
    // Se dicen igual, porque explican por qué un objetivo no es el que uno cree.
    case 'REQUIRE_TEAM_OBJ2':
      return 'El objetivo del segundo tramo es del EQUIPO.'
    case 'REQUIRE_TEAM_OBJ3':
      return 'El objetivo del tercer tramo es del EQUIPO.'
    case 'REQUIRE_TEAM_OBJ23':
      return 'Los objetivos del segundo y tercer tramo son del EQUIPO.'
    case 'ACCUMULATIVE_TRAMOS':
      return 'Tramos acumulativos: al llegar al segundo se cobran los dos por unidad.'
    case 'ACCUMULATIVE_FIXED_BASE':
      return 'Tramos acumulativos: bono fijo del primer tramo más las unidades del segundo.'
    default:
      return ''
  }
}

/**
 * Las frases de una regla, en el orden en que están configuradas. Array vacío =
 * esa palanca no lleva aviso (no tiene condiciones, o las que tiene están a
 * medias y el motor las salta).
 */
export function textoCondicionantes(rule: any): string[] {
  const nombre = String(rule?.nombre || '')
  if (!nombre) return []
  const frases: string[] = []
  for (const c of condicionesDe(rule)) {
    const f = fraseDe(c, nombre)
    // Sin repetir: dos condiciones idénticas no tienen por qué contarse dos veces.
    if (f && !frases.includes(f)) frases.push(f)
  }
  return frases
}
