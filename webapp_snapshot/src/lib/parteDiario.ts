// ─────────────────────────────────────────────────────────────────────────────
// PARTE DIARIO por comercial (TIENDAS) — tipos, traducción a producto y frases.
//
// Módulo PURO (sin React, sin fetch): lo usan la pantalla
// /comisiones/parte-diario y el endpoint /api/parte-diario, y lo usará el correo
// diario. Las CIFRAS salen siempre del endpoint (motor de comisiones); aquí solo
// vive cómo se CUENTAN esas cifras: la traducción a producto y las frases.
//
// Las frases se eligen de forma DETERMINISTA a partir de (comercial + fecha +
// palanca): no cambian al refrescar la pantalla, pero sí de un día para otro, y
// dos comerciales no leen lo mismo el mismo día.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tipos del JSON de /api/parte-diario ─────────────────────────────────────
export interface ParteDiarioAyerPalanca {
  palanca: string
  uds: number
  importe: number
  comision: number
}

export interface ParteDiarioPalanca {
  nombre: string
  /** true = la palanca se mide en € (regla de %), false = en unidades. */
  esImporte: boolean
  /** Confirmadas (unidades o € según esImporte). */
  ventas: number
  /** Pendientes de activar (cuentan para el objetivo, no consolidan). */
  pendientes: number
  /** ventas + pendientes: lo que se compara con el objetivo. */
  llevamos: number
  /** Objetivo que CONSOLIDA la comisión (tramo 1; si no lo hubiera, el del tramo 2). */
  objetivo: number
  falta: number
  /** % sobre el objetivo, SIN capar (puede pasar de 100). */
  pct: number
  comision: number
  /** Objetivo 1 alcanzado / condicionantes OK (la comisión consolida). */
  cumplido: boolean
  /** Tramo cuya tarifa se está aplicando (1/2/3; 0 = sin ventas). */
  hito: number
  /** Tarifa aplicada ahora mismo (€/ud o % según esImporte). */
  tarifaActual: number
  /** Tarifa del siguiente tramo, si queda alguno por encima. */
  tarifaSiguienteTramo: number | null
  /** Objetivo del siguiente tramo (para decir «con N más subes de tramo»). */
  objetivoSiguienteTramo: number | null
}

export interface ParteDiarioComercial {
  nombre: string
  ayer: {
    ops: number
    importe: number
    comision: number
    porPalanca: ParteDiarioAyerPalanca[]
  }
  mes: {
    ops: number
    importe: number
    comisionTotal: number
    consolidada: number
    pendiente: number
  }
  palancas: ParteDiarioPalanca[]
  ritmo: {
    /** Palanca sobre la que se mide el ritmo (la principal en € del mes). */
    palanca: string | null
    diasLaborablesRestantes: number
    diasLaborablesTranscurridos: number
    ritmoDiarioActual: number
    ritmoNecesario: number
    proyeccionMes: number
    pctProyeccion: number
  }
  /** Puesto del día dentro del equipo (1 = el que más vendió). */
  posicionDia: number
  /** Días laborables seguidos vendiendo, contando hacia atrás desde el parte. */
  rachaDias: number
  totalComerciales: number
}

export interface ParteDiarioEquipo {
  ops: number
  importe: number
  /** Importe medio por comercial CON ventas ese día (no se reparte entre quien libraba). */
  media: number
  /** Solo para jefatura y para el ERP: un comercial recibe su puesto, no las
   *  cifras nominales de sus compañeros. */
  ranking?: { nombre: string; ops: number; importe: number }[]
}

export interface ParteDiarioResponse {
  success: boolean
  periodKey: string
  /** Día del parte en YYYY-MM-DD. */
  fecha: string
  equipo: ParteDiarioEquipo
  comerciales: ParteDiarioComercial[]
  error?: string
}

// ── TRADUCCIÓN A PRODUCTO ────────────────────────────────────────────────────
// Lo que falta, contado en cosas que el comercial vende de verdad. Cambiar estos
// números cambia el mensaje en la pantalla Y en el correo (fuente única).
export const TRADUCCION_PRODUCTO = {
  /** Dispositivos + Seguros: 1.000 € = 1 iPhone (precio redondo de referencia). */
  EUROS_POR_IPHONE: 1000,
  /** ARPU / Repos: 50 € = 1 repo (importe medio de referencia). */
  EUROS_POR_REPO: 50,
  /** Días laborables que se cuentan por semana para el ritmo («2 por semana»). */
  DIAS_LABORABLES_SEMANA: 5,
}

