import { TIENDAS_COMERCIALES } from './constants';

export const STORE_NAMES = ["Auxiliadora 45", "Correhuela", "Villamayor", "Béjar", "O2"];

const isPending = (sale: any) => {
    return sale.pendiente === 'Sí' || sale.pendiente === 'Pendiente';
};

const isValidSale = (sale: any) => {
    return sale.anulado !== 'Si' && sale.anulado !== 'Sí' && sale.pendiente !== 'Anulado';
};

// --- Product Filters ---
const isBAFNoTrasl = (sale: any) => {
    const p = sale.producto?.toLowerCase() || '';
    if (p.includes('traslado')) return false;
    
    return p.includes('alta') && p.includes('baf') ||
           p.includes('mimovistar') ||
           p.includes('conecta max') ||
           p.includes('fusion+ bar') || p.includes('fusin+ bar') ||
           p.includes('o2 no fusion') || p.includes('o2 no fusin') ||
           (p.includes('extra repos') && p.includes('futbol')) ||
           p.includes('baf'); 
};

const isBAFConvMS = (sale: any) => {
    const p = sale.producto?.toLowerCase() || '';
    return p.includes('convergente') && p.includes('movistar');
};

const isFTTR = (sale: any) => {
    const p = sale.producto?.toLowerCase() || '';
    return p.includes('fttr');
};

const isTVFutbol = (sale: any) => {
    const p = sale.producto?.toLowerCase() || '';
    const a = sale.anotaciones?.toLowerCase() || '';
    return p.includes('tv') || p.includes('futbol') || p.includes('fútbol') || a.includes('tv') || a.includes('futbol');
};

const isAlarmas = (sale: any) => {
    const p = sale.producto?.toLowerCase() || '';
    return p.includes('alarma');
};

const isDispositivos = (sale: any) => {
    const p = sale.producto?.toLowerCase() || '';
    return p.includes('dispositivo');
};

const isSeguros = (sale: any) => {
    const p = sale.producto?.toLowerCase() || '';
    return p.includes('seguro');
};

const isMovil = (sale: any) => {
    const p = sale.producto?.toLowerCase() || '';
    return p.includes('móvil') || p.includes('movil') || p.includes('porta') || p.includes('alta movil');
};

const isRepos = (sale: any) => {
    const p = sale.producto?.toLowerCase() || '';
    return p.includes('repo');
};

// --- Commission Rule Engine Helper Functions ---

// Parseador de Fórmulas de Productos (Soporta exclusiones con " -")
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

