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
  // y detrás, como en los demás meses: O2, altas de cliente y la recogida
  'Contrato O2 - Alta y Porta Sólo Móvil',
  'Contrato O2 - Alta y Porta Líneas Adicionales',
  'Alta Cliente Contrato Movistar y O2',
  'Alta Cliente asociadas a Multicanalidad',
  'Extra Recogida Alta Cliente en Tienda',
]

// Orden para los meses PASADOS (jun/jul/ago), pedido el 30-ago («me refería a
// esta lista… has dejado los Cliente NUEVO abajo del todo»): ahí no hay
// EXISTENTE ni planos cerrados — el plano abierto es el producto de la época y
// cada «Cliente NUEVO» (la rectificación) va justo detrás del suyo. La lista
// cubre TODAS las filas Ti de esos meses para que nada se intercale.
const ORDEN_PASADO = [
  'Contrato Móvil AV - Alta, portabilidad y migración',
  'Contrato Móvil AV - Cliente NUEVO',
  'Contrato Móvil AV - Alta, portabilidad y migración Líneas extras adicionales',
  'Contrato Móvil MV - Alta, portabilidad y migración contrato móvil',
  'Contrato Móvil MV - Cliente NUEVO',
  'Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales',
  'Contrato Móvil BV - Alta, portabilidad y migración contrato móvil',
  'Contrato Móvil BV - Cliente NUEVO',
  'Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales',
  'Contrato Móvil Línea móvil adicional asociada a BAF SA',
  'Contrato O2 - Alta y Porta Sólo Móvil',
  'Contrato O2 - Alta y Porta Líneas Adicionales',
  'Alta Cliente Contrato Movistar y O2',
  'Alta Cliente asociadas a Multicanalidad',
  'Extra Recogida Alta Cliente en Tienda',
]

async function ordenarMes(prisma: PrismaClient, periodKey: string, orden: string[]): Promise<number> {
  const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } })
  if (!wp) return 0
  const filas = await prisma.productCatalog.findMany({
    where: { periodId: wp.id, categoria: 'Ti', producto: { in: orden } },
  })
  if (filas.length === 0) return 0
  const base = Math.min(...filas.map(f => f.createdAt.getTime()))
  let cambiadas = 0
  for (let i = 0; i < orden.length; i++) {
    const fila = filas.find(f => f.producto === orden[i])
    if (!fila) continue
    const objetivo = new Date(base + i * 1000)
    if (fila.createdAt.getTime() === objetivo.getTime()) continue
    await prisma.productCatalog.update({ where: { id: fila.id }, data: { createdAt: objetivo } })
    cambiadas++
  }
  return cambiadas
}

export async function fixTiContratosOrden() {
  const prisma = new PrismaClient()
  try {
    let cambiadas = await ordenarMes(prisma, '2026_09', ORDEN)
    for (const pk of ['2026_06', '2026_07', '2026_08']) {
      cambiadas += await ordenarMes(prisma, pk, ORDEN_PASADO)
    }
    if (cambiadas) console.log(`[tiOrden] ${cambiadas} filas recolocadas al orden del dueño`)
    else console.log('[tiOrden] ya estaban en orden')
  } catch (e) {
    console.error('[tiOrden] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
