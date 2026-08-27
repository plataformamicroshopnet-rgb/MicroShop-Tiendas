// ─────────────────────────────────────────────────────────────────────────────
// UNA VENTA, UN BLOQUE (dueño, 26-ago-2026)
//
// Telefónica paga el alta y sus paquetes como UNA sola operación. El equipo lo
// estaba grabando en dos líneas —el alta por un lado y el paquete en «Repos
// (Arpu)» por otro— y eso, además de contar dos ventas donde hay una, cobra de
// MENOS: la tarifa de un alta y la de un reposicionamiento son distintas, y al
// meter el paquete dentro el alta sube de tramo (BV ×1,5 → MV ×2). El ejemplo
// del dueño: 100,50 € + 68 € = 168,50 € tecleado a mano, cuando la fila del
// catálogo para ese mismo conjunto vale 200,00 €.
//
// Lo que hace este fichero: leer el catálogo de miMovistar como lo que ya es —
// una rejilla de conjuntos— para que la pantalla ofrezca los paquetes por
// separado y encuentre sola la fila buena (y con ella el precio OFICIAL).
//
// El nombre del producto en el catálogo ya viene multilínea:
//   «Movistar+\nFicción Total con netflix Estándar\nFutbol Total»
// es decir, la lista de paquetes de ese conjunto. Ahí está toda la información.
// ─────────────────────────────────────────────────────────────────────────────

import { isVentaWithinDates } from './salesUtils'

export interface FilaCatalogo {
  categoria?: string
  subcategoria?: string     // el TRAMO: BV / MV / AV / PROMO … (decide el multiplicador)
  gama?: string             // miMovistar BASE / MAX / ILIMITADO / ILIMITADO x2 / x4
  producto?: string
  comision?: string | number
  comisionConCoste?: string | number
  validFrom?: string
  validTo?: string
}

const num = (v: any): number => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export const normPaquete = (v: any) =>
  String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim()

/** El precio de una fila, con la MISMA cuenta que Nueva Venta: comisión ×
 *  multiplicador del tramo (un multiplicador a 0 vale 1). */
export function precioFila(f: FilaCatalogo): number {
  const base = num(f.comision)
  const mult = num(f.comisionConCoste)
  return base * (mult > 0 ? mult : 1)
}

/** Los paquetes de un producto: «Movistar+\nFútbol Total» → ['Movistar+', 'Fútbol Total'].
 *  «Seleccionar sin más productos» es el alta pelada: ningún paquete. */
export function paquetesDeProducto(producto: any): string[] {
  const txt = String(producto || '').trim()
  if (!txt) return []
  const partes = txt.split('\n').map(s => s.trim()).filter(Boolean)
  if (partes.length === 1 && normPaquete(partes[0]).startsWith('seleccionar sin')) return []
  return partes
}

/** Clave para comparar dos conjuntos sin que importe el orden en que se marcaron. */
export const claveConjunto = (paquetes: string[]) =>
  paquetes.map(normPaquete).filter(Boolean).sort().join('|')

/** Las PROMO (VODAFONE, DIGI…) no son paquetes que se marcan: son un producto
 *  entero con su tarifa cerrada. Se eligen como hasta ahora, en su desplegable. */
export const esPromo = (f: FilaCatalogo) =>
  normPaquete(f.subcategoria).startsWith('promo')

/** Las filas de una gama (todos los tramos: lo que decide si es BV, MV o AV es
 *  justamente el conjunto de paquetes, así que la pantalla no debe pedirlo antes). */
export function filasDeGama(catalogo: FilaCatalogo[], gama: string): FilaCatalogo[] {
  const g = normPaquete(gama)
  return (catalogo || []).filter(f => normPaquete(f.gama) === g && !esPromo(f))
}

/** Todos los paquetes que se pueden marcar en una gama, con su precio incremental
 *  aproximado (lo que sube el conjunto al añadirlo, mirando el propio catálogo).
 *  El precio final NUNCA sale de aquí: sale de la fila del conjunto. */
/** ¿Esta gama es de verdad una REJILLA de conjuntos? Lo es si el catálogo enseña
 *  combinaciones: alguna fila con dos o más paquetes, o el alta pelada. Si no
 *  —«Fusión+ BAR» son cuatro TRAMOS DE FACTURACIÓN excluyentes, «Autónomos» es
 *  un alta suelta—, sus filas NO son paquetes que se sumen y el bloque no debe
 *  salir: pintarlas como casillas invitaría a marcar dos tramos a la vez. */
