import { getSaleCommission, getSaleCommissionBase, isLegacySwap } from './saleCommission'
import { isSolar360, isSaleCancelled, esVentaSustituida } from './salesUtils'

// ─────────────────────────────────────────────────────────────────────────────
// LO QUE COBRAMOS vs LO QUE PAGAMOS — TIENDAS (paso del hub Cambio de Mes).
// Hermano del versus de FFVV (lib/versusPalancas), con los motores de Tiendas:
//
//   COBRO (empresa)  = getSaleCommission por venta — la MISMA fuente única que
//                      el feed /api/ventas-export que alimenta al ERP (Swap
//                      antiguo: base + 15 € espejo), con los catálogos del mes.
//   PAGO (comercial) = las líneas por venta+regla del motor del Panel
//                      (computePanelComisionesTiendas → sellerStats.lineasDetalle)
//                      + extras/bonos + el jefe (computeComisionJefeTiendas).
//
// Además caza lo que motivó este paso (julio-2026): UNA MISMA VENTA cobrando por
// DOS O TRES reglas a la vez (p. ej. «Repo Fútbol» + «ARPU» sobre los mismos
// 10 €) — 615,31 € (21 % del pago) aquel mes y nadie lo veía. No es un fallo:
// las reglas hacen lo que dicen; es una decisión de negocio que el dueño quiere
// VER cada mes. Este módulo NO toca ninguna regla: solo mide y enseña.
// ─────────────────────────────────────────────────────────────────────────────

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Catálogos del mes montados EXACTAMENTE como los monta /api/ventas-export
 * (catálogo del periodo → global → mezcla). No vale usar los del motor del
 * Panel: cargan las mismas categorías con otra estructura y en Rent la
 * vigencia elegía otra fila (−978,90 € en julio-2026 sin que nada estuviera
 * «mal» — dos fotos distintas del mismo armario). La referencia del COBRO es
 * el feed del ERP, que ya se cuadró al céntimo con la Hoja de Cobro.
 */
export async function catalogosDelMesTiendas(prisma: any, periodKey: string): Promise<Record<string, any[]>> {
  const catRows = await prisma.productCatalog.findMany({
    select: {
      categoria: true, producto: true, anual: true, comision: true,
      comisionConCoste: true, validFrom: true, validTo: true, subcategoria: true, gama: true,
      periodId: true,
    },
  })
  const mezcla: Record<string, any[]> = {}
  const porPeriodo = new Map<string, Record<string, any[]>>()
  for (const c of catRows) {
    (mezcla[c.categoria] ||= []).push(c)
    const clave = c.periodId || '(global)'
    if (!porPeriodo.has(clave)) porPeriodo.set(clave, {})
    const g = porPeriodo.get(clave)!
    ;(g[c.categoria] ||= []).push(c)
  }
  const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } }).catch(() => null)
  if (wp?.id && porPeriodo.has(wp.id)) return porPeriodo.get(wp.id)!
  if (porPeriodo.has('(global)')) return porPeriodo.get('(global)')!
  return mezcla
}

export interface VersusPalancaRow {
  palanca: string
  cobro: number
  pago: number      // solo líneas por venta (los extras/bonos y el jefe van aparte: son por objetivos, no por palanca)
  margen: number
}

export interface VersusMultiRegla {
  ventas: number             // cuántas ventas cobran por 2+ reglas
  importeAdicional: number   // € de las segundas/terceras reglas (todo menos la mayor de cada venta)
  ejemplos: string[]         // hasta 3, en cristiano
}

export interface VersusTiendasResult {
  cobro: number
  ops: number
  pagoEquipo: number   // comerciales de tienda (líneas + extras), sin Marta
  pagoO2: number       // Marta (O2 MovilFree)
  pagoJefe: number     // Salva
  pago: number         // total pagado
  margen: number
  margenPct: number | null
  multi: VersusMultiRegla
  porPalanca: VersusPalancaRow[]
  avisos: string[]     // palancas en pérdida o que pagan sin cobro (orientativo a mitad de mes)
}

