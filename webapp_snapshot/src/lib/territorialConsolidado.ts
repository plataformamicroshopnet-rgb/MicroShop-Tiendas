// Cálculo del "Total Consolidado Tiendas" de Territorial PDV de un mes.
// FUENTE ÚNICA DE VERDAD: lo usan la página /seguimiento-ventas/territorial-pdv y el
// panel de Ganancias ("Comisiones Tiendas Locales"). No duplicar.

import { matchesRule, getValueForRule } from '@/hooks/useComisionesData'

// Definición estática de las 6 palancas solicitadas y sus tramos según el mockup
export const STATIC_PALANCAS = [
  {
    key: 'altas_baf',
    negocio: 'Fijo',
    palanca: 'Altas BAF',
    tramos: { tramo1: '20%', tramo2: '30%', tramo3: '-', bonif: '-' },
    matches: ['Alta BAF Total', 'Altas BAF', 'baf total']
  },
  {
    key: 'altas_baf_conv',
    negocio: 'Fijo',
    palanca: 'Altas BAF Movistar Convergente',
    tramos: { tramo1: '40%', tramo2: '50%', tramo3: '-', bonif: '-' },
    matches: ['Alta BAF Convergente', 'Altas BAF Movistar Convergente', 'baf convergente']
  },
  {
    key: 'baf_conv_ms_disp',
    negocio: 'Fijo',
    palanca: 'BAF Convergente MS / Dispositivos',
    tramos: { tramo1: '-', tramo2: '-', tramo3: '-', bonif: '20%' },
    matches: ['BAF Convergente MS / Dispositivos', 'baf convergente ms / dispositivos']
  },
  {
    key: 'fibra_fttr',
    negocio: 'Fijo',
    palanca: 'Fibra FTTR por Tienda',
    tramos: { tramo1: '200 €', tramo2: '-', tramo3: '-', bonif: '-' },
    matches: ['FTTR', 'Fibra FTTR por Tienda', 'fttr por tienda']
  },
  {
    key: 'rent_disp_seguros',
    negocio: 'Móvil',
    palanca: 'Rent/Dispositivos + Seguros',
    tramos: { tramo1: '3,5%', tramo2: '4,5%', tramo3: '6,0%', bonif: '-' },
    matches: ['Dispositivos + Seguros', 'Rent/Dispositivos + Seguros', 'Dispositivos + Seguro']
  },
  {
    key: 'altas_futbol_tv',
    negocio: 'Fijo',
    palanca: 'Altas Fútbol/ Desarrollo TV por Tienda',
    tramos: { tramo1: '300 €', tramo2: '500 €', tramo3: '-', bonif: '-' },
    matches: ['Repo Fútbol', 'Altas Fútbol/ Desarrollo TV por Tienda', 'Repo Futbol', 'futbol por tienda']
  }
]

export interface TerritorialInput {
  sales: any[]
  tiendaRules: any[]
  territorialRules: any[]
  catalogs: Record<string, any[]>
}

