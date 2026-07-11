import { matchesRule, getValueForRule } from '@/hooks/useComisionesData'

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

export interface Concurso {
  id: string
  nombre: string
  tipoVenta: string    // valor del ProductTreeSelector (igual que Reglas Globales)
  metrica: TorneoMetrica
  premios: TorneoPremio[]
}

export interface TorneosConfig {
  concursos: Concurso[]
}

export const TORNEOS_CONFIG_KEY = 'torneos_config'
export const MAX_CONCURSOS = 3

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

// Aportación de UNA venta a UN concurso (0 si no cuenta; 1 si métrica nº; € si métrica importe).
// Usa EXACTAMENTE el mismo matching/valor que el panel de Comisiones.
export function concursoSaleValue(sale: any, concurso: Concurso, catalogs?: Record<string, any[]>): number {
  // La métrica 'comisiones' NO se mide venta a venta: el ranking es el total de
  // comisiones del mes de cada comercial (getSaleCommission, la misma receta que
  // Liquidación/Rentabilidad por Tiendas) y se agrega por comercial FUERA de esta
  // función, en la pantalla de Torneos. Aquí devolvemos 0 para no sumar nada.
  if (concurso.metrica === 'comisiones') return 0
  if (!matchesRule(sale, concurso.nombre, concurso.tipoVenta)) return 0
  return concurso.metrica === 'importe' ? (getValueForRule(sale, concurso.nombre, catalogs) || 0) : 1
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
