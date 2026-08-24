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

// Ventana de ventas cuando el concurso lleva fechas (petición del dueño,
// 24-ago-2026): 'mes' = cuentan TODAS las ventas del mes que se está viendo
// (retroactivo a principios de mes); 'tramo' = SOLO las ventas cuya fecha cae
// dentro de [fechaInicio, fechaFin]. Sin fechas, el concurso es permanente y
// se comporta como siempre (todas las ventas del mes visto).
export type TorneoVentana = 'mes' | 'tramo'

export interface Concurso {
  id: string
  nombre: string
  tipoVenta: string    // valor del ProductTreeSelector (igual que Reglas Globales)
  metrica: TorneoMetrica
  premios: TorneoPremio[]
  fechaInicio?: string   // 'YYYY-MM-DD' — vacío = sin límite (concurso permanente)
  fechaFin?: string      // 'YYYY-MM-DD' — vacío = sin límite
  ventana?: TorneoVentana  // solo pinta algo si hay fechas; por defecto 'mes'
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
