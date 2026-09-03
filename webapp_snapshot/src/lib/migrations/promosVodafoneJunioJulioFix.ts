import { PrismaClient } from '@prisma/client'

// LAS PROMO VODAFONE DE JUNIO Y JULIO DE 2026, COMO LAS PIDIÓ EL DUEÑO (03-sep-2026).
//
// Gabriel está rectificando ventas de junio y julio y necesita que el catálogo de
// esos meses tenga las promos con las que se vendió. Junio y julio son meses
// cerrados (HISTORIC): el guardado normal del catálogo los rechaza y además es un
// borrar-y-escribir de la parrilla entera, así que esto se hace aquí, al arrancar,
// tocando SOLO las filas afectadas y sin borrar nada. Idempotente: se puede
// ejecutar en cada arranque.
//
// Cómo se escribe una promo en el catálogo (categoría miMovistar): subcategoría
// «PROMO VODAFONE», gama (miMovistar Base / MAX), producto, comisión y el
// multiplicador «con coste» (×2). Lo que el dueño llama «130 €» es la comisión con
// coste: 65 × 2. Así están las de agosto y septiembre (Base 53, MAX 65 en «con
// anuncios») y así se estampan en la cuota de las ventas (130, 106…).
//
// JUNIO
//  · La fila de Vodafone que se dio de alta el 01/09 quedó mal: gama «PROMO
//    VODAFONE» (no es una gama) y producto «Netfix». Pasa a ser la de
//    miMovistar MAX · Fútbol + Netflix con anuncios (65 × 2 = 130 €).
//  · Se añade miMovistar Base · Fútbol + Netflix con anuncios (53 × 2 = 106 €).
//  · Se añade miMovistar Base · Fútbol + Ficción Total (73 × 2 = 146 €).
//  · La de MAX · Fútbol + Ficción Total (85 × 2 = 170 €) ya existía y se queda.
//  · Las tres ventas de junio tecleadas con el producto «Netfix con Anuncios»
//    pasan a llamarse como la fila buena («Netfilx con Anuncios», la grafía que
//    usa todo el catálogo); su cuota (130 €) no se toca.
// JULIO
//  · Se añade miMovistar MAX · Fútbol + Netflix con anuncios (65 × 2 = 130 €).
//    La de Base (53 × 2 = 106 €) ya existía.

const prisma = new PrismaClient()

const CATEGORIA = 'miMovistar'
const SUB = 'PROMO VODAFONE'
const CON_ANUNCIOS = 'Movistar Plus + Fútbol + Netfilx con Anuncios'
const FICCION = 'Movistar Plus + Fútbol + Ficción Total'
const MAL_ESCRITO = 'Movistar Plus + Fútbol + Netfix con Anuncios'
const X2 = '2.00'

type Fila = { gama: string; producto: string; comision: string }
const FILAS: Record<string, Fila[]> = {
  '2026_06': [
    { gama: 'miMovistar MAX', producto: CON_ANUNCIOS, comision: '65.00' },
    { gama: 'miMovistar Base', producto: CON_ANUNCIOS, comision: '53.00' },
    { gama: 'miMovistar Base', producto: FICCION, comision: '73.00' },
  ],
  '2026_07': [
    { gama: 'miMovistar MAX', producto: CON_ANUNCIOS, comision: '65.00' },
  ],
}

const norm = (v: any) => String(v ?? '').trim().toLowerCase()

export async function fixPromosVodafoneJunioJulio() {
  try {
    for (const [mes, filas] of Object.entries(FILAS)) {
      const wp = await prisma.workPeriod.findUnique({ where: { period_key: mes } })
      if (!wp) { console.log(`[promosVodafoneJunioJulioFix] el mes ${mes} no existe; nada que hacer`); continue }

      // 1) Junio: la fila mal tecleada del 01/09 se convierte en la de MAX · con anuncios.
      if (mes === '2026_06') {
        const malas = await prisma.productCatalog.findMany({
          where: { periodId: wp.id, categoria: CATEGORIA, subcategoria: SUB, gama: SUB },
        })
        for (const m of malas) {
          await prisma.productCatalog.update({
            where: { id: m.id },
            data: { gama: 'miMovistar MAX', producto: CON_ANUNCIOS, comision: '65.00', comisionConCoste: X2 },
          })
          console.log(`[promosVodafoneJunioJulioFix] ${mes}: fila «${m.gama} · ${m.producto}» corregida a miMovistar MAX · ${CON_ANUNCIOS} (65 × 2)`)
        }
      }

      // 2) Asegurar las filas pedidas: solo se crea lo que falta (misma categoría, subcategoría, gama y producto).
      const existentes = await prisma.productCatalog.findMany({ where: { periodId: wp.id, categoria: CATEGORIA, subcategoria: SUB } })
      for (const f of filas) {
        const ya = existentes.find(e => norm(e.gama) === norm(f.gama) && norm(e.producto) === norm(f.producto))
        if (ya) continue
        await prisma.productCatalog.create({
          data: { categoria: CATEGORIA, subcategoria: SUB, gama: f.gama, producto: f.producto, comision: f.comision, comisionConCoste: X2, mensual: '', anual: '', validFrom: null, validTo: null, periodId: wp.id },
        })
        console.log(`[promosVodafoneJunioJulioFix] ${mes}: creada ${f.gama} · ${f.producto} (${f.comision} × 2)`)
      }

      // 3) Junio: las ventas tecleadas con «Netfix» pasan a la grafía del catálogo; la cuota no se toca.
      if (mes === '2026_06') {
        const r = await prisma.sale.updateMany({ where: { periodId: wp.id, producto: MAL_ESCRITO }, data: { producto: CON_ANUNCIOS } })
        if (r.count) console.log(`[promosVodafoneJunioJulioFix] ${mes}: ${r.count} venta(s) «Netfix» renombradas a «Netfilx»`)
      }
    }
  } catch (e) {
    console.error('[promosVodafoneJunioJulioFix] error:', e)
  }
}