// Unidad con la que se cuenta cada palanca de UNIDADES (singular, plural).
// La clave se busca como fragmento dentro del nombre de la regla, así que
// sobreviven los renombrados del tipo "Alta BAF Total (Eq)".
const UNIDADES_PALANCA: { clave: string; singular: string; plural: string }[] = [
  { clave: 'convergente', singular: 'convergente', plural: 'convergentes' },
  { clave: 'baf', singular: 'fibra', plural: 'fibras' },
  { clave: 'fttr', singular: 'FTTR', plural: 'FTTR' },
  { clave: 'mpa', singular: 'alarma', plural: 'alarmas' },
  { clave: 'alarma', singular: 'alarma', plural: 'alarmas' },
  { clave: 'swap', singular: 'swap', plural: 'swaps' },
  { clave: 'futbol', singular: 'repo de fútbol', plural: 'repos de fútbol' },
  { clave: 'fútbol', singular: 'repo de fútbol', plural: 'repos de fútbol' },
  { clave: 'tv', singular: 'suscripción', plural: 'suscripciones' },
  { clave: 'seguro', singular: 'seguro', plural: 'seguros' },
]

const sinAcentos = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Nombre de la unidad de una palanca de unidades ("fibra"/"fibras"). */
export function unidadDePalanca(nombre: string, cantidad: number): string {
  const n = sinAcentos(nombre)
  const found = UNIDADES_PALANCA.find(u => n.includes(sinAcentos(u.clave)))
  if (!found) return cantidad === 1 ? 'venta' : 'ventas'
  return cantidad === 1 ? found.singular : found.plural
}

// Formato español a mano. Con toLocaleString y decimales fijados, el servidor
// devolvía los importes SIN separador de miles («7303 €» junto a «7.443 €» en
// la misma frase). Así sale igual en el navegador y en la imagen del correo.
const _miles = (entero: string) => entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const eur = (v: number) => _miles(String(Math.round(Number(v) || 0))) + ' €'
const eur2 = (v: number) => {
  const n = Number(v) || 0
  const [ent, dec] = Math.abs(n).toFixed(2).split('.')
  return `${n < 0 ? '-' : ''}${_miles(ent)},${dec} €`
}

/** € que se lleva el comercial si cubre `falta` en esta palanca (tarifa del tramo vigente). */
export function dineroPorCubrir(p: Pick<ParteDiarioPalanca, 'esImporte' | 'tarifaActual'>, falta: number): number {
  if (falta <= 0) return 0
  return p.esImporte ? falta * (p.tarifaActual / 100) : falta * p.tarifaActual
}

/**
 * Lo que falta contado en cosas: «4 iPhone», «6 fibras», «2 repos».
 * null si la palanca ya está cubierta.
 */
export function piezasQueFaltan(p: ParteDiarioPalanca): { cantidad: number; cosa: string } | null {
  if (p.falta <= 0) return null
  if (p.esImporte) {
    const n = sinAcentos(p.nombre)
    const esRepo = n.includes('arpu') || n.includes('repo')
    const ratio = esRepo ? TRADUCCION_PRODUCTO.EUROS_POR_REPO : TRADUCCION_PRODUCTO.EUROS_POR_IPHONE
    const cantidad = Math.max(1, Math.ceil(p.falta / ratio))
    return { cantidad, cosa: esRepo ? (cantidad === 1 ? 'repo' : 'repos') : 'iPhone' }
  }
  const cantidad = Math.ceil(p.falta)
  return { cantidad, cosa: unidadDePalanca(p.nombre, cantidad) }
}

/**
 * Lo que falta, traducido a producto + el dinero que hay detrás.
 * Dispositivos/Seguros → iPhone; ARPU/Repos → repos; unidades → su propia unidad
 * y su ritmo («2 por semana»).
 */
export function traducirFalta(p: ParteDiarioPalanca, diasLaborablesRestantes: number): string {
  const gana = dineroPorCubrir(p, p.falta)
  const colaDinero = gana > 0 ? ` Son ${eur2(gana)} para ti.` : ''

  if (p.falta <= 0) {
    // Objetivo cubierto: lo interesante ya no es lo que falta, sino lo que lleva ganado.
    if (p.comision > 0) return `Objetivo cubierto: ya son ${eur2(p.comision)} de comisión con esta palanca.`
    return 'Objetivo cubierto. Todo lo que venga ahora es extra.'
  }

  const piezas = piezasQueFaltan(p)
  if (!piezas) return `Te faltan ${eur(p.falta)}.${colaDinero}`

  if (p.esImporte) {
    return `Te faltan ${eur(p.falta)} — eso son ${piezas.cantidad} ${piezas.cosa}.${colaDinero}`
  }

  const uds = piezas.cantidad
  const cosa = piezas.cosa
  const semanas = diasLaborablesRestantes > 0 ? diasLaborablesRestantes / TRADUCCION_PRODUCTO.DIAS_LABORABLES_SEMANA : 0
  let ritmo = ''
  if (semanas >= 1) {
    const porSemana = uds / semanas
    if (porSemana <= 1) {
      const cadaDias = Math.max(1, Math.round(diasLaborablesRestantes / uds))
      ritmo = cadaDias === 1 ? ' — una al día y está hecho.' : ` — una cada ${cadaDias} días y está hecho.`
    } else {
      ritmo = ` — ${Math.ceil(porSemana)} por semana y está hecho.`
    }
  }
  // Si no hay frase de ritmo hay que cerrar con punto: si no, quedaba
  // «Faltan 13 fibras Son 19,50 € para ti.», todo pegado.
  return `Faltan ${uds} ${cosa}${ritmo || '.'}${colaDinero}`
}

