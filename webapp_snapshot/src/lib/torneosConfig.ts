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
  fechaInicio2?: string  // 2º TRAMO (opcional, dueño 25-ago-2026): el concurso
  fechaFin2?: string     //   descansa y VUELVE a jugar entre estas fechas
  ventana?: TorneoVentana  // solo pinta algo si hay fechas; por defecto 'mes'
  premioModo?: TorneoPremioModo  // por defecto 'podio'
  importePorVenta?: number       // solo modo 'porVenta': € por venta
  topeBote?: number              // solo modo 'porVenta': tope total (0 = sin tope)
  minIndividual?: number         // solo 'porVenta': ventas mínimas PROPIAS para cobrar (0 = sin mínimo)
  minGrupal?: number             // solo 'porVenta': ventas mínimas ENTRE TODOS — sin llegar, no cobra nadie
  objetivo2Grupal?: number       // solo 'porVenta' (dueño, 25-ago-2026): 2º OBJETIVO de equipo (ventas)
  importePorVenta2?: number      //   al llegar, TODAS las ventas pasan a pagarse a este importe (retroactivo)
  objetivo2PctMin?: number       //   «mínimo el X%»: el salto al 2º importe exige ADEMÁS llegar a ese
                                 //   % del objetivo de la palanca del MES. LO COMPRUEBA EL MOTOR
                                 //   (dueño, 30-ago-2026: «las unidades son orientativas — pueden dar
                                 //   bajas y después tramitarlas; la manera de que no ocurra es con
                                 //   los porcentajes»)
  gatePctPalanca?: number        //   candado de COBRO: sin llegar a este % del objetivo de la palanca
                                 //   del MES, el torneo entero paga 0 (sustituye a la nota a mano
                                 //   «imprescindible llegar al 100%…»). También lo comprueba el motor.
  palancaRef?: string            // regla de comisiones de referencia de los CANDADOS del motor
  minGrupalPct?: number          // ⚰️ RETIRADO (30-ago-2026): convertía el % del MES en un mínimo de la
  objetivo2Pct?: number          //   VENTANA del torneo y pisó los números del dueño (29→67, 39→78).
                                 //   Se conservan en el tipo por los JSON viejos; NADIE los aplica ya.
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
        fechaInicio2: fechaOk(c.fechaInicio2),
        fechaFin2: fechaOk(c.fechaFin2),
        ventana: c.ventana === 'tramo' ? 'tramo' as const : 'mes' as const,
        premioModo: c.premioModo === 'porVenta' ? 'porVenta' as const : 'podio' as const,
        importePorVenta: Number(c.importePorVenta) || 0,
        topeBote: Number(c.topeBote) || 0,
        minIndividual: Math.max(0, Math.floor(Number(c.minIndividual) || 0)),
        minGrupal: Math.max(0, Math.floor(Number(c.minGrupal) || 0)),
        objetivo2Grupal: Math.max(0, Math.floor(Number(c.objetivo2Grupal) || 0)),
        importePorVenta2: Number(c.importePorVenta2) || 0,
        objetivo2PctMin: Math.max(0, Number(c.objetivo2PctMin) || 0),
        gatePctPalanca: Math.max(0, Number(c.gatePctPalanca) || 0),
        palancaRef: String(c.palancaRef || '').trim(),
        minGrupalPct: Math.max(0, Number(c.minGrupalPct) || 0),
        objetivo2Pct: Math.max(0, Number(c.objetivo2Pct) || 0),
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

// Los tramos de juego del concurso (0, 1 o 2), ordenados por fecha. El 2º
// tramo (dueño, 25-ago-2026) comparte TODO con el 1º — mismo ranking y mismo
// bote —: el concurso simplemente descansa entre uno y otro y vuelve a jugar.
export function tramosDelConcurso(c: Concurso): { ini: string; fin: string }[] {
  const ts: { ini: string; fin: string }[] = []
  if (c.fechaInicio || c.fechaFin) ts.push({ ini: c.fechaInicio || '', fin: c.fechaFin || '' })
  if (c.fechaInicio2 || c.fechaFin2) ts.push({ ini: c.fechaInicio2 || '', fin: c.fechaFin2 || '' })
  return ts.sort((a, b) => ((a.ini || a.fin) < (b.ini || b.fin) ? -1 : 1))
}

