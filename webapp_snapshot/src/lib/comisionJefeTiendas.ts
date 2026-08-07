// ─────────────────────────────────────────────────────────────────────────────
// COMISIÓN DEL JEFE DE TIENDAS (Salva) — FUENTE ÚNICA.
//
// Cálculo EXTRAÍDO TAL CUAL de la pantalla «Comisiones Jefe Tiendas»
// (src/app/seguimiento-ventas/comisiones-jefe/page.tsx): 4 palancas
// independientes y la comisión final = SUMA de palancas. Cada palanca aplica
// un % (el del tramo MÁS ALTO alcanzado) sobre su base €:
//   · Dispositivos + Seguros: base = Σ volumen de ventas € (groupCounts de la
//     regla porcentual) de todos los comerciales SIN Marta; tramos por € contra
//     obj1/2/3 de la regla del Panel (obj2/3 YA rebajados por FTTR en
//     adjustedTiendaRules).
//   · ARPU (Repos): ídem con la regla "ARPU" (obj1/2).
//   · Altas Total BAF / Altas BAF Movistar Convergente: base = Σ comisión de
//     EMPRESA por venta (getSaleCommission); el tramo se decide por UNIDADES
//     contra los objetivos del TERRITORIAL TIENDAS (computeTerritorialRows;
//     solo 4 tiendas físicas, O2 excluido).
//
// Lo consumen:
//   - la propia pantalla (navegador) — misma salida que antes.
//   - /api/comisiones-liquidacion (server-to-server para el ERP): el jefe viaja
//     como una entrada más de porComercial (su total en UN extra) + campo
//     top-level `jefe` con el desglose, mismo patrón que el programa FFVV.
// ─────────────────────────────────────────────────────────────────────────────
import { computeTerritorialRows } from './territorialConsolidado'
import { getSaleCommission } from './saleCommission'
import { matchTipoVenta } from './ventaMatching'
import { isSolar360 } from './salesUtils'

// Los 9 porcentajes del Jefe y sus defaults — los mismos que arrancan los
// useState de la pantalla.
//
// POR MES (ago-2026). Antes vivían en 9 AppSettings GLOBALES, así que tocar el %
// de un mes se lo cambiaba a TODOS, incluidos los meses ya cerrados y pagados.
// Ahora cada mes tiene sus propias claves — COMISION_JEFE_DISP_PCT1_2026_08 — y
// la clave global se queda de RESPALDO para los meses que nadie ha tocado:
//     clave del mes  →  si no existe, clave global  →  si no existe, el defecto.
// Así ningún mes se mueve al desplegar (todos caen al respaldo, que es lo que
// usaban), y a partir de ahora editar un mes NO toca ningún otro.
export interface JefePcts {
    dispPct1: number
    dispPct2: number
    dispPct3: number
    arpuPct1: number
    arpuPct2: number
    bafPct1: number
    bafPct2: number
    convPct1: number
    convPct2: number
    // Altas Repos UP (la regla «Repo Fútbol»). Esta NO es un %: es lo que se le
    // paga al jefe POR CADA ALTA, en euros. Un solo tramo.
    reposEur1: number
}

export const JEFE_PCT_DEFAULTS: JefePcts = {
    dispPct1: 0.40,
    dispPct2: 0.60,
    dispPct3: 0,
    arpuPct1: 4.00,
    arpuPct2: 6.00,
    bafPct1: 0,
    bafPct2: 0,
    convPct1: 0,
    convPct2: 0,
    // A cero a propósito: así ningún mes empieza a pagar esta palanca solo, y
    // ninguno de los meses cerrados se mueve. Se pone a mano en el mes que toque.
    reposEur1: 0,
}

