// ─────────────────────────────────────────────────────────────────────────────
// QUÉ REPO SE PUEDE AÑADIR A UN ALTA (dueño, 27-ago-2026)
//
// Un Repo (Arpu) es SUBIR LA FACTURACIÓN de un cliente. De ahí sale toda la
// regla, en una frase del dueño: «si vale más, sí; si no, no se considera un
// repo». Así que:
//
//   · El paquete YA lleva ese servicio y el repo no sube nada  → PROHIBIDO
//   · El paquete lo lleva pero el repo SUBE de nivel           → permitido
//   · El paquete no lo lleva                                    → permitido
//
// Y hay un matiz que da el dueño: «el Fútbol Total es todos», o sea que quien
// tiene Fútbol Total ya tiene La Liga y Champions dentro — no hay nada que
// subir. Al revés sí: de La Liga o Champions se puede subir a Fútbol Total.
//
// El porqué de la prohibición: en miMovistar Telefónica paga a N+2, así que
// tras la baja de un paquete de TV tienen que pasar 20 días para que
// vuelva a pagar. Eso NO lo sabe el programa (no tenemos las bajas), por eso va
// como pregunta al comercial y no como candado automático.
// ─────────────────────────────────────────────────────────────────────────────

// Copia del normalizador de antifraudeVentas a propósito: ese fichero importa de
// este, y hacerlo en los dos sentidos deja un bucle de imports. Son tres líneas.
const norm = (v: any) =>
  String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim()

/** Las familias de servicio y su ESCALERA. Un repo de la misma familia solo se
 *  permite si su peldaño es más alto que el que ya lleva el alta. */
export interface Familia {
  clave: string
  etiqueta: string
  /** peldaños de menor a mayor; cada uno con las pistas que lo reconocen */
  escalera: { nivel: number; pistas: string[] }[]
}

export const FAMILIAS: Familia[] = [
  {
    clave: 'futbol', etiqueta: 'Fútbol',
    escalera: [
      { nivel: 1, pistas: ['champion', 'la liga', 'laliga'] },
      { nivel: 2, pistas: ['futbol total', 'futbol'] },   // el Fútbol Total los incluye
    ],
  },
  {
    // FICCIÓN Y NETFLIX SON LA MISMA FAMILIA (dueño, 28-ago-2026).
    //
    // Netflix tuvo escalera unos días: se permitía subir de anuncios a Estándar y a
    // Premium con un repo. El dueño lo cortó al verlo en pantalla, y con razón: el
    // propio desplegable del paquete ya ofrece la misma gama con cada Netflix, así
    // que la subida se elige en EL PAQUETE, no con un repo encima.
    //
    // Y van juntas porque son el mismo sitio del recibo con dos nombres. El paquete
    // normal se llama «Ficción Total con netflix Estándar»; el MISMO paquete en
    // promoción se llama «Movistar Plus + Fútbol + Netfilx Estandar», sin la palabra
    // Ficción. Separadas, las promos no bloqueaban los repos de Ficción y el mismo
    // producto tenía reglas distintas según cómo estuviera escrito.
    clave: 'ficcion', etiqueta: 'Ficción / Netflix',
    escalera: [
      { nivel: 1, pistas: ['ficcion', 'netflix', 'netfilx'] },
    ],
  },
  {
    clave: 'movistarplus', etiqueta: 'Movistar+',
    escalera: [{ nivel: 1, pistas: ['movistar+', 'movistar +', 'movistar plus'] }],
  },
]

/** Qué nivel de cada familia trae un texto de producto. */
export function nivelesDe(texto: any): Record<string, number> {
  const t = norm(texto)
  const out: Record<string, number> = {}
  if (!t) return out
  for (const f of FAMILIAS) {
    for (const peldano of f.escalera) {
      if (peldano.pistas.some(p => t.includes(p))) {
        out[f.clave] = Math.max(out[f.clave] || 0, peldano.nivel)
      }
    }
  }
  return out
}

