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

// --- Main Engine Function ---
export function calculateTramitacion(sales: any[], rules: any[], hours: any[], storeObjectives: any[], workingDaysElapsed: number, totalWorkingDays: number) {
    const projectionFactor = workingDaysElapsed > 0 ? totalWorkingDays / workingDaysElapsed : 1;

    // Helper to get total store hours
    const getStoreHours = (storeName: string) => {
        const sellers = TIENDAS_COMERCIALES[storeName] || [];
        return hours.filter((h: any) => sellers.includes(h.comercial)).reduce((acc, h) => acc + (h.horario || 0), 0);
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
        const storeSales = sales.filter(s => isValidSale(s) && sellers.includes(s.vendedor));
        const storeHours = getStoreHours(store);
        const storeHourRatio = storeHours / globalTotalHours;

        const exactObj = storeObjectives.find(o => o.storeName === store);

        const row: any = {
            store,
            pers: sellers.length,
            altasTotales: storeSales.length,
            
            bafNoTrasl_obj: exactObj ? ((exactObj.bafConvMS || 0) + (exactObj.bafNoFusionO2 || 0) + (exactObj.restoBaf || 0)) || globalObjs.bafNoTrasl * storeHourRatio : (globalObjs.bafNoTrasl * storeHourRatio),
            bafNoTrasl_vent: 0,
            bafNoTrasl_tram: 0,

            bafConvMS_obj: exactObj ? (exactObj.bafConvMS || globalObjs.bafConvMS * storeHourRatio) : (globalObjs.bafConvMS * storeHourRatio),
            bafConvMS_vent: 0,
            bafConvMS_tram: 0,

            fttr_obj: exactObj ? (exactObj.fttr || 0) : 0,
            fttr_vent: 0,
            fttr_proj: 0,

            tvFutbol_obj: exactObj ? (exactObj.tvFutbol || globalObjs.tvFutbol * storeHourRatio) : (globalObjs.tvFutbol * storeHourRatio),
            tvFutbol_vent: 0,

            alarmas_obj: exactObj ? (exactObj.alarmas || globalObjs.alarmas * storeHourRatio) : (globalObjs.alarmas * storeHourRatio),
            alarmas_vent: 0,

            dispSegEuros_obj: exactObj ? (exactObj.dispSegEuros || globalObjs.dispSegEuros * 300 * storeHourRatio) : (globalObjs.dispSegEuros * 300 * storeHourRatio),
            dispSegEuros_vent: 0,

            dispUnidades_obj: exactObj ? (exactObj.dispUnidades || globalObjs.dispUnidades * storeHourRatio) : (globalObjs.dispUnidades * storeHourRatio),
            dispUnidades_vent: 0,

            seguros_obj: exactObj ? (exactObj.seguros || globalObjs.seguros * storeHourRatio) : (globalObjs.seguros * storeHourRatio),
            seguros_vent: 0,

            movil_obj: exactObj ? (exactObj.movil || globalObjs.movil * storeHourRatio) : (globalObjs.movil * storeHourRatio),
            movil_vent: 0,

            repos_obj: exactObj ? (exactObj.repos || globalObjs.repos * storeHourRatio) : (globalObjs.repos * storeHourRatio),
            repos_vent: 0
        };

        // If it's O2 and no exact obj was imported for O2, override with specific O2 logic as requested
        if (store === 'O2' && !exactObj) {
            row.bafNoTrasl_obj = getGlobalObjective(['o2 fibra']); 
            row.tvFutbol_obj = getGlobalObjective(['o2 tv']);
        }

        // Count sales
        storeSales.forEach(sale => {
            const pending = isPending(sale);
            const p = sale.producto?.toLowerCase() || '';

            if (store === 'O2') {
                if (p.includes('fibra') && !p.includes('interna')) {
                    row.bafNoTrasl_vent++;
                    if (pending) row.bafNoTrasl_tram++;
                } else if (p.includes('interna')) {
                    row.bafConvMS_vent++;
                    if (pending) row.bafConvMS_tram++;
                }
                
                if (isTVFutbol(sale) || p.includes('movistar+')) {
                    row.tvFutbol_vent++;
                }
                if (isAlarmas(sale)) row.alarmas_vent++;
                if (isDispositivos(sale)) {
                    row.dispUnidades_vent++;
                    row.dispSegEuros_vent += (sale.importe_c || 0);
                }
                if (isSeguros(sale)) row.seguros_vent++;
                if (isMovil(sale)) row.movil_vent++;
                if (isRepos(sale)) row.repos_vent++;
            } else {
                if (isBAFNoTrasl(sale)) {
                    row.bafNoTrasl_vent++;
                    if (pending) row.bafNoTrasl_tram++;
                }
                if (isBAFConvMS(sale)) {
                    row.bafConvMS_vent++;
                    if (pending) row.bafConvMS_tram++;
                }
                if (isFTTR(sale)) {
                    row.fttr_vent++;
                }

                if (isTVFutbol(sale)) {
                    row.tvFutbol_vent++;
                }
                if (isAlarmas(sale)) {
                    row.alarmas_vent++;
                }
                if (isDispositivos(sale)) {
                    row.dispUnidades_vent++;
                    row.dispSegEuros_vent += (sale.importe_c || 0);
                }
                if (isSeguros(sale)) {
                    row.seguros_vent++;
                }
                if (isMovil(sale)) {
                    row.movil_vent++;
                }
                if (isRepos(sale)) {
                    row.repos_vent++;
                }
            }
        });

        // Calculate projections
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
