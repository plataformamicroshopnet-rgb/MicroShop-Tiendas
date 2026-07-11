import { matchesRule, getValueForRule } from '@/hooks/useComisionesData'

// ─── Configurador del Dashboard Tiempo Real (home) ──────────────────────────
// Config GLOBAL (persiste de un mes a otro; se edita en /config-dashboard).
// Port del sistema del FFVV al idioma de Tiendas: cada bloque declara QUÉ
// ventas le cuentan con el MISMO selector de tipo de venta que Reglas Globales
// y Torneos (ProductTreeSelector → string de tokens) y el MISMO matching
// (matchesRule/getValueForRule). El bloque de Torneos NO va aquí: ya tiene su
// torneos_config propio. Patrón: default retrocompatible que reproduce el
// dashboard histórico + parser defensivo + loader con fallback.
// ─────────────────────────────────────────────────────────────────────────────

export type DashMetrica = 'count' | 'importe' | 'comisiones' | 'clientesMulti'
export type DashAmbitoMvp = 'MES' | 'HOY'

export interface DashBloqueTipos {
  nombre: string
  /** Tipo de venta en formato ProductTreeSelector (tokens separados por coma).
   *  VACÍO = cuentan TODAS las ventas activas (p.ej. Facturación). */
  tipoVenta: string
  metrica: DashMetrica
}

export interface DashKpi extends DashBloqueTipos {
  id: string
  /** Objetivo mensual. 0 = AUTOMÁTICO: se toma de la regla del mes con este
   *  mismo nombre (objPrimerTramo), como hacía el dashboard de siempre. */
  objetivo: number
}
export interface DashMedalla extends DashBloqueTipos { id: string; emoji: string }

export interface DashboardConfig {
  /** Ámbito del bloque MVP: MES = líderes del mes completo (coherente con la
   *  etiqueta); HOY = líderes del día con relevo al mes por apartado. */
  mvpAmbito: DashAmbitoMvp
  mvpPrincipal: DashBloqueTipos
  mvpNominado1: DashBloqueTipos
  mvpNominado2: DashBloqueTipos
  kpis: DashKpi[]          // 1-8; el primero ocupa la fila completa con el reto diario
  carrera: DashBloqueTipos
  medallas: DashMedalla[]  // 0-3
}

export const DASHBOARD_CONFIG_KEY = 'dashboard_config'
export const MAX_KPIS = 8
export const MAX_MEDALLAS = 3

/** Sentinela de tipoVenta: AUTOMÁTICO. El bloque sigue a la regla del mes que
 *  se llame igual que él (productosCuentan para el matching; objPrimerTramo
 *  para el objetivo si objetivo=0) — el comportamiento de la home de siempre.
 *  El consumidor (home) resuelve el sentinela contra tiendaRules; si llega sin
 *  resolver, bloqueMatches usa el nombre del bloque como token de respaldo. */
export const TIPO_AUTO = 'AUTO'

/** Objetivos de respaldo históricos por KPI (los que la home traía a fuego):
 *  se usan en modo automático cuando el mes no tiene regla homónima. */
export const OBJETIVO_FALLBACKS: Record<string, number> = {
  'Dispositivos + Seguros': 96542,
  'Alta BAF Total': 87,
  'Alta BAF Convergente': 53,
  'Swap': 1,
  'FTTR': 8,
  'ARPU Acumulado': 50000,
  'Repo Fútbol': 34,
}

// Config por defecto = EXACTAMENTE los bloques que el dashboard traía
// hardcodeados, para que sin tocar nada se vea lo mismo de siempre.
// Los objetivos a 0 son "automático" (regla del mes por nombre); los KPIs
// que históricamente tenían fallback numérico lo conservan aquí.
export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  mvpAmbito: 'MES',
  mvpPrincipal: { nombre: 'Facturación', tipoVenta: '', metrica: 'importe' },
  mvpNominado1: { nombre: 'Ventas miMovistar', tipoVenta: 'miMovistar', metrica: 'count' },
  mvpNominado2: { nombre: 'Héroe Disp. + Seguros', tipoVenta: 'Dispositivos + Seguros', metrica: 'importe' },
  // KPIs y carrera en AUTOMÁTICO: siguen a la regla del mes homónima (tipos de
  // venta Y objetivo), exactamente como la home de siempre. Objetivo 0 = auto.
  kpis: [
    { id: 'k1', nombre: 'Dispositivos + Seguros', tipoVenta: TIPO_AUTO, metrica: 'importe', objetivo: 0 },
    { id: 'k2', nombre: 'Alta BAF Total', tipoVenta: TIPO_AUTO, metrica: 'count', objetivo: 0 },
    { id: 'k3', nombre: 'Alta BAF Convergente', tipoVenta: TIPO_AUTO, metrica: 'count', objetivo: 0 },
    { id: 'k4', nombre: 'Swap', tipoVenta: 'Swap', metrica: 'count', objetivo: 0 },
    { id: 'k5', nombre: 'FTTR', tipoVenta: TIPO_AUTO, metrica: 'count', objetivo: 0 },
    { id: 'k6', nombre: 'ARPU Acumulado', tipoVenta: TIPO_AUTO, metrica: 'importe', objetivo: 0 },
    { id: 'k7', nombre: 'Repo Fútbol', tipoVenta: TIPO_AUTO, metrica: 'count', objetivo: 0 },
  ],
  carrera: { nombre: 'Alta BAF Convergente', tipoVenta: TIPO_AUTO, metrica: 'count' },
  medallas: [
    { id: 'm1', nombre: 'Rey de Dispositivos', tipoVenta: 'Dispositivos + Seguros', metrica: 'importe', emoji: '👑' },
    { id: 'm2', nombre: 'El Pulpo (clientes multi-paquete)', tipoVenta: '', metrica: 'clientesMulti', emoji: '🐙' },
    { id: 'm3', nombre: 'Rey del Swap', tipoVenta: 'Swap', metrica: 'count', emoji: '🔁' },
  ],
}

