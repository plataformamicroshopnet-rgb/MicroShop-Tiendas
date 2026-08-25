// Import DIRECTO de la lib (no del hook): el hook va a importar este fichero
// para los extras del torneo y con el import antiguo se formaba un ciclo.
import { matchesRule, getValueForRule } from '@/lib/panelComisionesTiendas'

// ─── Configurador de Torneos de Ventas ───────────────────────────────────────
// Config GLOBAL (persiste de un mes a otro; se edita desde el configurador).
// El usuario decide cuántos concursos (0-3), su nombre, qué ventas cuentan
// (mismo sistema que «Reglas Globales y Tramos», columna Tipo de Venta), si se
// mide por nº de ventas, por € (importe) o por las comisiones del comercial,
// y los premios por posición.
// ─────────────────────────────────────────────────────────────────────────────

export type TorneoMetrica = 'count' | 'importe' | 'comisiones'

export interface TorneoPremio {
  pos: number          // 1, 2, 3...
  importe: number      // € del premio (0 si solo texto)
  texto: string        // descripción libre (ej. "Cena", "Día libre")
}

// Ventana de ventas cuando el concurso lleva fechas (petición del dueño,
// 24-ago-2026): 'mes' = cuentan TODAS las ventas del mes que se está viendo
// (retroactivo a principios de mes); 'tramo' = SOLO las ventas cuya fecha cae
// dentro de [fechaInicio, fechaFin]. Sin fechas, el concurso es permanente y
// se comporta como siempre (todas las ventas del mes visto).
export type TorneoVentana = 'mes' | 'tramo'

// Cómo se premia (petición del dueño, 24-ago-2026): 'podio' = los premios por
// posición de siempre; 'porVenta' = un EXTRA del mes — cada venta que puntúa
// paga X € al que la hizo, entre todos, y con un TOPE de bote opcional: al
// llegar al tope no se paga más (las ventas se cobran por orden de fecha).
export type TorneoPremioModo = 'podio' | 'porVenta'

export interface Concurso {
  id: string
  nombre: string
  tipoVenta: string    // valor del ProductTreeSelector (igual que Reglas Globales)
  metrica: TorneoMetrica
  premios: TorneoPremio[]
  fechaInicio?: string   // 'YYYY-MM-DD' — vacío = sin límite (concurso permanente)
  fechaFin?: string      // 'YYYY-MM-DD' — vacío = sin límite
  ventana?: TorneoVentana  // solo pinta algo si hay fechas; por defecto 'mes'
  premioModo?: TorneoPremioModo  // por defecto 'podio'
  importePorVenta?: number       // solo modo 'porVenta': € por venta
  topeBote?: number              // solo modo 'porVenta': tope total (0 = sin tope)
  minIndividual?: number         // solo 'porVenta': ventas mínimas PROPIAS para cobrar (0 = sin mínimo)
  minGrupal?: number             // solo 'porVenta': ventas mínimas ENTRE TODOS — sin llegar, no cobra nadie
  notas?: string                 // nota extra A MANO; las condiciones salen solas (generaNotasConcurso)
  tituloColor?: string           // color del nombre en el ranking ('' = el de siempre)
  tituloSize?: number            // tamaño en px del nombre en el ranking (0 = el de siempre)
}

export interface TorneosConfig {
  concursos: Concurso[]
}

export const TORNEOS_CONFIG_KEY = 'torneos_config'          // clave ANTIGUA (global)
// De 3 a 6 (27-ago-2026): el dueño quiere fomentar los EXTRAs por venta y el
// Dashboard estrena segunda carta de Torneos (concursos 4-6).
export const MAX_CONCURSOS = 6

// ── CONFIG POR MES (24-ago-2026) ─────────────────────────────────────────────
// La clave global arrastraba el último torneo a TODOS los meses (el dueño vio
// su Convergente de agosto plantado en julio — y de paso, guardar agosto pisó
// el torneo recuperado de julio). Desde hoy cada mes guarda LOS SUYOS en
// torneos_config_{periodKey}. La clave global queda de RESPALDO solo para el
// MES ACTUAL sin clave propia (migración suave: lo recién configurado sigue
// funcionando hasta que se guarde una vez con el configurador nuevo).
export const TORNEOS_CONFIG_KEY_MES = (periodKey: string) => `torneos_config_${periodKey}`

