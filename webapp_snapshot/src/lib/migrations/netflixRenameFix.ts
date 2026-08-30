import { PrismaClient } from '@prisma/client'

// Arreglo IDEMPOTENTE de arranque (30-ago-2026, OK del dueño: «es este el
// válido: Netflix Estandar x2 con anuncios PROMO, lo corriges»): las ventas
// tecleadas como «Netflix con anuncios» no existen en ningún catálogo — el
// nombre bueno lo delata su propia cuota (7,86 € = 5,24 × 1,5 del catálogo).
// Solo cambia el NOMBRE del producto; la cuota ya era la correcta y no se toca.
//
// GUARDA: coincidencia EXACTA del nombre malo. Si alguien ya corrigió una
// línea, no casa y no se toca.
export async function fixNetflixRename() {
  const prisma = new PrismaClient()
  try {
    const res = await prisma.sale.updateMany({
      where: { producto: 'Netflix con anuncios' },
      data: { producto: 'Netflix Estandar x2 con anuncios PROMO' },
    })
    if (res.count > 0) console.log(`[netflixRename] ${res.count} ventas renombradas al producto del catálogo`)
    else console.log('[netflixRename] nada que renombrar')
  } catch (e) {
    console.error('[netflixRename] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
