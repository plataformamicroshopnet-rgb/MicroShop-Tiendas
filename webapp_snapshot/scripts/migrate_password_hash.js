/**
 * CONVIERTE LAS CONTRASEÑAS LEGIBLES EN HUELLAS. Se ejecuta al arrancar.
 *
 * Hasta agosto de 2026 la contraseña se guardaba tal cual: cualquiera capaz de
 * abrir el fichero de la base —una copia del QNAP, un backup descargado— leía las
 * de todo el mundo de golpe. Esto las convierte en una huella con la que se puede
 * COMPROBAR la contraseña pero de la que NO se puede sacar.
 *
 * · Es IDEMPOTENTE: lo que ya es una huella no se toca. Puede correr en cada
 *   arranque sin hacer nada.
 * · Nadie tiene que cambiar de contraseña ni enterarse: se escribe la misma de
 *   siempre y el login la comprueba contra su huella.
 * · Si algo falla, NO se toca esa fila: mejor dejar una contraseña sin convertir
 *   que dejar a alguien sin poder entrar. El login tiene además su propia red
 *   (verifyPassword marca `hayQueMigrar` y la convierte al vuelo).
 *
 * Mismo formato que src/lib/password.ts:  scrypt$<sal hex>$<huella hex>
 */
const { PrismaClient } = require('@prisma/client')
const { scryptSync, randomBytes } = require('crypto')

const MARCA = 'scrypt$'
const LONGITUD = 32
const COSTE = 16384

const esHuella = (v) => typeof v === 'string' && v.startsWith(MARCA)
const hashPassword = (plana) => {
  const sal = randomBytes(16)
  const huella = scryptSync(String(plana ?? ''), sal, LONGITUD, { N: COSTE })
  return `${MARCA}${sal.toString('hex')}$${huella.toString('hex')}`
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const usuarios = await prisma.user.findMany({ select: { username: true, password: true } })
    const pendientes = usuarios.filter(u => !esHuella(u.password))

    if (pendientes.length === 0) {
      console.log(`[Contraseñas] Las ${usuarios.length} ya estaban cifradas. Nada que hacer.`)
      return
    }

    let hechas = 0, fallos = 0
    for (const u of pendientes) {
      // Una contraseña vacía no se convierte: dejaría una huella que nadie puede
      // acertar y esa persona se quedaría fuera sin saber por qué.
      if (!u.password || String(u.password).trim() === '') {
        console.warn(`[Contraseñas] ${u.username} no tiene contraseña: se deja como está.`)
        continue
      }
      try {
        await prisma.user.update({
          where: { username: u.username },
          data: { password: hashPassword(u.password) }
        })
        hechas++
      } catch (e) {
        fallos++
        console.error(`[Contraseñas] No se pudo convertir la de ${u.username}:`, e.message)
      }
    }
    console.log(`[Contraseñas] Cifradas ${hechas} de ${pendientes.length}` +
                (fallos ? ` (${fallos} con error, se quedan como estaban)` : '') +
                '. Nadie tiene que cambiar nada: se entra con la misma de siempre.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => {
  // Nunca tumbar el arranque por esto: sin las huellas se sigue pudiendo entrar
  // (el login acepta las legibles y las convierte cuando la persona entra).
  console.error('[Contraseñas] El paso de cifrado falló entero:', e)
  process.exit(0)
})