export function periodKeyActual(): string {
  const n = new Date()
  return `${n.getFullYear()}_${String(n.getMonth() + 1).padStart(2, '0')}`
}

// Carga del MES: su clave; si no existe y es el mes actual, la global antigua.
// Devuelve también de dónde salió, para que el configurador pueda avisar.
export async function loadTorneosConfigMes(periodKey: string):
    Promise<{ config: TorneosConfig; origen: 'mes' | 'global' | 'vacio' }> {
  try {
    const res = await fetch(`/api/settings?key=${TORNEOS_CONFIG_KEY_MES(periodKey)}`)
    const data = await res.json()
    if (data && data.value) return { config: parseTorneosConfig(data.value), origen: 'mes' }
  } catch { /* sigue al respaldo */ }
  if (periodKey === periodKeyActual()) {
    try {
      const res = await fetch(`/api/settings?key=${TORNEOS_CONFIG_KEY}`)
      const data = await res.json()
      if (data && data.value) return { config: parseTorneosConfig(data.value), origen: 'global' }
    } catch { /* vacío */ }
  }
  return { config: { concursos: [] }, origen: 'vacio' }
}

// Config por defecto = los 3 concursos que había históricamente, para no perder nada
export const DEFAULT_TORNEOS_CONFIG: TorneosConfig = {
  concursos: [
    { id: 'c1', nombre: 'Dispositivos + Seguros', tipoVenta: 'Dispositivos + Seguros', metrica: 'importe', premios: [] },
    { id: 'c2', nombre: 'ARPU', tipoVenta: 'ARPU', metrica: 'importe', premios: [] },
    { id: 'c3', nombre: 'Alta BAF Convergente', tipoVenta: 'Alta BAF Convergente', metrica: 'count', premios: [] },
  ],
}


export function parseTorneosConfig(raw: any): TorneosConfig {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (obj && Array.isArray(obj.concursos)) {
      const fechaOk = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : ''
      const concursos = obj.concursos.slice(0, MAX_CONCURSOS).map((c: any, i: number) => ({
        id: String(c.id || `c${i + 1}`),
        nombre: String(c.nombre || '').trim(),
        tipoVenta: String(c.tipoVenta || ''),
        metrica: c.metrica === 'importe' ? 'importe' : c.metrica === 'comisiones' ? 'comisiones' : 'count',
        premios: Array.isArray(c.premios) ? c.premios.map((p: any) => ({
          pos: Number(p.pos) || 0,
          importe: Number(p.importe) || 0,
          texto: String(p.texto || ''),
        })).filter((p: any) => p.pos > 0) : [],
        fechaInicio: fechaOk(c.fechaInicio),
        fechaFin: fechaOk(c.fechaFin),
        ventana: c.ventana === 'tramo' ? 'tramo' as const : 'mes' as const,
        premioModo: c.premioModo === 'porVenta' ? 'porVenta' as const : 'podio' as const,
        importePorVenta: Number(c.importePorVenta) || 0,
        topeBote: Number(c.topeBote) || 0,
        minIndividual: Math.max(0, Math.floor(Number(c.minIndividual) || 0)),
        minGrupal: Math.max(0, Math.floor(Number(c.minGrupal) || 0)),
        notas: String(c.notas || ''),
        tituloColor: /^#[0-9a-fA-F]{3,8}$/.test(String(c.tituloColor || '')) ? String(c.tituloColor) : '',
        tituloSize: Math.max(0, Math.min(40, Number(c.tituloSize) || 0)),
      }))
      return { concursos }
    }
  } catch { /* config corrupta → por defecto */ }
  return DEFAULT_TORNEOS_CONFIG
}

export async function loadTorneosConfig(): Promise<TorneosConfig> {
  try {
    const res = await fetch(`/api/settings?key=${TORNEOS_CONFIG_KEY}`)
    const data = await res.json()
    if (data && data.value) return parseTorneosConfig(data.value)
  } catch { /* sin red → por defecto */ }
  return DEFAULT_TORNEOS_CONFIG
}

