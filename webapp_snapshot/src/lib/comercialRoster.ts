import { TIENDAS_COMERCIALES } from './constants'

// ─── Plantilla de comerciales POR PERIODO ────────────────────────────────────
// El panel "2. Horarios de Comerciales" (tabla tiendaComercialHour, con periodKey)
// es la PLANTILLA OFICIAL del mes: define quién es comercial, de qué tienda y sus
// horas. Estas funciones traducen esas filas a las estructuras que esperan las
// pantallas, con RED DE SEGURIDAD: si un mes no tiene horarios configurados, se
// usa la lista fija de siempre (TIENDAS_COMERCIALES) para no descuadrar el
// histórico. O2/Marta se gestiona en su propio panel, así que aquí va siempre fijo.
// ─────────────────────────────────────────────────────────────────────────────

export interface HourRow {
  comercial?: string
  tienda?: string | null
  horario?: number | string
  email?: string | null
}

export const norm = (s: any) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Lista fija de tiendas físicas (sin O2) para los desplegables del panel
export const TIENDAS_FISICAS = Object.keys(TIENDAS_COMERCIALES).filter(t => t !== 'O2')

// Mapa heredado nombre -> tienda (para rellenar la tienda de filas antiguas sin ella)
const legacyNameToTienda: Record<string, string> = (() => {
  const m: Record<string, string> = {}
  for (const [t, names] of Object.entries(TIENDAS_COMERCIALES))
    for (const n of names) m[norm(n)] = t
  return m
})()

// Tienda de un comercial según el mapa heredado ('' si no se conoce)
export function tiendaDeComercial(nombre: string): string {
  return legacyNameToTienda[norm(nombre)] || ''
}

// Correo de un comercial según la plantilla del mes ('' si no lo tiene puesto).
// AQUÍ NO SE INVENTA NADA: si la casilla está vacía se devuelve '' y quien llame
// decide qué hacer. Componer un correo a partir del nombre (nombre@…) mandaría
// avisos a direcciones que no existen y nadie se enteraría de que se pierden.
export function emailDeComercial(hours: HourRow[] | null | undefined, nombre: string): string {
  const fila = (hours || []).find(h => norm(h?.comercial) === norm(nombre))
  return String(fila?.email || '').trim()
}

// Mapa efectivo tienda -> [comerciales] de un periodo, a partir de sus horarios.
// Si no hay horarios → lista fija completa (retrocompatible).
export function getEffectiveTiendaComerciales(hours?: HourRow[] | null): Record<string, string[]> {
  const rows = (hours || []).filter(h => h && String(h.comercial || '').trim())
  if (rows.length === 0) return { ...TIENDAS_COMERCIALES } // fallback total

  const map: Record<string, string[]> = {}
  for (const h of rows) {
    const name = String(h.comercial).trim()
    let tienda = String(h.tienda || '').trim() || legacyNameToTienda[norm(name)]
    if (!tienda) tienda = 'Sin Tienda'
    if (tienda === 'O2') continue // O2 tiene su propio panel
    if (!map[tienda]) map[tienda] = []
    if (!map[tienda].some(x => norm(x) === norm(name))) map[tienda].push(name)
  }
  // O2/Marta siempre presente desde la lista fija (no se edita en este panel)
  map['O2'] = [...(TIENDAS_COMERCIALES['O2'] || [])]
  return map
}

// Comerciales de UNA tienda en un periodo (fallback a lista fija).
export function getSellersForStore(storeName: string, hours?: HourRow[] | null): string[] {
  const map = getEffectiveTiendaComerciales(hours)
  const key = Object.keys(map).find(k => norm(k).replace('é', 'e') === norm(storeName).replace('é', 'e'))
  return key ? map[key] : []
}

// Tiendas FÍSICAS con actividad en un periodo -> [comerciales].
// Fuera O2 (tiene su propio panel) y fuera 'Sin Tienda': una fila de horarios sin
// tienda escrita no puede inventarse una quinta tienda. Ese mismo fallo ya mordió
// en el aviso de los 30 dispositivos del ERP (una venta suelta creaba una tienda
// fantasma que nunca llegaba al mínimo, así que el aviso no se callaba nunca).
// Solo cuentan las tiendas con alguien de plantilla con horas: una tienda cerrada
// el mes que sea no puede bloquear el tramo de nadie.
export function getTiendasConPlantilla(hours?: HourRow[] | null): Record<string, string[]> {
  const map = getEffectiveTiendaComerciales(hours)
  const rows = (hours || []).filter(h => h && String(h.comercial || '').trim())
  const conHoras = new Set(
    rows.filter(h => Number(h.horario) > 0).map(h => norm(h.comercial))
  )
  const out: Record<string, string[]> = {}
  for (const [tienda, nombres] of Object.entries(map)) {
    if (tienda === 'O2' || tienda === 'Sin Tienda') continue
    // Sin datos de horas (meses antiguos) no se descarta a nadie.
    const activos = conHoras.size === 0 ? nombres : nombres.filter(n => conHoras.has(norm(n)))
    if (activos.length > 0) out[tienda] = activos
  }
  return out
}

// Lista plana de comerciales activos del periodo (para sellerStats / rankings).
// tiendaHours = panel físico; o2Hours = panel O2. Fallback a lista fija si vacío.
export function getEffectiveSellers(tiendaHours?: HourRow[] | null, o2Hours?: HourRow[] | null): string[] {
  const tiendaRows = (tiendaHours || []).map(h => String(h?.comercial || '').trim()).filter(Boolean)
  const o2Rows = (o2Hours || []).map(h => String(h?.comercial || '').trim()).filter(Boolean)

  const tiendaBase = tiendaRows.length
    ? tiendaRows
    : Object.entries(TIENDAS_COMERCIALES).filter(([t]) => t !== 'O2').flatMap(([, n]) => n)
  const o2Base = o2Rows.length ? o2Rows : (TIENDAS_COMERCIALES['O2'] || [])

  const seen = new Set<string>()
  const out: string[] = []
  for (const n of [...tiendaBase, ...o2Base]) {
    const k = norm(n)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(n)
  }
  return out
}