// ── FRASES QUE ROTAN ─────────────────────────────────────────────────────────
export type EstadoPalanca = 'cubierto' | 'medias' | 'cero'

const ANIMO: Record<EstadoPalanca, string[]> = {
  cubierto: [
    'Objetivo firmado. Ahora todo lo que caiga es propina.',
    'Esto ya lo tienes. A por el siguiente escalón.',
    'Aquí no hay nada que corregir: sigue exactamente igual.',
    'De libro. Esta palanca la dominas.',
    'Bien jugado: cubierto y con margen.',
    'Objetivo cerrado. Que no se te enfríe.',
  ],
  medias: [
    'Vas a buen ritmo, no lo sueltes ahora.',
    'Estás más cerca de lo que parece.',
    'La segunda mitad se hace cuesta abajo.',
    'Un empujón esta semana y cambia la foto.',
    'Lo tienes a tiro: es cuestión de insistir.',
    'Con lo que ya sabes hacer, esto cae.',
  ],
  cero: [
    'Hoy es un buen día para estrenarla.',
    'Sin estrenar: la primera es la que más cuesta.',
    'Prueba a ofrecerla en la próxima venta y verás.',
    'Nadie la ha pedido todavía porque nadie la ha ofrecido.',
    'Un intento hoy y dejas de verla en cero.',
    'Merece un intento: es dinero que está sobre la mesa.',
  ],
}

const VEREDICTO_BUENO = [
  'un buen día',
  'un día de los que cuentan',
  'un día redondo',
  'un día para repetir',
]
const VEREDICTO_NORMAL = [
  'un día de oficio',
  'un día correcto',
  'un día de sumar',
  'un día tranquilo',
]
const VEREDICTO_CERO = [
  'un día en blanco',
  'un día sin cerrar nada',
  'un día para olvidar',
]

const CIERRE_BUENO = [
  'Sigue así y te sale un buen mes.',
  'A este paso el mes se te queda corto.',
  'Mantén el ritmo y el mes se firma solo.',
]
const CIERRE_NORMAL = [
  'Con una más al día cambia el mes entero.',
  'Poco a poco, pero hay que apretar.',
  'El mes se decide en los días como este.',
]
const CIERRE_CERO = [
  'Hoy toca darle la vuelta.',
  'Un día malo lo tiene cualquiera: hoy se arregla.',
  'Nada que no se arregle con una buena mañana.',
]

/** Hash estable (djb2) para elegir siempre la misma frase con la misma semilla. */
export function hashDeterminista(semilla: string): number {
  let h = 5381
  const s = String(semilla || '')
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return h
}

function elegir(lista: string[], semilla: string): string {
  if (!lista.length) return ''
  return lista[hashDeterminista(semilla) % lista.length]
}

/** Estado de una palanca para elegir el tono del mensaje. */
export function estadoDePalanca(p: ParteDiarioPalanca): EstadoPalanca {
  if (p.llevamos <= 0) return 'cero'
  if (p.objetivo > 0 && p.llevamos >= p.objetivo) return 'cubierto'
  if (p.objetivo <= 0 && p.cumplido) return 'cubierto'
  return 'medias'
}

/** Frase de ánimo de una palanca: fija para (comercial, fecha, palanca). */
export function fraseAnimo(estado: EstadoPalanca, comercial: string, fecha: string, palanca: string): string {
  return elegir(ANIMO[estado], `${comercial}|${fecha}|${palanca}`)
}

/** Veredicto del día: «ayer fue …» + frase de cierre, también deterministas. */
export function veredictoDelDia(
  comercial: string,
  fecha: string,
  ops: number,
  importe: number,
  mediaEquipo: number,
): { calificacion: string; cierre: string; tono: 'bueno' | 'normal' | 'cero' } {
  const semilla = `${comercial}|${fecha}`
  if (ops <= 0) {
    return { calificacion: elegir(VEREDICTO_CERO, semilla), cierre: elegir(CIERRE_CERO, semilla), tono: 'cero' }
  }
  const bueno = mediaEquipo > 0 ? importe >= mediaEquipo : ops >= 3
  if (bueno) {
    return { calificacion: elegir(VEREDICTO_BUENO, semilla), cierre: elegir(CIERRE_BUENO, semilla), tono: 'bueno' }
  }
  return { calificacion: elegir(VEREDICTO_NORMAL, semilla), cierre: elegir(CIERRE_NORMAL, semilla), tono: 'normal' }
}
