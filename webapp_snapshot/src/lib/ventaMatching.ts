// Emparejado venta ↔ tipo de venta (PURO, sin React). Vivía en hooks/useComisionesData
// (un Client Component por el useEffect), lo que impedía usarlo en endpoints de servidor
// (p. ej. territorial-export). Extraído aquí; useComisionesData lo re-exporta para no
// romper los imports existentes.

// Parseador de Fórmulas de Productos (soporta exclusiones con " -").
export const matchProductFormula = (productName: string, formula: string) => {
    if (!formula || !productName) return false;
    const p = String(productName).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

    const orBlocks = formula.split('+').map((b: string) => b.trim());
    for (const block of orBlocks) {
        if (!block) continue;
        const parts = block.split(' -').map(part => part.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim());
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
                const prodName = prod.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
                matched = prodName.startsWith('fibra') || prodName.startsWith('interna');
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
                    matched = cat === 'repos' && !prod.includes('fútbol') && !prod.includes('futbol');
                    break;
                case 'repo fútbol':
                case 'repo futbol':
                    matched = prod.includes('fútbol') || prod.includes('futbol') || prod.includes('repo f');
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