// Fecha de una venta ('dd/mm/aaaa' o 'aaaa-mm-dd…') como 'YYYY-MM-DD' ('' si no se entiende).
export function saleFechaISO(sale: any): string {
  const f = String(sale?.fecha || '').trim()
  if (f.includes('/')) {
    const p = f.split('/')
    if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(f)) return f.slice(0, 10)
  return ''
}

// ¿Esta venta entra en la ventana del concurso? Sin fechas → siempre. Con
// fechas y ventana 'tramo' → solo si su fecha cae dentro. Con ventana 'mes'
// las fechas NO filtran ventas (solo dicen cuándo juega el concurso).
export function ventaEnVentana(sale: any, c: Concurso): boolean {
  if (c.ventana !== 'tramo') return true
  if (!c.fechaInicio && !c.fechaFin) return true
  const f = saleFechaISO(sale)
  if (!f) return false                       // sin fecha legible no puede competir en un tramo
  if (c.fechaInicio && f < c.fechaInicio) return false
  if (c.fechaFin && f > c.fechaFin) return false
  return true
}

// ¿El concurso tiene algo que ver con el MES que se está mirando? Sin fechas,
// siempre. Con fechas, solo si [inicio, fin] pisa algún día de ese mes — si no,
// el ranking de ese mes NO debe pintarse (saldría todo a 0,00 € repartiendo
// medallas entre empatados a cero, que fue lo que vio el dueño el 24-ago).
export function concursoJuegaEnMes(c: Concurso, year: number, month: number): boolean {
  if (!c.fechaInicio && !c.fechaFin) return true
  const mm = String(month).padStart(2, '0')
  const mesIni = `${year}-${mm}-01`
  const mesFin = `${year}-${mm}-31`
  if (c.fechaFin && c.fechaFin < mesIni) return false
  if (c.fechaInicio && c.fechaInicio > mesFin) return false
  return true
}

// Estado del concurso HOY, para el chip del ranking: null = permanente (sin chip).
export function estadoConcurso(c: Concurso, hoyISO?: string): { txt: string; color: string } | null {
  if (!c.fechaInicio && !c.fechaFin) return null
  const hoy = hoyISO || new Date().toISOString().slice(0, 10)
  const d = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  if (c.fechaInicio && hoy < c.fechaInicio) return { txt: `⏳ empieza el ${d(c.fechaInicio)}`, color: '#64748b' }
  if (c.fechaFin && hoy > c.fechaFin) return { txt: `🏁 finalizado el ${d(c.fechaFin)}`, color: '#7c3aed' }
  const partes = []
  if (c.fechaInicio) partes.push(`desde el ${d(c.fechaInicio)}`)
  if (c.fechaFin) partes.push(`hasta el ${d(c.fechaFin)}`)
  return { txt: `🟢 en juego ${partes.join(' ')}`, color: '#16a34a' }
}

// Aportación de UNA venta a UN concurso (0 si no cuenta; 1 si métrica nº; € si métrica importe).
// Usa EXACTAMENTE el mismo matching/valor que el panel de Comisiones. La ventana de fechas
// se aplica AQUÍ para que ranking y dashboard la hereden sin duplicar nada.
export function concursoSaleValue(sale: any, concurso: Concurso, catalogs?: Record<string, any[]>): number {
  if (!ventaEnVentana(sale, concurso)) return 0
  // La métrica 'comisiones' NO se mide venta a venta: el ranking es el total de
  // comisiones del mes de cada comercial (getSaleCommission, la misma receta que
  // Liquidación/Rentabilidad por Tiendas) y se agrega por comercial FUERA de esta
  // función, en la pantalla de Torneos. Aquí devolvemos 0 para no sumar nada.
  if (concurso.metrica === 'comisiones') return 0
  if (!matchesRule(sale, concurso.nombre, concurso.tipoVenta)) return 0
  return concurso.metrica === 'importe' ? (getValueForRule(sale, concurso.nombre, catalogs) || 0) : 1
}

