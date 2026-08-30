import { PrismaClient } from '@prisma/client'

// Orden de la lista de Contratos Móvil (30-ago-2026, el dueño: «colócalas en
// el mismo orden que te las mandé» y después «los puedes colocar en orden» por
// los planos cerrados). Las pantallas de catálogo ordenan por createdAt
// ascendente, así que se fija una secuencia de segundos sobre la fecha más
// antigua del grupo: cada familia junta (nuevo → existente → el plano viejo
// CERRADO 31/08 → adicionales), AV, MV, BV, y la adicional BAF SA al final.
// Estable si se ejecuta dos veces. OJO: debe correr DESPUÉS de
// tiContratosRetagFix, que es quien re-crea los planos cerrados.
const ORDEN = [
  'Contrato Móvil AV - Cliente NUEVO',
  'Contrato Móvil AV - Cliente EXISTENTE',
  'Contrato Móvil AV - Alta, portabilidad y migración',
  'Contrato Móvil AV - Alta, portabilidad y migración Líneas extras adicionales',
  'Contrato Móvil MV - Cliente NUEVO',
  'Contrato Móvil MV - Cliente EXISTENTE',
  'Contrato Móvil MV - Alta, portabilidad y migración contrato móvil',
  'Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales',
  'Contrato Móvil BV - Cliente NUEVO',
  'Contrato Móvil BV - Cliente EXISTENTE',
  'Contrato Móvil BV - Alta, portabilidad y migración contrato móvil',
  'Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales',
  'Contrato Móvil Línea móvil adicional asociada a BAF SA',
]

export async function fixTiContratosOrden() {
  const prisma = new PrismaClient()
  try {
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: '2026_09' } })
    if (!wp) return
    const filas = await prisma.productCatalog.findMany({
      where: { periodId: wp.id, categoria: 'Ti', producto: { in: ORDEN } },
    })
    if (filas.length === 0) { console.log('[tiOrden] sin filas — nada que ordenar'); return }
    const base = Math.min(...filas.map(f => f.createdAt.getTime()))
    let cambiadas = 0
    for (let i = 0; i < ORDEN.length; i++) {
      const fila = filas.find(f => f.producto === ORDEN[i])
      if (!fila) continue
      const objetivo = new Date(base + i * 1000)
      if (fila.createdAt.getTime() === objetivo.getTime()) continue
      await prisma.productCatalog.update({ where: { id: fila.id }, data: { createdAt: objetivo } })
      cambiadas++
    }
    if (cambiadas) console.log(`[tiOrden] ${cambiadas} filas recolocadas al orden del dueño`)
    else console.log('[tiOrden] ya estaban en orden')
  } catch (e) {
    console.error('[tiOrden] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