export const JEFE_PCT_SETTING_KEYS: Record<keyof JefePcts, string> = {
    dispPct1: 'COMISION_JEFE_DISP_PCT1',
    dispPct2: 'COMISION_JEFE_DISP_PCT2',
    dispPct3: 'COMISION_JEFE_DISP_PCT3',
    arpuPct1: 'COMISION_JEFE_ARPU_PCT1',
    arpuPct2: 'COMISION_JEFE_ARPU_PCT2',
    bafPct1: 'COMISION_JEFE_BAF_PCT1',
    bafPct2: 'COMISION_JEFE_BAF_PCT2',
    convPct1: 'COMISION_JEFE_CONV_PCT1',
    convPct2: 'COMISION_JEFE_CONV_PCT2',
    reposEur1: 'COMISION_JEFE_REPOSUP_EUR1',
}

// Las 9 claves base, para quien necesite componerlas por mes (el clonado de
// periodos las arrastra igual que el territorial y las reglas de O2).
export const JEFE_PCT_KEYS_BASE: string[] = Object.values(JEFE_PCT_SETTING_KEYS)

// '2026-08' / '202608' / '2026_08' → '2026_08' (el mismo formato que ya usan
// territorial_tiendas_{mes} y el parámetro `mes` de la liquidación).
// Devuelve '' si no es un mes de verdad (mes fuera de 01-12 incluido).
export function normalizarMesJefe(mes: string): string {
    const d = String(mes || '').replace(/\D/g, '')
    if (d.length < 6) return ''
    const anio = d.slice(0, 4)
    const m = Number(d.slice(4, 6))
    if (!(m >= 1 && m <= 12)) return ''
    return `${anio}_${String(m).padStart(2, '0')}`
}

// Clave del mes para uno de los 9 porcentajes: COMISION_JEFE_DISP_PCT1_2026_08.
// Con un mes que no es un mes devuelve '' — NUNCA la clave global: esa es
// justamente la que este cambio deja de tocar, y escribir ahí por accidente
// volvería a mover todos los meses a la vez.
export function jefePctKeyMes(claveGlobal: string, mes: string): string {
    const m = normalizarMesJefe(mes)
    return m ? `${claveGlobal}_${m}` : ''
}

// Las 18 claves que hay que leer para pintar un mes: las 9 suyas y las 9 de
// respaldo. Se piden juntas para no encadenar 18 peticiones.
export function jefePctKeysTodas(mes: string): string[] {
    const globales = Object.values(JEFE_PCT_SETTING_KEYS)
    const m = normalizarMesJefe(mes)
    return m ? [...globales, ...globales.map(k => `${k}_${m}`)] : globales
}

export type JefePctOrigen = 'mes' | 'global' | 'defecto'

/**
 * Resuelve los 9 porcentajes de un mes con la cascada mes → global → defecto,
 * y dice de dónde ha salido cada uno (para que la pantalla pueda avisar de que
 * un valor todavía es heredado y no propio del mes).
 */
export function resolverJefePcts(
    valorPorClave: Map<string, string | null | undefined>,
    mes: string
): { pcts: JefePcts; origen: Record<keyof JefePcts, JefePctOrigen> } {
    const pcts: JefePcts = { ...JEFE_PCT_DEFAULTS }
    const origen = {} as Record<keyof JefePcts, JefePctOrigen>
    const num = (v: string | null | undefined): number | null => {
        if (v === undefined || v === null || String(v).trim() === '') return null
        const n = Number(v)
        return Number.isFinite(n) ? n : null
    }
    for (const k of Object.keys(JEFE_PCT_SETTING_KEYS) as (keyof JefePcts)[]) {
        const global = JEFE_PCT_SETTING_KEYS[k]
        const claveMes = jefePctKeyMes(global, mes)
        const delMes = claveMes ? num(valorPorClave.get(claveMes)) : null
        if (delMes !== null) { pcts[k] = delMes; origen[k] = 'mes'; continue }
        const deRespaldo = num(valorPorClave.get(global))
        if (deRespaldo !== null) { pcts[k] = deRespaldo; origen[k] = 'global'; continue }
        origen[k] = 'defecto'
    }
    return { pcts, origen }
}

export interface JefePalancaTramo {
    n: number          // nº de tramo (1/2/3)
    pct: number        // % configurado del tramo
    amount: number     // avance € = base × pct/100 (lo que se cobraría en ese tramo)
    reached: boolean   // objetivo del tramo alcanzado
}

