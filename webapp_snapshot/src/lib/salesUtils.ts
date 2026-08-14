import { OBJECTIVE_MAPPING } from './constants'

/**
 * Normalizes a string by keeping only alphanumeric characters.
 * Accents are removed, spaces and special characters are stripped.
 */
export function normalizeString(str: string): string {
    if (!str) return ''
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-zA-Z0-9]/g, "") // Keep only alphanumeric
        .trim()
        .toLowerCase()
}

/**
 * FUENTE ÚNICA del estado "anulada" de una venta. Una venta anulada (que en
 * Liquidaciones se muestra como "NULL") NO debe contar en ningún cálculo/conteo.
 * Cubre todas las variantes: anulado 'Si'/'Sí'/'SI' (con o sin acento, mayúsculas)
 * y pendiente 'Anulado'. Cualquier filtro de ventas que cuente debe usar esto y NO
 * recrear el check a mano (así no se vuelve a colar una anulada por mirar solo 'Si').
 */
export function isSaleCancelled(sale: any): boolean {
    // normalizeString quita acentos y deja minúsculas: 'Si'/'Sí'/'SI' -> 'si'; 'Anulado' -> 'anulado'.
    return normalizeString(sale?.anulado || '') === 'si' || normalizeString(sale?.pendiente || '') === 'anulado'
}

/** Inverso de isSaleCancelled: la venta cuenta (no anulada). */
export function isSaleActive(sale: any): boolean {
    return !isSaleCancelled(sale)
}

/**
 * Nombre de la palanca nueva de Repos (ago-2026). Vive aquí, en el módulo hoja,
 * para que la use todo el mundo igual: el catálogo, el motor de comisiones y el
 * cálculo de lo que factura la empresa. La clave NO es 'Repos': esa ya la ocupa
 * la pestaña vieja «Arpu (Repos)».
 */
export const PALANCA_REPOS = 'Repos UP'

/**
 * Palanca del EXTRA de fútbol. Cada cliente de fútbol genera dos operaciones: el
 * repo de verdad (78 €, palanca Repos) y este extra (10 €). Viven en palancas
 * DISTINTAS a propósito: así los 10 € no engordan la base del % de Repos, y esta
 * línea es la que cuenta como UNA unidad en la regla «Repo Fútbol».
 */
export const PALANCA_REPO_FUTBOL = 'Repo Fútbol'

/**
 * REPO DE ARPU CON IMPORTE A MANO (ago-2026). FUENTE ÚNICA del multiplicador.
 *
 * Telefónica paga estos reposicionamientos «en función incremental del ARPU real
 * (IVA incluido)»: no hay tarifa fija, se cobra un múltiplo de lo que le sube la
 * factura al cliente. Hasta ahora eso se tecleaba eligiendo UNO DE CUATRO
 * productos (uno por tramo) con el multiplicador guardado en el catálogo: si el
 * tramitador se equivocaba de tramo, el importe salía mal y no lo veía nadie.
 * Ahora hay UN producto, se teclea el incremento y el tramo lo pone el programa.
 *
 * LA TABLA (comunicado de Telefónica, confirmada por el dueño el 14-ago-2026):
 *   · ∆ARPU >= 10 €  →  ×2   (200 %)
 *   · ∆ARPU <  10 €  →  ×1,5 (150 %)
 * Coincide EXACTAMENTE con los cuatro productos viejos (< 6 € y 6-10 € → 1,5;
 * 10-35 € y >= 35 € → 2), así que el dinero no cambia: lo que desaparece es la
 * posibilidad de equivocarse de tramo.
 *
 * OJO: el multiplicador vive AQUÍ y no en el catálogo porque una fila de catálogo
 * solo admite UN multiplicador (por eso hacían falta cuatro productos). La casilla
 * «Multiplicador X» de esa fila se deja vacía: no se lee.
 */
export const REPO_ARPU_PRODUCTO = 'Reposicionamientos destino BAF miMovistar/Fusión'
export const REPO_ARPU_CORTE = 10