export function esGamaDeConjuntos(catalogo: FilaCatalogo[], gama: string): boolean {
  const filas = filasDeGama(catalogo, gama)
  if (filas.length < 2) return false
  const hayCombinada = filas.some(f => paquetesDeProducto(f.producto).length >= 2)
  const hayPelada = filas.some(f => paquetesDeProducto(f.producto).length === 0)
  return hayCombinada && hayPelada
}

export function paquetesDeGama(catalogo: FilaCatalogo[], gama: string):
    { nombre: string; suma: number | null }[] {
  if (!esGamaDeConjuntos(catalogo, gama)) return []
  const filas = filasDeGama(catalogo, gama)
  const vistos = new Map<string, string>()
  for (const f of filas) {
    for (const p of paquetesDeProducto(f.producto)) {
      if (!vistos.has(normPaquete(p))) vistos.set(normPaquete(p), p)
    }
  }
  // el alta pelada de esa gama, para poder decir cuánto suma cada paquete
  const pelada = filas.find(f => paquetesDeProducto(f.producto).length === 0)
  const basePelada = pelada ? num(pelada.comision) : null
  return [...vistos.values()].map(nombre => {
    const sola = filas.find(f => claveConjunto(paquetesDeProducto(f.producto)) === normPaquete(nombre))
    const suma = (sola && basePelada !== null) ? num(sola.comision) - basePelada : null
    return { nombre, suma }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** La fila del catálogo que corresponde EXACTAMENTE a esa gama y ese conjunto de
 *  paquetes. Es la que manda: su precio es el oficial de Telefónica. */
export function filaDelConjunto(catalogo: FilaCatalogo[], gama: string, paquetes: string[],
                                fechaVentaEs?: string): FilaCatalogo | null {
  const objetivo = claveConjunto(paquetes)
  const candidatas = filasDeGama(catalogo, gama)
    .filter(f => claveConjunto(paquetesDeProducto(f.producto)) === objetivo)
  if (candidatas.length === 0) return null
  // VIGENCIAS: con dos tarifas del mismo conjunto gana la que cubre la fecha de
  // la venta — exactamente el desempate que ya hace Nueva Venta al elegir
  // producto. Sin esto, cambiar un precio a mitad de mes dejaba el viejo.
  if (candidatas.length > 1 && fechaVentaEs) {
    const vigente = candidatas.find(f => isVentaWithinDates(fechaVentaEs, f.validFrom, f.validTo))
    if (vigente) return vigente
  }
  return candidatas[0]
}

/** El desglose para enseñarlo en pantalla: el alta pelada + lo que suma cada
 *  paquete + el multiplicador del tramo. Solo es INFORMATIVO: el total sale de
 *  la fila del conjunto. */
export function desgloseConjunto(catalogo: FilaCatalogo[], gama: string, paquetes: string[],
                                 fechaVentaEs?: string) {
  const filas = filasDeGama(catalogo, gama)
  const pelada = filas.find(f => paquetesDeProducto(f.producto).length === 0) || null
  const fila = filaDelConjunto(catalogo, gama, paquetes, fechaVentaEs)
  const sumas = paquetesDeGama(catalogo, gama)
  const com = (f: FilaCatalogo | null) => (f ? num(f.comision) : null)
  const lineas = paquetes.map(p => {
    // lo que suma ESE paquete: primero, si existe él solo en el catálogo; si no,
    // la diferencia entre el conjunto con él y el conjunto sin él (así no se
    // queda ningún guion en el ticket).
    let suma = sumas.find(s => normPaquete(s.nombre) === normPaquete(p))?.suma ?? null
    if (suma === null) {
      const conEl = com(filaDelConjunto(catalogo, gama, paquetes, fechaVentaEs))
      const sinEl = com(filaDelConjunto(catalogo, gama,
        paquetes.filter(x => normPaquete(x) !== normPaquete(p)), fechaVentaEs))
      if (conEl !== null && sinEl !== null) suma = conEl - sinEl
    }
    return { nombre: p, suma }
  })
  return {
    fila,
    baseNombre: pelada ? String(pelada.producto || '') : '',
    baseComision: pelada ? num(pelada.comision) : null,
    lineas,
    comisionConjunto: fila ? num(fila.comision) : null,
    multiplicador: fila ? (num(fila.comisionConCoste) > 0 ? num(fila.comisionConCoste) : 1) : null,
    tramo: fila ? String(fila.subcategoria || '') : '',
    total: fila ? precioFila(fila) : null,
  }
}