export interface JefePalanca {
    palanca: string
    base: number               // base € sobre la que se aplica el %
    uds: number | null         // unidades (solo BAF/Convergente; el tramo se decide por uds)
    obj1: number
    obj2: number
    obj3: number | null        // solo Dispositivos + Seguros
    tramoAlcanzado: 0 | 1 | 2 | 3
    pctAplicado: number        // % del tramo alcanzado (0 si ninguno)
    importe: number            // lo que cobra el Jefe por esta palanca
    // Tramos con su avance/reached, en el MISMO orden y condición con que los
    // pinta la pantalla (el 3º de Disp+Seg solo si obj3 > 0).
    tramos: JefePalancaTramo[]
    // true = el importe no es un % sobre una base en €, sino EUROS POR UNIDAD
    // (Altas Repos UP). En esas, `base` y `uds` son las mismas unidades.
    porUnidad?: boolean
}

export interface JefeComercialRow {
    name: string
    dispEur: number
    arpuEur: number
    bafEur: number
    convEur: number
    reposUds: number   // Altas Repos UP: son UNIDADES, no euros
}

export interface ComisionJefeTiendasResult {
    total: number              // Comisión Final (suma de palancas; tramo más alto manda)
    totalCondicionado: number  // máximo teórico si se cumplieran todos los objetivos
    palancas: JefePalanca[]    // [Disp+Seg, ARPU, Altas Total BAF, BAF Convergente]
    porComercial: JefeComercialRow[]  // desglose por comercial (tabla de la pantalla)
}

export interface ComisionJefeTiendasInput {
    // result.sellerStats del motor del Panel (computePanelComisionesTiendas).
    sellerStats: any[]
    // result.adjustedTiendaRules del MISMO motor (obj2/3 de Disp+Seg ya rebajados
    // por FTTR). La pantalla recibe exactamente esto como `tiendaRules` del hook.
    adjustedTiendaRules: any[]
    // JSON parseado del AppSetting territorial_tiendas_{mes} ([] si no existe).
    territorialTiendasRules: any[]
    // Ventas del mes (universo YA filtrado por exclusiones en la liquidación).
    monthSales: any[]
    catalogs: Record<string, any[]>
    // Periodo visualizado en formato 'YYYYMM' (activePeriodKey sin _ ni -).
    viewingPeriod: string
    pcts: JefePcts
}

