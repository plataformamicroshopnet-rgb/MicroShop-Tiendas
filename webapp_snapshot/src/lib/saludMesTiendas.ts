// ─────────────────────────────────────────────────────────────────────────────
// CAMBIO DE MES (Dirección Tiendas) — tipos compartidos entre la API
// GET /api/salud-mes y la pantalla /direccion-tiendas/cambio-de-mes.
//
// Hermano del hub de FFVV (mismo molde): la API hace TODAS las consultas y
// redacta los textos en cristiano; la pantalla solo pinta. Cada paso es un
// PasoSaludMes; la lista crece fase a fase.
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoPaso = 'verde' | 'ambar' | 'rojo' | 'apagado'

export interface SubCheck {
  etiqueta: string
  ok: boolean
  detalle?: string
}

export interface AccionPaso {
  /** 'clonar' = POST /api/admin/periodos (DUPLICATE); 'enlace' = navegar. */
  tipo: 'clonar' | 'enlace'
  etiqueta: string
  href?: string
  /** Solo 'clonar': id del WorkPeriod ORIGEN (el clonado crea el mes siguiente). */
  sourcePeriodId?: string
}

export interface TablaPaso {
  titulo: string
  subtitulo?: string
  columnas: string[]
  filas: string[][]
  numericas?: number[]
  nota?: string
}

export interface PasoSaludMes {
  id: string
  titulo: string
  resumen: string
  estado: EstadoPaso
  detalles: string[]
  ayuda?: string
  subChecks?: SubCheck[]
  accion?: AccionPaso
  pantalla?: string
  tablas?: TablaPaso[]
}

export interface SaludMesTiendasResponse {
  success: boolean
  error?: string
  periodKey?: string
  generadoEn?: string
  resumen?: { verde: number; ambar: number; rojo: number }
  pasos?: PasoSaludMes[]
}

/** '2026_08' → '2026_09'. */
export function mesSiguiente(periodKey: string): string {
  const [y, m] = periodKey.split('_').map(Number)
  return m === 12 ? `${y + 1}_01` : `${y}_${String(m + 1).padStart(2, '0')}`
}