export function computeVersusTiendas(args: {
  /** Ventas del mes — el MISMO universo que usa el motor del Panel. */
  ventas: any[]
  /** Catálogos del mes (input.catalogs de loadPanelInputs). */
  catalogs: Record<string, any[]>
  /** 'YYYY_MM'. */
  periodKey: string
  /** sellerStats del motor (con lineasDetalle y extrasConceptos). */
  sellerStats: any[]
  /** Total del jefe (computeComisionJefeTiendas). */
  jefeTotal: number
}): VersusTiendasResult {
  const { ventas, catalogs, periodKey, sellerStats, jefeTotal } = args
  const viewingPeriod = periodKey.replace(/[_-]/g, '')
  const ctx = { catalogs, dashRowsPlus: [], dashRowsBasico: [], viewingPeriod }

  // ── COBRO: venta a venta, igual que el feed del ERP ───────────────────────
  let cobro = 0
  let ops = 0
  const cobroPorPalanca = new Map<string, number>()
  const palancaDeVenta = new Map<string, string>()
  for (const v of ventas) {
    const palanca = String(v.detalle || '').trim() || '(sin palanca)'
    palancaDeVenta.set(String(v.id), palanca)
    if (isSaleCancelled(v) || esVentaSustituida(v)) continue
    if (isSolar360(v)) continue   // Solar360 no la cobra la empresa
    let c = 0
    try {
      // Swap antiguo (< jul-2026): la línea madre sin el +15 y el bono aparte,
      // exactamente como lo cuenta ventas-export (misma cifra por construcción).
      c = isLegacySwap(v) ? r2(getSaleCommissionBase(v, ctx) + 15) : r2(getSaleCommission(v, ctx))
    } catch { c = 0 }
    ops += 1
    cobro += c
    cobroPorPalanca.set(palanca, r2((cobroPorPalanca.get(palanca) || 0) + c))
  }
  cobro = r2(cobro)

  // ── PAGO: líneas por venta+regla del motor + extras + jefe ────────────────
  const esMarta = (s: any) => String(s?.name || s?.comercial || '').toLowerCase().includes('marta')
  const totalDe = (s: any) => r2(Number(s?.totalComision || 0) + Number(s?.totalExtras || 0))
  const pagoEquipo = r2(sellerStats.filter(s => !esMarta(s)).reduce((a, s) => a + totalDe(s), 0))
  const marta = sellerStats.find(esMarta)
  const pagoO2 = marta ? totalDe(marta) : 0
  const pagoJefe = r2(Number(jefeTotal || 0))
  const pago = r2(pagoEquipo + pagoO2 + pagoJefe)

  // pago por palanca (solo líneas; el seguro adosado del Rent cuenta como 'Seguro')
  const pagoPorPalanca = new Map<string, number>()
  // y el detector de ventas que cobran por 2+ reglas
  const porVenta = new Map<string, { producto: string; lineas: { regla: string; comision: number }[] }>()
  for (const st of sellerStats) {
    for (const l of (st.lineasDetalle || [])) {
      const saleId = String(l.saleId || '')
      const palanca = l.esSeguroVirtual ? 'Seguro' : (palancaDeVenta.get(saleId) || String(l.grupo || '(regla)'))
      pagoPorPalanca.set(palanca, r2((pagoPorPalanca.get(palanca) || 0) + Number(l.comision || 0)))
      // El seguro adosado es OTRO producto de la misma operación, no una segunda
      // regla sobre el mismo producto: fuera del detector de dobles.
      if (l.esSeguroVirtual) continue
      if (!saleId) continue
      const e = porVenta.get(saleId) || { producto: String(l.producto || ''), lineas: [] }
      e.lineas.push({ regla: String(l.grupo || ''), comision: Number(l.comision || 0) })
      porVenta.set(saleId, e)
    }
  }

  const dobles = [...porVenta.values()].filter(e => e.lineas.length >= 2)
  let importeAdicional = 0
  const conAdicional = dobles.map(e => {
    const orden = [...e.lineas].sort((a, b) => b.comision - a.comision)
    const adicional = r2(orden.slice(1).reduce((a, l) => a + l.comision, 0))
    importeAdicional += adicional
    return { ...e, adicional, reglas: orden.map(l => l.regla) }
  }).sort((a, b) => b.adicional - a.adicional)
  const multi: VersusMultiRegla = {
    ventas: dobles.length,
    importeAdicional: r2(importeAdicional),
    ejemplos: conAdicional.slice(0, 3).map(e =>
      `${e.producto || '(producto)'}: ${e.reglas.join(' + ')} (${e.adicional.toLocaleString('es-ES', { minimumFractionDigits: 2 })} € de regla adicional)`),
  }

  // ── por palanca + avisos ──────────────────────────────────────────────────
  const nombres = new Set<string>([...cobroPorPalanca.keys(), ...pagoPorPalanca.keys()])
  const porPalanca: VersusPalancaRow[] = [...nombres].map(p => {
    const c = cobroPorPalanca.get(p) || 0
    const g = pagoPorPalanca.get(p) || 0
    return { palanca: p, cobro: r2(c), pago: r2(g), margen: r2(c - g) }
  }).sort((a, b) => b.cobro - a.cobro)

  // Los avisos se miran por FAMILIA, no por palanca suelta: en el modelo de los
  // Repos (jul-2026) la empresa cobra por la línea «Repos UP» y paga al comercial
  // por la línea «Repos»/«Suscripciones TV» de al lado (y el fútbol entra en la
  // base de ARPU) — palancas hermanas entrelazadas A PROPÓSITO. Acusar a una de
  // ellas por separado sería llorar en falso; la familia entera sí debe cuadrar.
  const familiaDe = (p: string): string => {
    const n = p.toLowerCase()
    if (/repo|futbol|fútbol|suscripcion|suscripción/.test(n)) return 'Repos / TV / Fútbol'
    return p
  }
  const porFamilia = new Map<string, { cobro: number; pago: number }>()
  for (const row of porPalanca) {
    const f = familiaDe(row.palanca)
    const e = porFamilia.get(f) || { cobro: 0, pago: 0 }
    e.cobro = r2(e.cobro + row.cobro)
    e.pago = r2(e.pago + row.pago)
    porFamilia.set(f, e)
  }
  const avisos: string[] = []
  for (const [familia, e] of porFamilia) {
    if (e.pago > 0.5 && e.cobro <= 0.005) {
      avisos.push(`«${familia}» paga ${e.pago.toLocaleString('es-ES', { minimumFractionDigits: 2 })} € sin cobro de empresa registrado.`)
    } else if (e.cobro - e.pago < -0.5) {
      avisos.push(`«${familia}» en pérdida: se paga ${e.pago.toLocaleString('es-ES', { minimumFractionDigits: 2 })} € cobrando ${e.cobro.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €.`)
    }
  }

  const margen = r2(cobro - pago)
  return {
    cobro, ops, pagoEquipo, pagoO2, pagoJefe, pago,
    margen, margenPct: cobro > 0 ? r2((margen / cobro) * 100) : null,
    multi, porPalanca, avisos,
  }
}
