import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'

/**
 * CONTRASEÑAS: DE TEXTO LEGIBLE A HUELLA.
 *
 * Hasta agosto de 2026 la contraseña se guardaba tal cual y el login la comparaba
 * letra a letra. Eso significaba que cualquiera capaz de abrir el fichero de la
 * base —una copia del QNAP, un backup descargado— leía las contraseñas de las
 * doce personas de golpe. Y la gente repite contraseña entre el trabajo y su
 * correo, así que el daño no se quedaba aquí dentro.
 *
 * Ahora se guarda una HUELLA: sirve para comprobar si la contraseña que escriben
 * es la buena, pero de ella no se puede sacar la contraseña. Se usa `scrypt`, que
 * viene DENTRO de Node: sin dependencias nuevas que instalar ni que puedan fallar
 * en un despliegue.
 *
 * Formato guardado:  scrypt$<sal en hex>$<huella en hex>
 *
 * Para quien entra no cambia nada: escribe la misma contraseña de siempre.
 */

const MARCA = 'scrypt$'
const LONGITUD = 32
const COSTE = 16384          // ~50-100 ms por comprobación: sobra para un login

/** ¿Este valor guardado es ya una huella, o es una contraseña legible? */
export function esHuella(guardado: any): boolean {
  return typeof guardado === 'string' && guardado.startsWith(MARCA)
}

/** Convierte una contraseña en la huella que se guarda. */
export function hashPassword(plana: string): string {
  const sal = randomBytes(16)
  const huella = scryptSync(String(plana ?? ''), sal, LONGITUD, { N: COSTE })
  return `${MARCA}${sal.toString('hex')}$${huella.toString('hex')}`
}

/**
 * Comprueba una contraseña contra lo guardado.
 *
 * `hayQueMigrar` avisa de que lo guardado era texto legible y ha acertado: quien
 * llame debe aprovechar para guardar ya la huella. Así, aunque a alguien se le
 * escape un usuario con la contraseña en claro (creado a mano, restaurado de un
 * backup viejo), se arregla solo la primera vez que esa persona entra.
 */
export function verifyPassword(plana: string, guardado: any): { ok: boolean; hayQueMigrar: boolean } {
  const val = String(guardado ?? '')
  if (!esHuella(val)) {
    // Camino ANTIGUO: comparación directa. Se mantiene solo para no dejar a nadie
    // fuera mientras queden contraseñas sin convertir.
    return { ok: val.length > 0 && val === String(plana ?? ''), hayQueMigrar: true }
  }
  try {
    const [, salHex, huellaHex] = val.split('$')
    const sal = Buffer.from(salHex, 'hex')
    const esperada = Buffer.from(huellaHex, 'hex')
    const calculada = scryptSync(String(plana ?? ''), sal, esperada.length, { N: COSTE })
    // timingSafeEqual y no ===: comparar así no deja medir por el tiempo de
    // respuesta cuántas letras se han acertado.
    return { ok: timingSafeEqual(calculada, esperada), hayQueMigrar: false }
  } catch {
    return { ok: false, hayQueMigrar: false }
  }
}