const parseBloque = (raw: any, fallback: DashBloqueTipos): DashBloqueTipos => {
  if (!raw || typeof raw !== 'object') return { ...fallback }
  return {
    // Nombre vacío EXPLÍCITO se respeta (= descartar en las listas); solo cae
    // al default si el campo ni siquiera viene en el JSON.
    nombre: raw.nombre === undefined || raw.nombre === null ? fallback.nombre : String(raw.nombre).trim(),
    tipoVenta: raw.tipoVenta === undefined || raw.tipoVenta === null ? fallback.tipoVenta : String(raw.tipoVenta),
    metrica: raw.metrica === 'importe' || raw.metrica === 'comisiones' || raw.metrica === 'clientesMulti' ? raw.metrica : 'count',
  }
}

// Los bloques FIJOS (MVP, carrera) no se pueden descartar: nombre vacío → default.
const parseBloqueFijo = (raw: any, fallback: DashBloqueTipos): DashBloqueTipos => {
  const b = parseBloque(raw, fallback)
  if (!b.nombre) b.nombre = fallback.nombre
  return b
}

export function parseDashboardConfig(raw: any): DashboardConfig {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!obj || typeof obj !== 'object') return DEFAULT_DASHBOARD_CONFIG
    const d = DEFAULT_DASHBOARD_CONFIG
    const kpis = (Array.isArray(obj.kpis) && obj.kpis.length > 0 ? obj.kpis : d.kpis)
      .slice(0, MAX_KPIS)
      .map((k: any, i: number) => ({
        ...parseBloque(k, d.kpis[Math.min(i, d.kpis.length - 1)]),
        id: String(k?.id || `k${i + 1}`),
        objetivo: Math.max(0, Number(k?.objetivo) || 0),
      }))
      .filter((k: DashKpi) => k.nombre)
    const medallas = (Array.isArray(obj.medallas) ? obj.medallas : d.medallas)
      .slice(0, MAX_MEDALLAS)
      .map((m: any, i: number) => ({
        ...parseBloque(m, d.medallas[Math.min(i, d.medallas.length - 1)]),
        id: String(m?.id || `m${i + 1}`),
        emoji: Array.from(String(m?.emoji || '🏅')).slice(0, 2).join(''),
      }))
      .filter((m: DashMedalla) => m.nombre)
    return {
      mvpAmbito: obj.mvpAmbito === 'HOY' ? 'HOY' : 'MES',
      mvpPrincipal: parseBloqueFijo(obj.mvpPrincipal, d.mvpPrincipal),
      mvpNominado1: parseBloqueFijo(obj.mvpNominado1, d.mvpNominado1),
      mvpNominado2: parseBloqueFijo(obj.mvpNominado2, d.mvpNominado2),
      kpis,
      carrera: parseBloqueFijo(obj.carrera, d.carrera),
      medallas,
    }
  } catch { /* config corrupta → por defecto */ }
  return DEFAULT_DASHBOARD_CONFIG
}

export async function loadDashboardConfig(): Promise<DashboardConfig> {
  try {
    const res = await fetch(`/api/settings?key=${DASHBOARD_CONFIG_KEY}`)
    const data = await res.json()
    if (data && data.value) return parseDashboardConfig(data.value)
  } catch { /* sin red → por defecto */ }
  return DEFAULT_DASHBOARD_CONFIG
}

// ─── Matching y valor por venta (mismo motor que Comisiones y Torneos) ──────

/** ¿Esta venta pertenece al bloque? tipoVenta vacío = todas las ventas.
 *  TIPO_AUTO debe resolverse ANTES (home: productosCuentan de la regla del
 *  mes); si llega sin resolver, se usa el nombre del bloque como token. */
export function bloqueMatches(sale: any, b: DashBloqueTipos): boolean {
  const tv = String(b.tipoVenta || '').trim()
  if (!tv) return true
  const tokens = tv === TIPO_AUTO ? b.nombre : tv
  return matchesRule(sale, b.nombre, tokens)
}

/** Aportación de UNA venta (0 si no cuenta; 1 si count; € si importe).
 *  'clientesMulti' y 'comisiones' devuelven 0: se agregan en el consumidor
 *  (por NIF, o con getSaleCommission por comercial). */
export function bloqueSaleValue(sale: any, b: DashBloqueTipos, catalogs?: Record<string, any[]>): number {
  if (b.metrica === 'clientesMulti' || b.metrica === 'comisiones') return 0
  if (!bloqueMatches(sale, b)) return 0
  return b.metrica === 'importe' ? (getValueForRule(sale, b.nombre, catalogs) || 0) : 1
}

export function fmtEur(v: number): string {
  return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function fmtValor(v: number, metrica: DashMetrica): string {
  return metrica === 'importe' || metrica === 'comisiones' ? fmtEur(v) : String(Math.round(v))
}