// Reproduce EXACTAMENTE el cálculo de calculatedRows de la página Territorial PDV.
export function computeTerritorialRows(input: TerritorialInput): any[] {
  const { sales, tiendaRules, territorialRules, catalogs } = input

  // Auxiliar para parsear números con formato español
  const parseNumber = (val: any): number => {
    if (val === null || val === undefined) return 0
    if (typeof val === 'number') return isNaN(val) ? 0 : val
    let s = String(val).replace(/[^0-9.,\-]/g, '').trim()
    s = s.replace(/\./g, '').replace(',', '.')
    return parseFloat(s) || 0
  }

  // Buscar regla en la lista (tiendaRules o territorialRules)
  const findRuleInList = (palancaMatches: string[], rules: any[]) => {
    const clean = (str: string) => String(str || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "").trim()
    const cleanMatches = palancaMatches.map(m => clean(m))

    return rules.find(r => {
      const rName = clean(r.nombre)
      return cleanMatches.some(m => rName === m || rName.includes(m) || m.includes(rName))
    })
  }

  // Contar ventas reales de la tienda Salamanca (excluyendo a Marta de O2)
  const getSalesCountForRule = (ruleName: string, ruleProductosCuentan: string) => {
    let completed = 0
    const isPercentage = String(ruleName).toLowerCase().includes('dispositivos') || String(ruleName).toLowerCase().includes('seguro')

    sales.forEach(s => {
      // Excluir a Marta (O2)
      if (String(s.vendedor || '').toLowerCase().includes('marta')) return
      // Excluir anuladas
      if (s.anulado === 'Si' || s.anulado === 'Sí' || s.pendiente === 'Anulado') return

      if (matchesRule(s, ruleName, ruleProductosCuentan)) {
        const val = isPercentage ? getValueForRule(s, ruleName, catalogs) : 1
        completed += val
      }

      // Seguro virtual
      if (s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet || '').toLowerCase() !== 'seguro') {
        const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) }
        if (matchesRule(virtualSeguro, ruleName, ruleProductosCuentan)) {
          const val = isPercentage ? getValueForRule(virtualSeguro, ruleName, catalogs) : 1
          completed += val
        }
      }
    })

    return completed
  }

  return STATIC_PALANCAS.map(p => {
    // 1. Encontrar regla base de "Comisiones para Tiendas" para sacar el Objetivo
    const baseRule = findRuleInList(p.matches, tiendaRules)
    const objetivo = baseRule ? (baseRule.objPrimerTramo || 0) : 0

    // 2. Encontrar regla de "Territorial" para sacar tramos e importes
    const terrRule = findRuleInList(p.matches, territorialRules)

    // Obtener tramos/importes de la regla territorial de la BD si existe, o usar los estáticos por defecto
    const t1Raw = terrRule ? terrRule.importe1 : p.tramos.tramo1
    const t2Raw = terrRule ? terrRule.importe2 : p.tramos.tramo2
    const t3Raw = p.tramos.tramo3 // Tramo 3 estático de Rent/Dispositivos + Seguros
    const bonifRaw = p.tramos.bonif // Bonificación de BAF Conv + Disp

    // 3. Calcular las ventas totales de la tienda (Salamanca) para esta palanca
    let ventas = 0
    if (baseRule) {
      ventas = getSalesCountForRule(baseRule.nombre, baseRule.productosCuentan)
    } else {
      // Fallbacks para ventas de palancas si no hay regla explícita configurada
      if (p.key === 'altas_baf') {
        ventas = getSalesCountForRule('Alta BAF Total', 'Alta BAF Total, Alta BAF Convergente')
      } else if (p.key === 'altas_baf_conv') {
        ventas = getSalesCountForRule('Alta BAF Convergente', 'Alta BAF Convergente')
      } else if (p.key === 'baf_conv_ms_disp') {
        // BAF Convergente MS + Dispositivos (Rent)
        ventas = sales.filter(s => {
          if (String(s.vendedor || '').toLowerCase().includes('marta')) return false
          if (s.anulado === 'Si' || s.anulado === 'Sí' || s.pendiente === 'Anulado') return false
          return String(s.categoria || s.detalle || s.sheet || '').toLowerCase() === 'rent'
        }).length
      } else if (p.key === 'fibra_fttr') {
        ventas = getSalesCountForRule('FTTR', 'Solución FTTR')
      } else if (p.key === 'rent_disp_seguros') {
        ventas = getSalesCountForRule('Dispositivos + Seguros', 'Dispositivos, Seguro')
      } else if (p.key === 'altas_futbol_tv') {
        ventas = getSalesCountForRule('Repo Fútbol', 'Extra Repos up destino Fútbol')
      }
    }

    // 4. Calcular el porcentaje de cumplimiento
    // Para BAF Convergente MS / Dispositivos, no tiene objetivo directo, se asocia al cumplimiento de BAF Convergente
    let pct = 0
    if (p.key === 'baf_conv_ms_disp') {
      const bafConvRow = findRuleInList(['Alta BAF Convergente'], tiendaRules)
      const bafConvObj = bafConvRow ? (bafConvRow.objPrimerTramo || 0) : 0
      const bafConvSales = getSalesCountForRule('Alta BAF Convergente', 'Alta BAF Convergente')
      pct = bafConvObj > 0 ? (bafConvSales / bafConvObj) * 100 : 0
    } else {
      pct = objetivo > 0 ? (ventas / objetivo) * 100 : 0
    }

    // 5. Determinar tramo aplicable e importe generado
    let importe = 0
    let tramoAplicado = ''

    const isPct = (str: string) => String(str).includes('%')

    if (p.key === 'baf_conv_ms_disp') {
      // Bonificación >=100%: 20%
      if (pct >= 100) {
        tramoAplicado = 'Bonif (20%)'
        importe = ventas * 0.20 // 20% de las ventas de dispositivos
      }
    } else if (p.key === 'rent_disp_seguros') {
      // Rent/Dispositivos + Seguros tiene 3 tramos
      if (pct >= 130) {
        tramoAplicado = 'Tramo 3 (6%)'
        importe = ventas * 0.06
      } else if (pct >= 115) {
        tramoAplicado = 'Tramo 2 (4,5%)'
        importe = ventas * 0.045
      } else if (pct >= 100) {
        tramoAplicado = 'Tramo 1 (3,5%)'
        importe = ventas * 0.035
      }
    } else {
      // Palancas con Tramo 1 y Tramo 2 estándar
      const obj1Val = objetivo
      // El objetivo de tramo 2 territorial es el objSegundoTramo de la regla de la tienda si existe
      const obj2Val = baseRule ? (baseRule.objSegundoTramo || 0) : 0

      const val1 = parseNumber(t1Raw)
      const val2 = parseNumber(t2Raw)

      if (obj2Val > 0 && ventas >= obj2Val) {
        tramoAplicado = `Tramo 2 (${t2Raw})`
        importe = isPct(t2Raw) ? (ventas * (val2 / 100)) : val2
      } else if (obj1Val > 0 && ventas >= obj1Val) {
        tramoAplicado = `Tramo 1 (${t1Raw})`
        importe = isPct(t1Raw) ? (ventas * (val1 / 100)) : val1
      }
    }

    return {
      ...p,
      objetivo,
      ventas,
      pct,
      t1Raw,
      t2Raw,
      t3Raw,
      bonifRaw,
      tramoAplicado,
      importe
    }
  })
}

// Suma total de los importes territoriales generados = "Total Consolidado Tiendas".
export function computeTerritorialTotal(input: TerritorialInput): number {
  return computeTerritorialRows(input).reduce((acc, row) => acc + row.importe, 0)
}
