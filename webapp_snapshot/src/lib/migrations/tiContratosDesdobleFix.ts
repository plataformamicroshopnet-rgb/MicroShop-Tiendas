import { PrismaClient } from '@prisma/client'

// Desdoble del catálogo de Contratos Móvil (30-ago-2026, OK del dueño).
//
// El cuadre euro a euro de junio destapó que Telefónica paga los contratos POR
// CAPAS: la captación por gama (AV 15 € / MV 10 € / BV 5 €, conceptos NC13OD/OE/
// OF/OG) MÁS 10 € de «ALTA CLIENTE CONTRATO» (NC13D7/D8) cuando el cliente es
// NUEVO en Movistar. Nuestro catálogo plano solo apuntaba la captación: por eso
// el Importe MicroShop de junio (940 €) quedó 465 € por debajo de lo cobrado.
//
// El desdoble bueno NO es alta-vs-portabilidad (eso paga igual): es CLIENTE
// NUEVO vs CLIENTE EXISTENTE. Seis productos nuevos SOLO en septiembre (los
// catálogos van por mes: los meses pasados no se tocan, y los productos planos
// de siempre se quedan por compatibilidad — el dueño decide cuándo retirarlos).
const NUEVOS = [
  { producto: 'Contrato Móvil AV - Cliente NUEVO (incluye alta cliente)', anual: '25',
    sub: 'Captación AV 15 € + Alta Cliente Contrato 10 € (NC13OD/OE + NC13D7). Cliente nuevo en Movistar.' },
  { producto: 'Contrato Móvil AV - Cliente existente', anual: '15',
    sub: 'Captación AV 15 € (NC13OD/OE). Línea para cliente que ya es de Movistar.' },
  { producto: 'Contrato Móvil MV - Cliente NUEVO (incluye alta cliente)', anual: '20',
    sub: 'Captación MV 10 € + Alta Cliente Contrato 10 € (NC13D7). Cliente nuevo en Movistar.' },
  { producto: 'Contrato Móvil MV - Cliente existente', anual: '10',
    sub: 'Captación MV 10 €. Línea para cliente que ya es de Movistar.' },
  { producto: 'Contrato Móvil BV - Cliente NUEVO (incluye alta cliente)', anual: '15',
    sub: 'Captación BV 5 € + Alta Cliente Contrato 10 € (NC13OF/OG + NC13D7). Cliente nuevo en Movistar.' },
  { producto: 'Contrato Móvil BV - Cliente existente', anual: '5',
    sub: 'Captación BV 5 € (NC13OF/OG). Línea para cliente que ya es de Movistar.' },
]

export async function fixTiContratosDesdoble() {
  const prisma = new PrismaClient()
  try {
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: '2026_09' } })
    if (!wp) { console.log('[tiDesdoble] sin periodo 2026_09 — nada que hacer'); return }
    let creados = 0
    for (const n of NUEVOS) {
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
    if (creados) console.log(`[tiDesdoble] ${creados} productos de Contratos Móvil desdoblados creados en 2026_09`)
    else console.log('[tiDesdoble] ya estaban — nada que hacer')
  } catch (e) {
    console.error('[tiDesdoble] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
