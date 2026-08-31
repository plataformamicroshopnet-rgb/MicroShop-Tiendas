/**
 * QUÉ COLUMNA DEL CATÁLOGO DE RENT ES LA CATEGORÍA Y CUÁL ES EL FABRICANTE.
 *
 * EL PROBLEMA (31-ago-2026, el dueño: «está bailado los nombres Fabricante y
 * Categoría»): el catálogo de Rent se carga pegando un Excel, y el programa mete
 * la 1ª columna en `fabricante` y la 2ª en `subcategoria` SIN MIRAR lo que traen.
 * Hasta junio-2026 el Excel venía con la MARCA primero (APPLE, ACER…) y todo
 * cuadraba con los rótulos. Desde julio viene con el TIPO primero (SMARTPHONE,
 * ACCESORIO…), así que las dos columnas quedaron cambiadas de sitio:
 *   · mayo y junio 2026: fabricante=MARCA, subcategoria=TIPO   → rótulos correctos
 *   · julio, agosto y septiembre: al revés (637 de 637 filas en agosto)
 *
 * POR QUÉ NO SE ARREGLA CAMBIANDO LOS RÓTULOS: si se fijan al orden de agosto,
 * mayo y junio pasan a mentir; y si el mes que viene el Excel vuelve al orden
 * antiguo, vuelve a mentir sin que nadie se entere. Y si se arreglan los datos,
 * el siguiente Excel los vuelve a torcer.
 *
 * LA SOLUCIÓN: no fiarse del sitio, MIRAR LO QUE PONE. Los TIPOS son un puñado
 * de palabras conocidas y repetidas; las marcas son una lista abierta. Así que
 * se mira el catálogo del mes y se decide cuál de las dos columnas habla de
 * tipos. Cada mes se decide solo, y da igual cómo venga el Excel.
 *
 * ⚠️ Esto NO toca el dinero: la comisión de un Rent se busca por el NOMBRE del
 * producto y la fecha (lib/saleCommission), no por estas dos columnas. Es solo
 * para que la pantalla llame a cada cosa por su nombre.
 */

/** Los tipos de aparato que maneja Rent. No hace falta que estén todos: basta
 *  con que sean bastantes para desempatar contra una lista de marcas. */
const TIPOS = new Set([
  'SMARTPHONE', 'TABLET', 'PORTÁTIL', 'PORTATIL', 'ACCESORIO', 'SMARTWATCH',
  'SMARTTV', 'TV', 'IOT', 'HOGAR', 'GAMING', 'CÁMARA', 'CAMARA', 'FITNESS',
  'PULSERA', 'REACONDICIONADO', 'GAFAS IA', 'ANILLO DE SALUD', 'PC', 'OTROS',
])

const norm = (v: any) => String(v ?? '').trim().toUpperCase()

export interface RolesRent {
  /** Nombre del campo que guarda el TIPO de aparato (lo que el dueño llama Categoría). */
  campoCategoria: 'fabricante' | 'subcategoria'
  /** Nombre del campo que guarda la MARCA. */
  campoFabricante: 'fabricante' | 'subcategoria'
  /** true si hubo que darles la vuelta respecto al nombre de la columna. */
  invertido: boolean
}

const POR_DEFECTO: RolesRent = {
  campoCategoria: 'subcategoria',
  campoFabricante: 'fabricante',
  invertido: false,
}

/**
 * Decide, mirando el catálogo de Rent de un mes, qué columna es cada cosa.
 * Si no hay filas o no se puede decidir, se queda con lo que dicen los nombres
 * de las columnas (que es como estaba hasta junio).
 */
export function rolesCatalogoRent(filasRent: any[] | undefined | null): RolesRent {
  const filas = (filasRent || []).filter(Boolean)
  if (filas.length === 0) return POR_DEFECTO

  let aciertosFabricante = 0
  let aciertosSubcategoria = 0
  for (const f of filas) {
    if (TIPOS.has(norm(f?.fabricante))) aciertosFabricante++
    if (TIPOS.has(norm(f?.subcategoria))) aciertosSubcategoria++
  }

  // Empate o silencio (ninguna columna habla de tipos): no se inventa nada.
  if (aciertosFabricante === aciertosSubcategoria) return POR_DEFECTO

  const invertido = aciertosFabricante > aciertosSubcategoria
  return invertido
    ? { campoCategoria: 'fabricante', campoFabricante: 'subcategoria', invertido: true }
    : POR_DEFECTO
}