/** Número tecleado a la española ('12,50') o a la inglesa ('12.50'). Nunca NaN. */
function _numArpu(v: any): number {
    const n = parseFloat(String(v ?? '').replace(',', '.'))
    return isNaN(n) ? 0 : n
}

/**
 * ¿Es el producto de repo de ARPU que se teclea con el incremento a mano?
 * Se reconoce por el nombre para que el dueño pueda darlo de alta en el catálogo
 * sin tocar código. NO confundir con los CUATRO viejos («Repos destino BAF …
 * incremento de ARPU < 6€»…), que llevan sus dos casillas Fact. Anterior/Nueva:
 * aquellos dicen «incremento de ARPU» y este empieza por «Reposicionamientos».
 */
export function esRepoArpuManual(producto?: string | null): boolean {
    const p = normalizeString(producto || '')
    return p.includes('reposicionamientos') && p.includes('destinobaf')
}

/** El multiplicador que toca según el incremento de ARPU tecleado. */
export function factorRepoArpu(incremento: any): number {
    return _numArpu(incremento) >= REPO_ARPU_CORTE ? 2 : 1.5
}

/** Lo que se cobra por el repo: el incremento por su multiplicador (2 decimales). */
export function importeRepoArpu(incremento: any): number {
    const inc = Math.max(0, _numArpu(incremento))
    return Math.round(inc * factorRepoArpu(inc) * 100) / 100
}

/**
 * Rastro que se guarda en las anotaciones de la venta. Sin él, un importe de
 * 24 € podría venir de 12 × 2 o de 16 × 1,5 y no habría forma de saberlo: la
 * venta solo guarda el resultado, y el tramo ya no viaja en el nombre del
 * producto como pasaba con los cuatro viejos.
 */
export function rastroRepoArpu(incremento: any): string {
    const inc = Math.max(0, _numArpu(incremento))
    const factor = String(factorRepoArpu(inc)).replace('.', ',')
    return `Incremento ARPU ${inc.toFixed(2).replace('.', ',')} € × ${factor} (IVA incl.)`
}

/**
 * FUENTE ÚNICA de "esta venta ya no cuenta para el COBRO porque tiene una
 * corrección" (ago-2026). Los precios de los Repos estaban mal; en vez de
 * reescribir un mes ya pagado, a la venta vieja se le cuelga una HIJA con el
 * importe bueno. La madre queda marcada:
 *   · sigue pagando LA MISMA comisión que se pactó (eso no se toca), pero
 *   · deja de sumar en lo que factura la empresa, o se cobraría dos veces.
 * OJO: esto NO es lo mismo que anulada. Una venta sustituida no está anulada:
 * existió, se pagó su comisión y se cobró — con el importe de su hija.
 */
export function esVentaSustituida(sale: any): boolean {
    return sale?.sustituida === true || String(sale?.sustituida).toLowerCase() === 'true'
}

/** true si la venta ES una corrección contable (la hija de otra). */
/**
 * Linea de CORRECCION de los Repos que no debe contar como venta nueva.
 * Es toda hija (sustituyeA) o toda venta de las palancas nuevas con fecha
 * anterior al 01/08/2026: son apuntes contables de meses ya pagados. Vive aqui
 * para que la usen tambien el territorial y el Resumen MOD, que contaban tres
 * unidades por cada cliente de futbol corregido (y el territorial paga por
 * unidades: 300 €/500 € por tienda).
 */
export function esCorreccionRepos(sale: any): boolean {
  const f = String(sale?.fecha || '').trim()
  if (f.length < 10 || f[2] !== '/' || f[5] !== '/') return false
  const d = new Date(Number(f.slice(6, 10)), Number(f.slice(3, 5)) - 1, Number(f.slice(0, 2)))
  if (d >= new Date(2026, 7, 1)) return false
  if (String(sale?.sustituyeA || '').trim()) return true
  const cat = String(sale?.categoria || sale?.detalle || sale?.sheet || '').trim().toLowerCase()
  return cat === PALANCA_REPOS.toLowerCase()
      || cat === PALANCA_REPO_FUTBOL.toLowerCase()
      || cat === 'repo futbol'
}