export const matchTipoVenta = (sale: any, tipoVentaRaw: string) => {
    if (!tipoVentaRaw) return false;
    
    const tipos = tipoVentaRaw.split(',').map(s => s.trim()).filter(Boolean);
    const catRaw = sale.categoria || sale.detalle || sale.sheet || '';
    const cat = String(catRaw).trim().toLowerCase();
    const prod = String(sale.producto || '').trim().toLowerCase();

    for (const tipoVenta of tipos) {
        if (tipoVenta === 'FORMULA_LIBRE') continue;
        
        let matched = false;
        switch(tipoVenta.toLowerCase().trim()) {
            case 'alta baf total':
                matched = cat === 'mimovistar' || cat === 'resto baf' || prod.includes('baf total') || (prod.includes('fibra') && !prod.includes('movil') && !prod.includes('móvil'));
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
        if (matched) return true;
    }
    return false;
};

export const parseSafeFloat = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const clean = String(val).replace('€', '').replace(/\s/g, '').replace(',', '.').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

export const isSuscripcionesTV = (s: any) => {
    const text = String(s.categoria || s.detalle || s.sheet || s.producto || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return text.includes("suscripciones tv") || text.includes("suscripcion tv");
};

export const isExtraRepoUpFutbol = (s: any) => {
    const text = String(s.producto || s.detalle || s.categoria || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return text.includes("extra repo") && text.includes("futbol");
};

export const matchesRule = (s: any, ruleName: string, ruleProductosCuentan: string) => {
    // Si la venta es de Marta (O2), aplicamos la regla simplificada según instrucción del usuario
    const isMartaSale = String(s.vendedor || '').toLowerCase().includes('marta') || String(s.detalle || '').toLowerCase() === 'o2';
    
    if (isMartaSale) {
        const normRule = String(ruleName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const prodName = String(s.producto || '').toLowerCase().trim();
        
        if (normRule.includes('altas/portas') || normRule.includes('altas fibra') || normRule === 'altas/portas fibra') {
            return prodName.startsWith('fibra');
        }
        if (normRule.includes('internas') || normRule === 'internas fibra') {
            return prodName.startsWith('interna');
        }
        return false;
    }

    const normRule = String(ruleName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (normRule === 'arpu') {
        return matchTipoVenta(s, 'ARPU') || isSuscripcionesTV(s) || isExtraRepoUpFutbol(s);
    }
    if (normRule === 'repo futbol') {
        return matchTipoVenta(s, 'Repo Fútbol') || isExtraRepoUpFutbol(s);
    }
    return matchTipoVenta(s, ruleProductosCuentan);
};

export const getValueForRule = (s: any, ruleName: string) => {
    let cuotaValue = parseSafeFloat(s.cuota);
    if (String(s.categoria || s.detalle || s.sheet).toLowerCase() === 'seguro' && s.seguroImporte) {
        cuotaValue = parseSafeFloat(s.seguroImporte);
    }

    if (ruleName === 'ARPU') {
        if (isSuscripcionesTV(s)) {
            return parseSafeFloat(s.importe || s.cuota || 0);
        }
    }
    return cuotaValue;
};

const findRule = (rules: any[], name: string) => {
    const normTgt = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return rules.find((r: any) => {
        const normName = String(r.nombre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return normName === normTgt;
    });
};

const calculateSellerObj = (rule: any, seller: string, hoursList: any[]) => {
    if (!rule) return 0;
    const comercialHour = hoursList.find(h => String(h.comercial).toLowerCase() === String(seller).toLowerCase());
    const horario = comercialHour ? Number(comercialHour.horario) : 0;
    const totalHoras = rule.totalHoras || 0;
    if (totalHoras > 0 && horario > 0) {
        return (rule.objPrimerTramo / totalHoras) * horario;
    }
    return rule.objPrimerTramo || 0;
};

const calculateStoreRuleObj = (rule: any, sellers: string[], hoursList: any[]) => {
    if (!rule) return 0;
    let sum = 0;
    sellers.forEach(seller => {
        sum += calculateSellerObj(rule, seller, hoursList);
    });
    return sum;
};

const isSellerInStore = (sellerName: string, storeSellers: string[]) => {
    const normSeller = String(sellerName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return storeSellers.some(s => {
        const normS = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return normSeller === normS;
    });
};

const countRuleSales = (storeSales: any[], rule: any) => {
    let completed = 0;
    let pending = 0;
    if (!rule) return { completed, pending };

    const ruleName = rule.nombre;
    const ruleProductosCuentan = rule.productosCuentan;
    const isPercentage = String(rule.importePrimerTramo || '').includes('%');

    storeSales.forEach(s => {
        const isPending = String(s.pendiente || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === 'si';
        
        if (matchesRule(s, ruleName, ruleProductosCuentan)) {
            const val = isPercentage ? getValueForRule(s, ruleName) : 1;
            if (isPending) {
                pending += val;
            } else {
                completed += val;
            }
        }

        if (s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet || '').toLowerCase() !== 'seguro') {
            const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
            if (matchesRule(virtualSeguro, ruleName, ruleProductosCuentan)) {
                const val = isPercentage ? getValueForRule(virtualSeguro, ruleName) : 1;
                if (isPending) {
                    pending += val;
                } else {
                    completed += val;
                }
            }
        }
    });

    return { completed, pending };
};

// --- Main Engine Function ---
export function calculateTramitacion(
    sales: any[],
    rules: any[],
    hours: any[],
    storeObjectives: any[],
    workingDaysElapsed: number,
    totalWorkingDays: number,
    o2Rules: any[] = [],
    o2Hours: any[] = []
) {
    const projectionFactor = workingDaysElapsed > 0 ? totalWorkingDays / workingDaysElapsed : 1;

    // Helper to get total store hours
    const getStoreHours = (storeName: string) => {
        const sellers = TIENDAS_COMERCIALES[storeName] || [];
        const hoursList = storeName === 'O2' ? o2Hours : hours;
        return hoursList.filter((h: any) => sellers.includes(h.comercial)).reduce((acc, h) => acc + (h.horario || 0), 0);
    };

    const globalTotalHours = hours.reduce((acc, h) => acc + (h.horario || 0), 0) || 1;

    // Helper to get global objective for a column (best guess mapping from rules)
    const getGlobalObjective = (keywords: string[]) => {
        const rule = rules.find(r => keywords.some(kw => r.nombre?.toLowerCase().includes(kw)));
        return rule?.objPrimerTramo || 0;
    };

    // Global objectives mapping (approximate for now, can be overridden)
    const globalObjs = {
        bafNoTrasl: getGlobalObjective(['baf', 'mimovistar']),
        bafConvMS: getGlobalObjective(['convergente']),
        bafNoFusionO2: getGlobalObjective(['o2 no fusion']),
        restoBaf: getGlobalObjective(['resto']),
        tvFutbol: getGlobalObjective(['tv', 'futbol']),
        alarmas: getGlobalObjective(['alarma']),
        dispSegEuros: getGlobalObjective(['dispositivo']), // Need € sum
        dispUnidades: getGlobalObjective(['dispositivo']),
        seguros: getGlobalObjective(['seguro']),
        movil: getGlobalObjective(['movil', 'porta']),
        repos: getGlobalObjective(['repo'])
    };

    const result: any = {};

    STORE_NAMES.forEach(store => {
        const sellers = TIENDAS_COMERCIALES[store] || [];
        const storeSales = sales.filter(s => isValidSale(s) && isSellerInStore(s.vendedor, sellers));
        const storeHours = getStoreHours(store);
        const storeHourRatio = storeHours / globalTotalHours;

        const exactObj = storeObjectives.find(o => o.storeName === store);

        // Find rules dynamically
        const activeRules = store === 'O2' ? o2Rules : rules;
        const activeHours = store === 'O2' ? o2Hours : hours;

        const rBafNoTrasl = findRule(activeRules, store === 'O2' ? "Altas/Portas Fibra" : "Alta BAF Total");
        const rBafConvMS = findRule(activeRules, store === 'O2' ? "Internas Fibra" : "Alta BAF Convergente");
        const rTvFutbol = store === 'O2' ? null : findRule(activeRules, "Repo Fútbol");
        const rDispSegEuros = store === 'O2' ? null : findRule(activeRules, "Dispositivos + Seguros");
        const rRepos = store === 'O2' ? null : findRule(activeRules, "ARPU");
        const rFttr = store === 'O2' ? null : findRule(activeRules, "FTTR");
        const rAlarmas = store === 'O2' ? null : findRule(activeRules, "MPA");

        // Compute Objectives (Obj)
        let bafNoTrasl_obj = 0;
        if (store === 'O2') {
            bafNoTrasl_obj = exactObj && exactObj.bafNoTrasl !== null && exactObj.bafNoTrasl !== undefined
                ? exactObj.bafNoTrasl
                : (rBafNoTrasl ? calculateStoreRuleObj(rBafNoTrasl, sellers, activeHours) : getGlobalObjective(['o2 fibra']));
        } else {
            bafNoTrasl_obj = rBafNoTrasl
                ? calculateStoreRuleObj(rBafNoTrasl, sellers, activeHours)
                : (exactObj ? ((exactObj.bafConvMS || 0) + (exactObj.bafNoFusionO2 || 0) + (exactObj.restoBaf || 0)) || globalObjs.bafNoTrasl * storeHourRatio : (globalObjs.bafNoTrasl * storeHourRatio));
        }

        let bafConvMS_obj = 0;
        if (store === 'O2') {
            bafConvMS_obj = exactObj && exactObj.bafConvMS !== null && exactObj.bafConvMS !== undefined
                ? exactObj.bafConvMS
                : (rBafConvMS ? calculateStoreRuleObj(rBafConvMS, sellers, activeHours) : 0);
        } else {
            bafConvMS_obj = rBafConvMS
                ? calculateStoreRuleObj(rBafConvMS, sellers, activeHours)
                : (exactObj ? (exactObj.bafConvMS || globalObjs.bafConvMS * storeHourRatio) : (globalObjs.bafConvMS * storeHourRatio));
        }

        const fttr_obj = store === 'O2'
            ? (exactObj ? (exactObj.fttr || 0) : 0)
            : (rFttr
                ? calculateStoreRuleObj(rFttr, sellers, activeHours)
                : (exactObj ? (exactObj.fttr || 0) : 0));

        const tvFutbol_obj = store === 'O2'
            ? (exactObj ? (exactObj.tvFutbol || 0) : getGlobalObjective(['o2 tv']))
            : (rTvFutbol
                ? calculateStoreRuleObj(rTvFutbol, sellers, activeHours)
                : (exactObj ? (exactObj.tvFutbol || globalObjs.tvFutbol * storeHourRatio) : (globalObjs.tvFutbol * storeHourRatio)));

        const alarmas_obj = store === 'O2'
            ? (exactObj ? (exactObj.alarmas || 0) : 0)
            : (rAlarmas
                ? calculateStoreRuleObj(rAlarmas, sellers, activeHours)
                : (exactObj ? (exactObj.alarmas || globalObjs.alarmas * storeHourRatio) : (globalObjs.alarmas * storeHourRatio)));

        const dispSegEuros_obj = store === 'O2'
            ? (exactObj ? (exactObj.dispSegEuros || 0) : 0)
            : (rDispSegEuros
                ? calculateStoreRuleObj(rDispSegEuros, sellers, activeHours)
                : (exactObj ? (exactObj.dispSegEuros || globalObjs.dispSegEuros * 300 * storeHourRatio) : (globalObjs.dispSegEuros * 300 * storeHourRatio)));

        const repos_obj = store === 'O2'
            ? (exactObj ? (exactObj.repos || 0) : 0)
            : (rRepos
                ? calculateStoreRuleObj(rRepos, sellers, activeHours)
                : (exactObj ? (exactObj.repos || globalObjs.repos * storeHourRatio) : (globalObjs.repos * storeHourRatio)));

        // Unused in current layout headers but kept for schema consistency
        const dispUnidades_obj = exactObj ? (exactObj.dispUnidades || globalObjs.dispUnidades * storeHourRatio) : (globalObjs.dispUnidades * storeHourRatio);
        const seguros_obj = exactObj ? (exactObj.seguros || globalObjs.seguros * storeHourRatio) : (globalObjs.seguros * storeHourRatio);
        const movil_obj = exactObj ? (exactObj.movil || globalObjs.movil * storeHourRatio) : (globalObjs.movil * storeHourRatio);

        const row: any = {
            store,
            pers: sellers.length,
            altasTotales: storeSales.length,

            bafNoTrasl_obj,
            bafNoTrasl_vent: 0,
            bafNoTrasl_tram: 0,

            bafConvMS_obj,
            bafConvMS_vent: 0,
            bafConvMS_tram: 0,

            fttr_obj,
            fttr_vent: 0,
            fttr_proj: 0,

            tvFutbol_obj,
            tvFutbol_vent: 0,

            alarmas_obj,
            alarmas_vent: 0,

            dispSegEuros_obj,
            dispSegEuros_vent: 0,

            dispUnidades_obj,
            dispUnidades_vent: 0,

            seguros_obj,
            seguros_vent: 0,

            movil_obj,
            movil_vent: 0,

            repos_obj,
            repos_vent: 0
        };

        // --- Count Sales ---
        
        // 1. bafNoTrasl
        if (rBafNoTrasl) {
            const counts = countRuleSales(storeSales, rBafNoTrasl);
            row.bafNoTrasl_vent = counts.completed;
            row.bafNoTrasl_tram = counts.pending;
        } else {
            // fallback
            storeSales.forEach(s => {
                const pending = isPending(s);
                const p = s.producto?.toLowerCase() || '';
                if (store === 'O2') {
                    if (p.includes('fibra') && !p.includes('interna')) {
                        row.bafNoTrasl_vent++;
                        if (pending) row.bafNoTrasl_tram++;
                    }
                } else {
                    if (isBAFNoTrasl(s)) {
                        row.bafNoTrasl_vent++;
                        if (pending) row.bafNoTrasl_tram++;
                    }
                }
            });
        }

        // 2. bafConvMS
        if (rBafConvMS) {
            const counts = countRuleSales(storeSales, rBafConvMS);
            row.bafConvMS_vent = counts.completed;
            row.bafConvMS_tram = counts.pending;
        } else {
            // fallback
            storeSales.forEach(s => {
                const pending = isPending(s);
                const p = s.producto?.toLowerCase() || '';
                if (store === 'O2') {
                    if (p.includes('interna')) {
                        row.bafConvMS_vent++;
                        if (pending) row.bafConvMS_tram++;
                    }
                } else {
                    if (isBAFConvMS(s)) {
                        row.bafConvMS_vent++;
                        if (pending) row.bafConvMS_tram++;
                    }
                }
            });
        }

        // 3. tvFutbol
        if (rTvFutbol) {
            const counts = countRuleSales(storeSales, rTvFutbol);
            row.tvFutbol_vent = counts.completed + counts.pending;
        } else {
            // fallback
            storeSales.forEach(s => {
                const p = s.producto?.toLowerCase() || '';
                if (store === 'O2') {
                    if (isTVFutbol(s) || p.includes('movistar+')) {
                        row.tvFutbol_vent++;
                    }
                } else {
                    if (isTVFutbol(s)) {
                        row.tvFutbol_vent++;
                    }
                }
            });
        }

        // 4. alarmas (MPA)
        if (rAlarmas) {
            const counts = countRuleSales(storeSales, rAlarmas);
            row.alarmas_vent = counts.completed + counts.pending;
        } else {
            // fallback
            storeSales.forEach(s => {
                if (isAlarmas(s)) {
                    row.alarmas_vent++;
                }
            });
        }

        // 5. dispSegEuros (Dispositivos + Seguros)
        if (rDispSegEuros) {
            const counts = countRuleSales(storeSales, rDispSegEuros);
            row.dispSegEuros_vent = counts.completed + counts.pending;
        } else {
            // fallback
            storeSales.forEach(s => {
                if (isDispositivos(s)) {
                    row.dispSegEuros_vent += (s.importe_c || s.cuota || 0);
                }
            });
        }

        // 6. repos (ARPU)
        if (rRepos) {
            const counts = countRuleSales(storeSales, rRepos);
            row.repos_vent = counts.completed + counts.pending;
        } else {
            // fallback
            storeSales.forEach(s => {
                if (isRepos(s)) {
                    row.repos_vent++;
                }
            });
        }

        // 7. fttr
        if (rFttr) {
            const counts = countRuleSales(storeSales, rFttr);
            row.fttr_vent = counts.completed + counts.pending;
        } else {
            // fallback
            storeSales.forEach(s => {
                if (isFTTR(s)) {
                    row.fttr_vent++;
                }
            });
        }

        // Standard units counts / fallback for not shown columns
        storeSales.forEach(s => {
            if (isDispositivos(s)) row.dispUnidades_vent++;
            if (isSeguros(s)) row.seguros_vent++;
            if (isMovil(s)) row.movil_vent++;
        });

        // Projections
        row.bafNoTrasl_proj = (row.bafNoTrasl_vent + row.bafNoTrasl_tram) * projectionFactor;
        row.bafConvMS_proj = (row.bafConvMS_vent + row.bafConvMS_tram) * projectionFactor;
        row.fttr_proj = row.fttr_vent * projectionFactor;

        row.tvFutbol_proj = row.tvFutbol_vent * projectionFactor;
        row.alarmas_proj = row.alarmas_vent * projectionFactor;
        row.dispSegEuros_proj = row.dispSegEuros_vent * projectionFactor;
        row.dispUnidades_proj = row.dispUnidades_vent * projectionFactor;
        row.seguros_proj = row.seguros_vent * projectionFactor;
        row.movil_proj = row.movil_vent * projectionFactor;
        row.repos_proj = row.repos_vent * projectionFactor;

        result[store] = row;
    });

    return Object.values(result);
}
