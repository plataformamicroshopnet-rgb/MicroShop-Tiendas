import { GANANCIAS_DATA } from '@/app/direccion-tiendas/ganancias/data'

// ─────────────────────────────────────────────────────────────────────────────
// LOS INGRESOS DE LA FUERZA DE VENTAS, MES A MES — FUENTE ÚNICA.
//
// Antes había dos verdades. El cuadro grande de Ganancias recomponía el «Total
// Ingresos FFVV» con los datos en vivo, y la pantalla del reparto por comercial
// leía la foto del Excel grabada en data.ts. Resultado: para enero de 2026 uno
// decía 36.663,83 € y el otro 25.842,56 €, casi 11.000 € de diferencia en el
// mismo mes, y de mayo en adelante el reparto enseñaba ceros aunque el dinero
// estuviera. Esto lo calcula UNA vez para los dos.
//
// De dónde sale cada concepto:
//   · Caja FFVV ......... A MANO. No tiene ninguna tubería: es lo que alguien
//                         escriba en el cuadro grande. Si no lo escribe nadie,
//                         falta, y el total de ese mes queda corto.
//   · Producción Plus ... del programa de FFVV (Total Acumulado PLUS/BÁSICO de
//   · Producción Básico   la Liquidación), desde abril de 2026.
//   · PRV FFVV .......... del ERP (ficheros SAUT), desde enero de 2026.
//   · Gastos FFVV ....... del Excel / lo que se teclee en el cuadro grande.
//
// El «Total Ingresos FFVV» NO se lee: se SUMA. En el Excel venía calculado y
// cuadra al céntimo con esta misma cuenta de enero a abril de 2026, así que la
// hoja original hacía exactamente esto.
// ─────────────────────────────────────────────────────────────────────────────

/** Desde cuándo hay dato vivo. Antes de esto manda el Excel. */
const PRV_DESDE_ANIO = 2026
const PRODUCCION_DESDE = '2026_04'
/** La Caja FFVV dejó de existir en 2026: hasta 2025 sí era un ingreso real. */
const CAJA_HASTA_ANIO = 2026

export interface MesFfvv {
  /** 1..12 */
  mes: number
  caja: number | null
  plus: number | null
  basico: number | null
  prv: number | null
  gastos: number | null
  /** caja + plus + básico + prv. null si no hay NI UN concepto con dato. */
  total: number | null
  /** total − gastos. null si falta el total. */
  ganancia: number | null
  /** true si alguno de los importes viene de una tubería y no del Excel. */
  vivo: boolean
  /** Conceptos que no tienen dato este mes («Caja FFVV», «PRV FFVV»…). */
  faltan: string[]
}

const ETIQUETAS = {
  caja: 'Caja FFVV',
  plus: 'Producción Plus',
  basico: 'Producción Básico',
  prv: 'PRV FFVV',
  gastos: 'Gastos FFVV',
} as const

function filaDe(filas: any[], etiqueta: string): (number | null)[] {
  const r = (filas || []).find((x: any) => String(x?.label || '').trim() === etiqueta)
  return r && Array.isArray(r.months) ? r.months : new Array(12).fill(null)
}

/**
 * El PRV de FFVV, buscándolo POR DÓNDE ESTÁ y no por cómo se llama.
 *
 * ⚠️ ESTO COSTÓ 16.020 € AL MES EN 2025. Esa fila no se llama igual en todos los
 * años: «PRV» en 2024 y 2025, «PRV 6 FFVV» en 2020 y «PRV FFVV» solo en 2026,
 * porque al renombrarla para distinguirla de la de Tiendas se renombró únicamente
 * el año en curso. Buscarla por el nombre nuevo hacía que en los años viejos no
 * apareciera: los ingresos salían cortos justo el importe de esa fila (2.670 € por
 * comercial y mes con 6 comerciales) y encima el aviso de «meses incompletos»
 * cantaba «falta PRV FFVV» los doce meses. El aviso decía la verdad.
 *
 * La regla buena: en el cuadro hay DOS filas de PRV, la de Tiendas y la de FFVV,
 * y la de FFVV es la que cae DESPUÉS de «Caja FFVV», que es donde empieza el
 * bloque de la fuerza de ventas. Así da igual cómo se llame hoy o mañana.
 */
function filaPrvFfvv(filas: any[]): (number | null)[] {
  const lista = filas || []
  const inicioBloque = lista.findIndex(
    (x: any) => String(x?.label || '').trim() === ETIQUETAS.caja)
  const desde = inicioBloque >= 0 ? inicioBloque : 0
  const r = lista.slice(desde).find(
    (x: any) => String(x?.label || '').toUpperCase().includes('PRV'))
  if (r && Array.isArray(r.months)) return r.months
  // Sin bloque reconocible: el nombre nuevo, como último recurso.
  return filaDe(lista, ETIQUETAS.prv)
}