export function esCorreccionDeOtra(sale: any): boolean {
    return !!String(sale?.sustituyeA || '').trim()
}

/**
 * "Señalización Solar 360": ni la cobra la empresa ni se paga al comercial. Se elimina de
 * comisiones Y de los listados de operaciones. Fuente única para detectarla (por producto;
 * en los datos llega como detalle='Varios' + producto 'Solar360 (...)').
 */
export function isSolar360(sale: any): boolean {
    const hay = (x: any) => { const s = String(x || '').toLowerCase(); return s.includes('solar360') || s.includes('solar 360') }
    return hay(sale?.producto) || hay(sale?.categoria) || hay(sale?.detalle)
}

/**
 * Parses a Spanish DD/MM/YYYY date string into a Date object for comparison.
 */
export function parseSpanishDate(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        return new Date(y, m, d, 0, 0, 0, 0); // Normalized to midnight
    }
    return null;
}

/**
 * Checks if a specific sale date falls within a catalog version's validity window.
 * Returns true if the dates overlap or if boundaries are null.
 */
export function isVentaWithinDates(ventaFechaParam?: string | null, validFrom?: string | null, validTo?: string | null): boolean {
    const saleDate = parseSpanishDate(ventaFechaParam);
    if (!saleDate) return true; // If sale has no valid date, safely assume it matches standard monthly config
    
    const sTime = saleDate.getTime();

    const fromDate = parseSpanishDate(validFrom);
    if (fromDate && sTime < fromDate.getTime()) return false;

    const toDate = parseSpanishDate(validTo);
    if (toDate && sTime > toDate.getTime()) return false;

    return true; // Match!
}

/**
 * Clave de producto EXACTA para casar venta↔catálogo: quita acentos, espacios y
 * mayúsculas pero CONSERVA los símbolos. normalizeString borra el "+" y colapsa
 * "Galaxy S26" con "Galaxy S26+" (pares reales del catálogo Rent que solo se
 * distinguen por el símbolo), aplicando la tarifa del modelo equivocado.
 */
export function productKeyExact(str: string): string {
    return String(str || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/\s+/g, "")             // Remove whitespace (keep symbols!)
        .toLowerCase()
}

/**
 * VIGENCIAS — FUENTE ÚNICA del "¿qué fila del catálogo le toca a esta venta?".
 * Un producto puede tener varias filas con ventanas Desde/Hasta distintas (p. ej.
 * un Rent que cambia de precio a mitad de mes). El desempate es siempre:
 *   1º la fila cuya ventana CUBRE la fecha de la venta,
 *   2º si ninguna cubre (o la venta no tiene fecha), la primera que casa.
 * Antes cada pantalla repetía este filtro con desempates distintos (unas caían a
 * la primera fila, otras a la última) y con dos vigencias el cuadre entre
 * Liquidación/Comisiones/Operaciones se rompía en silencio. Cualquier lookup de
 * catálogo por producto debe pasar por aquí y NO recrear el filtro a mano.
 *
 * Matching en DOS NIVELES: primero por clave exacta (productKeyExact, que
 * conserva el "+" y demás símbolos → no confunde S26 con S26+); solo si esa
 * clave no casa NADA se cae a normalizeString (el criterio histórico, tolerante
 * con puntuación), para que ninguna venta antigua pierda el match que ya tenía.
 * `matcher` opcional para claves compuestas (O2: producto+subcategoría, etc.).
 */
export function findCatalogVigente(
    list: any[],
    producto: string,
    fechaVenta?: string | null,
    matcher?: (c: any) => boolean
): any | null {
    let cands: any[]
    if (matcher) {
        cands = (list || []).filter(matcher)
    } else {
        const exact = productKeyExact(producto)
        cands = (list || []).filter((c: any) => productKeyExact(c?.producto) === exact)
        if (cands.length === 0) {
            const target = normalizeString(producto)
            cands = (list || []).filter((c: any) => normalizeString(c?.producto) === target)
        }
    }
    if (cands.length === 0) return null
    if (cands.length === 1) return cands[0]
    const covering = cands.find((c: any) => isVentaWithinDates(fechaVenta, c.validFrom, c.validTo))
    return covering || cands[0]
}


