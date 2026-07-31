import type { ParteDiarioComercial, ParteDiarioPalanca, ParteDiarioResponse } from '@/lib/parteDiario'

// ─────────────────────────────────────────────────────────────────────────────
// MOLDE COMÚN DE LOS DISEÑOS DEL PARTE DIARIO (versión imagen).
//
// Cada diseño vive en su propio fichero de esta carpeta y solo tiene que hacer
// dos cosas: decir cuánto va a medir de alto y devolver el dibujo. Todo lo que
// necesita —las cifras ya calculadas y las funciones de formato— se lo damos
// hecho, para que ninguno se invente números por su cuenta.
//
// ── LAS TRES TRAMPAS DE SATORI (el dibujante que usa next/og) ───────────────
// Están aprendidas a base de golpes; saltárselas rompe la imagen:
//
//  1. Un recuadro con MÁS DE UN hijo revienta si no declara «display: flex».
//     Lo más seguro es montar cada frase entera en JavaScript y meterla como
//     un único hijo de texto.
//  2. Solo entiende FLEXBOX. Nada de rejillas (grid). Para dos columnas:
//     flexWrap con anchos calculados a mano.
//  3. La altura NO se puede medir sola: hay que dársela calculada. Si te
//     quedas corto, la imagen se CORTA por abajo y los bloques se solapan.
//     Para eso está `lineas()`: estima en cuántas líneas parte una frase.
//
// Además: no hereda estilos (cada texto lleva su tamaño y su color), y las
// fuentes son «Liberation Sans» en 400 y 700, que es lo que se le carga.
// ─────────────────────────────────────────────────────────────────────────────

/** Ancho fijo de la imagen. Se lee en el portátil, así que va holgado. */
export const ANCHO = 1180

export interface AyudasParte {
  /** 1234.5 → «1.235 €» */
  eur0: (v: number) => string
  /** 1234.5 → «1.234,50 €» */
  eur2: (v: number) => string
  /** 12.34 → «12,3» */
  num: (v: number) => string
  /** '2026-05-12' → «Martes, 12 de mayo» */
  fechaLarga: (iso: string) => string
  /** Emoji decorativo de una palanca por su nombre. */
  iconoDe: (nombre: string) => string
  /** «Ayer sumaste 4 fibras. Llevas 11 de 17.» */
  textoAyer: (p: ParteDiarioPalanca) => string
  /** «Faltan 6 fibras — 2 por semana y está hecho. Son 120 € para ti.» */
  textoFalta: (p: ParteDiarioPalanca) => string
  /** Frase de ánimo, fija para (comercial, fecha, palanca). */
  textoAnimo: (p: ParteDiarioPalanca) => string
  /** 'cubierto' | 'medias' | 'cero' */
  estado: (p: ParteDiarioPalanca) => string
  /** Unidad de la palanca: «fibra»/«fibras». */
  unidad: (nombre: string, cantidad: number) => string
  /** Cuántas líneas ocupará un texto en un ancho dado. Para calcular el alto. */
  lineas: (texto: string, anchoPx: number, tam: number) => number
}

export interface DatosParte {
  /** El parte del comercial, tal cual lo devuelve /api/parte-diario. */
  c: ParteDiarioComercial
  /** La respuesta entera: fecha, equipo, ranking. */
  data: ParteDiarioResponse
  /** «un buen día» + la frase de cierre, ya elegidas. */
  veredicto: { calificacion: string; cierre: string; tono: 'bueno' | 'normal' | 'cero' }
  /** Palancas ordenadas: primero lo que está a medias, al final lo sin estrenar. */
  palancas: ParteDiarioPalanca[]
  /** La palanca con más dinero en juego, para darle protagonismo. */
  destacada?: ParteDiarioPalanca
  /** Las demás. */
  resto: ParteDiarioPalanca[]
  /** Cuánto está por encima o por debajo de la media del equipo, en %. */
  pctMedia: number
  ancho: number
  a: AyudasParte
}

export interface Diseno {
  /** Identificador para la dirección: ?diseno=original */
  clave: string
  /** Como se llama para el dueño. */
  nombre: string
  /** Alto en píxeles. Más vale pasarse que quedarse corto. */
  alto: (d: DatosParte) => number
  /** El dibujo. */
  render: (d: DatosParte) => any
}
