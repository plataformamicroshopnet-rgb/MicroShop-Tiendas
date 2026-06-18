import { calculateDynamicCommission, normalizeString, isVentaWithinDates } from './salesUtils'

// ─────────────────────────────────────────────────────────────────────────
// FUENTE ÚNICA DE LA COMISIÓN POR VENTA (empresa / Telefónica)
// Antes esta misma lógica estaba copiada literal en 4 sitios (Liquidaciones,
// MOD, MOD-Resumen y Operaciones por Grupo Cliente) y divergía: Grupo Cliente
// se olvidaba del +15 € de Swap. Centralizándola, las cuatro vistas cuadran
// siempre por construcción.
//
// getSaleCommissionBase = comisión de la operación SIN el bono de Swap.
// getSaleCommission     = base + 15 € si la venta es Swap (la empresa cobra
//                         15 € extra por cada venta con ¿Swap? marcado).
// ─────────────────────────────────────────────────────────────────────────

export interface SaleCommissionCtx {
  /** Catálogos por palanca (Ti, Rent, Seguro, Micro…). */
  catalogs: Record<string, any[]>
  /** Filas del dashboard del canal Plus/Pyme (renderDashboardData 'Pyme'). */
  dashRowsPlus: any[]
  /** Filas del dashboard del canal Básico/Captador (renderDashboardData 'Captador'). */
  dashRowsBasico: any[]
  /** Periodo que se está visualizando, en formato 'YYYYMM'. */
  viewingPeriod: string
}

const parseSafeFloat = (val: any): number => {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const clean = String(val).replace('€', '').replace(/\s/g, '').replace(',', '.').trim()
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

const PLUS_CODES_EXACT = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7']

export function getSaleCommissionBase(sale: any, ctx: SaleCommissionCtx): number {
  const { catalogs, dashRowsPlus, dashRowsBasico, viewingPeriod } = ctx

  // Anuladas no comisionan.
  if (sale.anulado === 'Si' || sale.anulado === 'Sí' || sale.pendiente === 'Anulado') return 0

  const codigoLower = String(sale.codigo || '').trim().toLowerCase()
  const isPlus = PLUS_CODES_EXACT.some(c => codigoLower.includes(c))

  // Mes de la venta (de su fecha de tramitación), en formato YYYYMM.
  let saleMonth = ''
  if (sale.fecha) {
    const parts = sale.fecha.split('/')
    if (parts.length === 3) saleMonth = `${parts[2]}${parts[1]}`
    else if (sale.fecha.includes('-')) {
      const p = sale.fecha.split('-')
      if (p.length >= 2) saleMonth = `${p[0]}${p[1]}`
    }
  }

  const det = (sale.detalle || '').toLowerCase()

  // Valor de reserva cuando la venta no es del periodo visualizado: para los
  // técnicos (Ti/TMA/Rent/Micro) sin importe se rescata el anual del catálogo.
  const getFallbackValue = () => {
    let val = sale.importe || sale.cuota || 0
    if (!val && (det === 'ti' || det === 'tma' || det === 'rent' || det === 'micro')) {
      let catalogKey = ''
      if (det === 'ti') catalogKey = 'Ti'
      if (det === 'tma' || det === 'rent') catalogKey = 'Rent'
      if (det === 'micro') catalogKey = 'Micro'

      const list = catalogs[catalogKey] || []
      const found = list.find((c: any) => normalizeString(c.producto) === normalizeString(sale.producto))
      if (found) val = parseSafeFloat(found.anual)
    }
    return parseSafeFloat(val)
  }

  if (!saleMonth) return getFallbackValue()
  if (saleMonth !== viewingPeriod) return getFallbackValue()

  // Palancas que guardan la comisión directamente en importe/cuota.
  const isTV = det === 'suscripciones tv' || det === 'suscripcion tv'
  if (det === 'o2' || det === 'seguro' || det === 'mimovistar' || det === 'repos' || det === 'varios' || isTV || det === 'prepago' || det === 'resto baf' || det === 'traslado mimovistar') {
    if (det === 'seguro') {
      const seguroList = catalogs['Seguro'] || []
      const foundSeguro = seguroList.find((c: any) => normalizeString(c.producto) === normalizeString(sale.producto))
      if (foundSeguro && foundSeguro.comision) {
        return parseSafeFloat(foundSeguro.comision)
      }
    }
    return parseSafeFloat(sale.importe || sale.cuota || 0)
  }

  // Técnicos (Ti/TMA/Rent/Micro): override directo desde el catálogo.
  let overrideBaseValue: number | undefined = undefined
  if (det === 'ti' || det === 'tma' || det === 'rent' || det === 'micro') {
    let catalogKey = ''
    if (det === 'ti') catalogKey = 'Ti'
    if (det === 'tma' || det === 'rent') catalogKey = 'Rent'
    if (det === 'micro') catalogKey = 'Micro'

    const list = catalogs[catalogKey] || []
    const matchingProducts = list.filter((c: any) => normalizeString(c.producto) === normalizeString(sale.producto))

    let found = matchingProducts[0]
    if (matchingProducts.length > 1) {
      const correctlyDated = matchingProducts.find((c: any) => isVentaWithinDates(sale.fecha, c.validFrom, c.validTo))
      if (correctlyDated) found = correctlyDated
    }

    if (found) {
      overrideBaseValue = Number(String(found.anual || 0).replace(',', '.'))

      // Contratos Móvil (Ti): la comisión es directamente el anual del catálogo.
      if (det === 'ti') return overrideBaseValue

      // Rent/TMA: comisión normal o con coste según lleve seguro con coste.
      if (det === 'tma' || det === 'rent') {
        const isConCoste = sale.rentConCoste && (sale.rentConCoste.toLowerCase() === 'sí' || sale.rentConCoste.toLowerCase() === 'si')
        if (isConCoste) return Number(String(found.comisionConCoste || 0).replace(',', '.'))
        return Number(String(found.comision || 0).replace(',', '.'))
      }
    }
  }

  // Resto: comisión dinámica por tramo del dashboard del canal correspondiente.
  const dashboardRows = isPlus ? dashRowsPlus : dashRowsBasico
  return calculateDynamicCommission(sale, dashboardRows, overrideBaseValue)
}

/** Comisión total de la operación, incluyendo el bono de Swap (+15 € empresa). */
export function getSaleCommission(sale: any, ctx: SaleCommissionCtx): number {
  return getSaleCommissionBase(sale, ctx) + (sale.isSwap === true ? 15 : 0)
}