/** 0 y null son lo mismo aquí: «no hay dato». El Excel usa los dos. */
const dato = (v: any): number | null =>
  (v === null || v === undefined || !isFinite(Number(v)) || Number(v) === 0) ? null : Number(v)

async function json(url: string): Promise<any> {
  try {
    const r = await fetch(url, { cache: 'no-store' })
    return await r.json()
  } catch {
    return null
  }
}

/**
 * Los doce meses de un año, con el dato vivo aplicado encima del Excel.
 *
 * Se le pasa el año como texto ('2026'). Devuelve SIEMPRE 12 meses; los que no
 * tienen nada vienen con total = null, que no es lo mismo que 0: un mes sin
 * datos y un mes que ingresó cero se cuentan distinto en las medias.
 */
export async function cargarIngresosFfvv(anio: string): Promise<MesFfvv[]> {
  const [guardado, feedPrv, feedProd] = await Promise.all([
    json('/api/ganancias-data'),
    json('/api/prv-feed'),
    json('/api/produccion-feed'),
  ])

  // La versión editable del cuadro manda sobre el Excel; si no existe, el Excel.
  const base = (guardado && guardado.success && guardado.data) ? guardado.data : GANANCIAS_DATA
  const filas = (base as any)[anio] || (GANANCIAS_DATA as any)[anio] || []

  const excel = {
    caja: filaDe(filas, ETIQUETAS.caja),
    plus: filaDe(filas, ETIQUETAS.plus),
    basico: filaDe(filas, ETIQUETAS.basico),
    prv: filaPrvFfvv(filas),
    gastos: filaDe(filas, ETIQUETAS.gastos),
  }

  const anioNum = Number(anio)
  const salida: MesFfvv[] = []

  for (let m = 1; m <= 12; m++) {
    const clave = `${anioNum}_${String(m).padStart(2, '0')}`
    let vivo = false

    let caja = dato(excel.caja[m - 1])
    let plus = dato(excel.plus[m - 1])
    let basico = dato(excel.basico[m - 1])
    let prv = dato(excel.prv[m - 1])
    const gastos = dato(excel.gastos[m - 1])

    // PRV FFVV del ERP (ficheros SAUT). Pisa al Excel, que traía una cifra de
    // presupuesto fija de 16.020 € que no era lo que pagó Telefónica.
    if (anioNum >= PRV_DESDE_ANIO && feedPrv?.success && feedPrv.data) {
      const v = feedPrv.data[clave]
      if (v !== undefined && v !== null && isFinite(Number(v))) { prv = Number(v); vivo = true }
    }
    // Producción del programa de FFVV, desde abril de 2026.
    if (clave >= PRODUCCION_DESDE && feedProd?.success && feedProd.data) {
      const v = feedProd.data[clave]
      if (v && typeof v === 'object') {
        if (isFinite(Number(v.plus))) { plus = Number(v.plus); vivo = true }
        if (isFinite(Number(v.basico))) { basico = Number(v.basico); vivo = true }
      }
    }

    const partes = [caja, plus, basico, prv]
    const hayAlgo = partes.some(x => x !== null)
    const total = hayAlgo ? partes.reduce((a: number, b) => a + (b || 0), 0) : null

    // Qué falta DE VERDAD. El aviso solo sirve si se calla cuando no pasa nada:
    // llevaba meses cantando «falta Caja FFVV» los doce meses de 2026, cuando la
    // Caja YA NO EXISTE desde 2026 (lo confirmó el dueño el 01-ago-2026: la
    // sección FFVV son solo Producción Plus, Producción Básico y PRV). Un aviso
    // que siempre está encendido acaba sin mirarse, y entonces no avisa del día
    // que falta algo de verdad.
    const faltan: string[] = []
    if (hayAlgo) {
      if (caja === null && anioNum < CAJA_HASTA_ANIO) faltan.push(ETIQUETAS.caja)
      if (plus === null) faltan.push(ETIQUETAS.plus)
      if (basico === null) faltan.push(ETIQUETAS.basico)
      if (prv === null) faltan.push(ETIQUETAS.prv)
    }

    salida.push({
      mes: m, caja, plus, basico, prv, gastos, total,
      ganancia: total === null ? null : total - (gastos || 0),
      vivo, faltan,
    })
  }
  return salida
}

/**
 * Media de los meses QUE TIENEN DATO.
 *
 * No de los doce: la pantalla del reparto dividía siempre entre 12 y en un año a
 * medias enseñaba un tercio de lo real (1.700,50 € donde eran 5.101,49 €).
 */
export function mediaConDato(valores: (number | null)[]): number | null {
  const buenos = valores.filter((v): v is number => v !== null && isFinite(v))
  return buenos.length ? buenos.reduce((a, b) => a + b, 0) / buenos.length : null
}
