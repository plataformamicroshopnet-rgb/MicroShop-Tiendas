import { getEffectiveTiendaComerciales } from './comercialRoster';

export const STORE_NAMES = ["Auxiliadora 45", "Correhuela", "Villamayor", "Béjar", "O2"];

export const isPending = (sale: any) => {
    // OJO: la base guarda 'Si' SIN acento (166 filas reales contra 0 con 'Sí').
    // La versión vieja solo casaba 'Sí'/'Pendiente' y el modo análisis le sacó
    // los colores (Carmen con 3 en tramitación salía a 0 — dueño, 24-ago-2026).
    // El conteo de la tabla (countRuleSales) ya normalizaba por su cuenta; ahora
    // TODOS pasan por aquí con la misma vara.
    const p = String(sale.pendiente || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    return p === 'si' || p === 'pendiente';
};

export const isValidSale = (sale: any) => {
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
    // Un dispositivo se identifica por la categoría 'rent' (igual que matchTipoVenta del
    // dashboard); el 'producto' es el modelo (iPhone, Samsung…), no la palabra "dispositivo".
    const cat = String(sale.categoria || sale.detalle || sale.sheet || '').trim().toLowerCase();
    return cat === 'rent';
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
// ⚠️ matchTipoVenta y matchProductFormula VIVÍAN AQUÍ COPIADAS, y la copia se
// quedó vieja: le faltaban el comodín de O2 arreglado en julio (las «Fibra
// Adicional» y las «Interna Linea Movil» ya NO cuentan), el caso del Swap y el
// puente de agosto de los Repos. Por eso esta pantalla enseñaba otras cifras que
// el resto del programa. Ahora se usan las de lib/ventaMatching, que es la única
// que hay: lo que se arregle allí vale también aquí.
export { matchProductFormula, matchTipoVenta } from './ventaMatching';
import { matchProductFormula, matchTipoVenta } from './ventaMatching';


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

// ── LA PALANCA «Repos» SE ESTRENA EN AGOSTO DE 2026 ──────────────────────────
// Las ventas de esa palanca con fecha ANTERIOR son CORRECCIONES CONTABLES de
// meses ya liquidados: existen para que el cobro y las pantallas de operaciones
// enseñen el precio de verdad, pero NO pueden pagar comisión a nadie — moverían
// una nómina ya acordada. Sin este candado, corregir julio le habría subido a
// Elena 222 € y a Carlos 108 € por la regla «Repo Fútbol», que casa por la
// palabra «fútbol» del nombre del producto sin mirar la palanca.
// Mismo patrón que SWAP_LINE_FROM en api/sales/unified.
export const REPOS_PALANCA = 'Repos UP'
export const REPOS_PALANCA_FUTBOL = 'Repo Fútbol'
const REPOS_CUENTA_DESDE = new Date(2026, 7, 1)   // 1 de agosto de 2026

/** true si la venta es de agosto de 2026 en adelante (el corte del rediseño de los Repos). */
export const esDesdeAgosto2026 = (s: any): boolean => {
    const f = String(s?.fecha || '').trim()          // dd/mm/aaaa
    if (f.length < 10 || f[2] !== '/' || f[5] !== '/') return false
    const d = new Date(Number(f.slice(6, 10)), Number(f.slice(3, 5)) - 1, Number(f.slice(0, 2)))
    return d >= new Date(2026, 7, 1)
}

export const esCorreccionContableRepos = (s: any): boolean => {
    const f = String(s?.fecha || '').trim()          // dd/mm/aaaa
    if (f.length < 10 || f[2] !== '/' || f[5] !== '/') return false
    const d = new Date(Number(f.slice(6, 10)), Number(f.slice(3, 5)) - 1, Number(f.slice(0, 2)))
    if (d >= REPOS_CUENTA_DESDE) return false
    // Una venta que SUSTITUYE a otra es siempre una corrección, sea cual sea su
    // palanca: es el criterio más seguro y cubre las que todavía no existen.
    if (String(s?.sustituyeA || '').trim()) return true
    // Y por si alguna se crea sin el enlace, también por palanca: las dos que
    // estrena el rediseño de los Repos (el repo de 78 € y el extra de 10 €).
    const cat = String(s?.categoria || s?.detalle || s?.sheet || '').trim().toLowerCase()
    return cat === REPOS_PALANCA.toLowerCase()
        || cat === REPOS_PALANCA_FUTBOL.toLowerCase()
        || cat === 'repo futbol'
}

export const matchesRule = (s: any, ruleName: string, ruleProductosCuentan: string) => {
    // Correcciones contables de meses anteriores: no cuentan para ninguna regla.
    if (esCorreccionContableRepos(s)) return false

    // Si la venta es de Marta (O2), aplicamos la regla simplificada según instrucción del usuario
    const isMartaSale = String(s.vendedor || '').toLowerCase().includes('marta') || String(s.detalle || '').toLowerCase() === 'o2';
    
    if (isMartaSale) {
        const normRule = String(ruleName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const prodName = String(s.producto || '').toLowerCase().trim();
        
        // La lista "Tipo de Venta" de la regla MANDA: matchTipoVenta casa las ventas O2 por
        // nombre EXACTO ('O2' en la lista = comodín fibra*/interna* heredado). Antes se usaba
        // un PREFIJO hardcodeado y editar la lista no surtía efecto.
        if (String(ruleProductosCuentan || '').trim()) {
            return matchTipoVenta(s, ruleProductosCuentan);
        }
        // Compat: regla sin lista configurada -> prefijo de siempre.
        if (normRule.includes('altas/portas') || normRule.includes('altas fibra') || normRule === 'altas/portas fibra') {
            return prodName.startsWith('fibra');
        }
        if (normRule.includes('internas') || normRule === 'internas fibra') {
            return prodName.startsWith('interna');
        }
        return false;
    }

    const normRule = String(ruleName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    // ── EL CABLE VIEJO, SOLO HASTA JULIO DE 2026 ─────────────────────────
    // Hasta julio, «ARPU» y «Repo Fútbol» tenían escrito a mano qué contaban,
    // saltándose su casilla «Tipo de Venta». Desde agosto manda la casilla, que
    // es lo que hace que un cliente de fútbol cuente UNA vez y no dos ahora que
    // genera dos líneas. Copia gemela de panelComisionesTiendas: si se toca una
    // y no la otra, cada pantalla da una cifra distinta del mismo mes.
    if (!esDesdeAgosto2026(s)) {
        if (normRule === 'arpu') {
            return matchTipoVenta(s, 'ARPU') || isSuscripcionesTV(s) || isExtraRepoUpFutbol(s);
        }
        if (normRule === 'repo futbol') {
            return matchTipoVenta(s, 'Repo Fútbol') || isExtraRepoUpFutbol(s);
        }
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

export const isSellerInStore = (sellerName: string, storeSellers: string[]) => {
    const normSeller = String(sellerName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return storeSellers.some(s => {
        const normS = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return normSeller === normS;
    });
};

const countRuleSales = (storeSales: any[], rule: any, forzarUnidades = false) => {
    let completed = 0;
    let pending = 0;
    if (!rule) return { completed, pending };

    const ruleName = rule.nombre;
    const ruleProductosCuentan = rule.productosCuentan;
    // forzarUnidades: aunque la regla sea porcentual (y su base de comisión vaya
    // en euros), esta carta cuenta CLIENTES. Desde ago-2026 los Repos son
    // paquetes con precio (7,86–82 €): sumar cuotas aquí daba «Vent 5.476»
    // contra objetivos de la era ARPU, un porcentaje sin sentido.
    const isPercentage = String(rule.importePrimerTramo || '').includes('%') && !forzarUnidades;

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

    // Plantilla del periodo: tienda -> comerciales según el panel de Horarios (fallback fijo)
    const tiendaComerciales = getEffectiveTiendaComerciales(hours);

    // Helper to get total store hours
    const getStoreHours = (storeName: string) => {
        const sellers = tiendaComerciales[storeName] || [];
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
        const sellers = tiendaComerciales[store] || [];
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
        // LA CASILLA OFICIAL MANDA (ago-2026): TiendaStoreObjective es la tabla
        // que rellena el Excel de objetivos de Telefónica (vía ERP o pegado en
        // esta misma pantalla). Cuando tiene valor, ese ES el objetivo del mes
        // por tienda. El prorrateo de la regla por horas queda de RESPALDO para
        // meses sin tabla — antes era al revés y la pantalla enseñaba un reparto
        // inventado aunque el objetivo oficial estuviera tecleado.
        const oficial = (v: any): number | null => {
            const n = Number(v);
            return v !== null && v !== undefined && isFinite(n) && n > 0 ? n : null;
        };

        let bafNoTrasl_obj = 0;
        if (store === 'O2') {
            bafNoTrasl_obj = exactObj && exactObj.bafNoTrasl !== null && exactObj.bafNoTrasl !== undefined
                ? exactObj.bafNoTrasl
                : (rBafNoTrasl ? calculateStoreRuleObj(rBafNoTrasl, sellers, activeHours) : getGlobalObjective(['o2 fibra']));
        } else {
            bafNoTrasl_obj = oficial(exactObj?.bafNoTrasl)
                ?? oficial(exactObj ? (exactObj.bafConvMS || 0) + (exactObj.bafNoFusionO2 || 0) + (exactObj.restoBaf || 0) : null)
                ?? (rBafNoTrasl ? calculateStoreRuleObj(rBafNoTrasl, sellers, activeHours) : globalObjs.bafNoTrasl * storeHourRatio);
        }

        let bafConvMS_obj = 0;
        if (store === 'O2') {
            bafConvMS_obj = exactObj && exactObj.bafConvMS !== null && exactObj.bafConvMS !== undefined
                ? exactObj.bafConvMS
                : (rBafConvMS ? calculateStoreRuleObj(rBafConvMS, sellers, activeHours) : 0);
        } else {
            bafConvMS_obj = oficial(exactObj?.bafConvMS)
                ?? (rBafConvMS ? calculateStoreRuleObj(rBafConvMS, sellers, activeHours) : globalObjs.bafConvMS * storeHourRatio);
        }

        const fttr_obj = store === 'O2'
            ? (exactObj ? (exactObj.fttr || 0) : 0)
            : (oficial(exactObj?.fttr)
                ?? (rFttr ? calculateStoreRuleObj(rFttr, sellers, activeHours) : 0));

        const tvFutbol_obj = store === 'O2'
            ? (exactObj ? (exactObj.tvFutbol || 0) : getGlobalObjective(['o2 tv']))
            : (oficial(exactObj?.tvFutbol)
                ?? (rTvFutbol ? calculateStoreRuleObj(rTvFutbol, sellers, activeHours) : globalObjs.tvFutbol * storeHourRatio));

        const alarmas_obj = store === 'O2'
            ? (exactObj ? (exactObj.alarmas || 0) : 0)
            : (oficial(exactObj?.alarmas)
                ?? (rAlarmas ? calculateStoreRuleObj(rAlarmas, sellers, activeHours) : globalObjs.alarmas * storeHourRatio));

        const dispSegEuros_obj = store === 'O2'
            ? (exactObj ? (exactObj.dispSegEuros || 0) : 0)
            : (oficial(exactObj?.dispSegEuros)
                ?? (rDispSegEuros ? calculateStoreRuleObj(rDispSegEuros, sellers, activeHours) : globalObjs.dispSegEuros * 300 * storeHourRatio));

        // Desde ago-2026 la carta de Repos va en UNIDADES (decisión del dueño):
        // el objetivo en euros de la regla de comisiones (1.100/1.600 de la era
        // ARPU) ya no pinta nada aquí. Manda la casilla editable por tienda de
        // esta misma pantalla (TiendaStoreObjective.repos); sin casilla, 0.
        const repos_obj = exactObj ? (exactObj.repos || 0) : 0;

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

        // 6. repos (ARPU) — en unidades, no en euros (ver forzarUnidades)
        if (rRepos) {
            const counts = countRuleSales(storeSales, rRepos, true);
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