// ── Modo «porVenta»: el reparto del EXTRA del mes ────────────────────────────
// Cada venta que puntúa paga `importePorVenta` € al que la hizo. Si hay TOPE
// de bote, las ventas cobran POR ORDEN DE FECHA (da igual de quién sean) hasta
// agotarlo: al llegar al tope, las siguientes cuentan en el ranking pero ya no
// cobran. Devuelve el ranking por Nº DE VENTAS con lo ganado por cada uno.
export interface RepartoPorVenta {
  // ganado = lo que COBRA de verdad (0 mientras el mínimo de equipo no llegue).
  // enJuego = lo que LLEVARÍA si el equipo llega — se enseña en ámbar para que
  // se vea lo que se puede perder (dueño, 24-ago-2026: «siempre motiva más ver
  // la cifra que sale y que la puedas perder por no llegar entre todos»).
  filas: { name: string; ventas: number; ganado: number; enJuego: number; cumpleMin: boolean }[]
  repartido: number       // € ya pagados de verdad entre todos
  enJuegoTotal: number    // € que habría repartidos si el equipo llega al mínimo
  tope: number            // 0 = sin tope
  agotado: boolean
  teamVentas: number      // ventas que puntúan, entre todos
  minIndividual: number   // 0 = sin mínimo
  minGrupal: number       // 0 = sin mínimo
  grupalCumplido: boolean // con mínimo grupal sin llegar, NO cobra nadie
}

export function repartoPorVenta(items: { name: string; sale: any }[], c: Concurso,
                                catalogs?: Record<string, any[]>): RepartoPorVenta {
  const rate = Number(c.importePorVenta) || 0
  const tope = Number(c.topeBote) || 0
  const minInd = Math.max(0, Math.floor(Number(c.minIndividual) || 0))
  const minGrp = Math.max(0, Math.floor(Number(c.minGrupal) || 0))
  // Puntúa = mismo matching y misma ventana que el resto (métrica a 'count'
  // para que concursoSaleValue devuelva 1/0, pase lo que ponga la config).
  const cCount: Concurso = { ...c, metrica: 'count' }
  const puntuan = items.filter(x => concursoSaleValue(x.sale, cCount, catalogs) > 0)
  // Orden de cobro: por fecha de la venta (las sin fecha legible, al final).
  puntuan.sort((a, b) => {
    const fa = saleFechaISO(a.sale) || '9999-99-99'
    const fb = saleFechaISO(b.sale) || '9999-99-99'
    return fa < fb ? -1 : fa > fb ? 1 : 0
  })
  // Los MÍNIMOS son la llave del cobro (dueño, 24-ago-2026): sin llegar al
  // grupal no cobra nadie; sin llegar al individual, ese comercial no cobra.
  // Las ventas de quien no cobra NO gastan bote (el bote es para los pagos).
  const conteo: Record<string, number> = {}
  puntuan.forEach(({ name }) => { conteo[name] = (conteo[name] || 0) + 1 })
  const teamVentas = puntuan.length
  const grupalCumplido = teamVentas >= minGrp
  // El reparto se calcula COMO SI el mínimo de equipo estuviera cumplido
  // (mismos bote, orden de fecha y mínimo individual): eso es lo «en juego».
  // El pago REAL solo existe cuando el grupal llega — hasta entonces, 0.
  let restante = tope > 0 ? tope : Number.POSITIVE_INFINITY
  const porNombre: Record<string, { ventas: number; enJuego: number }> = {}
  for (const { name, sale: _s } of puntuan) {
    const st = porNombre[name] || (porNombre[name] = { ventas: 0, enJuego: 0 })
    st.ventas += 1
    const cobraInd = (conteo[name] || 0) >= minInd
    if (cobraInd && rate > 0 && restante >= rate) {
      st.enJuego += rate
      restante -= rate
    }
  }
  const filas = Object.entries(porNombre)
    .map(([name, v]) => ({ name, ventas: v.ventas, enJuego: v.enJuego,
                           ganado: grupalCumplido ? v.enJuego : 0,
                           cumpleMin: (conteo[name] || 0) >= minInd }))
    .sort((a, b) => b.ventas - a.ventas || b.enJuego - a.enJuego)
  const enJuegoTotal = filas.reduce((acc, f) => acc + f.enJuego, 0)
  const repartido = grupalCumplido ? enJuegoTotal : 0
  return { filas, repartido, enJuegoTotal, tope, agotado: tope > 0 && restante < rate,
           teamVentas, minIndividual: minInd, minGrupal: minGrp, grupalCumplido }
}