// ¿Esta venta entra en la ventana del concurso? Sin fechas → siempre. Con
// fechas y ventana 'tramo' → solo si su fecha cae dentro de ALGÚN tramo. Con
// ventana 'mes' las fechas NO filtran ventas (solo dicen cuándo juega).
export function ventaEnVentana(sale: any, c: Concurso): boolean {
  if (c.ventana !== 'tramo') return true
  const tramos = tramosDelConcurso(c)
  if (tramos.length === 0) return true
  const f = saleFechaISO(sale)
  if (!f) return false                       // sin fecha legible no puede competir en un tramo
  return tramos.some(t => !(t.ini && f < t.ini) && !(t.fin && f > t.fin))
}

// ¿El concurso tiene algo que ver con el MES que se está mirando? Sin fechas,
// siempre. Con fechas, solo si [inicio, fin] pisa algún día de ese mes — si no,
// el ranking de ese mes NO debe pintarse (saldría todo a 0,00 € repartiendo
// medallas entre empatados a cero, que fue lo que vio el dueño el 24-ago).
export function concursoJuegaEnMes(c: Concurso, year: number, month: number): boolean {
  const tramos = tramosDelConcurso(c)
  if (tramos.length === 0) return true
  const mm = String(month).padStart(2, '0')
  const mesIni = `${year}-${mm}-01`
  const mesFin = `${year}-${mm}-31`
  return tramos.some(t => !(t.fin && t.fin < mesIni) && !(t.ini && t.ini > mesFin))
}

