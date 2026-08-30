// Cálculo del "TERRITORIAL PDV Importe" (antes "Total Consolidado Tiendas") de un mes.
// FUENTE ÚNICA: usa EXACTAMENTE la misma lógica que la Entrada de Datos (TERRITORIAL
// TIENDAS, components/TerritorialTab): el importe de cada palanca se calcula por las 4
// tiendas físicas y se SUMA (p. ej. Fútbol 500€ plano × 4 tiendas = 2.000€). Lo usan la
// página Territorial PDV, la Entrada de Datos y el panel de Ganancias ("Comisiones
// Tiendas Locales"). No duplicar.

import { matchTipoVenta, tipoVentaDeReglaTerritorial, seSalvaDelFiltroFutbol } from '@/lib/ventaMatching'
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
    matches: ['Alta BAF Total', 'Altas BAF', 'baf total'],
    reglas: [
      'QUÉ CUENTA · Altas y portabilidades de fibra Movistar y O2 de las 4 tiendas, más los traslados con fibra. Las anuladas por causa técnica (ORTI) que no se rehacen en 15 días también SUMAN a favor.',
      'OBJETIVO · La suma de los objetivos BAF Convergente MS + Convergente O2 + Resto BAF del Excel de Telefónica. Se mide con la EMPRESA entera, no tienda a tienda.',
      'QUÉ PAGA · Al llegar al 100 % del objetivo: el 20 % de la cuota (PVP con IVA y promos) de CADA operación del mes. Al 115 %: el 30 %. Por debajo del 100 %: nada.',
      'CANDADOS · Sin el 80 % del Convergente no se cobra. Una baja de fibra en el domicilio a ±30 días anula el alta (mismo titular o distinto). Si el cliente baja de tarifa en los 15 días tras instalar, pagan por la tarifa menor.',
      'CUÁNDO · Se cobra a los 2 meses (N+2). Lo que se instala a partir del 2º mes se va a la liquidación del mes de instalación.',
    ]
  },
  {
    key: 'altas_baf_conv',
    negocio: 'Fijo',
    palanca: 'Altas BAF Movistar Convergente',
    tramos: { tramo1: '40%', tramo2: '50%', tramo3: '-', bonif: '-' },
    matches: ['Alta BAF Convergente', 'Altas BAF Movistar Convergente', 'baf convergente'],
    reglas: [
      'QUÉ CUENTA · Altas, portabilidades y traslados de miMovistar y Fusión (fibra + paquete). OJO: la fibra y el paquete deben tramitarse en el MISMO pedido de Movistar; en dos pedidos, Telefónica lo degrada a fibra suelta (~60 €). Las ORTI no rehechas en 15 días suman.',
      'OBJETIVO · El BAF CONVERGENTE MS del Excel. Empresa entera.',
      'QUÉ PAGA · Al 100 %: el 40 % de la cuota (PVP con IVA) de cada alta. Al 115 %: el 50 %.',
      'ES LA LLAVE DE TODO · Esta palanca es EL GATE: sin su 80 % no se cobra el resto del Territorial (BAF, Fútbol, FTTR, Dispositivos).',
      'CANDADOS · Baja a ±30 días anula; bajada de tarifa en 15 días tras instalar → pagan por la menor; si el paquete lleva fútbol y el cliente lo quita antes del día 8 del 2º mes, pagan 1,5/1,3 cuotas en vez de 2. Cobro N+2.',
    ]
  },
  {
    key: 'baf_conv_ms_disp',
    negocio: 'Fijo',
    palanca: 'BAF Convergente MS / Dispositivos',
    tramos: { tramo1: '-', tramo2: '-', tramo3: '-', bonif: '20%' },
    matches: ['BAF Convergente MS / Dispositivos', 'baf convergente ms / dispositivos'],
    reglas: [
      'QUÉ ES · Una BONIFICACIÓN extra del +20 % de la cuota por CADA alta convergente del mes — encima del 40/50 % de la palanca de arriba (~2.300 €/mes con los números de agosto).',
      'DOS PUERTAS · (1) el Convergente al 100 % de su objetivo; y (2) que al menos el 40 % de esas altas lleven un terminal de gama Media o superior entregado en el mes o el siguiente.',
      'EL MEDIDOR · Esta fila cuenta las convergentes con terminal (mismo cliente, a ±30 días). Telefónica declara su propio medidor en la liquidación: mayo 30 %, junio 8 % — por eso nunca se ha cobrado.',
      'LA JUGADA · Convergente + terminal EN LA MISMA VISITA. Cada venta así acerca los ~2.300 €.',
      'CANDADOS · El terminal ligado a la venta en ≤30 días; fuera desistimientos (15 días) y repo-down a Base (±20 días). Cobro N+2.',
    ]
  },
  {
    key: 'fibra_fttr',
    negocio: 'Fijo',
    palanca: 'Fibra FTTR por Tienda',
    tramos: { tramo1: '200 €', tramo2: '-', tramo3: '-', bonif: '-' },
    matches: ['FTTR', 'Fibra FTTR por Tienda', 'fttr por tienda'],
    reglas: [
      'QUÉ CUENTA · Altas de Solución FTTR (kit principal) — la fibra invisible. Las ORTI también suman.',
      'OBJETIVO · POR TIENDA, no por empresa: cada tienda pelea su propio objetivo del Excel (2/2/3/2 en agosto).',
      'QUÉ PAGA · 200 € fijos a CADA tienda que llegue al 100 % del suyo. Julio: solo Villamayor lo logró → 200 €.',
      'PROPINA · Cada alta FTTR paga además 100 € por unidad (tarifario nacional) y computa 910 € en el objetivo de ingresos de Dispositivos — una FTTR empuja TRES palancas a la vez.',
      'CANDADOS · El 80 % del Convergente. Cobro N+2.',
    ]
  },
  {
    key: 'rent_disp_seguros',
    negocio: 'Móvil',
    palanca: 'Rent/Dispositivos + Seguros',
    tramos: { tramo1: '3,5%', tramo2: '4,5%', tramo3: '6,0%', bonif: '-' },
    matches: ['Dispositivos + Seguros', 'Rent/Dispositivos + Seguros', 'Dispositivos + Seguro'],
    reglas: [
      'QUÉ CUENTA (en €) · El PVP sin IVA de los dispositivos (Rent y venta) entregados en el mes o el siguiente + 910 € por cada alta FTTR + los seguros a valor fijo: Smartphone 200 € · Tablet 50 € · Reacondicionado 150 €. La gama Baja, con tope de 100 uds por tienda.',
      'OBJETIVO · La suma de INGRESOS DISPOSITIVOS + INGRESOS SEGURO MÓVIL + INGRESOS FIBRA FTTR del Excel (agosto: 94.463 €). Distribuidor entero.',
      'QUÉ PAGA · Al 100 %: el 3,5 % del PVP sin IVA de los dispositivos. Al 115 %: el 4,5 %. Al 130 %: el 6 %.',
      'CANDADOS · El 80 % del Convergente; certificación de 30 dispositivos por tienda; fuera la autoventa, los desistimientos en 15 días y los repo-down a Base (±20 días); los seguros deben seguir vivos el día 8 del 2º mes.',
      'CUÁNDO · Cobro N+2. Mayo se quedó a 8.019 € del objetivo: cada venta de terminal cuenta.',
    ]
  },
  {
    key: 'altas_futbol_tv',
    negocio: 'Fijo',
    palanca: 'Altas Fútbol/ Desarrollo TV por Tienda',
    tramos: { tramo1: '300 €', tramo2: '500 €', tramo3: '-', bonif: '-' },
    matches: ['Repo Fútbol', 'Altas Fútbol/ Desarrollo TV por Tienda', 'Repo Futbol', 'futbol por tienda'],
    reglas: [
      'QUÉ CUENTA · Todo el fútbol del mes: altas de miMovistar con Fútbol Total, Champions o LaLiga; altas de Fusión Bar; y los repos con destino Fútbol Total, su pago único, Champions o LaLiga (con subida de cuota). Las ORTI no rehechas en 15 días suman.',
      'QUÉ NO CUENTA · Repos con repo-down a ±20 días (en cualquier canal) y los de origen LaLiga/Champions a destino Fútbol Total (eso no es subir).',
      'OBJETIVO · ALTAS FÚTBOL + DESARROLLO TV del Excel, sumados (agosto: 50 + 111 = 161). Empresa entera.',
      'QUÉ PAGA · Al 100 %: 300 € por CADA tienda (1.200 €). Al 115 %: 500 € por tienda (2.000 €). Junio y julio se cobraron a 2.000 €.',
      'CANDADOS · El Fútbol Total debe seguir activo el día 8 del 2º mes (altas y repos); el 80 % del Convergente. Cobro N+2.',
    ]
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

// ── LAS BASES OFICIALES DEL TER (30-ago-2026, F3 de la Disección) ───────────

const _normSuave = (v: any) => String(v || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

/** Ajuste del numerador OFICIAL del TC1437 (Dispositivos) para unas ventas:
 *  Telefónica suma 910 € por cada alta FTTR y valora los seguros a tarifa
 *  plana (Smartphone 200 · Tablet 50 · Reacondicionado 150) en vez de la
 *  prima real. Nuestro motor sumaba solo cuotas: pintaba 56,5 % cuando el
 *  cálculo oficial daba 58,4 % — casi 2 puntos estructurales de menos, y el
 *  objetivo SÍ incluye los ingresos de FTTR. Devuelve los € A SUMAR sobre la
 *  base de cuotas ya contada (para los seguros, la diferencia plano−prima). */
export function ajusteOficialDispositivos(ventas: any[]): number {
  let ajuste = 0
  for (const s of ventas) {
    if (isSaleCancelled(s) || esVentaSustituida(s)) continue
    const cat = _normSuave(s.detalle || s.categoria || s.sheet)
    const prod = _normSuave(s.producto)
    if (prod.includes('fttr')) { ajuste += 910; continue }
    if (cat === 'seguro') {
      const plano = prod.includes('tablet') ? 50 : (prod.includes('reacond') ? 150 : 200)
      const prima = parseFloat(String(s.cuota ?? s.importe ?? '0').replace(',', '.')) || 0
      ajuste += plano - prima
    }
  }
  return Math.round(ajuste * 100) / 100
}

/** PVP con IVA de un alta BAF, que es la base REAL del pago de Telefónica
 *  (multiplicador × PVP), no nuestra comisión interna (≈2× el PVP): con la
 *  comisión, el «esperado» salía inflado ~×2 (4.550 € frente a los 2.487,95 €
 *  que Telefónica pagó en junio). La venta no guarda el PVP: se recupera del
 *  catálogo casando producto y comprobando que com × mult == cuota (el mismo
 *  truco que la deducción de gama); si no casa (venta conjunta con repos
 *  dentro, producto retocado), se aproxima con cuota/2 (el multiplicador 2 es
 *  el dominante). */
export function pvpDeAltaBaf(sale: any, catalogs?: Record<string, any[]>): number {
  const cuota = parseFloat(String(sale?.cuota ?? sale?.importe ?? '0').replace(',', '.')) || 0
  const prodVenta = _normSuave(sale?.producto)
  if (catalogs && prodVenta) {
    const cat = _normSuave(sale.detalle || sale.categoria || sale.sheet)
    const listas = cat === 'resto baf' ? ['Resto BAF'] : ['miMovistar']
    for (const l of listas) {
      for (const fila of (catalogs[l] || [])) {
        if (_normSuave(fila.producto) !== prodVenta) continue
        const com = parseFloat(String(fila.comision ?? '0').replace(',', '.')) || 0
        const mult = parseFloat(String(fila.comisionConCoste ?? '0').replace(',', '.')) || 0
        const m = mult === 0 ? 1 : mult
        if (com > 0 && Math.abs(com * m - cuota) < 0.02) return com
      }
    }
  }
  return Math.round((cuota / 2) * 100) / 100
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
      if ((esCorreccionRepos(s) || esVentaSustituida(s)) && !seSalvaDelFiltroFutbol(tipoVenta, s)) return false
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
    // ── TC1458 «BAF Convergente MS / Dispositivos» — EL MEDIDOR DEL 40 % ──
    // Telefónica paga +0,2 × PVP por CADA alta convergente si el convergente
    // llega al 100 % Y al menos el 40 % de esas altas llevan terminal. Su
    // medidor oficial existe (viaja en la liquidación: mayo 30,4 %, junio 8 %)
    // pero aquí la fila salía muerta (sin regla → 0). Este bloque la convierte
    // en el CUENTAKILÓMETROS del attach: cuántas convergentes llevan un Rent
    // del mismo NIF a ±30 días — definición CALIBRADA contra lo declarado por
    // Telefónica (junio: nuestras 4 = sus 4/51 exactas). El importe se queda a
    // 0 € hasta que las dos puertas abran (el € exacto es multiplicador × PVP
    // y llega con la fase de bases oficiales).
    if (p.key === 'baf_conv_ms_disp') {
      const _fd = (f: any): number | null => {
        const t = String(f || '')
        if (t.length < 10 || t[2] !== '/' || t[5] !== '/') return null
        const d = new Date(Number(t.slice(6, 10)), Number(t.slice(3, 5)) - 1, Number(t.slice(0, 2)))
        return isNaN(d.getTime()) ? null : d.getTime()
      }
      // OJO: sin esCorreccionRepos — un Rent con corrección de precio sigue
      // siendo un terminal de verdad (la madre sustituida ya queda fuera, y la
      // hija es su representación viva).
      // LIMITACIÓN CONOCIDA: la pantalla solo carga las ventas DEL MES, así que
      // un par que cruce la frontera (alta a fin de mes, terminal a primeros
      // del siguiente) se escapa — junio: contamos 3 de las 4 que declaró
      // Telefónica, y la cuarta era justo un cruce de mes. El medidor es para
      // EMPUJAR el attach (la jugada es alta+terminal en la misma visita, que
      // nunca cruza mes); la cifra que liquida es la declarada del cierre.
      const _viva = (s: any) => !isSaleCancelled(s) && !esVentaSustituida(s)
      const convs = sales.filter(s => _viva(s)
        && String(s.detalle || s.categoria || '').trim().toLowerCase() === 'mimovistar')
      const gamaDe = (prod: any): string => {
        for (const fila of (((input as any).catalogs || {})['Rent'] || [])) {
          if (String(fila.producto || '').trim().toLowerCase() === String(prod || '').trim().toLowerCase())
            return String(fila.gama || '').toUpperCase()
        }
        return ''
      }
      const rents = sales.filter(s => _viva(s)
        && String(s.detalle || s.categoria || '').trim().toLowerCase() === 'rent'
        // El TER solo cuenta terminales de gama Media o superior para el
        // attach; sin catálogo a mano (llamadas de prueba), se cuentan todos.
        && gamaDe(s.producto) !== 'BAJA')
      const DIA = 86400000
      const conTerminal = convs.filter(c => {
        const cf = _fd(c.fecha); const nif = String(c.nif || '').toUpperCase()
        if (!nif || cf === null) return false
        return rents.some(r => {
          if (String(r.nif || '').toUpperCase() !== nif) return false
          const rf = _fd(r.fecha)
          return rf !== null && Math.abs(rf - cf) <= 30 * DIA
        })
      })
      const objetivo40 = Math.ceil(convs.length * 0.4)
      const pctAttach = convs.length > 0 ? (conTerminal.length / convs.length) * 100 : 0
      // La otra puerta: el convergente al 100 % (su propia regla)
      const reglaConv = findRuleInList(['Alta BAF Convergente', 'Altas BAF Movistar Convergente'], territorialRules || [])
      const objConv = parseNumber(reglaConv?.obj1Global)
      const puertaConv = objConv > 0 && convs.length >= objConv
      return { ...p, objetivo: objetivo40, obj1Target: objetivo40, obj2Target: 0, obj3Target: 0,
        ventas: conTerminal.length, ventasBase: conTerminal.length, comisionBase: 0,
        pct: objetivo40 > 0 ? (conTerminal.length / objetivo40) * 100 : 0,
        t1Raw: p.tramos.tramo1, t2Raw: p.tramos.tramo2, t3Raw: p.tramos.tramo3, bonifRaw: p.tramos.bonif,
        tramoAplicado: `attach ${pctAttach.toFixed(1)} % de ${convs.length} convergentes (necesita 40 %)`
          + (puertaConv ? ' · puerta convergente OK' : ' · puerta convergente pendiente'),
        importe: 0, potencial1: null, potencial2: null, potencial3: null, logs: conTerminal }
    }
    const terrRule = findRuleInList(p.matches, territorialRules || [])
    if (!terrRule) {
      return { ...p, objetivo: 0, obj1Target: 0, obj2Target: 0, obj3Target: 0, ventas: 0, ventasBase: 0, comisionBase: 0, pct: 0, t1Raw: p.tramos.tramo1, t2Raw: p.tramos.tramo2, t3Raw: p.tramos.tramo3, bonifRaw: p.tramos.bonif, tramoAplicado: '', importe: 0, potencial1: null, potencial2: null, potencial3: null, logs: [] }
    }

    // Ventas por tienda física + total, y el importe sumado (método Entrada de Datos).
    // En palancas con `baseComision` se excluyen las ventas O2 (su territorial es aparte)
    // también del conteo, para espejar el grupo de Operaciones por Grupo Cliente.
    const _notO2 = (s: any) => String(s.detalle || s.categoria || '').toLowerCase().trim() !== 'o2'
    const perStoreData = TIENDAS_FISICAS.map(store => getSalesDataForStoreAndType(sales, store, tipoVentaDeReglaTerritorial(terrRule), tiendaMap))
    let perStore = perStoreData.map(d => terrRule.baseComision ? d.logs.filter(_notO2).length : d.value)
    // Dispositivos (TC1437): a la base de cuotas se le suma el numerador
    // oficial que el conteo por cuotas no ve — 910 €/alta FTTR y la
    // diferencia de valorar los seguros a tarifa plana (200/50/150).
    if (p.key === 'rent_disp_seguros') {
      perStore = perStore.map((v, i) => {
        const sellers = (tiendaMap as any)[Object.keys(tiendaMap).find(k =>
          k.toLowerCase().replace('é', 'e') === TIENDAS_FISICAS[i].toLowerCase().replace('é', 'e')) || ''] || []
        const deLaTienda = sales.filter(s =>
          sellers.some((x: string) => String(s.vendedor || '').toLowerCase() === String(x).toLowerCase()))
        return v + ajusteOficialDispositivos(deLaTienda)
      })
    }
    const salesTot = perStore.reduce((a, b) => a + b, 0)

    // Condicionante `baseComision`: el % se aplica sobre la Σ de comisiones por venta
    // (misma fuente que Liquidaciones, getSaleCommission), no sobre las unidades.
    const ctx = {
      catalogs: (input as any).catalogs || {},
      dashRowsPlus: (input as any).dashRowsPlus || [],
      dashRowsBasico: (input as any).dashRowsBasico || [],
      viewingPeriod: (input as any).viewingPeriod || ''
    }
    // Base € POR TIENDA para las palancas en % (BAF 20/30, Convergente 40/50),
    // con O2 fuera (su territorial es aparte). DESDE LA F3 la base es la
    // OFICIAL: Σ PVP con IVA de las altas (lo que multiplica Telefónica), no
    // la comisión interna, que es ≈2× el PVP e inflaba el esperado al doble
    // (validado con junio: pagó 2.487,95 € y el motor esperaba 4.550 €).
    const perStoreCom = TIENDAS_FISICAS.map((_store, i) =>
      perStoreData[i].logs.filter(_notO2).reduce((a: number, s: any) => a + pvpDeAltaBaf(s, ctx.catalogs), 0))

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
