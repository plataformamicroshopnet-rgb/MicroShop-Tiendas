// Emparejado venta ↔ tipo de venta (PURO, sin React). Vivía en hooks/useComisionesData
// (un Client Component por el useEffect), lo que impedía usarlo en endpoints de servidor
// (p. ej. territorial-export). Extraído aquí; useComisionesData lo re-exporta para no
// romper los imports existentes.

// Parseador de Fórmulas de Productos (soporta exclusiones con " -").
export const matchProductFormula = (productName: string, formula: string) => {
    if (!formula || !productName) return false;
    const p = String(productName).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const orBlocks = formula.split('+').map((b: string) => b.trim());
    for (const block of orBlocks) {
        if (!block) continue;
        const parts = block.split(' -').map(part => part.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
        const mustInclude = parts[0];
        const mustNotIncludes = parts.slice(1);

        if (mustInclude && p.includes(mustInclude)) {
            let isExcluded = false;
            for (const excl of mustNotIncludes) {
                if (excl && p.includes(excl)) {
                    isExcluded = true;
                    break;
                }
            }
            if (!isExcluded) return true;
        }
    }
    return false;
};

/** true si la venta es de agosto de 2026 en adelante (corte del rediseño de los Repos). */
export const esDesdeAgosto2026 = (s: any): boolean => {
    const f = String(s?.fecha || '').trim()          // dd/mm/aaaa
    if (f.length < 10 || f[2] !== '/' || f[5] !== '/') return false
    const d = new Date(Number(f.slice(6, 10)), Number(f.slice(3, 5)) - 1, Number(f.slice(0, 2)))
    return d >= new Date(2026, 7, 1)
}

/** El token de la palanca territorial del fútbol (TC1435). */
export const TIPO_FUTBOL_TERRITORIAL = 'Altas Fútbol + Desarrollo TV'

/** Tipo de venta EFECTIVO de una regla de la Entrada de Datos (TERRITORIAL
 *  TIENDAS). La regla del fútbol guardada con el valor viejo «Repo Fútbol»
 *  cuenta con el token nuevo, que replica lo que Telefónica mide en el TC1435
 *  (las altas con fútbol incluidas): así no hay que tocar las reglas ya
 *  guardadas de cada mes. Si en el desplegable se elige otro tipo, se respeta.
 *  SOLO para las reglas territoriales: la palanca «Repo Fútbol» de las
 *  comisiones de los comerciales sigue contando únicamente los repos. */
export const tipoVentaDeReglaTerritorial = (rule: any): string => {
    const nombre = String(rule?.nombre || '').toLowerCase()
    const tv = String(rule?.tipoVenta || '').trim().toLowerCase()
    if ((tv === 'repo fútbol' || tv === 'repo futbol')
        && (nombre.includes('fútbol') || nombre.includes('futbol')))
        return TIPO_FUTBOL_TERRITORIAL
    return rule?.tipoVenta || ''
}

/** Para la palanca territorial del fútbol: ¿esta fila se salva del filtro de
 *  correcciones? Los repos de julio se re-tejearon el 09-ago como madre
 *  sustituida + hija de 78 € + hija de 10 €, y el filtro genérico tiraba las
 *  TRES: julio contaba 0 repos (26 en vez de 84) y pintaba 0 € en un mes que
 *  Telefónica paga al tramo 2. La hija del extra (palanca «Repo Fútbol») es LA
 *  unidad del cliente corregido: una por cliente. La madre sustituida y la
 *  hija de 78 € siguen fuera. */
export const seSalvaDelFiltroFutbol = (tipoVenta: string, sale: any): boolean => {
    if (tipoVenta !== TIPO_FUTBOL_TERRITORIAL) return false
    const cat = String(sale?.categoria || sale?.detalle || sale?.sheet || '').trim().toLowerCase()
    return cat === 'repo futbol' || cat === 'repo fútbol'
}

export const matchTipoVenta = (sale: any, tipoVentaRaw: string) => {
    if (!tipoVentaRaw) return false;

    // El MultiSelectDropdown separa los valores con comas
    const tipos = tipoVentaRaw.split(',').map(s => s.trim()).filter(Boolean);

    const catRaw = sale.categoria || sale.detalle || sale.sheet || '';
    const cat = String(catRaw).trim().toLowerCase();
    const prod = String(sale.producto || '').trim().toLowerCase();

    for (const tipoVenta of tipos) {
        if (tipoVenta === 'FORMULA_LIBRE') continue;

        let matched = false;
        if (cat === 'o2') {
            const target = String(tipoVenta).trim().toLowerCase();
            if (target === 'o2') {
                const prodName = prod.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                // Comodín 'O2' = SOLO fibras: externas ('Fibra …') + internas ('Interna
                // Fibra …'). Regla del dueño (transmitida por O2, jul-2026): las Fibras
                // Adicionales y las líneas móviles NO cuentan para los bonos. Antes el
                // prefijo 'interna*' arrastraba las 'Interna Linea Movil …' (líneas
                // móviles) y 'fibra*' las 'Fibra Adicional …' a los bonos mensual y
                // trimestral. Si algún mes deben contar, se añaden por nombre EXACTO
                // a la lista "Tipo de Venta" de la regla.
                matched = (prodName.startsWith('fibra') || prodName.startsWith('interna fibra'))
                    && !prodName.includes('adicional');
            } else {
                matched = (prod === target);
            }
        } else {
            switch (tipoVenta.toLowerCase().trim()) {
                case 'alta baf total':
                    matched = cat === 'mimovistar' || cat === 'resto baf' || prod.includes('baf total') || (prod.includes('fibra') && !prod.includes('movil') && !prod.includes('móvil') && !prod.includes('migraci'));
                    break;
                case 'alta baf convergente':
                    matched = cat === 'mimovistar' || prod.includes('baf convergente') || prod.includes('fd total') || prod.includes('fd flex') || (prod.includes('fibra') && (prod.includes('movil') || prod.includes('móvil')));
                    break;
                case 'dispositivos + seguro':
                case 'dispositivos + seguros':
                    matched = cat === 'rent' || cat === 'seguro';
                    break;
                case 'dispositivos':
                    matched = cat === 'rent';
                    break;
                case 'seguro':
                    matched = cat === 'seguro';
                    break;
                case 'swap':
                    matched = sale.isSwap === true || String(sale.isSwap).toLowerCase() === 'true';
                    break;
                case 'mpa':
                    matched = prod.includes('movistar prosegur alarmas') || prod.includes('mpa') || prod.includes('alarma');
                    break;
                case 'fttr':
                    matched = prod.includes('solución fttr') || prod.includes('solucion fttr') || prod.includes('fttr');
                    break;
                case 'señalización solar 360':
                    matched = prod.includes('solar360') || prod.includes('solar 360') || prod.includes('solar');
                    break;
                case 'arpu':
                    // DESDE AGOSTO 2026 la palanca de los repos es «Repos (Arpu)»
                    // (categoría 'Repos UP') y el dueño paga el % sobre TODOS sus
                    // repos, el de fútbol incluido: por eso aquí no va la exclusión
                    // del fútbol que sí tiene el histórico (allí el fútbol venía por
                    // otro cable). Sin esta rama, una regla que siga diciendo «ARPU»
                    // en su casilla dejaría de casar con las ventas nuevas y la
                    // palanca pagaría 0 € sin que nadie lo viera.
                    matched = esDesdeAgosto2026(sale)
                        ? (cat === 'repos up' || cat === 'repos')
                        : (cat === 'repos' && !prod.includes('fútbol') && !prod.includes('futbol'));
                    break;
                case 'extra repos up destino fútbol':
                case 'extra repos up destino futbol':
                    // Nombre VIEJO del producto, que muchas reglas tienen escrito en su
                    // casilla «Tipo de Venta». Desde agosto el extra es una palanca con
                    // nombre propio: se trata igual que el token «Repo Fútbol» para que
                    // las reglas ya configuradas sigan funcionando sin tocarlas.
                    if (esDesdeAgosto2026(sale)) {
                        // Conviven las dos formas: la nueva (palanca «Repo Fútbol») y la
                        // vieja que se sigue tecleando en «Repos» con el producto de
                        // siempre. Una unidad cada una; nunca las dos por el mismo cliente.
                        matched = cat === 'repo futbol' || cat === 'repo fútbol'
                            || (cat === 'repos' && prod.includes('extra repo')
                                && (prod.includes('fútbol') || prod.includes('futbol')));
                    } else {
                        // Antes de agosto, EXACTAMENTE lo que hacía la rama por
                        // defecto con este mismo texto: ni un céntimo se mueve.
                        const s0 = `${prod} ${String(sale.detalle || '').toLowerCase()} ${String(sale.grupo || '').toLowerCase()}`;
                        matched = tipoVenta.toLowerCase().trim() === cat || matchProductFormula(s0, tipoVenta);
                    }
                    break;
                case 'repo fútbol':
                case 'repo futbol':
                    // DESDE AGOSTO 2026: un cliente de fútbol genera DOS líneas —el repo
                    // de 78 € y el extra de 10 €— y las dos llevan «Fútbol» en el nombre.
                    // Si se casara por el nombre, un cliente contaría DOS altas. Se casa
                    // por PALANCA: solo la del extra es la que cuenta como alta.
                    // Las hijas de LaLiga/Champions (29-ago) NO cuentan aquí: su unidad
                    // es la MADRE de Repos (Arpu), y esta palanca es la de Fútbol Total.
                    // Antes de agosto, el criterio de siempre (histórico intacto).
                    matched = esDesdeAgosto2026(sale)
                        ? ((cat === 'repo futbol' || cat === 'repo fútbol'
                           || (cat === 'repos' && prod.includes('extra repo')
                               && (prod.includes('fútbol') || prod.includes('futbol'))))
                           && !prod.includes('champion') && !prod.includes('laliga') && !prod.includes('la liga'))
                        : (prod.includes('fútbol') || prod.includes('futbol') || prod.includes('repo f'));
                    break;
                case 'altas fútbol + desarrollo tv':
                case 'altas futbol + desarrollo tv':
                    // LA PALANCA TERRITORIAL DEL FÚTBOL (TC1435). Telefónica cuenta:
                    //  (a) las ALTAS de miMovistar cuyo paquete lleva Fútbol Total,
                    //      Champions o LaLiga (las promos DIGI/VODAFONE con fútbol
                    //      también son altas miMovistar), y las altas Fusión Bar;
                    //  (b) los REPOS destino fútbol —la unidad es el extra de 10 €,
                    //      una línea por cliente— y los repos destino Champions/
                    //      LaLiga, que no llevan extra. La línea de 78 € del repo
                    //      NO casa: contaría doble.
                    // Antes de agosto-2026, EXACTAMENTE el criterio viejo de «Repo
                    // Fútbol» (por nombre), que ya arrastraba las altas con fútbol:
                    // el histórico no se mueve ni una unidad (junio 52, julio 84).
                    if (esDesdeAgosto2026(sale)) {
                        const conFutbol = prod.includes('fútbol') || prod.includes('futbol')
                            || prod.includes('champion') || prod.includes('laliga') || prod.includes('la liga');
                        const esAltaFutbol = cat === 'mimovistar' && conFutbol;
                        const esFusionBar = (cat === 'mimovistar' || cat === 'resto baf')
                            && (prod.includes('fusión') || prod.includes('fusion')) && prod.includes('bar');
                        // Las hijas de LaLiga/Champions no son la unidad (lo es su
                        // madre de Repos UP, que ya cuenta en esRepoChampLiga): sin
                        // esta exclusión un repo a LaLiga contaría DOS veces.
                        const esExtraFutbol = (cat === 'repo futbol' || cat === 'repo fútbol'
                            || (cat === 'repos' && prod.includes('extra repo')
                                && (prod.includes('fútbol') || prod.includes('futbol'))))
                            && !prod.includes('champion') && !prod.includes('laliga') && !prod.includes('la liga');
                        const esRepoChampLiga = (cat === 'repos up' || cat === 'suscripciones tv')
                            && (prod.includes('champion') || prod.includes('laliga') || prod.includes('la liga'))
                            && !prod.includes('fútbol total') && !prod.includes('futbol total');
                        matched = esAltaFutbol || esFusionBar || esExtraFutbol || esRepoChampLiga;
                    } else {
                        matched = prod.includes('fútbol') || prod.includes('futbol') || prod.includes('repo f');
                    }
                    break;
                default:
                    if (tipoVenta.toLowerCase().trim() === cat) {
                        matched = true;
                    } else {
                        const searchString = `${prod} ${String(sale.detalle || '').toLowerCase()} ${String(sale.grupo || '').toLowerCase()}`;
                        matched = matchProductFormula(searchString, tipoVenta);
                    }
                    break;
            }
        }
        if (matched) return true;
    }
    return false;
};