// Estado del concurso HOY, para el chip del ranking: null = permanente (sin chip).
export function estadoConcurso(c: Concurso, hoyISO?: string): { txt: string; color: string } | null {
  const tramos = tramosDelConcurso(c)
  if (tramos.length === 0) return null
  const hoy = hoyISO || new Date().toISOString().slice(0, 10)
  const d = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  for (let i = 0; i < tramos.length; i++) {
    const t = tramos[i]
    if (t.ini && hoy < t.ini) {
      // aún no llega este tramo: antes del 1º «empieza», entre tramos «descansa»
      return i === 0 ? { txt: `⏳ empieza el ${d(t.ini)}`, color: '#64748b' }
                     : { txt: `⏳ descansando — vuelve el ${d(t.ini)}`, color: '#64748b' }
    }
    if (!t.fin || hoy <= t.fin) {
      const partes = []
      if (t.ini) partes.push(`desde el ${d(t.ini)}`)
      if (t.fin) partes.push(`hasta el ${d(t.fin)}`)
      const sig = tramos[i + 1]
      const vuelta = sig && sig.ini ? ` · vuelve el ${d(sig.ini)}` : ''
      return { txt: `🟢 en juego ${partes.join(' ')}${vuelta}`, color: '#16a34a' }
    }
  }
  return { txt: `🏁 finalizado el ${d(tramos[tramos.length - 1].fin)}`, color: '#7c3aed' }
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

// ── OBJETIVOS EN % DEL OBJETIVO DE LA PALANCA (dueño, 26-ago-2026) ──────────
// «Llegar al 100%» = el PRIMER objetivo de la palanca de comisiones del mes,
// entero (Convergente: 67 → el 115% son 77). Así el torneo sigue solo a los
// objetivos cuando cambian de mes — y como el equipo se mide con las MISMAS
// ventas que la palanca, las bajas que excluye la liquidación bajan el marcador
// y el torneo se re-evalúa igual que las comisiones. El configurador guarda
// TAMBIÉN las unidades resueltas: si aquí no llegan reglas, valen esas.
const normTxt = (v: any) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export function reglaDeReferencia(c: Concurso, reglas: any[]): any | null {
  if (!Array.isArray(reglas) || reglas.length === 0) return null
  const ref = normTxt(c.palancaRef)
  if (ref) {
    const porNombre = reglas.find(r => normTxt(r?.nombre) === ref)
    if (porNombre) return porNombre
  }
  const tipo = normTxt(c.tipoVenta)
  if (!tipo) return null
  return reglas.find(r => normTxt(r?.nombre) === tipo)
      || reglas.find(r => normTxt(r?.productosCuentan) === tipo)
      || null
}

// ⚰️ RETIRADA (30-ago-2026): convertía minGrupalPct/objetivo2Pct (% del objetivo
// del MES de la palanca) en mínimos de ventas de la VENTANA del torneo — dos
// universos distintos: al dueño le pisó 29→67 y 39→78. Los % de verdad son los
// candados del motor (gatePctPalanca / objetivo2PctMin) dentro de repartoPorVenta.
// Se deja exportada por compatibilidad; ya no la llama nadie.
export function resolverObjetivosTorneo(c: Concurso, reglas: any[]): Concurso {
  const minPct = Number(c.minGrupalPct) || 0
  const obj2Pct = Number(c.objetivo2Pct) || 0
  if (minPct <= 0 && obj2Pct <= 0) return c
  const regla = reglaDeReferencia(c, reglas)
  const obj1 = regla ? (parseFloat(String(regla.objPrimerTramo ?? '').replace(',', '.')) || 0) : 0
  if (!(obj1 > 0)) return c        // sin la palanca a mano: valen las unidades guardadas
  const out = { ...c }
  if (minPct > 0) out.minGrupal = Math.round(obj1 * minPct / 100)
  if (obj2Pct > 0) out.objetivo2Grupal = Math.round(obj1 * obj2Pct / 100)
  return out
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
  rateActual: number          // € por venta que SE ESTÁ pagando (el 2º importe si el equipo llegó)
  objetivo2Grupal: number     // 0 = sin 2º objetivo
  importePorVenta2: number
  objetivo2Cumplido: boolean  // al cumplirse, TODAS las ventas pasan al 2º importe
  // Candados en % contra la palanca del MES (dueño, 30-ago-2026):
  pctPalanca: number | null   // % del objetivo de la palanca que lleva el equipo (null = no medible)
  gatePctPalanca: number      // 0 = sin candado de cobro
  gateCumplido: boolean       // sin cumplirse, el torneo entero paga 0 (todo queda «en juego»)
  objetivo2PctMin: number     // 0 = el 2º importe solo exige las ventas del 2º objetivo
}

export function repartoPorVenta(items: { name: string; sale: any }[], c: Concurso,
                                catalogs?: Record<string, any[]>, reglas?: any[]): RepartoPorVenta {
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
  // 2º OBJETIVO del premio (dueño, 25-ago-2026): al llegar el equipo a esas
  // ventas, TODAS las que puntúan pasan al 2º importe — retroactivo, igual que
  // los tramos de las palancas (ej.: de 5 € a 10 € por venta).
  const obj2 = Math.max(0, Math.floor(Number(c.objetivo2Grupal) || 0))
  const rate2 = Number(c.importePorVenta2) || 0
  // ── Candados en % contra la palanca del MES (dueño, 30-ago-2026) ──────────
  // «Las unidades son orientativas: pueden dar bajas y después tramitarlas; la
  // manera de que no ocurra es con los porcentajes.» Se mide el contador de la
  // palanca de referencia sobre el MES ENTERO (el mismo universo que su fila
  // del Panel), no solo la ventana del torneo. Si el candado está puesto y no
  // se puede medir (llamador sin reglas, o palanca sin objetivo), NO se paga:
  // mejor quedarse corto que pagar sin comprobar.
  const gatePct = Math.max(0, Number(c.gatePctPalanca) || 0)
  const pctMin2 = Math.max(0, Number(c.objetivo2PctMin) || 0)
  let pctPalanca: number | null = null
  if (gatePct > 0 || pctMin2 > 0) {
    const regla = reglaDeReferencia(c, reglas || [])
    const obj1 = regla ? (parseFloat(String(regla.objPrimerTramo ?? '').replace(',', '.')) || 0) : 0
    if (regla && obj1 > 0) {
      let uds = 0
      for (const { sale } of items) if (matchesRule(sale, regla.nombre, regla.productosCuentan)) uds++
      pctPalanca = uds / obj1 * 100
    }
  }
  const gateCumplido = gatePct <= 0 || (pctPalanca !== null && pctPalanca >= gatePct)
  const objetivo2Cumplido = obj2 > 0 && rate2 > 0 && teamVentas >= obj2
    && (pctMin2 <= 0 || (pctPalanca !== null && pctPalanca >= pctMin2))
  const rate = objetivo2Cumplido ? rate2 : (Number(c.importePorVenta) || 0)
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
  // El candado del % corta el COBRO igual que el mínimo grupal: todo queda
  // «en juego» (en ámbar) hasta que la palanca llegue a su %.
  const seCobra = grupalCumplido && gateCumplido
  const filas = Object.entries(porNombre)
    .map(([name, v]) => ({ name, ventas: v.ventas, enJuego: v.enJuego,
                           ganado: seCobra ? v.enJuego : 0,
                           cumpleMin: (conteo[name] || 0) >= minInd }))
    .sort((a, b) => b.ventas - a.ventas || b.enJuego - a.enJuego)
  const enJuegoTotal = filas.reduce((acc, f) => acc + f.enJuego, 0)
  const repartido = seCobra ? enJuegoTotal : 0
  return { filas, repartido, enJuegoTotal, tope, agotado: tope > 0 && restante < rate,
           teamVentas, minIndividual: minInd, minGrupal: minGrp, grupalCumplido,
           rateActual: rate, objetivo2Grupal: obj2, importePorVenta2: rate2, objetivo2Cumplido,
           pctPalanca, gatePctPalanca: gatePct, gateCumplido, objetivo2PctMin: pctMin2 }
}

// ── Las NOTAS del concurso se escriben SOLAS desde sus condiciones ──────────
// (mismo criterio que el «OJO» de las palancas: lo que se lee es exactamente
// lo que se paga; nada a mano que se pueda quedar viejo). La nota manual del
// configurador, si existe, se añade detrás.
export function generaNotasConcurso(c: Concurso): string {
  const partes: string[] = []
  const d = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  const tramos = tramosDelConcurso(c)
  if (tramos.length > 0) {
    let f = 'Juega'
    tramos.forEach((t, i) => {
      if (i > 0) f += ' y'
      if (t.ini) f += ` del ${d(t.ini)}`
      if (t.fin) f += ` al ${d(t.fin)}`
    })
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
  // El candado de cobro en % — LO COMPRUEBA EL MOTOR (30-ago-2026).
  if ((c.premioModo || 'podio') === 'porVenta' && Number(c.gatePctPalanca) > 0) {
    partes.push(`Imprescindible llegar al ${c.gatePctPalanca}% del objetivo`
      + ` de ${c.palancaRef || c.tipoVenta || 'la palanca'} — lo comprueba el programa.`)
  }
  if (c.notas) partes.push(String(c.notas))
  // La frase del 🎯 CIERRA el cartel (dueño, 30-ago-2026): primero las reglas
  // base y la letra del concurso, y el premio gordo al final. El «mínimo el X%»
  // también lo comprueba el motor (candado del 2º importe).
  if ((c.premioModo || 'podio') === 'porVenta'
      && Number(c.importePorVenta2) > 0 && Number(c.objetivo2Grupal) > 0) {
    partes.push(`🎯 Al llegar el equipo a ${c.objetivo2Grupal} venta(s)`
      + (Number(c.objetivo2PctMin) > 0 ? ` mínimo el ${c.objetivo2PctMin}%` : '')
      + `, TODAS pasan a ${fmtEur(Number(c.importePorVenta2))} por venta.`)
  }
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

// El nombre del vendedor viene TECLEADO (el Registro de Operaciones lo deja
// libre): 'ELENA' y 'Elena' son la misma persona, pero agrupando en crudo se
// partían su mínimo individual, su turno en el bote y su fila. Se canoniza a la
// PRIMERA grafía vista, así una persona = una sola cuenta.
export function canonizaVendedores(sales: any[]): (v: any) => string {
  const n = (v: any) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const primera: Record<string, string> = {}
  for (const s of sales) {
    const bruto = String(s?.vendedor || '').trim()
    if (!bruto) continue
    const k = n(bruto)
    if (!primera[k]) primera[k] = bruto
  }
  return (v: any) => primera[n(v)] || String(v || '').trim()
}

export function torneoExtrasPorVendedor(
  sales: any[], cfg: TorneosConfig, catalogs?: Record<string, any[]>, reglas?: any[],
): Record<string, TorneoExtraConcepto[]> {
  const out: Record<string, TorneoExtraConcepto[]> = {}
  const canon = canonizaVendedores(sales)
  const norm = (v: any) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  for (const cRaw of cfg.concursos) {
    // resolverObjetivosTorneo RETIRADO (30-ago-2026): los % son los candados del motor.
    const c = cRaw
    if ((c.premioModo || 'podio') !== 'porVenta') continue
    if (!(Number(c.importePorVenta) > 0)) continue
    const items: { name: string; sale: any }[] = []
    for (const s of sales) {
      const vend = String(s.vendedor || '').trim()
      if (!vend || norm(vend) === 'marta') continue
      if (norm(s.anulado) === 'si' || norm(s.pendiente) === 'anulado') continue
      items.push({ name: canon(vend), sale: s })
    }
    const rep = repartoPorVenta(items, c, catalogs, reglas)
    for (const f of rep.filas) {
      if (f.ganado <= 0) continue
      const rate = rep.rateActual || 0
      const cobradas = rate > 0 ? Math.round(f.ganado / rate) : f.ventas
      ;(out[f.name] = out[f.name] || []).push({
        concepto: c.nombre || 'Extra del torneo',
        // Si el bote cortó, se dice claro: «1 de 2 venta(s)» — cobró 1, hizo 2.
        detalle: (cobradas < f.ventas ? `${cobradas} de ${f.ventas}` : `${f.ventas}`)
          + ` venta(s) × ${fmtEur(rate)}`
          + (rep.objetivo2Cumplido ? ' · 🎯 2º objetivo' : '')
          + (rep.tope > 0 ? ` · bote ${fmtEur(rep.tope)}` : ''),
        importe: f.ganado,
      })
    }
  }
  return out
}

// ── LO QUE ESTÁ EN JUEGO (dueño, 26-ago-2026) ────────────────────────────────
// La tabla de Comisiones se quedaba MUDA mientras el torneo no llega al mínimo
// de equipo: sin cobro no hay concepto (torneoExtrasPorVendedor salta las filas
// con ganado 0) y el comercial no veía lo que se juega. Esta hermana emite ESE
// dinero pendiente — y SOLO ese: en cuanto el equipo llega, el importe pasa a
// cobrarse por el carril normal y aquí ya no sale nada, para no contarlo dos
// veces. NUNCA suma a totalExtras ni viaja al ERP: es información en pantalla.
export interface TorneoEnJuegoConcepto {
  concepto: string      // nombre del torneo
  ventas: number        // ventas suyas que puntúan
  cobrables: number     // de esas, las que caben en el bote (puede ser menos)
  rate: number          // € por venta que se estarían pagando
  enJuego: number       // € que llevaría si el equipo llega al mínimo
  teamVentas: number    // ventas del equipo dentro de la ventana
  minGrupal: number     // mínimo de equipo que falta por alcanzar
  faltan: number        // minGrupal - teamVentas
}

/** Opciones del carril «en juego»: `mesVisto`/`hoyISO` evitan prometer dinero de
 *  un torneo que ya terminó; `rosterNombres` limita el equipo a la plantilla del
 *  mes, el mismo universo que enseña la pantalla de Torneos. */
export interface TorneoEnJuegoOpciones {
  mesVisto?: string
  hoyISO?: string
  rosterNombres?: string[]
}

export function torneoEnJuegoPorVendedor(
  sales: any[], cfg: TorneosConfig, catalogs?: Record<string, any[]>, reglas?: any[],
  opciones?: TorneoEnJuegoOpciones,
): Record<string, TorneoEnJuegoConcepto[]> {
  const out: Record<string, TorneoEnJuegoConcepto[]> = {}
  const norm = (v: any) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const canon = canonizaVendedores(sales)
  const hoy = opciones?.hoyISO || new Date().toISOString().slice(0, 10)
  // Un mes ya cerrado no admite ventas nuevas: lo que no se ganó, no se gana.
  if (opciones?.mesVisto && opciones.mesVisto < periodKeyActual()) return out
  const roster = opciones?.rosterNombres && opciones.rosterNombres.length
    ? new Set(opciones.rosterNombres.map(norm))
    : null
  for (const cRaw of cfg.concursos) {
    // resolverObjetivosTorneo RETIRADO (30-ago-2026): los % son los candados del motor.
    const c = cRaw
    if ((c.premioModo || 'podio') !== 'porVenta') continue
    if (!(Number(c.importePorVenta) > 0)) continue
    // Torneo con la ventana ya cerrada: nadie puede sumar una venta más, así que
    // no hay nada «en juego» (la pantalla de Torneos lo marca 🏁 finalizado).
    const est = estadoConcurso(c, hoy)
    if (est && est.txt.startsWith('🏁')) continue
    const items: { name: string; sale: any }[] = []
    for (const s of sales) {
      const vend = String(s.vendedor || '').trim()
      if (!vend || norm(vend) === 'marta') continue
      if (roster && !roster.has(norm(vend))) continue
      if (norm(s.anulado) === 'si' || norm(s.pendiente) === 'anulado') continue
      items.push({ name: canon(vend), sale: s })
    }
    const rep = repartoPorVenta(items, c, catalogs)
    // Solo mientras el mínimo de equipo NO se ha alcanzado: con él cumplido, el
    // dinero ya sale como cobrado en la fila de extras de siempre.
    if (rep.grupalCumplido) continue
    for (const f of rep.filas) {
      if (f.enJuego <= 0) continue
      const rate = rep.rateActual || 0
      // Con tope de bote no todas sus ventas llevan dinero: se dice cuántas
      // caben, igual que hace la fila ya cobrada («3 de 5 venta(s)»).
      const cobrables = rate > 0 ? Math.round(f.enJuego / rate) : f.ventas
      ;(out[f.name] = out[f.name] || []).push({
        concepto: c.nombre || 'Extra del torneo',
        ventas: f.ventas,
        cobrables,
        rate,
        enJuego: f.enJuego,
        teamVentas: rep.teamVentas,
        minGrupal: rep.minGrupal,
        faltan: Math.max(0, rep.minGrupal - rep.teamVentas),
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
