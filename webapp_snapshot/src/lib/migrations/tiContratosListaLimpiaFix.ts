import { PrismaClient } from '@prisma/client'

// Corrección del desdoble de Contratos Móvil (30-ago-2026, el dueño: «me hago
// un lío, te paso la lista y corrígela»): en vez de AÑADIR 6 productos junto a
// los planos (quedaban 13 y era un lío), se corrige SU lista en sitio:
//  - Los 3 productos PRINCIPALES (AV/MV/BV «Alta, portabilidad y migración»)
//    se desdoblan en Cliente NUEVO (con los 10 € del Alta Cliente Contrato,
//    NC13D7) y Cliente existente — conservando SUS descripciones de tarifas.
//  - Las «Líneas extras adicionales» y la «adicional asociada a BAF SA» se
//    quedan tal cual: una línea adicional es de un cliente que ya existe y no
//    lleva alta de cliente.
//  - Los 6 productos paralelos del intento anterior se retiran.
// Solo toca SEPTIEMBRE (2026_09); guardas por nombre exacto e idempotente.

const QUITAR = [
  // el intento anterior (paralelo, confuso)
  'Contrato Móvil AV - Cliente NUEVO (incluye alta cliente)',
  'Contrato Móvil AV - Cliente existente',
  'Contrato Móvil MV - Cliente NUEVO (incluye alta cliente)',
  'Contrato Móvil MV - Cliente existente',
  'Contrato Móvil BV - Cliente NUEVO (incluye alta cliente)',
  'Contrato Móvil BV - Cliente existente',
  // los 3 principales planos, que quedan sustituidos por su desdoble
  'Contrato Móvil AV - Alta, portabilidad y migración',
  'Contrato Móvil MV - Alta, portabilidad y migración contrato móvil',
  'Contrato Móvil BV - Alta, portabilidad y migración contrato móvil',
]

const SUB = {
  AV: 'Altas, portabilidades y migraciones desde Prepago a Tarifa Móvil Ilimitada/Tarifa Móvil Ilimitada x2',
  MV: 'Altas, portabilidades y migraciones desde Prepago a Tarifa Móvil Max',
  BV: 'Altas, portabilidades y migraciones desde Prepago a Tarifa Móvil Base',
}
const NUEVO = ' · Cliente NUEVO en Movistar: lleva incluidos los 10 € del Alta Cliente Contrato (NC13D7)'
const EXIST = ' · Cliente que ya es de Movistar'

const PONER = [
  { producto: 'Contrato Móvil AV - Cliente NUEVO', anual: '25', sub: SUB.AV + NUEVO },
  { producto: 'Contrato Móvil AV - Cliente EXISTENTE', anual: '15', sub: SUB.AV + EXIST },
  { producto: 'Contrato Móvil MV - Cliente NUEVO', anual: '20', sub: SUB.MV + NUEVO },
  { producto: 'Contrato Móvil MV - Cliente EXISTENTE', anual: '10', sub: SUB.MV + EXIST },
  { producto: 'Contrato Móvil BV - Cliente NUEVO', anual: '15', sub: SUB.BV + NUEVO },
  { producto: 'Contrato Móvil BV - Cliente EXISTENTE', anual: '5', sub: SUB.BV + EXIST },
]

export async function fixTiContratosListaLimpia() {
  const prisma = new PrismaClient()
  try {
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: '2026_09' } })
    if (!wp) { console.log('[tiListaLimpia] sin periodo 2026_09'); return }

    // Guarda: si alguna venta de septiembre ya usó un producto a retirar, no se
    // borra ese (se avisa) — el histórico manda.
    let borrados = 0
    for (const nombre of QUITAR) {
      const usada = await prisma.sale.count({ where: { producto: nombre, fecha: { contains: '/09/2026' } } })
      if (usada > 0) { console.log(`[tiListaLimpia] «${nombre}» tiene ${usada} ventas de sept — no se retira`); continue }
      const res = await prisma.productCatalog.deleteMany({
        where: { periodId: wp.id, categoria: 'Ti', producto: nombre },
      })
      borrados += res.count
    }

    let creados = 0
    for (const n of PONER) {
      const ya = await prisma.productCatalog.findFirst({
        where: { periodId: wp.id, categoria: 'Ti', producto: n.producto },
      })
      if (ya) continue
      await prisma.productCatalog.create({ data: {
        periodId: wp.id, categoria: 'Ti', producto: n.producto,
        mensual: 'NaN', anual: n.anual, validFrom: '01/09/2026', validTo: null,
        subcategoria: n.sub, fabricante: null, gama: null, comision: null, comisionConCoste: null,
      } })
      creados++
    }
    console.log(`[tiListaLimpia] ${borrados} retirados · ${creados} creados (lista limpia de Contratos Móvil en 2026_09)`)
  } catch (e) {
    console.error('[tiListaLimpia] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