export const etiquetaFamilia = (clave: string) =>
  FAMILIAS.find(f => f.clave === clave)?.etiqueta || clave

export interface Veredicto {
  permitido: boolean
  motivo: string           // por qué no, en castellano de tienda
  familia?: string
}

/**
 * ¿Se puede añadir este repo a este alta?
 * @param productoAlta  el producto del alta («Movistar+\nFútbol Total»)
 * @param productoRepo  el producto de Repos (Arpu) que se quiere añadir
 */
export function puedeAnadirse(productoAlta: any, productoRepo: any): Veredicto {
  const enAlta = nivelesDe(productoAlta)
  const enRepo = nivelesDe(productoRepo)

  for (const clave of Object.keys(enRepo)) {
    const yaTiene = enAlta[clave]
    if (!yaTiene) continue                       // el alta no lo lleva: adelante
    const sube = enRepo[clave] > yaTiene
    if (sube) continue                           // sube de nivel: es un repo de verdad

    const fam = etiquetaFamilia(clave)
    // La Ficción Total no tiene escalera: si el alta la lleva, ningún repo con
    // «Ficción» aporta nada (la mezcla de Ficción + Netflix ya va dentro).
    const detalle = clave === 'futbol' && yaTiene === 2
      ? 'el Fútbol Total ya incluye La Liga y Champions'
      : `el alta ya lleva ${fam} y este repo no sube de nivel`
    return {
      permitido: false, familia: clave,
      motivo: `No se puede: ${detalle}. Un Repo (Arpu) solo vale si SUBE la facturación del cliente.`,
    }
  }
  return { permitido: true, motivo: '' }
}

/**
 * TODAS las familias por las que este repo no cabe en este alta (puedeAnadirse
 * corta en la primera; aquí hacen falta todas para poder perdonar alguna, como
 * el Movistar+ de las altas con la promo «sin el Paquete Movistar Plus»).
 */
export function familiasBloqueadas(productoAlta: any, productoRepo: any): string[] {
  const enAlta = nivelesDe(productoAlta)
  const enRepo = nivelesDe(productoRepo)
  return Object.keys(enRepo).filter(clave => {
    const yaTiene = enAlta[clave]
    return !!yaTiene && enRepo[clave] <= yaTiene
  })
}

/** ¿Estos dos textos comparten familia? Da igual el nivel: dos cosas de la misma
 *  familia en la MISMA venta siempre están de más (Champions y La Liga, o
 *  Champions y Fútbol Total, son el mismo sitio del recibo del cliente). */
export function familiasComunes(unTexto: any, otroTexto: any): string[] {
  const a = nivelesDe(unTexto)
  const b = nivelesDe(otroTexto)
  return Object.keys(a).filter(clave => clave in b)
}

/** La misma pregunta, para una lista de repos: útil para pintar el desplegable
 *  con los que no caben ya deshabilitados y con su motivo. */
export function filtraRepos<T extends { producto?: any }>(productoAlta: any, repos: T[]) {
  return repos.map(r => ({ ...r, veredicto: puedeAnadirse(productoAlta, r.producto) }))
}

/** El aviso de los 20 días: se pregunta SIEMPRE que el repo entre en
 *  una familia que el alta no lleva pero que el cliente pudo tener antes. */
export const AVISO_BAJA_TV =
  'Si este cliente tuvo antes un paquete de TV, tienen que haber pasado 20 días '
  + 'desde la baja para que Telefónica lo pague (miMovistar se cobra a N+2).\n\n'
  + '¿Han pasado ya?'

export const PREGUNTA_PLANTA =
  '¿Este cliente YA está en planta (ya era cliente antes de esta venta)?\n\n'
  + '· SÍ  → se graba como Repo (Arpu) aparte, con su propio precio.\n'
  + '· NO  → entra dentro del alta: una sola venta, con los importes sumados.'