/**
 * Guesses the assigned Grupo/Categoria based on common substrings in the product name.
 * Handles the retroactive logic where older rows have no Grupo attached.
 */
function guessCategory(productoName: string): string {
    const prod = (productoName || '').toLowerCase()
    
    if (prod.includes('tgt') || prod.includes('ti') || prod.includes('alarma') || prod.includes('ciber')) return 'TI'
    if (prod.includes('fusion') || prod.includes('fusión') || prod.includes('fibra') || prod.includes('baf') || prod.includes('internet')) return 'FIBRA'
    if (prod.includes('tma') || prod.includes('mfe') || prod.includes('fijo')) return 'TMA'
    if (prod.includes('movil') || prod.includes('móvil') || prod.includes('mv') || prod.includes('porta') || prod.includes('linea')) return 'MÓVIL'
    if (prod.includes('micro') || prod.includes('microsoft') || prod.includes('m365')) return 'MICRO'
    if (prod.includes('xcu') || prod.includes('básico') || prod.includes('basico')) return 'BÁSICO XCU'

    return 'FIBRA' // Fallback
}

/**
 * Returns the current month in the "YYYYMM" format used by the application,
 * determining whether the sale is in the "live" sync window or historical.
 */
export function getCurrentMonthString(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0') // 01 to 12
    return `${year}${month}`
}

/**
 * Standardizes a sale object, merging old fields into new ones,
 * cleaning monetary values into strict floats, and ensuring category classification.
 */
export function sanitizeSale(sale: any): any {
    const s = { ...sale }

    // 1. Unify 'cuota' and 'importe' into 'importe' 
    // Old data used 'cuota'
    let rawValue = s.importe || s.cuota || '0'
    
    // 2. Clean numerical value (remove €, spaces, replace comma with dot)
    if (typeof rawValue === 'string') {
        rawValue = rawValue.replace('€', '').replace(/\s/g, '').replace(',', '.')
    }
    const cleanImporte = parseFloat(rawValue) || 0;
    
    // Store back both so UI that depends on either still works, 
    // but the unified truth is 'importe'
    s.importe = cleanImporte

    // 3. Retroactively assign Grupo / Categoria if missing
    // In older rows, 'categoria' and 'sheet' were often missing or varied
    const existingGroup = s.categoria || s.sheet || s.grupo || ''
    
    if (!existingGroup || existingGroup.trim() === '') {
         s.categoria = guessCategory(s.producto)
    } else {
         s.categoria = existingGroup.toUpperCase()
    }
    
    // Explicit overrides for exact mappings
    const prodLower = String(s.producto || '').toLowerCase();
    if (prodLower.includes('xcu') || prodLower.includes('básico') || prodLower.includes('basico')) {
         s.categoria = 'BÁSICO XCU';
         s.sheet = 'BÁSICO XCU';
         s.codigo = 'BÁSICO XCU';
    }

    // Normalize mapping for operations
    if (!s.grupo || String(s.grupo).trim() === '') {
        s.grupo = s.categoria
    }

    return s
}

/**
 * Centralized dynamic commission calculator.
 * Takes a sanitized sale and the currently processed dashboard configuration, 
 * and returns the exact € payout.
 */
