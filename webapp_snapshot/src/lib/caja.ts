// ─────────────────────────────────────────────────────────────────────────────
// CAJA DE TIENDAS — reglas compartidas por la pantalla y por el servidor.
//
// Modulo PURO (sin React, sin prisma). Aqui vive lo que antes estaba suelto en
// la pantalla y no se aplicaba en ningun sitio:
//
//   - Que conceptos existen y cuales son entrada, salida o libres.
//   - El SIGNO del importe. Los conceptos siempre se han llamado «(-) Ingreso
//     en Banco», «(-) Recogida de Efectivo»… pero eso era decoracion: el
//     importe se guardaba tal cual se tecleaba y el saldo lo sumaba todo, asi
//     que una recogida de 200 EUR SUBIA la caja 200 EUR en vez de bajarla.
//     Ahora el signo lo pone el programa a partir del concepto.
//   - Las tiendas que tienen caja, Central incluida.
// ─────────────────────────────────────────────────────────────────────────────

/** Conceptos de un movimiento suelto (los que se ven en el desplegable). */
export const CONCEPTOS: string[] = [
  '(+) Caja SIAC',
  '(+) Ajuste SIAC',
  '(+) Facturación Microshop',
  '(+) Otras entradas',
  '(+) Facturación MovilFree',
  '(+) Tarjeta MovilFree',
  '(+/-) Corrección',
  '(-) Recogida de Efectivo',
  '(-) Pago Servicio Técnico',
  '(-) Material de oficina',
  '(-) Ingreso en Banco',
  '(-) Otras salidas',
]

/** Conceptos que genera un traspaso entre cajas (no se eligen a mano). */
export const CONCEPTO_TRASPASO_SALIDA = '(-) Traspaso de efectivo'
export const CONCEPTO_TRASPASO_ENTRADA = '(+) Traspaso recibido'

/** Cajas que existen. Central es una caja mas: es donde acaba el efectivo. */
export const TIENDAS_CON_CAJA = ['Auxiliadora', 'Villamayor', 'Béjar', 'Correhuela', 'MovilFree', 'Central']

/**
 * Destinos que NO son una caja: el dinero se va del circuito y no entra en
 * ningun sitio (por eso no llevan apunte de contrapartida).
 */
export const DESTINO_BANCO = 'Banco'
export const DESTINO_VARIOS = 'Varios'
export const DESTINOS_EXTERNOS = [DESTINO_BANCO, DESTINO_VARIOS]
export const esDestinoExterno = (destino: string) => DESTINOS_EXTERNOS.includes(String(destino))

/**
 * A donde puede ir el dinero segun de que caja sale.
 *
 * Regla del dueno: desde una TIENDA el efectivo sube a Central o pasa a otra
 * tienda (y tambien puede irse al banco o a un gasto), pero **desde Central
 * las salidas son a Banco o a Varios**: de Central no vuelve a bajar a las
 * tiendas.
 */
export function destinosDesde(origen: string): string[] {
  if (origen === 'Central') return [...DESTINOS_EXTERNOS]
  return [...TIENDAS_CON_CAJA.filter(t => t !== origen), ...DESTINOS_EXTERNOS]
}

/**
 * Signo que le corresponde a un concepto:
 *   -1 → siempre negativo (sale dinero)
 *   +1 → siempre positivo (entra dinero)
 *    0 → lo que teclee la persona (correcciones: pueden ir en los dos sentidos)
 *
 * Se decide por el prefijo del propio nombre del concepto, que es como se han
 * llamado siempre. Asi un concepto nuevo hereda la regla sin tocar codigo.
 */
export function signoDeConcepto(concepto: string): -1 | 0 | 1 {
  const c = String(concepto || '').trim()
  if (c.startsWith('(+/-)')) return 0
  if (c.startsWith('(-)')) return -1
  if (c.startsWith('(+)')) return 1
  return 0 // desconocido: no tocamos lo que venga
}

/**
 * Importe ya con su signo correcto.
 *
 * OJO, es IDEMPOTENTE a proposito: FUERZA el signo, no lo invierte. El TPV ya
 * graba las devoluciones en negativo con concepto «(-) Otras salidas»
 * (src/app/api/microshop-accesorios/sales/[id]/route.ts); una regla que le
 * diera la vuelta al signo convertiria esa devolucion en un ingreso.
 */
export function normalizarImporte(concepto: string, importe: number): number {
  const n = Number(importe)
  if (!isFinite(n)) return 0
  const signo = signoDeConcepto(concepto)
  const abs = Math.abs(n)
  // Se redondea a 2 decimales: el TPV venia guardando 15,004 / 29,9959 y un
  // arqueo contra el cajon nunca cuadraba al centimo.
  const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100
  if (signo === -1) return r2(-abs)
  if (signo === 1) return r2(abs)
  return r2(n)
}

/** ¿Este apunte es una de las dos patas de un traspaso? */
export const esTraspaso = (e: { tipo?: string | null }) =>
  e.tipo === 'TRASPASO_SALIDA' || e.tipo === 'TRASPASO_ENTRADA'

/** Nombre de caja al que corresponde un grupo de comerciales. */
export function cajaDelGrupo(grupo: string): string {
  if (grupo === 'Auxiliadora 45') return 'Auxiliadora'
  if (grupo === 'O2') return 'MovilFree'
  return grupo
}

/**
 * En que caja esta un usuario. 'ADMIN' = manda sobre todas las cajas.
 *
 * REGLA UNICA para la pantalla y para el servidor. Tenerla en dos sitios costo
 * caro: la pantalla ascendia a 'ADMIN' a cualquiera con permiso de Caja que no
 * estuviera en la lista de comerciales de tienda (el caso de Salva, jefe de
 * ventas, que es justo quien recoge el efectivo), le pintaba todas las pestanas
 * y el boton de salida… y el servidor le respondia «sin tienda asignada». Se
 * quedaba sin apunte y, como ahora el papel sale DESPUES de guardar, sin
 * justificante tampoco.
 */
export function cajaDeUsuario(
  user: { username?: string; role?: string } | null | undefined,
  tiendasComerciales: Record<string, string[]>,
  opts: { mandaSobreTodas: boolean; puedeCaja: boolean },
): string | null {
  if (!user) return null
  if (user.role === 'ADMIN' || opts.mandaSobreTodas) return 'ADMIN'
  for (const [grupo, miembros] of Object.entries(tiendasComerciales)) {
    if (miembros.includes(String(user.username))) return cajaDelGrupo(grupo)
  }
  // No esta asignado a ninguna tienda pero tiene permiso de Caja: es de
  // central (jefatura, back office). Manda sobre todas las cajas.
  if (opts.puedeCaja) return 'ADMIN'
  return null
}