// ── Las NOTAS del concurso se escriben SOLAS desde sus condiciones ──────────
// (mismo criterio que el «OJO» de las palancas: lo que se lee es exactamente
// lo que se paga; nada a mano que se pueda quedar viejo). La nota manual del
// configurador, si existe, se añade detrás.
export function generaNotasConcurso(c: Concurso): string {
  const partes: string[] = []
  const d = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  if (c.fechaInicio || c.fechaFin) {
    let f = 'Juega'
    if (c.fechaInicio) f += ` del ${d(c.fechaInicio)}`
    if (c.fechaFin) f += ` al ${d(c.fechaFin)}`
    f += c.ventana === 'tramo' ? ' — solo cuentan las ventas de esas fechas'
                               : ' — cuentan todas las ventas del mes'
    partes.push(f + '.')
  }
  if ((c.premioModo || 'podio') === 'porVenta') {
    if (Number(c.importePorVenta) > 0) partes.push(`Se paga ${fmtEur(Number(c.importePorVenta))} por venta realizada.`)
    if (Number(c.minIndividual) > 0) partes.push(`Mínimo individual: ${c.minIndividual} venta(s) para cobrar.`)
    if (Number(c.minGrupal) > 0) partes.push(`Mínimo de equipo: ${c.minGrupal} venta(s) entre todos.`)
    if (Number(c.topeBote) > 0) partes.push(`Bote máximo: ${fmtEur(Number(c.topeBote))} entre todos, por orden de venta.`)
  }
  if (c.notas) partes.push(String(c.notas))
  return partes.join(' ')
}

// ── El EXTRA del torneo, camino de la NÓMINA (dueño, 24-ago-2026) ────────────
// «Si se cumplen los parámetros de cobro, como cualquier otra venta»: lo ganado
// en el modo porVenta entra en las comisiones del comercial como un bono más.
// Devuelve, por vendedor, los conceptos a añadir. Mismo reparto que el ranking
// (repartoPorVenta: fechas, tramo y tope por orden de fecha); anuladas fuera y
// Marta fuera, igual que en el ranking. Lo consumen el hook del Panel y
// /api/comisiones-liquidacion — la MISMA cifra en pantalla y en el ERP.
export interface TorneoExtraConcepto { concepto: string; detalle: string; importe: number }

export function torneoExtrasPorVendedor(
  sales: any[], cfg: TorneosConfig, catalogs?: Record<string, any[]>,
): Record<string, TorneoExtraConcepto[]> {
  const out: Record<string, TorneoExtraConcepto[]> = {}
  const norm = (v: any) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  for (const c of cfg.concursos) {
    if ((c.premioModo || 'podio') !== 'porVenta') continue
    if (!(Number(c.importePorVenta) > 0)) continue
    const items: { name: string; sale: any }[] = []
    for (const s of sales) {
      const vend = String(s.vendedor || '').trim()
      if (!vend || norm(vend) === 'marta') continue
      if (norm(s.anulado) === 'si' || norm(s.pendiente) === 'anulado') continue
      items.push({ name: vend, sale: s })
    }
    const rep = repartoPorVenta(items, c, catalogs)
    for (const f of rep.filas) {
      if (f.ganado <= 0) continue
      const rate = Number(c.importePorVenta) || 0
      const cobradas = rate > 0 ? Math.round(f.ganado / rate) : f.ventas
      ;(out[f.name] = out[f.name] || []).push({
        concepto: c.nombre || 'Extra del torneo',
        // Si el bote cortó, se dice claro: «1 de 2 venta(s)» — cobró 1, hizo 2.
        detalle: (cobradas < f.ventas ? `${cobradas} de ${f.ventas}` : `${f.ventas}`)
          + ` venta(s) × ${fmtEur(rate)}`
          + (rep.tope > 0 ? ` · bote ${fmtEur(rep.tope)}` : ''),
        importe: f.ganado,
      })
    }
  }
  return out
}

export function fmtEur(v: number): string {
  return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// Texto corto de un premio para mostrarlo (ej. "100 € · Cena")
export function premioLabel(p: TorneoPremio): string {
  const parts: string[] = []
  if (p.importe > 0) parts.push(fmtEur(p.importe))
  if (p.texto) parts.push(p.texto)
  return parts.join(' · ') || '—'
}