export function calculateDynamicCommission(sale: any, dashboardDataRows: any[], overrideBaseValue?: number): number {
    if (isSaleCancelled(sale)) return 0;
    if (sale.producto && String(sale.producto).toLowerCase().includes('solar360')) return 0;
    
    // If we have no dashboard data to compare against, we can't calculate blue commission
    if (!dashboardDataRows || dashboardDataRows.length === 0) return 0;

    const product = normalizeString(sale.producto);

    // Find the matching dashboard row (using the unified NFD logic)
    const matchingRow = dashboardDataRows.find((row: any) => {
        const saleGrp = String(sale.grupo || '').trim().toUpperCase();
        const rowGrp = String(row.grupo || '').trim().toUpperCase();
        const isFallback = ['FIBRA', 'MÓVIL', 'MICRO', 'TMA', 'BÁSICO XCU'].includes(saleGrp);
        // ALARMAS/MPA rows match by product name only (sold under any segment group)
        const isRowCrossGroup = rowGrp === 'MPA' || rowGrp === 'ALARMAS';
        if (saleGrp && rowGrp && !isFallback && !isRowCrossGroup && saleGrp !== rowGrp) {
            return false;
        }

        let mapped: string[] = []
        
        if (row.isHeader || row.isCategoryTotal || row.isBoundary) return false;

        // Explicit category override from the Unified form
        const detGroup = String(sale.detalle || '').trim().toUpperCase();
        if (detGroup === 'TI' && row.grupo === 'TI') return true;
        if (detGroup === 'TMA' && row.grupo === 'TMA') return true;
        if (detGroup === 'MICRO' && (row.grupo === 'MICRO' || row.grupo === 'MIC')) return true;

        if (row.grupo === 'TI' && (product.includes('ti') || product.includes('tgt') || product === 'servicio no kd')) return true;
        if (row.grupo === 'TMA' && (product.includes('tma') || product.includes('mfe') || product.includes('fijo'))) return true;
        if (row.grupo === 'MICRO' || row.grupo === 'MIC') {
            if (product.includes('micro') || product.includes('m365')) return true;
        }
        if (row.grupo === 'ALARMAS' || row.grupo === 'MPA') {
            if (product.includes('alarma')) return true;
        }

        if (row.grupo === 'TI' || row.grupo === 'ALARMAS' || row.grupo === 'MICRO' || row.grupo === 'TMA') {
            // If they belong to the group but didn't match the hardcoded strings, fallback to string splitting
            mapped = String(row.concepto || '').split('/').map(v => normalizeString(v))
        } else {
            // Mirror renderDashboardData: check operacionesAsignadas first, then OBJECTIVE_MAPPING
            if (row.operacionesAsignadas && String(row.operacionesAsignadas).trim() !== '') {
                mapped = String(row.operacionesAsignadas).split(',').map((s: string) => normalizeString(s))
            } else {
                mapped = [
                    normalizeString(row.concepto),
                    ...(OBJECTIVE_MAPPING[row.concepto] || []).map((s: string) => normalizeString(s))
                ]
            }
        }

        return mapped.includes(product)
    })

    if (!matchingRow) return 0;

    let cleanImporte = 0;
    if (sale.importe) {
        let s = String(sale.importe).replace(/[^\d,\.-]/g, '').trim();
        if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
        cleanImporte = Number(s) || 0;
    }
    const saleValue = overrideBaseValue !== undefined ? overrideBaseValue : (Number(sale.cuota) || cleanImporte);
    
    // Percentage vs Flat Rate logic mapping exactly the Liquidaciones dashboard rules
    const isMonetary = matchingRow.isPercentage === true;

    const rawValue = isMonetary ? (saleValue * (matchingRow.tramoVal / 100)) : matchingRow.tramoVal;
    return Math.round(rawValue * 100) / 100;
}

/**
 * Calculates the dashboard metrics (achieved units, % of goal, and Tramo value mapping)
 * for a given profile (Pyme or Captador) based on existing sales and objective settings.
 */