export function computeComisionJefeTiendas(input: ComisionJefeTiendasInput): ComisionJefeTiendasResult {
    const sellerStats = input.sellerStats || []
    const adjustedTiendaRules = input.adjustedTiendaRules || []
    const territorialTiendasRules = input.territorialTiendasRules || []
    // Igual que el hook useComisionesData: Solar 360 fuera de las ventas del mes
    // (idempotente: la pantalla ya las recibe filtradas; la liquidación pasa el
    // universo crudo y el filtro se aplica aquí).
    const monthSales = (input.monthSales || []).filter((s: any) => !isSolar360(s))
    const catalogs = input.catalogs || {}
    const viewingPeriod = input.viewingPeriod || ''
    const { dispPct1, dispPct2, dispPct3, arpuPct1, arpuPct2, bafPct1, bafPct2, convPct1, convPct2, reposEur1 } = input.pcts

    // ── Bases Disp+Seg / ARPU + desglose por comercial (primer useMemo de la página) ──
    let tableData: JefeComercialRow[] = []
    let totalDispVentas = 0
    let totalArpuVentas = 0
    let globalDispObj1 = 0
    let globalDispObj2 = 0
    let globalDispObj3 = 0
    let globalArpuObj1 = 0
    let globalArpuObj2 = 0
    let totalReposUds = 0
    let globalReposObj1 = 0

    if (sellerStats.length > 0) {
        const dispRule = adjustedTiendaRules.find((r: any) => r.nombre?.toLowerCase().includes('dispositivo') && r.nombre?.toLowerCase().includes('seguro'))
        const arpuRule = adjustedTiendaRules.find((r: any) => r.nombre?.toLowerCase().includes('arpu'))
        // «Altas Repos UP» es la regla que el programa llama «Repo Fútbol»
        // (productos: Extra Repos up destino Fútbol).
        const reposRule = adjustedTiendaRules.find((r: any) => {
            const n = String(r.nombre || '').toLowerCase()
            return n.includes('repo') && !n.includes('arpu')
        })

        globalDispObj1 = dispRule ? Number(dispRule.objPrimerTramo || 0) : 0
        globalDispObj2 = dispRule ? Number(dispRule.objSegundoTramo || 0) : 0
        globalDispObj3 = dispRule ? Number(dispRule.objTercerTramo || 0) : 0
        globalArpuObj1 = arpuRule ? Number(arpuRule.objPrimerTramo || 0) : 0
        globalArpuObj2 = arpuRule ? Number(arpuRule.objSegundoTramo || 0) : 0
        // Un solo objetivo, el PRIMERO de Reglas Globales y Tramos de Comisiones.
        globalReposObj1 = reposRule ? Number(reposRule.objPrimerTramo || 0) : 0
        const reposRuleName = reposRule ? String(reposRule.nombre) : ''

        // tipoVenta de las palancas BAF para el desglose por comercial (mismo filtro que el
        // territorial). Comisión por venta de empresa, O2 excluido (cuadra con la base).
        const _n = (x: string) => String(x || '').toLowerCase()
        const bafTipo = (territorialTiendasRules.find((r: any) => _n(r.nombre).includes('baf') && !_n(r.nombre).includes('convergente'))?.tipoVenta) || 'Alta BAF Total'
        const convTipo = (territorialTiendasRules.find((r: any) => _n(r.nombre).includes('baf') && _n(r.nombre).includes('convergente'))?.tipoVenta) || 'Alta BAF Convergente'
        const _ctx = {
            catalogs,
            dashRowsPlus: [] as any[],
            dashRowsBasico: [] as any[],
            viewingPeriod
        }
        const _notO2 = (sale: any) => String(sale.detalle || sale.categoria || '').toLowerCase().trim() !== 'o2'
        const comisionPalanca = (rawSales: any[], tipo: string) =>
            (rawSales || []).filter(sale => _notO2(sale) && matchTipoVenta(sale, tipo))
                            .reduce((acc, sale) => acc + getSaleCommission(sale, _ctx), 0)

        // Filtrar a Marta
        const validSellers = sellerStats.filter((s: any) => !s.name.toLowerCase().includes('marta'))

        tableData = validSellers.map((s: any) => {
            // Utilizar groupCounts que ya viene calculado y validado por el motor del Panel
            const dispKey = Object.keys(s.groupCounts || {}).find(k => k.toLowerCase().includes('dispositivo') && k.toLowerCase().includes('seguro'))
            const arpuKey = Object.keys(s.groupCounts || {}).find(k => k.toLowerCase().includes('arpu'))

            const dispEur = dispKey ? (s.groupCounts[dispKey] || 0) : 0
            const arpuEur = arpuKey ? (s.groupCounts[arpuKey] || 0) : 0
            // Repo Fútbol es una regla POR UNIDADES, así que groupCounts son altas.
            const reposUds = reposRuleName ? (s.groupCounts[reposRuleName] || 0) : 0
            const bafEur = comisionPalanca(s.rawSales, bafTipo)
            const convEur = comisionPalanca(s.rawSales, convTipo)

            totalDispVentas += dispEur
            totalArpuVentas += arpuEur
            totalReposUds += reposUds

            return { name: s.name, dispEur, arpuEur, bafEur, convEur, reposUds }
        })
    }

    // ── BAF y Convergente: objetivos (uds) + base de comisiones (€) desde TERRITORIAL
    // TIENDAS (segundo useMemo de la página). Reusa el mismo motor
    // (computeTerritorialRows) → cuadra con el territorial por construcción. ──
    const empty = { obj1: 0, obj2: 0, uds: 0, base: 0 }
    let baf = empty
    let conv = empty
    if (monthSales.length > 0 && territorialTiendasRules.length > 0) {
        const rows = computeTerritorialRows({
            sales: monthSales,
            territorialRules: territorialTiendasRules,
            catalogs,
            viewingPeriod
        } as any)
        const get = (key: string) => {
            const r = rows.find((x: any) => x.key === key)
            if (!r) return empty
            return { obj1: r.obj1Target || 0, obj2: r.obj2Target || 0, uds: r.ventasBase || 0, base: r.comisionBase || 0 }
        }
        baf = get('altas_baf')
        conv = get('altas_baf_conv')
    }

    // ── Avances y comisión final (mismo cálculo inline de la página) ──
    // Avance del Jefe: su % sobre la base de comisiones de la palanca; el tramo
    // (más alto alcanzado) se decide por las UNIDADES vs el objetivo del territorial.
    const avanceBaf1 = baf.base * (bafPct1 / 100)
    const avanceBaf2 = baf.base * (bafPct2 / 100)
    const avanceConv1 = conv.base * (convPct1 / 100)
    const avanceConv2 = conv.base * (convPct2 / 100)

    let finalBaf = 0
    let bafTramo: 0 | 1 | 2 | 3 = 0
    if (baf.obj2 > 0 && baf.uds >= baf.obj2) { finalBaf = avanceBaf2; bafTramo = 2 }
    else if (baf.obj1 > 0 && baf.uds >= baf.obj1) { finalBaf = avanceBaf1; bafTramo = 1 }
    let finalConv = 0
    let convTramo: 0 | 1 | 2 | 3 = 0
    if (conv.obj2 > 0 && conv.uds >= conv.obj2) { finalConv = avanceConv2; convTramo = 2 }
    else if (conv.obj1 > 0 && conv.uds >= conv.obj1) { finalConv = avanceConv1; convTramo = 1 }

    const avanceDisp1 = totalDispVentas * (dispPct1 / 100)
    const avanceDisp2 = totalDispVentas * (dispPct2 / 100)
    const avanceDisp3 = totalDispVentas * (dispPct3 / 100)

    const avanceArpu1 = totalArpuVentas * (arpuPct1 / 100)
    const avanceArpu2 = totalArpuVentas * (arpuPct2 / 100)

    // Altas Repos UP: euros POR ALTA, un solo tramo. Se cobra entero en cuanto el
    // equipo llega al objetivo 1 de la regla; por debajo, nada.
    const avanceRepos1 = totalReposUds * (reposEur1 || 0)
    let finalRepos = 0
    let reposTramo: 0 | 1 | 2 | 3 = 0
    if (globalReposObj1 > 0 && totalReposUds >= globalReposObj1) { finalRepos = avanceRepos1; reposTramo = 1 }

    // Total Condicionado (El máximo posible: el tramo más alto configurado)
    const totalCondicionado = (globalDispObj3 > 0 ? avanceDisp3 : avanceDisp2) + avanceArpu2 + avanceBaf2 + avanceConv2 + avanceRepos1

    // Comisión Final (Real) - el tramo más alto alcanzado manda
    let finalDisp = 0
    let dispTramo: 0 | 1 | 2 | 3 = 0
    if (totalDispVentas >= globalDispObj3 && globalDispObj3 > 0) { finalDisp = avanceDisp3; dispTramo = 3 }
    else if (totalDispVentas >= globalDispObj2 && globalDispObj2 > 0) { finalDisp = avanceDisp2; dispTramo = 2 }
    else if (totalDispVentas >= globalDispObj1 && globalDispObj1 > 0) { finalDisp = avanceDisp1; dispTramo = 1 }

    let finalArpu = 0
    let arpuTramo: 0 | 1 | 2 | 3 = 0
    if (totalArpuVentas >= globalArpuObj2 && globalArpuObj2 > 0) { finalArpu = avanceArpu2; arpuTramo = 2 }
    else if (totalArpuVentas >= globalArpuObj1 && globalArpuObj1 > 0) { finalArpu = avanceArpu1; arpuTramo = 1 }

    const total = finalDisp + finalArpu + finalBaf + finalConv + finalRepos

    const pctDe = (tramo: number, p1: number, p2: number, p3: number) =>
        tramo === 3 ? p3 : tramo === 2 ? p2 : tramo === 1 ? p1 : 0

    const palancas: JefePalanca[] = [
        {
            palanca: 'Dispositivos + Seguros',
            base: totalDispVentas,
            uds: null,
            obj1: globalDispObj1,
            obj2: globalDispObj2,
            obj3: globalDispObj3,
            tramoAlcanzado: dispTramo,
            pctAplicado: pctDe(dispTramo, dispPct1, dispPct2, dispPct3),
            importe: finalDisp,
            tramos: [
                { n: 1, pct: dispPct1, amount: avanceDisp1, reached: globalDispObj1 > 0 && totalDispVentas >= globalDispObj1 },
                { n: 2, pct: dispPct2, amount: avanceDisp2, reached: globalDispObj2 > 0 && totalDispVentas >= globalDispObj2 },
                ...(globalDispObj3 > 0 ? [{ n: 3, pct: dispPct3, amount: avanceDisp3, reached: totalDispVentas >= globalDispObj3 }] : [])
            ],
        },
        {
            palanca: 'ARPU (Repos)',
            base: totalArpuVentas,
            uds: null,
            obj1: globalArpuObj1,
            obj2: globalArpuObj2,
            obj3: null,
            tramoAlcanzado: arpuTramo,
            pctAplicado: pctDe(arpuTramo, arpuPct1, arpuPct2, 0),
            importe: finalArpu,
            tramos: [
                { n: 1, pct: arpuPct1, amount: avanceArpu1, reached: globalArpuObj1 > 0 && totalArpuVentas >= globalArpuObj1 },
                { n: 2, pct: arpuPct2, amount: avanceArpu2, reached: globalArpuObj2 > 0 && totalArpuVentas >= globalArpuObj2 }
            ],
        },
        {
            palanca: 'Altas Total BAF',
            base: baf.base,
            uds: baf.uds,
            obj1: baf.obj1,
            obj2: baf.obj2,
            obj3: null,
            tramoAlcanzado: bafTramo,
            pctAplicado: pctDe(bafTramo, bafPct1, bafPct2, 0),
            importe: finalBaf,
            tramos: [
                { n: 1, pct: bafPct1, amount: avanceBaf1, reached: baf.obj1 > 0 && baf.uds >= baf.obj1 },
                { n: 2, pct: bafPct2, amount: avanceBaf2, reached: baf.obj2 > 0 && baf.uds >= baf.obj2 }
            ],
        },
        {
            palanca: 'Altas BAF Movistar Convergente',
            base: conv.base,
            uds: conv.uds,
            obj1: conv.obj1,
            obj2: conv.obj2,
            obj3: null,
            tramoAlcanzado: convTramo,
            pctAplicado: pctDe(convTramo, convPct1, convPct2, 0),
            importe: finalConv,
            tramos: [
                { n: 1, pct: convPct1, amount: avanceConv1, reached: conv.obj1 > 0 && conv.uds >= conv.obj1 },
                { n: 2, pct: convPct2, amount: avanceConv2, reached: conv.obj2 > 0 && conv.uds >= conv.obj2 }
            ],
        },
        {
            // La única que se paga por unidad y no por porcentaje.
            palanca: 'Altas Repos UP',
            base: totalReposUds,
            uds: totalReposUds,
            obj1: globalReposObj1,
            obj2: 0,
            obj3: null,
            tramoAlcanzado: reposTramo,
            pctAplicado: reposTramo === 1 ? (reposEur1 || 0) : 0,
            importe: finalRepos,
            porUnidad: true,
            tramos: [
                { n: 1, pct: reposEur1 || 0, amount: avanceRepos1, reached: globalReposObj1 > 0 && totalReposUds >= globalReposObj1 }
            ],
        },
    ]

    return { total, totalCondicionado, palancas, porComercial: tableData }
}
