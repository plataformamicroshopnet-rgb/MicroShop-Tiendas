import { PrismaClient } from '@prisma/client'

// Arreglo IDEMPOTENTE de arranque (30-ago-2026, auditoría de arrastres, orden del
// dueño): el territorial de JULIO (AppSetting territorial_tiendas_2026_07) se
// quedó con los objetivos de JUNIO en «Dispositivos + Seguro»
// (110.734/127.344/143.955 €) cuando los oficiales de julio — los mismos que ya
// tiene el Panel de julio en TiendaCommissionRule — son 99.000/122.815/141.238 €.
// El clon del 01-ago actualizó las demás palancas de julio pero esta no, y la
// pantalla Territorial de julio evaluaba los tramos con objetivos viejos.
//
// GUARDA: solo se toca si las tres casillas AÚN llevan el valor de junio — si el
// dueño ya lo corrigió a mano, no se pisa nada.
export async function fixTerritorialJulio() {
  const prisma = new PrismaClient()
  try {
    const fila = await prisma.appSetting.findUnique({ where: { key: 'territorial_tiendas_2026_07' } })
    if (!fila?.value) {
      console.log('[territorialJulioFix] sin territorial_tiendas_2026_07 — nada que hacer')
      return
    }
    const items = JSON.parse(fila.value)
    if (!Array.isArray(items)) return
    const it = items.find((x: any) => String(x?.nombre || '').trim() === 'Dispositivos + Seguro')
    if (!it) return
    const viejo = it.obj1Global === '110734€' && it.obj2Global === '127344€' && it.obj3Global === '143955€'
    if (!viejo) {
      console.log('[territorialJulioFix] ya corregido (o distinto): no se toca',
        { obj1: it.obj1Global, obj2: it.obj2Global, obj3: it.obj3Global })
      return
    }
    it.obj1Global = '99000€'
    it.obj2Global = '122815€'
    it.obj3Global = '141238€'
    await prisma.appSetting.update({
      where: { key: 'territorial_tiendas_2026_07' },
      data: { value: JSON.stringify(items) },
    })
    console.log('[territorialJulioFix] Dispositivos + Seguro de julio: objetivos de junio → oficiales de julio (99000/122815/141238)')
  } catch (e) {
    console.error('[territorialJulioFix] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
