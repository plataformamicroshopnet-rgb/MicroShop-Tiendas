// Cálculo del "TERRITORIAL PDV Importe" (antes "Total Consolidado Tiendas") de un mes.
// FUENTE ÚNICA: usa EXACTAMENTE la misma lógica que la Entrada de Datos (TERRITORIAL
// TIENDAS, components/TerritorialTab): el importe de cada palanca se calcula por las 4
// tiendas físicas y se SUMA (p. ej. Fútbol 500€ plano × 4 tiendas = 2.000€). Lo usan la
// página Territorial PDV, la Entrada de Datos y el panel de Ganancias ("Comisiones
// Tiendas Locales"). No duplicar.

import { matchTipoVenta } from '@/hooks/useComisionesData'
import { TIENDAS_COMERCIALES } from '@/lib/constants'

export const TIENDAS_FISICAS = ['Auxiliadora 45', 'Correhuela', 'Villamayor', 'Béjar']

// Las 6 palancas mostradas en Territorial PDV (etiquetas + matching con las reglas de la
// Entrada de Datos). El importe ya NO sale de estos tramos estáticos, sino de la regla.
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
  tiendaRules?: any[]        // /api/tiendas-comisiones (no usado para el importe; compat)
  territorialRules: any[]    // /api/territorial -> tiendas (Entrada de Datos = fuente)
  catalogs?: Record<string, any[]>
}

const parseNumber = (val: any): number => {
  let s = String(val || '0').replace(/[^0-9.,\-]/g, '').trim()
  s = s.replace(/\./g, '').replace(',', '.')
  return parseFloat(s) || 0
}

// === Funciones idénticas a la Entrada de Datos (components/TerritorialTab) ===