export function renderDashboardData(
    profile: 'Pyme' | 'Captador',
    configRows: any[],
    objProfile: any,
    filteredSalesGlobal: any[],
    objGrupos: any,
    periodData?: any
) {
    const mult = periodData?.pymeMultiplier ?? 5;
    const t1 = periodData?.tramo1Limit ?? 50;
    const t2 = periodData?.tramo2Limit ?? 80;
    const t3 = periodData?.tramo3Limit ?? 100;

    // Repartidor Logic: Filter operations by profile-specific codes (Real Names)
    const profileSales = filteredSalesGlobal.filter(s => {
        const codigoLower = String(s.codigo || '').trim().toLowerCase();

        const isBasico = codigoLower.includes('básico xcu') || codigoLower.includes('basico xcu');
        
        const plusCodesExact = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7'];
        const isPlus = plusCodesExact.some(c => codigoLower.includes(c));

        if (profile === 'Pyme') {
            // Pyme (Lime Green) tracks 'VENTAS vs IMPORTES PLUS'
            return isPlus;
        } else {
            // Captador (Cyan Blue) tracks 'VENTAS vs IMPORTES BÁSICO'
            return isBasico;
        }
    })

    const precalcRows = configRows.map(row => {
        const objKey = row.concepto
        let mappedProducts: string[] = []
        if (row.operacionesAsignadas && String(row.operacionesAsignadas).trim() !== '') {
            mappedProducts = String(row.operacionesAsignadas).split(',').map((s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase())
        } else if (row.concepto && String(row.concepto).includes(',')) {
            mappedProducts = String(row.concepto).split(',').map((s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase())
        } else {
            mappedProducts = [
                String(row.concepto || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
            ]
        }

        const monGroup = String(row.grupo || '').trim().toUpperCase()
        let quantity = 0
        let quantityPending = 0
        let isMonetary = row.isPercentage === true
        let matchedOps: any[] = []
        let matchedOpsPending: any[] = []
        
        const filterByGroup = (s: any) => {
            const saleGrp = String(s.grupo || '').trim().toUpperCase();
            const rowGrp = String(row.grupo || '').trim().toUpperCase();
            const isFallback = ['FIBRA', 'MÓVIL', 'MICRO', 'TMA', 'BÁSICO XCU'].includes(saleGrp);
            // ALARMAS/MPA rows match by product name only (sold under any segment group)
            const isRowCrossGroup = rowGrp === 'MPA' || rowGrp === 'ALARMAS';
            if (saleGrp && rowGrp && !isFallback && !isRowCrossGroup && saleGrp !== rowGrp) return false;
            return true;
        }

        // Dual Logic: Count for units, Sum for monetary
        if (isMonetary) {
            isMonetary = true
            matchedOps = profileSales
                .filter(s => {
                    if (!filterByGroup(s)) return false;
                    const distincDet = String(s.detalle || '').trim().toLowerCase()

                    // Exact Category Matching Logic (Structural)
                    if (monGroup === 'TMA') {
                        return distincDet === 'tma' && isSaleActive(s)
                    }
                    if (monGroup === 'TI') {
                        return distincDet === 'ti' && isSaleActive(s)
                    }
                    if (monGroup === 'MICRO' || monGroup === 'MIC') {
                        return distincDet === 'micro' && isSaleActive(s)
                    }

                    // Special hardcoded match for "Dispositivos + Seguros" to mirror main dashboard logic
                    if (String(row.concepto || '').trim().toLowerCase() === 'dispositivos + seguros') {
                        const cat = String(s.categoria || '').trim().toLowerCase();
                        const det = String(s.detalle || '').trim().toLowerCase();
                        const sheet = String(s.sheet || '').trim().toLowerCase();
                        if (['rent', 'seguro'].includes(cat) || det.includes('seguro') || sheet.includes('seguro')) {
                            return isSaleActive(s);
                        }
                    }

                    // Fallback to previous mapped logic for others
                    if (!s.producto && !s.categoria) return false
                    const saleProd = String(s.producto || s.categoria).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
                    return mappedProducts.includes(saleProd) && isSaleActive(s)
                })

            // Separate confirmed vs pending for display — both still shown in table
            matchedOpsPending = matchedOps.filter(s => s.estado === 'Pendiente' || s.pendiente === 'Si')
            matchedOps = matchedOps.filter(s => s.estado !== 'Pendiente' && s.pendiente !== 'Si')

            quantity = matchedOps.reduce((acc, s) => {
                let rowSum = 0;
                const cat = String(s.categoria || '').trim().toLowerCase();
                const det = String(s.detalle || '').trim().toLowerCase();
                const sheet = String(s.sheet || '').trim().toLowerCase();
                const prod = String(s.producto || '').trim().toLowerCase();
                
                // Si es un seguro puro (añadido desde el botón + Seguro)
                const isExclusivelySeguro = cat.includes('seguro') || det.includes('seguro') || sheet.includes('seguro') || prod.includes('seguro');
                
                if (isExclusivelySeguro) {
                    if (s.seguroImporte && Number(s.seguroImporte) > 0) {
                        rowSum += Number(s.seguroImporte);
                    } else {
                        // Seguro antiguo sin seguroImporte, usamos lo que haya
                        const rawImporte = String(s.importe || s.cuota || '0');
                        rowSum += parseFloat(rawImporte.replace('€', '').replace(/\s/g, '').replace(',', '.')) || 0;
                    }
                } else {
                    // Es un terminal u otro producto. Sumamos su importe base.
                    const rawImporte = String(s.importe || s.cuota || '0');
                    rowSum += parseFloat(rawImporte.replace('€', '').replace(/\s/g, '').replace(',', '.')) || 0;
                    
                    // Si además tiene un seguro pegado en la misma línea, lo sumamos también
                    if (s.seguroImporte && Number(s.seguroImporte) > 0) {
                        rowSum += Number(s.seguroImporte);
                    }
                }
                
                return acc + rowSum;
            }, 0)
            quantityPending = matchedOpsPending.reduce((acc, s) => {
                let rowSum = 0;
                const cat = String(s.categoria || '').trim().toLowerCase();
                const det = String(s.detalle || '').trim().toLowerCase();
                const sheet = String(s.sheet || '').trim().toLowerCase();
                const prod = String(s.producto || '').trim().toLowerCase();
                
                const isExclusivelySeguro = cat.includes('seguro') || det.includes('seguro') || sheet.includes('seguro') || prod.includes('seguro');
                
                if (isExclusivelySeguro) {
                    if (s.seguroImporte && Number(s.seguroImporte) > 0) {
                        rowSum += Number(s.seguroImporte);
                    } else {
                        const rawImporte = String(s.importe || s.cuota || '0');
                        rowSum += parseFloat(rawImporte.replace('€', '').replace(/\s/g, '').replace(',', '.')) || 0;
                    }
                } else {
                    const rawImporte = String(s.importe || s.cuota || '0');
                    rowSum += parseFloat(rawImporte.replace('€', '').replace(/\s/g, '').replace(',', '.')) || 0;
                    
                    if (s.seguroImporte && Number(s.seguroImporte) > 0) {
                        rowSum += Number(s.seguroImporte);
                    }
                }
                
                return acc + rowSum;
            }, 0)
        } else if (mappedProducts.length > 0) {
            let allMatched = profileSales.filter(s => {
                if (!s.producto) return false
                if (!filterByGroup(s)) return false;
                const saleProd = String(s.producto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
                return mappedProducts.includes(saleProd) && isSaleActive(s)
            })
            matchedOpsPending = allMatched.filter(s => s.estado === 'Pendiente' || s.pendiente === 'Si')
            matchedOps = allMatched.filter(s => s.estado !== 'Pendiente' && s.pendiente !== 'Si')
            quantity = matchedOps.length
            quantityPending = matchedOpsPending.length
        }

        const normalizeStr = (str: string) => String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
        const searchGrupo = normalizeStr(row.grupo)
        const currentObjGrupos = objGrupos[profile] || {}

        // The user requested that we find the row in Objetivos where GRUPO matches EXACTLY.
        // We sum all matches in case there are multiple, or just take the mapped value.
        let autoTarget = 0
        for (const k of Object.keys(objProfile)) {
            const kGrupo = normalizeStr(currentObjGrupos[k])
            const kConcept = normalizeStr(k)

            // If the objective row's group matches, OR its name matches the group directly
            if (kGrupo === searchGrupo || kConcept === searchGrupo) {
                autoTarget += (parseFloat(objProfile[k]) || 0)
            }
        }

        return { ...row, quantity, quantityPending, isMonetary, autoTarget, matchedOps, matchedOpsPending }
    })

    const groupStats: { [g: string]: { totalVentas: number, totalVentasPendientes: number, groupTarget: number, groupPje: number, groupPjeProyectado: number } } = {}
    for (const row of precalcRows) {
        const grupoStr = String(row.grupo || '').trim().toUpperCase()
        const calculatedTarget = profile === 'Pyme' ? row.autoTarget * mult : row.autoTarget
        if (grupoStr) {
            if (!groupStats[grupoStr]) {
                groupStats[grupoStr] = { totalVentas: 0, totalVentasPendientes: 0, groupTarget: calculatedTarget, groupPje: 0, groupPjeProyectado: 0 }
            }
            groupStats[grupoStr].totalVentas += row.quantity
            groupStats[grupoStr].totalVentasPendientes += row.quantityPending
        }
    }
    for (const g in groupStats) {
        const stats = groupStats[g]
        // For % cump: use TOTAL (confirmed + pending) so tramo rate reflects all sold units
        stats.groupPje = stats.groupTarget > 0 ? ((stats.totalVentas + stats.totalVentasPendientes) / stats.groupTarget) * 100 : 0
        stats.groupPjeProyectado = stats.groupTarget > 0 ? ((stats.totalVentas + stats.totalVentasPendientes) / stats.groupTarget) * 100 : 0
    }

    const calcRows = precalcRows.map(row => {
        const grupoStr = String(row.grupo || '').trim().toUpperCase()
        let pje = 0
        let pjeProyectado = 0
        let target = profile === 'Pyme' ? row.autoTarget * mult : row.autoTarget

        if (grupoStr && groupStats[grupoStr]) {
            target = groupStats[grupoStr].groupTarget
            pje = groupStats[grupoStr].groupPje
            pjeProyectado = groupStats[grupoStr].groupPjeProyectado
        } else {
            pje = target > 0 ? (row.quantity / target) * 100 : 0
            pjeProyectado = target > 0 ? ((row.quantity + row.quantityPending) / target) * 100 : 0
        }

        // Determine Tramo dinámico REAL
        let tramoVal = 0
        if (pje < t1) tramoVal = row.comisionNacionalMenos50 || 0
        else if (pje >= t1 && pje < t2) tramoVal = row.comisionNacionalEntre50Y80 || 0
        else if (pje >= t2 && pje <= t3) tramoVal = row.comisionNacionalEntre80Y100 || 0
        else tramoVal = row.comisionNacionalMas100 || 0
        
        // Determine Tramo dinámico PROYECTADO
        let tramoValProyectado = 0
        if (pjeProyectado < t1) tramoValProyectado = row.comisionNacionalMenos50 || 0
        else if (pjeProyectado >= t1 && pjeProyectado < t2) tramoValProyectado = row.comisionNacionalEntre50Y80 || 0
        else if (pjeProyectado >= t2 && pjeProyectado <= t3) tramoValProyectado = row.comisionNacionalEntre80Y100 || 0
        else tramoValProyectado = row.comisionNacionalMas100 || 0

        const isPercentageGroup = row.isPercentage === true;
        // ALL products use TOTAL (confirmed+pending) for importe — same as % CUMP uses total
        const totalQty = row.quantity + row.quantityPending
        let importe = isPercentageGroup ? (totalQty * (tramoVal / 100)) : (totalQty * tramoVal)
        let importeProyectado = importe // same as importe since pje == pjeProyectado

        return { ...row, pje, pjeProyectado, autoTarget: row.autoTarget, target, tramoVal, tramoValProyectado, importe, importeProyectado }
    })

    const totalImporte = calcRows.reduce((acc, row) => acc + row.importe, 0)
    const totalImporteProyectado = calcRows.reduce((acc, row) => acc + row.importeProyectado, 0)

    return { rows: calcRows, totalImporte, totalImporteProyectado }
}
