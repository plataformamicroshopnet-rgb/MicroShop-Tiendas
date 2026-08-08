/**
 * EL «OJO» DE LAS DOS PALANCAS QUE LO NECESITAN.
 *
 * Va en el Panel de Comisiones (lo ven los comerciales y el jefe). Antes salía
 * un aviso en CADA palanca con toda su letra pequeña, y ocupaba media pantalla:
 * cuando todo avisa, no avisa nada. Petición del dueño (8-ago-2026): dejar solo
 * las dos que de verdad condicionan el cobro, y con sus palabras.
 *
 * ⚠️ LOS NÚMEROS SIGUEN SALIENDO DE LA REGLA, NUNCA ESCRITOS A MANO. El texto es
 * el suyo, pero el 161, el 186, el 80 % y los 30 dispositivos se leen de la
 * configuración de ese mes. Si un día cambia un objetivo, el aviso cambia con él;
 * si estuviera escrito a mano, la pantalla prometería una condición y el programa
 * aplicaría otra — y eso, en una pantalla que la gente usa para saber lo que va a
 * cobrar, es peor que no poner nada.
 */

const num = (v: any) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}
const ent = (v: any) => Math.round(num(v)).toLocaleString('es-ES')

const sinAdornos = (s: any) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

const condicionesDe = (rule: any): any[] => {
  const raw = String(rule?.condicionantes || '')
  if (!raw.startsWith('[')) return []
  try { return JSON.parse(raw) || [] } catch { return [] }
}

/**
 * ¿Es la palanca de los Repos por ARPU? El nombre ha ido cambiando: en mayo de
 * 2026 se llamaba «ARPU» a secas, después «Repos UP» y en pantalla «Repos
 * (Arpu)». Basta con que lleve «arpu» o con que sea un repo que no es el del
 * fútbol. (La primera versión exigía que llevara «repo» Y «arpu», y con la
 * palanca llamada «ARPU» no reconocía ninguna: el aviso no salía nunca.)
 */
const esReposArpu = (nombre: string) => {
  const n = sinAdornos(nombre)
  if (n.includes('futbol')) return false
  return n.includes('arpu') || (n.includes('repo') && n.includes('up'))
}

/** ¿Es la del fútbol? (Repo Fútbol, Altas Fútbol, Desarrollo TV…) */
const esFutbol = (nombre: string) => {
  const n = sinAdornos(nombre)
  return n.includes('futbol') || n.includes('desarrollo tv')
}

/**
 * El aviso de una regla. Array vacío = esa palanca no lleva aviso, que es el
 * caso de casi todas.
 */
export function textoCondicionantes(rule: any): string[] {
  const nombre = String(rule?.nombre || '')
  if (!nombre) return []

  const conds = condicionesDe(rule)

  if (esReposArpu(nombre)) {
    // El % lo pone la condición REQUIRE_GROUP_PCT_TRAMO2 (hoy, 100 % de
    // «Dispositivos + Seguros»). Si no estuviera puesta, no hay condición que
    // contar y no se enseña nada: mejor callar que prometer un candado que no
    // existe.
    const c = conds.find((x: any) => x?.type === 'REQUIRE_GROUP_PCT_TRAMO2')
    if (!c) return []
    return [
      `Condicionado el cobro del segundo tramo a llegar al ${ent(c.value)} % en ${String(c.targetGroup || 'Dispositivos + Seguros').trim()} para Cobrar.`,
    ]
  }

  if (esFutbol(nombre)) {
    // Solo los dos mínimos de empresa. Los objetivos de la propia palanca NO se
    // repiten aquí: ya se ven en su fila de la tabla, y meterlos alargaba el
    // aviso justo de lo que hay que enterarse (decisión del dueño, 8-ago-2026).
    const pct = conds.find((x: any) => x?.type === 'REQUIRE_GROUP_PCT_TRAMO2' || x?.type === 'REQUIRE_GROUP_PCT')
    const porTienda = conds.find((x: any) => x?.type === 'REQUIRE_STORE_QTY_TRAMO2')
    const minimo = pct ? `un mínimo al ${ent(pct.value)} % de ${String(pct.targetGroup || 'BAF convergente').trim()}` : ''
    const tienda = porTienda ? `${ent(porTienda.value)} ${String(porTienda.targetGroup || 'Dispositivos').trim()} por Tienda` : ''
    // Sin ninguna de las dos condiciones no hay candado que contar: mejor callar
    // que prometer uno que el programa no aplica.
    if (!minimo && !tienda) return []
    const cuerpo = minimo && tienda ? `${minimo} y ${tienda}` : (minimo || tienda)
    return [`Condicionado a llegar a ${cuerpo}.`]
  }

  // El resto de palancas, sin aviso: su letra pequeña ya está en los objetivos
  // que se ven en la propia tabla, y repetirla en cada fila tapaba lo que sí
  // hay que leer.
  return []
}