// Ventas (unidades, o € si el tipo es "dispositivos/importe") de una tienda física para
// un tipoVenta. Filtra por los comerciales de esa tienda (TIENDAS_COMERCIALES).
export function getSalesDataForStoreAndType(sales: any[], storeName: string, tipoVenta: string): { value: number; logs: any[] } {
  if (!tipoVenta) return { value: 0, logs: [] }
  const isProductMatch = (sale: any) => matchTipoVenta(sale, tipoVenta)

  let filtered: any[]
  if (storeName === 'O2') {
    filtered = sales.filter(s => {
      if (s.anulado === 'Si' || s.pendiente === 'Anulado') return false
      const det = String(s.detalle || s.categoria || '').toLowerCase().trim()
      if (det !== 'o2') return false
      const prod = String(s.producto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
      return prod.startsWith('fibra') || prod.startsWith('interna')
    })
  } else {
    let storeSellers: string[] = []
    const key = Object.keys(TIENDAS_COMERCIALES).find(k => k.toLowerCase().replace('é', 'e') === storeName.toLowerCase().replace('é', 'e'))
    if (key) storeSellers = (TIENDAS_COMERCIALES as any)[key]
    filtered = sales.filter(s => {
      if (s.anulado === 'Si' || s.pendiente === 'Anulado') return false
      if (!storeSellers.some(seller => (s.vendedor || '').toLowerCase() === seller.toLowerCase())) return false
      return isProductMatch(s)
    })
  }

  const isMoneyType = tipoVenta.toLowerCase().includes('dispositivos') || tipoVenta.toLowerCase().includes('importe')
  if (isMoneyType) {
    return { value: filtered.reduce((acc, s) => acc + (parseFloat(s.importe || s.cuota || '0') || 0), 0), logs: filtered }
  }
  return { value: filtered.length, logs: filtered }
}

// Importe ganado por UNA tienda física para una regla (tramos en % o plano; el tramo más
// alto alcanzado manda). Igual que calculateTiendaImporte de TerritorialTab.
export function calculateTiendaImporte(rule: any, storeName: string, salesCount: number, salesTot: number): number {
  let earned = 0

  let target1 = 0, isReached1 = false
  if (rule.obj1Type === 'per_store') { target1 = parseNumber(rule.obj1Stores?.[storeName] || '0'); isReached1 = target1 > 0 && salesCount >= target1 }
  else { target1 = parseNumber(rule.obj1Global); isReached1 = target1 > 0 && salesTot >= target1 }

  let target2 = 0, isReached2 = false
  if (rule.obj2Type === 'per_store') { target2 = parseNumber(rule.obj2Stores?.[storeName] || '0'); isReached2 = target2 > 0 && salesCount >= target2 }
  else { target2 = parseNumber(rule.obj2Global); isReached2 = target2 > 0 && salesTot >= target2 }

  let target3 = 0, isReached3 = false
  if (rule.obj3Type === 'per_store') { target3 = parseNumber(rule.obj3Stores?.[storeName] || '0'); isReached3 = target3 > 0 && salesCount >= target3 }
  else { target3 = parseNumber(rule.obj3Global); isReached3 = target3 > 0 && salesTot >= target3 }

  const import1Num = parseNumber(rule.importe1)
  const import2Num = parseNumber(rule.importe2)
  const import3Num = parseNumber(rule.importe3)
  const isPct1 = String(rule.importe1).includes('%')
  const isPct2 = String(rule.importe2).includes('%')
  const isPct3 = String(rule.importe3).includes('%')

  if (isReached3) { earned = isPct3 ? salesCount * (import3Num / 100) : import3Num }
  else if (isReached2) { earned = isPct2 ? salesCount * (import2Num / 100) : import2Num }
  else if (isReached1) { earned = isPct1 ? salesCount * (import1Num / 100) : import1Num }

  return earned
}

// matching palanca -> regla de la Entrada de Datos. Prioriza el match EXACTO para no
// confundir nombres donde uno es subcadena de otro (p. ej. "Altas BAF" vs "Altas BAF
// Movistar Convergente").
function findRuleInList(palancaMatches: string[], rules: any[]) {
  const clean = (str: string) => String(str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '').trim()
  const cleanMatches = palancaMatches.map(m => clean(m))
  // 1) Match exacto del nombre de la regla con alguno de los alias de la palanca.
  const exact = rules.find((r: any) => cleanMatches.includes(clean(r.nombre)))
  if (exact) return exact
  // 2) Match laxo por inclusión (para nombres no exactos, p. ej. "Fibra FTTR" ⊃ "FTTR").
  return rules.find((r: any) => {
    const rName = clean(r.nombre)
    return cleanMatches.some(m => rName.includes(m) || m.includes(rName))
  })
}

// Filas de Territorial PDV. El importe de cada palanca = Σ (por las 4 tiendas físicas) del
// importe que paga su regla en la Entrada de Datos. Palanca sin regla => importe 0.
export function computeTerritorialRows(input: TerritorialInput): any[] {
  const { sales, territorialRules } = input

  return STATIC_PALANCAS.map(p => {
    const terrRule = findRuleInList(p.matches, territorialRules || [])
    if (!terrRule) {
      return { ...p, objetivo: 0, ventas: 0, pct: 0, t1Raw: p.tramos.tramo1, t2Raw: p.tramos.tramo2, t3Raw: p.tramos.tramo3, bonifRaw: p.tramos.bonif, tramoAplicado: '', importe: 0 }
    }

    // Ventas por tienda física + total, y el importe sumado (método Entrada de Datos).
    const perStore = TIENDAS_FISICAS.map(store => getSalesDataForStoreAndType(sales, store, terrRule.tipoVenta).value)
    const salesTot = perStore.reduce((a, b) => a + b, 0)
    const importe = TIENDAS_FISICAS.reduce((acc, store, i) => acc + calculateTiendaImporte(terrRule, store, perStore[i], salesTot), 0)

    // Objetivo/tramo para mostrar (objetivo global de tramo 1; en per_store no hay global).
    const obj1Target = terrRule.obj1Type === 'global' ? parseNumber(terrRule.obj1Global) : 0
    const obj2Target = terrRule.obj2Type === 'global' ? parseNumber(terrRule.obj2Global) : 0
    const obj3Target = terrRule.obj3Type === 'global' ? parseNumber(terrRule.obj3Global) : 0
    let activeTramo = 0
    if (obj3Target > 0 && salesTot >= obj3Target) activeTramo = 3
    else if (obj2Target > 0 && salesTot >= obj2Target) activeTramo = 2
    else if (obj1Target > 0 && salesTot >= obj1Target) activeTramo = 1
    const tramoAplicado = activeTramo === 3 ? 'Tramo 3' : activeTramo === 2 ? 'Tramo 2' : activeTramo === 1 ? 'Tramo 1' : ''

    return {
      ...p,
      objetivo: obj1Target,
      ventas: salesTot,
      pct: obj1Target > 0 ? (salesTot / obj1Target) * 100 : 0,
      t1Raw: terrRule.importe1 || p.tramos.tramo1,
      t2Raw: terrRule.importe2 || p.tramos.tramo2,
      t3Raw: terrRule.importe3 || p.tramos.tramo3,
      bonifRaw: p.tramos.bonif,
      tramoAplicado,
      importe
    }
  })
}

// Suma total = "TERRITORIAL PDV Importe" (debe cuadrar con el Total Tiendas de la Entrada
// de Datos para las palancas que tienen regla).
export function computeTerritorialTotal(input: TerritorialInput): number {
  return computeTerritorialRows(input).reduce((acc, row) => acc + row.importe, 0)
}
