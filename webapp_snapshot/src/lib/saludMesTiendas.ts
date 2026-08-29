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
  /** 'clonar' = POST /api/admin/periodos (DUPLICATE); 'enlace' = navegar;
   *  'revisado' = «Ya lo he revisado»: sella el paso para ESTE mes (quién,
   *  cuándo y una huella), el aviso vuelve solo si el contenido cambia. */
  tipo: 'clonar' | 'enlace' | 'revisado'
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
  /** Un segundo botón: además de ir a la pantalla, hacer algo aquí (hoy: «Ya
   *  lo he revisado» de los pasos con sello). */
  accionSecundaria?: AccionPaso
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

/** '2026_09' → '2026_08'. */
export function mesAnterior(periodKey: string): string {
  const [y, m] = periodKey.split('_').map(Number)
  return m === 1 ? `${y - 1}_12` : `${y}_${String(m - 1).padStart(2, '0')}`
}

/** '2026_08' → '2026_09'. */
export function mesSiguiente(periodKey: string): string {
  const [y, m] = periodKey.split('_').map(Number)
  return m === 12 ? `${y + 1}_01` : `${y}_${String(m + 1).padStart(2, '0')}`
}
