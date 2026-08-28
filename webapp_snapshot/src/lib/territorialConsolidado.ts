// Cálculo del "TERRITORIAL PDV Importe" (antes "Total Consolidado Tiendas") de un mes.
// FUENTE ÚNICA: usa EXACTAMENTE la misma lógica que la Entrada de Datos (TERRITORIAL
// TIENDAS, components/TerritorialTab): el importe de cada palanca se calcula por las 4
// tiendas físicas y se SUMA (p. ej. Fútbol 500€ plano × 4 tiendas = 2.000€). Lo usan la
// página Territorial PDV, la Entrada de Datos y el panel de Ganancias ("Comisiones
// Tiendas Locales"). No duplicar.

import { matchTipoVenta, tipoVentaDeReglaTerritorial } from '@/lib/ventaMatching'
import { TIENDAS_COMERCIALES } from '@/lib/constants'
import { getEffectiveTiendaComerciales } from '@/lib/comercialRoster'
import { getSaleCommission } from '@/lib/saleCommission'
import { isSaleCancelled, esCorreccionRepos, esVentaSustituida } from '@/lib/salesUtils'

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
  tiendaHours?: any[]        // panel "Horarios de Comerciales" del mes -> plantilla (tienda de cada comercial)
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
export function getSalesDataForStoreAndType(sales: any[], storeName: string, tipoVenta: string, tiendaComerciales?: Record<string, string[]>): { value: number; logs: any[] } {
  if (!tipoVenta) return { value: 0, logs: [] }
  const isProductMatch = (sale: any) => matchTipoVenta(sale, tipoVenta)
  const tiendaMap = tiendaComerciales || TIENDAS_COMERCIALES

  let filtered: any[]
  if (storeName === 'O2') {
    filtered = sales.filter(s => {
      if (isSaleCancelled(s)) return false
      const det = String(s.detalle || s.categoria || '').toLowerCase().trim()
      if (det !== 'o2') return false
      // La lista "Tipo de Venta" de la regla MANDA (el token 'O2' de la lista = comodín
      // SOLO fibras externas+internas, sin Adicionales ni líneas móviles — ver
      // matchTipoVenta). Antes un prefijo hardcodeado ignoraba la lista y editar
      // los productos de la regla no cambiaba el bono.
      return isProductMatch(s)
    })
  } else {
    let storeSellers: string[] = []
    const key = Object.keys(tiendaMap).find(k => k.toLowerCase().replace('é', 'e') === storeName.toLowerCase().replace('é', 'e'))
    if (key) storeSellers = (tiendaMap as any)[key]
    filtered = sales.filter(s => {
      if (isSaleCancelled(s)) return false
      // Un cliente de futbol corregido deja TRES filas con la palabra «Futbol»
      // en el producto (la madre y sus dos hijas). Sin este filtro contaba 3
      // unidades en la regla territorial, que paga 300 €/500 € POR TIENDA.
      if (esCorreccionRepos(s) || esVentaSustituida(s)) return false
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
export function calculateTiendaImporte(rule: any, storeName: string, salesCount: number, salesTot: number, comisionBase: number = 0): number {
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

  // Base sobre la que se aplica el % en los tramos porcentuales:
  //  - condicionante `baseComision` activo => Σ de comisiones (€) de las ventas de la
  //    palanca (p. ej. Altas BAF: Telefónica liquida el 20%/30% de TODAS las comisiones).
  //  - por defecto => nº de unidades (comportamiento histórico). El tramo alcanzado se
  //    sigue determinando por unidades en ambos casos.
  const pctBase = rule.baseComision ? comisionBase : salesCount

  if (isReached3) { earned = isPct3 ? pctBase * (import3Num / 100) : import3Num }
  else if (isReached2) { earned = isPct2 ? pctBase * (import2Num / 100) : import2Num }
  else if (isReached1) { earned = isPct1 ? pctBase * (import1Num / 100) : import1Num }

  return earned
}

// Importe del bono O2 de una regla según las ventas O2 (tramos mes/trim + conectividad).
// Idéntico a calculateO2Importe de TerritorialTab / mod-resumen.
export function calculateO2Importe(rule: any, totalSales: number): number {
  const TRAMOS_MES = [
    { key: '4_10', min: 4 }, { key: '11_14', min: 11 }, { key: '15_20', min: 15 },
    { key: '21_30', min: 21 }, { key: '31_40', min: 31 }, { key: '41_plus', min: 41 }
  ]
  const TRAMOS_TRIM = [{ key: '5_9', min: 5 }, { key: '10_plus', min: 10 }]
  let bonus = 0
  for (const t of [...TRAMOS_MES].reverse()) { if (totalSales >= t.min) { bonus += parseNumber(rule.tramosMes?.[t.key] || '0'); break } }
  for (const t of [...TRAMOS_TRIM].reverse()) { if (totalSales >= t.min) { bonus += parseNumber(rule.tramosTrim?.[t.key] || '0'); break } }
  if (totalSales > 0) bonus += parseNumber(rule.conectividad || '0')
  return bonus
}

// "PRV Territorial O2" del mes = TOTAL O2 de la Entrada de Datos = Σ del bono O2 de cada
// regla O2 sobre sus ventas O2 (fibra/interna). Se SUMA a la Caja Tiendas en Ganancias.
export function computeBonosO2(sales: any[], o2Rules: any[]): number {
  return (o2Rules || []).reduce((acc: number, rule: any) =>
    acc + calculateO2Importe(rule, getSalesDataForStoreAndType(sales, 'O2', rule.tipoVenta).value), 0)
}

// Bono O2 desglosado en sus 3 importes (Tramo Mes + Tramo Trimestre + Conectividad),
// sumados sobre todas las reglas O2. total === computeBonosO2. Lo consume el ERP
// para mostrar el PRV Territorial O2 en el consolidado de Liquidaciones.
export function computeBonosO2Breakdown(sales: any[], o2Rules: any[]) {
  const TRAMOS_MES = [
    { key: '4_10', min: 4 }, { key: '11_14', min: 11 }, { key: '15_20', min: 15 },
    { key: '21_30', min: 21 }, { key: '31_40', min: 31 }, { key: '41_plus', min: 41 }
  ]
  const TRAMOS_TRIM = [{ key: '5_9', min: 5 }, { key: '10_plus', min: 10 }]
  let bonoMes = 0, bonoTrim = 0, conectividad = 0
  for (const rule of (o2Rules || [])) {
    const totalSales = getSalesDataForStoreAndType(sales, 'O2', rule.tipoVenta).value
    for (const t of [...TRAMOS_MES].reverse()) { if (totalSales >= t.min) { bonoMes += parseNumber(rule.tramosMes?.[t.key] || '0'); break } }
    for (const t of [...TRAMOS_TRIM].reverse()) { if (totalSales >= t.min) { bonoTrim += parseNumber(rule.tramosTrim?.[t.key] || '0'); break } }
    if (totalSales > 0) conectividad += parseNumber(rule.conectividad || '0')
  }
  return { bonoMes, bonoTrim, conectividad, total: bonoMes + bonoTrim + conectividad }
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
  // Plantilla del mes (tienda de cada comercial). Sin tiendaHours -> lista fija (idéntico).
  const tiendaMap = getEffectiveTiendaComerciales(input.tiendaHours)

  return STATIC_PALANCAS.map(p => {
    const terrRule = findRuleInList(p.matches, territorialRules || [])
    if (!terrRule) {
      return { ...p, objetivo: 0, obj1Target: 0, obj2Target: 0, obj3Target: 0, ventas: 0, ventasBase: 0, comisionBase: 0, pct: 0, t1Raw: p.tramos.tramo1, t2Raw: p.tramos.tramo2, t3Raw: p.tramos.tramo3, bonifRaw: p.tramos.bonif, tramoAplicado: '', importe: 0, potencial1: null, potencial2: null, potencial3: null, logs: [] }
    }

    // Ventas por tienda física + total, y el importe sumado (método Entrada de Datos).
    // En palancas con `baseComision` se excluyen las ventas O2 (su territorial es aparte)
    // también del conteo, para espejar el grupo de Operaciones por Grupo Cliente.
    const _notO2 = (s: any) => String(s.detalle || s.categoria || '').toLowerCase().trim() !== 'o2'
    const perStoreData = TIENDAS_FISICAS.map(store => getSalesDataForStoreAndType(sales, store, tipoVentaDeReglaTerritorial(terrRule), tiendaMap))
    const perStore = perStoreData.map(d => terrRule.baseComision ? d.logs.filter(_notO2).length : d.value)
    const salesTot = perStore.reduce((a, b) => a + b, 0)

    // Condicionante `baseComision`: el % se aplica sobre la Σ de comisiones por venta
    // (misma fuente que Liquidaciones, getSaleCommission), no sobre las unidades.
    const ctx = {
      catalogs: (input as any).catalogs || {},
      dashRowsPlus: (input as any).dashRowsPlus || [],
      dashRowsBasico: (input as any).dashRowsBasico || [],
      viewingPeriod: (input as any).viewingPeriod || ''
    }
    // Comisión base (€) POR TIENDA, con O2 fuera (su territorial es aparte). Se
    // usa para el importe real y para los potenciales por tramo.
    const perStoreCom = TIENDAS_FISICAS.map((_store, i) =>
      perStoreData[i].logs.filter(_notO2).reduce((a: number, s: any) => a + getSaleCommission(s, ctx), 0))

    const importe = TIENDAS_FISICAS.reduce((acc, store, i) => {
      // Excluye ventas O2 (detalle='o2'): pertenecen a la palanca O2 (propio territorial);
      // matchTipoVenta las arrastra por nombre de producto. Así la base = los grupos de
      // Operaciones por Grupo Cliente (Convergente → miMovistar; Altas BAF → Resto BAF + miMovistar).
      return acc + calculateTiendaImporte(terrRule, store, perStore[i], salesTot,
                                          terrRule.baseComision ? perStoreCom[i] : 0)
    }, 0)

    // ── LO QUE COBRARÍA EN CADA TRAMO (dueño, 27-ago-2026: «así sé lo que
    // podría cobrar en cada tramo»). Hipótesis: el tramo se alcanza en las 4
    // tiendas. Los tramos planos pagan su importe POR TIENDA (Fútbol 300 € × 4).
    // Los de % se calculan SIEMPRE sobre el OBJETIVO de su tramo, nunca sobre
    // lo vendido hoy (corrección del dueño, 27-ago). Con el condicionante
    // baseComision (objetivo en unidades, base en comisiones €) se proyecta
    // con la comisión media por unidad de hoy × el objetivo. ──
    const objetivoTramo = (k: number): number => {
      const tipo = (terrRule as any)[`obj${k}Type`]
      if (tipo === 'per_store') {
        return TIENDAS_FISICAS.reduce((a, st) =>
          a + parseNumber((terrRule as any)[`obj${k}Stores`]?.[st] || '0'), 0)
      }
      return parseNumber((terrRule as any)[`obj${k}Global`])
    }
    const comTotal = perStoreCom.reduce((a, b) => a + b, 0)
    const potencialTramo = (k: number): number | null => {
      const raw = (terrRule as any)[`importe${k}`]
      const txt = String(raw ?? '').trim()
      if (!txt || txt === '-') return null
      const num = parseNumber(raw)
      if (!(num > 0)) return null
      if (!String(raw).includes('%')) return num * TIENDAS_FISICAS.length
      // SIEMPRE sobre el OBJETIVO del tramo («lo quiero sobre el objetivo que
      // me marcan, en esta y todas las palancas» — dueño, 27-ago-2026).
      const objK = objetivoTramo(k)
      if (!(objK > 0)) return null
      if (terrRule.baseComision) {
        // objetivo en unidades, base en comisiones €: comisión media de hoy × objetivo
        const media = ventasBase > 0 ? comTotal / ventasBase : 0
        return media * objK * (num / 100)
      }
      // objetivo y base en la misma unidad (€ en Dispositivos, uds en el resto)
      return objK * (num / 100)
    }

    // Base de comisiones (€) y unidades de la palanca, SIEMPRE con O2 excluido (su
    // territorial es aparte). Se exponen para reusar fuera del territorial — p. ej.
    // Comisiones Jefe Tiendas aplica su propio % a esta base, exista o no el
    // condicionante `baseComision` del territorial.
    const comisionBase = perStoreData.reduce((acc, d) =>
      acc + d.logs.filter(_notO2).reduce((a: number, s: any) => a + getSaleCommission(s, ctx), 0), 0)
    const ventasBase = perStoreData.reduce((acc, d) => acc + d.logs.filter(_notO2).length, 0)

    const potencial1 = potencialTramo(1)
    const potencial2 = potencialTramo(2)
    const potencial3 = potencialTramo(3)

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
      obj1Target,
      obj2Target,
      obj3Target,
      ventas: salesTot,
      ventasBase,
      comisionBase,
      pct: obj1Target > 0 ? (salesTot / obj1Target) * 100 : 0,
      t1Raw: terrRule.importe1 || p.tramos.tramo1,
      t2Raw: terrRule.importe2 || p.tramos.tramo2,
      t3Raw: terrRule.importe3 || p.tramos.tramo3,
      bonifRaw: p.tramos.bonif,
      tramoAplicado,
      importe,
      potencial1,
      potencial2,
      potencial3,
      // Ventas que cuentan para esta palanca (O2 excluido), para trazabilidad/desglose.
      logs: perStoreData.flatMap(d => (d.logs || []).filter(_notO2)),
    }
  })
}

// Suma total = "TERRITORIAL PDV Importe" (debe cuadrar con el Total Tiendas de la Entrada
// de Datos para las palancas que tienen regla).
export function computeTerritorialTotal(input: TerritorialInput): number {
  return computeTerritorialRows(input).reduce((acc, row) => acc + row.importe, 0)
}
