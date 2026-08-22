// ─────────────────────────────────────────────────────────────────────────────
// MOTOR PURO del Panel de Comisiones de TIENDAS (FUENTE ÚNICA).
//
// Este fichero es el cálculo EXTRAÍDO TAL CUAL de src/hooks/useComisionesData.ts
// (líneas ~12-87 los helpers y ~174-1084 el cálculo del hook original): JS puro
// sobre arrays, sin React, sin fetch, sin window/localStorage. Lo consumen:
//   - useComisionesData (Panel Comisiones, navegador) — misma salida que antes.
//   - /api/comisiones-liquidacion (server-to-server para el ERP) — permite
//     excluir ventas (bajas de cliente) y que los objetivos — incluidos los
//     tramos de EQUIPO (REQUIRE_TEAM_OBJ2/OBJ3/OBJ23) y el descuento FTTR sobre
//     Dispositivos + Seguros — se recalculen solos.
//
// Mismo patrón que el motor de FFVV (su src/lib/panelComisiones.ts): el motor
// recibe las respuestas CRUDAS de las routes y aplica LOS MISMOS filtros que
// hacía el hook (Solar360 fuera, reglas 'solar' fuera, reglas KPI isActive +
// '[KPI]'). Los filtros son idempotentes: el hook puede seguir pasando sus
// estados ya filtrados sin que cambie el resultado.
//
// ADICIONES (no alteran los totales del panel):
//   - lineasDetalle: comisión POR VENTA. La comisión de cada palanca (regla) se
//     reparte entre sus ventas con el MISMO peso con que contaron para la regla
//     (1 ud en reglas de unidades, su importe € en reglas de %). La suma de
//     líneas de cada palanca cuadra con la comisión de la palanca (la última
//     línea absorbe el redondeo a 2 decimales). "Altas O2/Otras" (9 €/ud para
//     comerciales que NO son Marta) se emite también por línea. Las ventas
//     válidas que no casan con ninguna palanca se listan a 0 € (trazabilidad).
//   - extrasConceptos: extras/bonos etiquetados {concepto, detalle, importe,
//     persistido}. persistido=true -> asignación real de BD (no se recalcula al
//     excluir ventas, solo se etiqueta); persistido=false -> bono virtual que el
//     motor acaba de computar con las ventas recibidas (KPI, Territorial O2).
//   - objetivosResumen: objetivo/conseguido/tramo por palanca (lo que el motor
//     ya computa, sin cálculo nuevo).
//   Siempre: totalLineas + totalExtras == totalComision del Panel.
// ─────────────────────────────────────────────────────────────────────────────
import { getProfile, getGroupVisual, ALL_GROUPS } from './comisiones';
import { getEffectiveSellers, getTiendasConPlantilla, norm as normNombre } from './comercialRoster';
import { isSolar360, findCatalogVigente } from './salesUtils';
import { matchTipoVenta } from './ventaMatching';

// ── Helpers puros que vivían en el hook (el hook los re-exporta) ─────────────
export const parseSafeFloat = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const clean = String(val).replace('€', '').replace(/\s/g, '').replace(',', '.').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

export const isSuscripcionesTV = (s: any) => {
    const text = String(s.categoria || s.detalle || s.sheet || s.producto || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return text.includes("suscripciones tv") || text.includes("suscripcion tv");
};

export const isExtraRepoUpFutbol = (s: any) => {
    const text = String(s.producto || s.detalle || s.categoria || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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
        const normRule = String(ruleName || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
        const prodName = String(s.producto || '').toLowerCase().trim();

        // La lista "Tipo de Venta" de la regla MANDA (Reglas Globales O2 / MovilFree): lo que
        // se selecciona cuenta y lo que se quita deja de contar. matchTipoVenta casa las ventas
        // O2 por nombre EXACTO de producto (el token 'O2' de la lista = comodín SOLO fibras,
        // sin Adicionales ni líneas móviles — regla del dueño jul-2026). Antes se emparejaba
        // por PREFIJO hardcodeado y editar la lista no surtía efecto (caso "Fibra Adicional"
        // en junio-2026).
        if (String(ruleProductosCuentan || '').trim()) {
            return matchTipoVenta(s, ruleProductosCuentan);
        }
        // Compat: regla sin lista configurada -> prefijo, ENDURECIDO (jul-2026): solo fibras.
        // Las 'Fibra Adicional …' y las líneas móviles ('Interna Linea Movil …') no cuentan
        // por defecto; si un mes deben contar, se añaden por nombre exacto a la lista.
        if (normRule.includes('altas/portas') || normRule.includes('altas fibra') || normRule === 'altas/portas fibra') {
            return prodName.startsWith('fibra') && !prodName.includes('adicional');
        }
        if (normRule.includes('internas') || normRule === 'internas fibra') {
            return prodName.startsWith('interna fibra') && !prodName.includes('adicional');
        }
        return false;
    }

    const normRule = String(ruleName || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

    // ── EL CABLE VIEJO, SOLO HASTA JULIO DE 2026 ─────────────────────────
    // Hasta julio, las reglas «ARPU» y «Repo Fútbol» tenían escrito a mano qué
    // contaban, SALTÁNDOSE su casilla «Tipo de Venta»: el ARPU se tragaba las
    // Suscripciones TV y los Extra Repos Fútbol (de los 252,66 € que pagó en
    // julio, solo 21,92 € eran repos de ARPU de verdad), y el fútbol casaba por
    // la palabra «fútbol» del nombre del producto sin mirar la palanca.
    // DESDE AGOSTO manda la casilla y punto — que es lo que hay que hacer para
    // que un cliente de fútbol cuente UNA vez y no dos, ahora que genera dos
    // líneas. El histórico se queda exactamente como estaba: los meses cerrados
    // no se pueden mover.
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

export const getValueForRule = (s: any, ruleName: string, catalogs?: Record<string, any[]>) => {
    let cuotaValue = parseSafeFloat(s.cuota);
    if (String(s.categoria || s.detalle || s.sheet).toLowerCase() === 'seguro') {
        if (catalogs) {
            // Vigencias: con dos precios del mismo seguro gana el que cubre la fecha de la venta.
            const found = findCatalogVigente(catalogs['Seguro'] || [], s.producto, s.fecha);
            if (found && found.anual) {
                return parseSafeFloat(found.anual);
            }
        }
        if (s.seguroImporte) {
            cuotaValue = parseSafeFloat(s.seguroImporte);
        }
    }

    if (ruleName === 'ARPU') {
        if (isSuscripcionesTV(s)) {
            return parseSafeFloat(s.importe || s.cuota || 0);
        }
    }
    return cuotaValue;
};

// "Altas O2/Otras": tarifa plana para O2 MovilFree vendidas por comerciales que NO son Marta.
export const O2_OTRAS_RATE = 9;

export interface LineaComisionTienda {
    saleId: any;
    producto: string;
    grupo: string | null;   // nombre de la palanca (regla), 'Altas O2/Otras' o null (sin palanca)
    comision: number;
    esSeguroVirtual?: boolean; // línea generada por el seguro adosado a otra venta (mismo saleId)
}

export interface ExtraConceptoTienda {
    concepto: string;
    detalle: string;
    importe: number;
    persistido: boolean;
}

export interface ObjetivoResumenTienda {
    grupo: string;           // nombre de la palanca (regla)
    cumplido: boolean;       // isConsolidado (tramo 1 alcanzado / sin objetivo / condicionantes OK)
    hito: number;            // tramo cuya tarifa se aplicó (1/2/3); 0 = sin ventas
    objetivo1: number; conseguido1: number;
    objetivo2: number; conseguido2: number;  // si el tramo 2 es de EQUIPO: objetivo global y total del equipo
    objetivo3: number; conseguido3: number;  // ídem tramo 3
    esEquipoObj2: boolean;
    esEquipoObj3: boolean;
    tarifaAplicada: string | null; // 'Tramo N' aplicado
    // Candado de tramo: la palanca se ha pagado al tramo 1 aunque el objetivo 2/3
    // estuviera cumplido, porque otra palanca no llegó a su %. Sin esto, la pantalla
    // enseñaría «objetivo 2 ✓» y una comisión de tramo 1 sin explicar por qué.
    topeAplicado?: boolean;
    topeMotivo?: string | null;
}

export interface PanelComisionesTiendasInput {
    periodKey: string;
    // Ventas con el shape del map de /api/sales?periodKey&dashboard=true (id, vendedor,
    // producto, cuota, importe, detalle, sheet, categoria, pendiente, anulado, seguroImporte,
    // isSwap, timestamp, periodId...). El motor quita Solar360 (mismo filtro que el hook).
    sales: any[];
    // /api/tiendas-comisiones → rules + hours. El motor quita las reglas 'solar'.
    tiendaRules: any[];
    tiendaHours?: any[];
    // AppSetting o2_rules_v2_{periodKey} → { rules, hours }
    o2Rules?: any[];
    o2Hours?: any[];
    // /api/territorial → o2 (AppSetting territorial_o2_{periodKey})
    territorialO2Rules?: any[];
    // /api/extras/assignments (crudas, include rule)
    extraAssignments?: any[];
    // /api/extras/rules (crudas; el motor filtra isActive + '[KPI]')
    kpiRules?: any[];
    // /api/catalogs (por categoría; el Panel usa el del mes ACTIVO — ver route)
    catalogs?: Record<string, any[]>;
    // AppSetting fttr_discount_{periodKey}; por defecto 910 €/ud
    fttrDiscount?: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────────
// ¿ESTE MES YA NO PUEDE CRECER? — regla del dueno (22-ago-2026).
//
// Un mes de ventas deja de moverse el DIA 5 del mes SIGUIENTE: hasta entonces
// todavia se meten ventas de los ultimos dias, asi que quien no ha llegado a su
// objetivo aun puede llegar. A partir del dia 5 «donde no haya llegado no puede
// hacer nada y se queda a lo que si haya llegado».
//
// No se usa el estado del WorkPeriod: el mes rota el dia 1 (api/rotar-mes) y eso
// cerraria los objetivos cuatro dias antes de tiempo.
// ─────────────────────────────────────────────────────────────────────────────
export function objetivosCerrados(periodKey: string, hoy: Date = new Date()): boolean {
    const [y, m] = String(periodKey || '').split('_').map(Number);
    if (!y || !m) return false;
    // Date cuenta los meses desde 0, asi que `m` YA es el mes siguiente
    return hoy > new Date(y, m, 5, 23, 59, 59);
}

export function computePanelComisionesTiendas(input: PanelComisionesTiendasInput) {
    const activePeriodKey = input.periodKey || '';
    // Mientras el mes pueda crecer, lo que depende de un objetivo sin alcanzar
    // TAMBIEN esta por consolidar: puede subir de tramo si se vende mas.
    const objCerrados = objetivosCerrados(activePeriodKey);

    // ── Mismo pre-procesado que hacía el hook con las respuestas de los fetches ──
    // (filtros idempotentes: da igual si el llamante ya los aplicó)
    const monthSales = (input.sales || []).filter((s: any) => !isSolar360(s));
    // "Señalización Solar 360" eliminada como palanca de comisión (no se paga).
    const tiendaRules = (input.tiendaRules || []).filter((r: any) => !String(r.nombre || '').toLowerCase().includes('solar'));
    const tiendaHours = input.tiendaHours || [];
    const o2Rules = input.o2Rules || [];
    const o2Hours = input.o2Hours || [];
    const territorialO2Rules = input.territorialO2Rules || [];
    const extraAssignments = input.extraAssignments || [];
    // Filtramos solo las reglas KPI activas
    const activeRules = (input.kpiRules || []).filter((r: any) => r.isActive && r.combinationLabel?.startsWith('[KPI]'));
    const catalogs = input.catalogs || {};
    const _fttrParsed = input.fttrDiscount === undefined || input.fttrDiscount === null ? NaN : Number(input.fttrDiscount);
    const fttrDiscount = isNaN(_fttrParsed) ? 910 : _fttrParsed;

    // Calcular ventas válidas de FTTR para vendedores de tiendas (excluyendo a Marta)
    const totalStoreFttrSales = monthSales.filter(s => {
        if (String(s.vendedor || '').toLowerCase().includes('marta')) return false;

        const prod = String(s.producto || '').toLowerCase();
        const isAnul = String(s.anulado || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim() === 'si' ||
                       String(s.pendiente || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim() === 'anulado';
        if (isAnul) return false;

        return prod.includes('solución fttr') || prod.includes('solucion fttr') || prod.includes('fttr');
    }).length;

    // Crear una versión ajustada de tiendaRules con el objetivo global reducido
    const adjustedTiendaRules = tiendaRules.map(rule => {
        if (rule.nombre === 'Dispositivos + Seguros') {
            return {
                ...rule,
                objSegundoTramo: Math.max(0, (rule.objSegundoTramo || 0) - fttrDiscount * totalStoreFttrSales),
                objTercerTramo: Math.max(0, (Number(rule.objTercerTramo) || 0) - fttrDiscount * totalStoreFttrSales)
            };
        }
        return rule;
    });

    // ── MÍNIMOS POR TIENDA (condicionante REQUIRE_STORE_QTY_TRAMO2) ─────────────
    // Cuenta VENTAS (no euros) de un Tipo de Venta en cada tienda física del mes.
    // La tienda de una venta es la de SU COMERCIAL según la plantilla del mes
    // (panel «Horarios de Comerciales»), no el código que lleve escrito la venta:
    // así una venta con la tienda en blanco no se convierte en una tienda nueva.
    const tiendasConPlantilla = getTiendasConPlantilla(tiendaHours);
    const _tiendaDeVendedor: Record<string, string> = {};
    Object.entries(tiendasConPlantilla).forEach(([tienda, nombres]) => {
        nombres.forEach(n => { _tiendaDeVendedor[normNombre(n)] = tienda; });
    });
    const _cacheUdsTienda: Record<string, Record<string, number>> = {};
    const unidadesPorTienda = (tipoVenta: string): Record<string, number> => {
        const key = normNombre(tipoVenta);
        if (_cacheUdsTienda[key]) return _cacheUdsTienda[key];
        const out: Record<string, number> = {};
        Object.keys(tiendasConPlantilla).forEach(t => { out[t] = 0; });
        monthSales.forEach(s => {
            const _an = String(s.anulado || '').toLowerCase().trim();
            const _pe = String(s.pendiente || '').toLowerCase().trim();
            if (_an === 'si' || _an === 'sí' || _pe === 'anulado') return;
            // Las líneas de corrección de los Repos son contabilidad de meses ya
            // pagados: no cuentan para ningún objetivo (ver esCorreccionContableRepos).
            if (esCorreccionContableRepos(s)) return;
            const t = _tiendaDeVendedor[normNombre(s.vendedor)];
            if (!t) return;
            if (matchTipoVenta(s, tipoVenta)) out[t] += 1;
        });
        _cacheUdsTienda[key] = out;
        return out;
    };

    const teamGroupCounts: Record<string, number> = {};
    const teamGroupPending: Record<string, number> = {};
    const o2TeamGroupCounts: Record<string, number> = {};
    const o2TeamGroupPending: Record<string, number> = {};

    adjustedTiendaRules.forEach(rule => { teamGroupCounts[rule.nombre] = 0; teamGroupPending[rule.nombre] = 0; });
    o2Rules.forEach(rule => { o2TeamGroupCounts[rule.nombre] = 0; o2TeamGroupPending[rule.nombre] = 0; });

    monthSales.forEach(s => {
        // Las ANULADAS no cuentan en los agregados de equipo (objetivos «(Eq)» / «Falta entre todo el Equipo»)
        const _anT = String(s.anulado || '').toLowerCase().trim();
        const _peT = String(s.pendiente || '').toLowerCase().trim();
        if (_anT === 'si' || _anT === 'sí' || _peT === 'anulado') return;
        const isPending = String(s.pendiente || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim() === 'si';

        // Movistar
        if (!String(s.vendedor).toLowerCase().includes('marta')) {
            adjustedTiendaRules.forEach(rule => {
                if (matchesRule(s, rule.nombre, rule.productosCuentan)) {
                    const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                    const val = getValueForRule(s, rule.nombre, catalogs);
                    if (isPercentage) {
                        if (isPending) {
                            teamGroupPending[rule.nombre] += val;
                        } else {
                            teamGroupCounts[rule.nombre] += val;
                        }
                    } else {
                        if (isPending) {
                            teamGroupPending[rule.nombre] += 1;
                        } else {
                            teamGroupCounts[rule.nombre] += 1;
                        }
                    }
                }
                if (s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet).toLowerCase() !== 'seguro') {
                    const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
                    if (matchesRule(virtualSeguro, rule.nombre, rule.productosCuentan)) {
                        const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                        const val = getValueForRule(virtualSeguro, rule.nombre, catalogs);
                        if (isPercentage) {
                            if (isPending) {
                                teamGroupPending[rule.nombre] += val;
                            } else {
                                teamGroupCounts[rule.nombre] += val;
                            }
                        } else {
                            if (isPending) {
                                teamGroupPending[rule.nombre] += 1;
                            } else {
                                teamGroupCounts[rule.nombre] += 1;
                            }
                        }
                    }
                }
            });
        }

        // O2
        if (String(s.vendedor).toLowerCase().includes('marta')) {
            o2Rules.forEach(rule => {
                if (matchesRule(s, rule.nombre, rule.productosCuentan)) {
                    const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                    const val = getValueForRule(s, rule.nombre, catalogs);
                    if (isPercentage) {
                        if (isPending) {
                            o2TeamGroupPending[rule.nombre] += val;
                        } else {
                            o2TeamGroupCounts[rule.nombre] += val;
                        }
                    } else {
                        if (isPending) {
                            o2TeamGroupPending[rule.nombre] += 1;
                        } else {
                            o2TeamGroupCounts[rule.nombre] += 1;
                        }
                    }
                }
                if (s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet).toLowerCase() !== 'seguro') {
                    const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
                    if (matchesRule(virtualSeguro, rule.nombre, rule.productosCuentan)) {
                        const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                        const val = getValueForRule(virtualSeguro, rule.nombre, catalogs);
                        if (isPercentage) {
                            if (isPending) {
                                o2TeamGroupPending[rule.nombre] += val;
                            } else {
                                o2TeamGroupCounts[rule.nombre] += val;
                            }
                        } else {
                            if (isPending) {
                                o2TeamGroupPending[rule.nombre] += 1;
                            } else {
                                o2TeamGroupCounts[rule.nombre] += 1;
                            }
                        }
                    }
                }
            });
        }
    });

    // La plantilla del mes manda: comerciales activos = los del panel "Horarios de
    // Comerciales" (tiendaHours) + O2 (o2Hours). Si el mes no tiene horarios, se usa
    // la lista fija de siempre (fallback retrocompatible -> no descuadra histórico).
    const rosterSellers = getEffectiveSellers(tiendaHours, o2Hours);
    const sellerStats = rosterSellers.map(name => {
        const sSales = monthSales.filter(s => {
            const v = String(s.vendedor || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
            const tgt = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
            return v === tgt;
        });

        const sExtras = extraAssignments.filter(ea => {
            const v = String(ea.seller || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
            const tgt = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

            // Excluir el extra manual para Marta según lo solicitado
            const isMarta = tgt.includes('marta');
            const isTerritorial = String(ea.customerNif) === 'TERRITORIAL' || String(ea.customerName).includes('Territorial') || String(ea.triggerKey).includes('TERRITORIAL');

            const ruleName = String(ea.rule?.name || 'Extra Manual').toLowerCase();
            const isManualExtra = !isTerritorial && (
                                  String(ea.customerName || '').toLowerCase().includes('manual') ||
                                  ea.sourceType === 'MANUAL' ||
                                  ruleName.includes('extra manual'));

            if (isMarta && isManualExtra) return false;

            return v === tgt && ea.status !== 'CANCELLED';
        }).map(ea => {
            const tgt = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
            const isMarta = tgt.includes('marta');
            const isTerritorial = String(ea.customerNif) === 'TERRITORIAL' || String(ea.customerName).includes('Territorial') || String(ea.triggerKey).includes('TERRITORIAL');

            // Si es un bono territorial para Marta, forzamos que no sume importe (informativo)
            if (isMarta && isTerritorial) {
                return { ...ea, sellerRewardAmount: 0 };
            }
            return ea;
        });

        const pendientes = sSales.filter(s => {
            const val = String(s.pendiente || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
            return val === 'si';
        }).length;

        const fechas = sSales.map(s => s.timestamp).filter(t => !isNaN(t)).sort((a, b) => b - a);
        const ultimaVenta = fechas.length > 0 ? new Date(fechas[0]).toLocaleDateString('es-ES') : '-';

        const groupCounts: Record<string, number> = {};
        const groupPending: Record<string, number> = {};
        const groupObj1: Record<string, number> = {};
        const groupObj2: Record<string, number> = {};
        const groupObj3: Record<string, number> = {};
        const groupComisions: Record<string, number> = {};
        const groupConsolidada: Record<string, number> = {};
        const groupSales: Record<string, any[]> = {};
        // ADICIÓN (liquidación): peso de cada venta dentro de la palanca (1 ud o € según regla),
        // para repartir la comisión de la palanca línea a línea sin cambiar el total.
        const groupLineEntries: Record<string, { sale: any; weight: number; esSeguroVirtual: boolean }[]> = {};
        const matchedSaleIds = new Set<any>();

        // INICIALIZAR OBJETIVOS Y CONTADORES BASADOS EN REGLAS DINAMICAS
        const isO2 = String(name).toLowerCase().includes('marta');
        const activeTiendaRules = isO2 ? o2Rules : adjustedTiendaRules;
        const activeTiendaHours = isO2 ? o2Hours : tiendaHours;

        const activeTeamGroupCounts = isO2 ? o2TeamGroupCounts : teamGroupCounts;
        const activeTeamGroupPending = isO2 ? o2TeamGroupPending : teamGroupPending;
        const comercialHour = activeTiendaHours.find(h => String(h.comercial).toLowerCase() === String(name).toLowerCase());
        const horario = comercialHour ? Number(comercialHour.horario) : 0;

        // Contar ventas de FTTR para este vendedor (excluyendo a Marta O2)
        let fttrCount = 0;
        if (!isO2) {
            fttrCount = sSales.filter(s => {
                const prod = String(s.producto || '').toLowerCase();
                const isAnul = String(s.anulado || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim() === 'si' ||
                               String(s.pendiente || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim() === 'anulado';
                if (isAnul) return false;
                return prod.includes('solución fttr') || prod.includes('solucion fttr') || prod.includes('fttr');
            }).length;
        }

        activeTiendaRules.forEach(rule => {
            const ruleName = rule.nombre;
            groupCounts[ruleName] = 0;
            groupPending[ruleName] = 0;
            groupComisions[ruleName] = 0;
            groupConsolidada[ruleName] = 0;
            groupSales[ruleName] = [];
            groupLineEntries[ruleName] = [];

            const totalHoras = rule.totalHoras || 0;
            let valObj1 = 0;
            let valObj2 = 0;
            let valObj3 = 0;
            if (totalHoras > 0 && horario > 0) {
                valObj1 = (rule.objPrimerTramo / totalHoras) * horario;
                valObj2 = (rule.objSegundoTramo / totalHoras) * horario;
                valObj3 = ((rule.objTercerTramo || 0) / totalHoras) * horario;
                // Objetivo 1 por UNIDADES: el prorrateo por horas da decimales (p.ej. 2,29) que se
                // MUESTRAN redondeados ("2") pero antes se comparaban en crudo -> con 2 ventas faltaba
                // 0,29 y no consolidaba. Se redondea SOLO el objetivo 1 (consolidación + Falta 1) para
                // que display y cálculo coincidan. Los tramos 2/3 y los de % (valor €) se dejan exactos.
                const _isPctObj = String(rule.importePrimerTramo || '').includes('%');
                if (!_isPctObj) {
                    valObj1 = Math.round(valObj1);
                }
            } else {
                valObj1 = rule.objPrimerTramo || 0;
                valObj2 = rule.objSegundoTramo || 0;
                valObj3 = rule.objTercerTramo || 0;
            }

            // Aplicar descuento de 910€ por cada venta de FTTR para Dispositivos + Seguros
            if (!isO2 && ruleName === 'Dispositivos + Seguros') {
                valObj1 = Math.max(0, valObj1 - fttrDiscount * fttrCount);
                valObj2 = Math.max(0, valObj2 - fttrDiscount * fttrCount);
                valObj3 = Math.max(0, valObj3 - fttrDiscount * fttrCount);
            }

            groupObj1[ruleName] = valObj1;
            groupObj2[ruleName] = valObj2;
            groupObj3[ruleName] = valObj3;
        });


        let totalValueGroupsAmount = 0;
        let totalUnitGroupsAmount = 0;

        // COUNTING LOGIC BASED ON RULES
        sSales.forEach(s => {
            // Las ANULADAS no cuentan (ni en volumen ni en comisión), igual que el resto de vistas.
            // Antes este bucle no las filtraba y se colaban en el volumen (p.ej. Dispositivos + Seguros).
            const _an = String(s.anulado || '').toLowerCase().trim();
            const _pe = String(s.pendiente || '').toLowerCase().trim();
            if (_an === 'si' || _an === 'sí' || _pe === 'anulado') return;
            // Un producto puede contar para multiples reglas si encaja en el Tipo de Venta
            activeTiendaRules.forEach(rule => {
                if (matchesRule(s, rule.nombre, rule.productosCuentan)) {
                    // Determinar si el tramo pide % o Euros (heuristic)
                    const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                    const isPending = String(s.pendiente || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim() === 'si';
                    const val = getValueForRule(s, rule.nombre, catalogs);
                    if (isPercentage) {
                        if (isPending) {
                            groupPending[rule.nombre] += val;
                        } else {
                            groupCounts[rule.nombre] += val;
                        }
                        totalValueGroupsAmount += val;
                    } else {
                        if (isPending) {
                            groupPending[rule.nombre] += 1;
                        } else {
                            groupCounts[rule.nombre] += 1;
                        }
                        totalUnitGroupsAmount += 1;
                    }
                    groupSales[rule.nombre].push(s);
                    groupLineEntries[rule.nombre].push({ sale: s, weight: isPercentage ? val : 1, esSeguroVirtual: false });
                    matchedSaleIds.add(s.id);
                }
                if (s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet).toLowerCase() !== 'seguro') {
                    const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
                    if (matchesRule(virtualSeguro, rule.nombre, rule.productosCuentan)) {
                        const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                        const isPending = String(s.pendiente || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim() === 'si';
                        const val = getValueForRule(virtualSeguro, rule.nombre, catalogs);
                        if (isPercentage) {
                            if (isPending) {
                                groupPending[rule.nombre] += val;
                            } else {
                                groupCounts[rule.nombre] += val;
                            }
                            totalValueGroupsAmount += val;
                        } else {
                            if (isPending) {
                                groupPending[rule.nombre] += 1;
                            } else {
                                groupCounts[rule.nombre] += 1;
                            }
                            totalUnitGroupsAmount += 1;
                        }
                        groupSales[rule.nombre].push(virtualSeguro);
                        groupLineEntries[rule.nombre].push({ sale: s, weight: isPercentage ? val : 1, esSeguroVirtual: true });
                        matchedSaleIds.add(s.id);
                    }
                }
            });
        });

        const profile = getProfile(name);
        let internalTotalComision = 0;
        let internalTotalConsolidada = 0;
        let internalTotalPendiente = 0;

        const groupIsConsolidado: Record<string, boolean> = {};
        // Por que una palanca se ha quedado en el tramo 1 teniendo el objetivo 2
        // cumplido (candado de tramo). La pantalla lo pinta al lado de la barra:
        // sin esto el comercial ve el objetivo en verde y cobra menos, sin motivo.
        const groupTopeMotivo: Record<string, string | null> = {};

        // ── ADICIONES (liquidación): detalle por línea y resumen de objetivos ──
        const lineasDetalle: LineaComisionTienda[] = [];
        const objetivosResumen: ObjetivoResumenTienda[] = [];

        activeTiendaRules.forEach(rule => {
            const ruleName = rule.nombre;
            const qtty = groupCounts[ruleName] || 0;
            const obj1 = groupObj1[ruleName] || 0;
            const obj2 = groupObj2[ruleName] || 0;
            const obj3 = groupObj3[ruleName] || 0;

            let comisionCalculada = 0;
            const isPercentage = String(rule.importePrimerTramo || '').includes('%');

            const parseImporte = (val: any) => {
                let s = String(val || '0').replace(/[^0-9.,\-]/g, '').trim();
                s = s.replace(',', '.');
                return Number(s) || 0;
            };

            const imp1 = parseImporte(rule.importePrimerTramo);
            const imp2 = parseImporte(rule.importeSegundoTramo);
            const imp3 = parseImporte(rule.importeTercerTramo);

            const qttyPending = groupPending[ruleName] || 0;
            const qttyFinalizadas = groupCounts[ruleName] || 0;
            const qttyTotal = qttyFinalizadas + qttyPending;

            let comTotal = 0;
            let comConsolidada = 0;
            let comPendiente = 0;

            // ADICIÓN (liquidación): variables del resumen de objetivos, hoisted del bloque
            // qttyTotal > 0 (misma asignación que siempre; con 0 ventas quedan en su defecto).
            let isTeamObj2 = false;
            let isTeamObj3 = false;
            let tramoAplicado = 0;
            // El candado de tramo ha mordido: la palanca se paga al tramo 1 aunque el
            // objetivo 2 (o el 3) esten cumplidos. Viaja al resumen para que la pantalla
            // y el abonare del ERP puedan explicar POR QUE se ha pagado menos.
            let topeAplicado = false;
            let topeMotivo: string | null = null;

            if (qttyTotal > 0) {
                let activeImp = imp1;
                tramoAplicado = 1;
                let isConsolidado = (obj1 === 0 && obj2 === 0) || (qttyTotal >= obj1 && obj1 > 0);
                let isAccumulative = false;
                let isAccumulativeFixed = false;
                // Candado de tramo: palancas AJENAS que tienen que llegar a su % de
                // objetivo para que esta regla pueda pasar del tramo 1.
                const topeTramo1: any[] = [];
                let fixedSoloBase = false;  // bono fijo sin las unidades extra

                // Evaluar reglas dinámicas del Constructor Visual
                if (rule.condicionantes && rule.condicionantes.startsWith('[')) {
                    try {
                        const conds = JSON.parse(rule.condicionantes);
                        if (Array.isArray(conds)) {
                            for (const cond of conds) {
                                // Una condición SIN «sobre qué» o sin valor NO es una condición:
                                // se salta, igual que hace la fórmula del jefe. Antes,
                                // REQUIRE_GROUP_QTY con targetGroup vacío buscaba el grupo ''
                                // (0 ventas siempre) y dejaba la palanca ENTERA sin consolidar,
                                // mientras el panel de edición aseguraba en rojo que «así esta
                                // condición no se aplica». El aviso tiene que ser verdad.
                                // (Los tipos colectivos/acumulativos no llevan targetGroup.)
                                const necesitaObjetivo = ['REQUIRE_GROUP_QTY', 'REQUIRE_GROUP_PCT',
                                    'REQUIRE_GROUP_PCT_TRAMO2', 'REQUIRE_STORE_QTY_TRAMO2'].includes(cond.type)
                                if (necesitaObjetivo && (!String(cond.targetGroup || '').trim() || !(Number(cond.value) > 0))) {
                                    continue;
                                }
                                if (cond.type === 'REQUIRE_TEAM_OBJ2') {
                                    isTeamObj2 = true;
                                } else if (cond.type === 'REQUIRE_TEAM_OBJ3') {
                                    isTeamObj3 = true;
                                } else if (cond.type === 'REQUIRE_TEAM_OBJ23') {
                                    isTeamObj2 = true;
                                    isTeamObj3 = true;
                                } else if (cond.type === 'ACCUMULATIVE_TRAMOS') {
                                    isAccumulative = true;
                                } else if (cond.type === 'ACCUMULATIVE_FIXED_BASE') {
                                    isAccumulativeFixed = true;
                                } else if (cond.type === 'REQUIRE_GROUP_QTY') {
                                    const targetQtty = (groupCounts[cond.targetGroup] || 0) + (groupPending[cond.targetGroup] || 0);
                                    if (targetQtty < cond.value) {
                                        isConsolidado = false;
                                    }
                                } else if (cond.type === 'REQUIRE_GROUP_PCT_TRAMO2' ||
                                           cond.type === 'REQUIRE_STORE_QTY_TRAMO2') {
                                    // No bloquea la regla entera: solo impide subir de tramo.
                                    topeTramo1.push(cond);
                                } else if (cond.type === 'REQUIRE_GROUP_PCT') {
                                    const targetQtty = (groupCounts[cond.targetGroup] || 0) + (groupPending[cond.targetGroup] || 0);
                                    const targetObj = groupObj1[cond.targetGroup] || 0;
                                    if (targetObj > 0) {
                                        const pct = (targetQtty / targetObj) * 100;
                                        if (pct < cond.value) {
                                            isConsolidado = false;
                                        }
                                    } else {
                                        if (cond.value > 0 && targetQtty === 0) {
                                            isConsolidado = false;
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('Error parsing rule conditions', e);
                    }
                }

                if (isTeamObj2 || isTeamObj3) {
                    // Tramo 2 y/o 3 colectivos: se evalúan contra el total del Equipo (objetivo global, sin prorratear)
                    const globalObj2 = rule.objSegundoTramo || 0;
                    const globalObj3 = Number(rule.objTercerTramo) || 0;
                    const teamTotal = (activeTeamGroupCounts[ruleName] || 0) + (activeTeamGroupPending[ruleName] || 0);
                    const baseOk = qttyTotal >= obj1 && obj1 > 0;
                    const reached3 = isTeamObj3 ? (globalObj3 > 0 && teamTotal >= globalObj3) : (obj3 > 0 && qttyTotal >= obj3);
                    const reached2 = isTeamObj2 ? (globalObj2 > 0 && teamTotal >= globalObj2) : (obj2 > 0 && qttyTotal >= obj2);
                    if (baseOk && reached3) { activeImp = imp3; tramoAplicado = 3; }
                    else if (baseOk && reached2) { activeImp = imp2; tramoAplicado = 2; }
                    else { activeImp = imp1; tramoAplicado = 1; }
                } else {
                    if (qttyTotal >= obj3 && obj3 > 0) { activeImp = imp3; tramoAplicado = 3; }
                    else if (qttyTotal >= obj2 && obj2 > 0) { activeImp = imp2; tramoAplicado = 2; }
                    else if (qttyTotal >= obj1 && obj1 > 0) { activeImp = imp1; tramoAplicado = 1; }
                    else { activeImp = imp1; tramoAplicado = 1; } // Valorar siempre al Tramo 1 aunque no llegue al objetivo
                }

                // ── CANDADO DE TRAMO (REQUIRE_GROUP_PCT_TRAMO2) ──────────────────
                // Pedido por el dueno (ago-2026): del segundo tramo en adelante, una
                // regla puede quedar condicionada a que OTRA palanca llegue a un % de
                // su objetivo. Ejemplo real: el tramo 2 de ARPU solo se paga si
                // Dispositivos + Seguros llega al 100 %. Si no llega, la regla se queda
                // en el tramo 1 — NO se deja de cobrar, que para eso ya esta
                // REQUIRE_GROUP_PCT.
                // El % se mide sobre el PRIMER objetivo de la palanca ajena, igual que
                // REQUIRE_GROUP_PCT, para que las dos condiciones cuenten lo mismo.
                // El candado SOLO puede BAJAR el pago: si alguna vez deja de cumplirse
                // esa regla, es un fallo.
                if (topeTramo1.length > 0) {
                    const culpables: string[] = [];
                    topeTramo1.forEach((cond: any) => {
                        // Sin palanca elegida no hay condicion que cumplir.
                        if (!cond.targetGroup || !cond.value || cond.value <= 0) return;

                        // MÍNIMO POR TIENDA: TODAS las tiendas del mes tienen que llegar
                        // a N ventas de ese Tipo de Venta. Es la traduccion literal de
                        // «30 dispositivos por tienda»: si una sola tienda se queda
                        // corta, la palanca entera se paga al primer tramo.
                        if (cond.type === 'REQUIRE_STORE_QTY_TRAMO2') {
                            const uds = unidadesPorTienda(cond.targetGroup);
                            const tiendas = Object.keys(uds);
                            // Sin plantilla no se sabe que tiendas hay: no se bloquea
                            // (mismo criterio que el objetivo 0 de aqui abajo).
                            if (tiendas.length === 0) return;
                            const flojas = tiendas.filter(t => uds[t] < cond.value).sort();
                            if (flojas.length > 0) {
                                culpables.push(
                                    `${cond.targetGroup}: exige ${cond.value} por tienda y ` +
                                    `faltan en ${flojas.map(t => `${t} (${uds[t]})`).join(', ')}`
                                );
                            }
                            return;
                        }

                        const targetObj = groupObj1[cond.targetGroup] || 0;
                        // Objetivo 0 (o palanca que no existe en este juego de reglas, p.ej.
                        // O2, o renombrada en Catalogos) = no se puede fallar un objetivo
                        // que no existe: NO bloquea. Preferimos no cobrar de menos por una
                        // casilla mal escrita, que es un error mudo e imposible de ver.
                        if (targetObj <= 0) return;
                        const targetQtty = (groupCounts[cond.targetGroup] || 0) + (groupPending[cond.targetGroup] || 0);
                        const logro = (targetQtty / targetObj) * 100;
                        if (logro < cond.value) {
                            culpables.push(`${cond.targetGroup} al ${logro.toFixed(0)} % (exige ${cond.value} %)`);
                        }
                    });
                    if (culpables.length > 0) {
                        topeAplicado = true;
                        topeMotivo = `Tramo 1 forzado: ${culpables.join('; ')}`;
                        activeImp = imp1;
                        tramoAplicado = 1;
                        // ACCUMULATIVE_TRAMOS calcula baseQty*imp1 + extraQty*imp2, o sea
                        // que se salta el tramo: apagarlo deja qttyTotal*imp1, que es
                        // justo «todo al primer tramo». Correcto.
                        isAccumulative = false;
                        // ACCUMULATIVE_FIXED_BASE es OTRA cosa: ahi imp1 no es una tarifa
                        // por unidad sino un BONO FIJO (imp1 + extra*imp2). Apagarlo
                        // dejaria qttyTotal * imp1 = el bono cobrado UNA VEZ POR VENTA, es
                        // decir pagar MUCHISIMO MAS. Se queda encendido y lo unico que se
                        // hace es quitar las unidades extra: solo el bono base.
                        fixedSoloBase = true;
                    }
                }

                if (isPercentage) {
                    if (isAccumulativeFixed) {
                        if (qttyTotal >= obj1 && obj1 > 0) {
                            const extraQty = fixedSoloBase ? 0 : Math.max(0, qttyTotal - (obj2 > 0 ? obj2 - 1 : obj1));
                            comTotal = imp1 + (extraQty * (imp2 / 100));
                        } else {
                            comTotal = 0;
                        }
                    } else if (isAccumulative && qttyTotal >= obj2 && obj2 > 0) {
                        const baseQty = obj2 - 1;
                        const extraQty = qttyTotal - baseQty;
                        comTotal = (baseQty * (imp1 / 100)) + (extraQty * (imp2 / 100));
                    } else {
                        comTotal = qttyTotal * (activeImp / 100);
                    }
                } else {
                    if (isAccumulativeFixed) {
                        if (qttyTotal >= obj1 && obj1 > 0) {
                            const extraQty = fixedSoloBase ? 0 : Math.max(0, qttyTotal - (obj2 > 0 ? obj2 - 1 : obj1));
                            comTotal = imp1 + (extraQty * imp2);
                        } else {
                            comTotal = 0;
                        }
                    } else if (isAccumulative && qttyTotal >= obj2 && obj2 > 0) {
                        const baseQty = obj2 - 1;
                        const extraQty = qttyTotal - baseQty;
                        comTotal = (baseQty * imp1) + (extraQty * imp2);
                    } else {
                        comTotal = qttyTotal * activeImp;
                    }
                }

                // CONSOLIDADO / POR CONSOLIDAR = INSTALADO / PENDIENTE DE INSTALAR.
                //
                // Hasta el 22-ago-2026 este reparto miraba `isConsolidado`, o sea
                // si la palanca habia llegado a su primer OBJETIVO: la comision
                // entera se iba al consolidado o entera a lo pendiente. Eso no es
                // lo que significan esas palabras para el negocio — «consolidar es
                // que las ventas se instalen» (el dueno) — y daba numeros absurdos:
                // Elena, julio, con 55 ventas esperando instalacion salia con 0,00 €
                // por consolidar (habia superado todos sus objetivos), y Lara salia
                // con 125,64 € sin tener NI UNA venta pendiente.
                //
                // Ahora se reparte por lo unico que importa: cuanto de la comision
                // viene de ventas ya finalizadas y cuanto de ventas pendientes. Es
                // el mismo peso con el que cada venta conto para la regla, asi que
                // cuadra con la columna «Pte.» de la tabla y con el detalle por
                // linea que se manda al ERP.
                // El reparto en si se hace MAS ABAJO, cuando ya estan calculadas
                // las lineas: se suman las de las ventas pendientes con SUS MISMOS
                // centimos redondeados. Repartir aqui en proporcion daba hasta 2
                // centimos de diferencia con el detalle que recibe el ERP, y dos
                // pantallas que no cuadran por dos centimos son dos pantallas que
                // no cuadran.
                //
                // El flag de objetivo NO se toca: alimenta `cumplido` y las columnas
                // «Faltan 1/2/3», que si van de objetivos. Son dos cosas distintas y
                // ahora cada una esta en su sitio.
                groupIsConsolidado[ruleName] = isConsolidado;
            } else {
                groupIsConsolidado[ruleName] = false;
            }

            groupComisions[ruleName] = comTotal;
            groupTopeMotivo[ruleName] = topeAplicado ? topeMotivo : null;
            internalTotalComision += comTotal;

            // ── ADICIÓN (liquidación): detalle por línea de la palanca ────────────
            // Reparte la MISMA comisión de la palanca línea a línea con el peso con el
            // que cada venta contó para la regla (1 ud / su importe €). La última línea
            // absorbe la diferencia de redondeo para que Σ líneas == comisión (2 dec).
            const entradas = groupLineEntries[ruleName] || [];
            const totalWeight = entradas.reduce((acc, e) => acc + e.weight, 0);
            const lineasGrupo: LineaComisionTienda[] = entradas.map(e => ({
                saleId: e.sale.id,
                producto: e.esSeguroVirtual ? `Seguro de ${String(e.sale.producto || '')}`.trim() : String(e.sale.producto || ''),
                grupo: ruleName,
                comision: totalWeight > 0 ? comTotal * (e.weight / totalWeight) : 0,
                ...(e.esSeguroVirtual ? { esSeguroVirtual: true } : {}),
            }));
            const objetivoRedondeo = r2(comTotal);
            let sumaLineas = 0;
            lineasGrupo.forEach(l => { l.comision = r2(l.comision); sumaLineas = r2(sumaLineas + l.comision); });
            if (lineasGrupo.length > 0) {
                const diff = r2(objetivoRedondeo - sumaLineas);
                if (diff !== 0) {
                    const last = lineasGrupo[lineasGrupo.length - 1];
                    last.comision = r2(last.comision + diff);
                }
            }
            // ── El reparto CONSOLIDADO / POR CONSOLIDAR, con las lineas ya hechas ─
            // «Por consolidar» = lo que suman las lineas de las ventas marcadas
            // PENDIENTES (la columna «Pte.» de la tabla). Se usan las cifras ya
            // redondeadas, las MISMAS que se mandan al ERP, para que el importe
            // que retiene alli y el que aparece aqui sean el mismo al centimo.
            const esPte = (venta: any) => String(venta?.pendiente || '')
                .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() === 'si';
            let comPteLineas = 0;
            lineasGrupo.forEach((l, i) => {
                if (esPte(entradas[i]?.sale)) comPteLineas = r2(comPteLineas + l.comision);
            });
            if (!objCerrados && !groupIsConsolidado[ruleName] && objetivoRedondeo !== 0) {
                // Mes VIVO y objetivo sin alcanzar: toda la comision de esta palanca
                // esta por consolidar, porque aun puede cambiar vendiendo mas.
                comPendiente = objetivoRedondeo;
                comConsolidada = 0;
            } else {
                // Mes cerrado (o objetivo ya alcanzado): lo unico que queda por
                // consolidar son las ventas pendientes de INSTALAR.
                comPendiente = comPteLineas;
                comConsolidada = r2(objetivoRedondeo - comPteLineas);
            }
            groupConsolidada[ruleName] = comConsolidada;
            internalTotalConsolidada += comConsolidada;
            internalTotalPendiente += comPendiente;

            lineasDetalle.push(...lineasGrupo);

            // ── ADICIÓN (liquidación): resumen del objetivo de la palanca ─────────
            const teamTotalResumen = (activeTeamGroupCounts[ruleName] || 0) + (activeTeamGroupPending[ruleName] || 0);
            objetivosResumen.push({
                grupo: ruleName,
                cumplido: !!groupIsConsolidado[ruleName],
                hito: tramoAplicado,
                objetivo1: obj1, conseguido1: qttyTotal,
                objetivo2: isTeamObj2 ? (rule.objSegundoTramo || 0) : obj2,
                conseguido2: isTeamObj2 ? teamTotalResumen : qttyTotal,
                objetivo3: isTeamObj3 ? (Number(rule.objTercerTramo) || 0) : obj3,
                conseguido3: isTeamObj3 ? teamTotalResumen : qttyTotal,
                esEquipoObj2: isTeamObj2,
                esEquipoObj3: isTeamObj3,
                tarifaAplicada: tramoAplicado > 0 ? `Tramo ${tramoAplicado}` : null,
                topeAplicado,
                topeMotivo,
            });
        });

        // ── "Altas O2/Otras": O2 MovilFree vendidas por comerciales que NO son de la tienda O2
        // (Marta). Se les paga 9 €/ud en SU propia liquidación. La facturación de la empresa por
        // estas ventas se imputa a la tienda O2 MovilFree (ver Rentabilidad por Tiendas). ──
        let o2OtrasConfirmed = 0;
        let o2OtrasPending = 0;
        const o2OtrasSales: any[] = [];
        if (!isO2) {
            sSales.forEach(s => {
                const _an = String(s.anulado || '').toLowerCase().trim();
                const _pe = String(s.pendiente || '').toLowerCase().trim();
                if (_an === 'si' || _an === 'sí' || _pe === 'anulado') return;
                const det = String(s.detalle || s.categoria || '').toLowerCase().trim();
                if (det !== 'o2') return;
                o2OtrasSales.push(s);
                const isPend = String(s.pendiente || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim() === 'si';
                if (isPend) o2OtrasPending += 1; else o2OtrasConfirmed += 1;
            });
        }
        const o2OtrasComisionConsolidada = o2OtrasConfirmed * O2_OTRAS_RATE;
        const o2OtrasComisionPendiente = o2OtrasPending * O2_OTRAS_RATE;
        const o2OtrasComision = o2OtrasComisionConsolidada + o2OtrasComisionPendiente;
        internalTotalComision += o2OtrasComision;
        internalTotalConsolidada += o2OtrasComisionConsolidada;
        internalTotalPendiente += o2OtrasComisionPendiente;

        // ADICIÓN (liquidación): las "Altas O2/Otras" son por venta (9 €/ud) → líneas.
        o2OtrasSales.forEach(s => {
            lineasDetalle.push({ saleId: s.id, producto: String(s.producto || ''), grupo: 'Altas O2/Otras', comision: O2_OTRAS_RATE });
            matchedSaleIds.add(s.id);
        });

        // ADICIÓN (liquidación): ventas válidas SIN palanca de comisión — no comisionan,
        // pero se listan a 0 € para que la liquidación las pueda trazar.
        sSales.forEach(s => {
            const _an = String(s.anulado || '').toLowerCase().trim();
            const _pe = String(s.pendiente || '').toLowerCase().trim();
            if (_an === 'si' || _an === 'sí' || _pe === 'anulado') return;
            // Las correcciones contables de meses ya liquidados tampoco se listan:
            // la liquidación es un documento de NÓMINA y ahí no pintan nada. Sin
            // esto, julio viajaba al ERP con 104 líneas a 0 € que le habrían
            // ensuciado el cotejo a quien lleva las liquidaciones.
            if (esCorreccionContableRepos(s)) return;
            if (!matchedSaleIds.has(s.id)) {
                lineasDetalle.push({ saleId: s.id, producto: String(s.producto || ''), grupo: null, comision: 0 });
            }
        });

        // Apuntar las comisiones del motor de reglas extra
        const virtualKpiExtras: any[] = [];

        // --- AUTO-PILOTO RENDIMIENTOS GLOBALES (KPI BONOS) ---
        if (activePeriodKey && activeRules.length > 0) {

            const qttyBaf = (groupCounts['BAF'] || 0) + (groupPending['BAF'] || 0);
            const targetBaf = groupObj2['BAF'] > 0 ? groupObj2['BAF'] : (groupObj1['BAF'] || 0);
            const perceBaf = targetBaf > 0 ? (qttyBaf / targetBaf) * 100 : (qttyBaf > 0 ? 100 : 0);

            const qttyFd = (groupCounts['FD'] || 0) + (groupPending['FD'] || 0);
            const targetFd = groupObj2['FD'] > 0 ? groupObj2['FD'] : (groupObj1['FD'] || 0);
            const perceFd = targetFd > 0 ? (qttyFd / targetFd) * 100 : (qttyFd > 0 ? 100 : 0);

            activeRules.forEach(rule => {
                // Verificar canal
                const cType = rule.channelType?.toUpperCase() || 'AMBOS';
                if (cType !== 'AMBOS' && cType !== profile.toUpperCase()) return; // Ignorar si no es de su segmento

                if (rule.combinationLabel.startsWith('[KPI] ')) {
                    // Extraer variables BAF y FD del Label => [KPI] BAF>=120 FD>=80 MULT=FD
                    const str = rule.combinationLabel;
                    let bafReq = 0, fdReq = 0;
                    const bafMatch = str.match(/BAF>=(\d+)/); if (bafMatch) bafReq = Number(bafMatch[1]);
                    const fdMatch = str.match(/FD>=(\d+)/); if (fdMatch) fdReq = Number(fdMatch[1]);
                    const multMatch = str.match(/MULT=([a-zA-Z0-9_]+)/);
                    const multToken = multMatch ? multMatch[1].toUpperCase() : null;

                    // Evaluar si supera ambas barreras
                    if (perceBaf >= bafReq && perceFd >= fdReq) {
                        let multiplier = 1;
                        if (multToken) {
                            multiplier = groupCounts[multToken] || 0;
                        }
                        if (multiplier <= 0) return; // Si exige ventas pero tuvo 0, no cobra bono

                        const rewardTeleco = (rule.telecomRewardAmount || 0) * multiplier;
                        const rewardSeller = (rule.sellerRewardAmount || 0) * multiplier;

                        const activePeriodId = monthSales.length > 0 ? monthSales[0].periodId : null;
                        if (!activePeriodId) return;

                        const triggerKey = `${activePeriodId}-${rule.id}-${name}-KPI_AUTOPILOT`;
                        const alreadyExists = extraAssignments.some(ea => ea.triggerKey === triggerKey);

                        if (!alreadyExists) {
                            virtualKpiExtras.push({
                                ruleId: rule.id,
                                periodId: activePeriodId,
                                seller: name,
                                sourceType: 'AUTOMATIC',
                                customerName: 'Bono Global Mensual KPI',
                                customerNif: 'GENERAL',
                                triggerKey: triggerKey,
                                triggerSummary: `Hito Alcanzado: BAF ${Math.round(perceBaf)}% / FD ${Math.round(perceFd)}%${multToken ? ` (x${multiplier} ${multToken})` : ''}`,
                                telecomRewardAmount: rewardTeleco,
                                sellerRewardAmount: rewardSeller,
                                status: 'LIQUIDATED',
                                rule: rule
                            });
                        }
                    }
                } else if (rule.combinationLabel.startsWith('[KPI_QTY]')) {
                    const str = rule.combinationLabel;
                    const tgtMatch = str.match(/TGT=(.*?)\s+QTY>=/);
                    const qtyMatch = str.match(/QTY>=(\d+)/);
                    const multMatch = str.match(/MULT=(.*)/);
                    const scopeMatch = str.match(/SCOPE=(TEAM|INDIV)/);
                    const indivMinMatch = str.match(/INDIV_MIN=(\d+)/);

                    if (!tgtMatch || !qtyMatch) return;

                    const tgtProd = tgtMatch[1].trim().toUpperCase();
                    const qtyReq = Number(qtyMatch[1]);
                    const multToken = multMatch && multMatch[1] ? multMatch[1].trim().toUpperCase() : null;
                    const scope = scopeMatch ? scopeMatch[1] : 'INDIV';
                    const indivMin = indivMinMatch ? Number(indivMinMatch[1]) : 0;

                    // Calcular contador del target (Soporta Equipo o Individual)
                    let count = 0;
                    if (scope === 'TEAM') {
                        count = monthSales.filter(s => {
                            const pName = String(s.vendedor || '');
                            const sProfile = getProfile(pName) || 'BASICO';
                            if (cType !== 'AMBOS' && sProfile.toUpperCase() !== cType) return false;

                            const v = String(s.producto || '').toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
                            const t = tgtProd.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
                            if (ALL_GROUPS.includes(tgtProd)) {
                                return getGroupVisual(s.producto, s.detalle || s.sheet || s.categoria) === tgtProd;
                            }
                            return v === t || v.includes(t);
                        }).length;
                    } else {
                        if (ALL_GROUPS.includes(tgtProd)) {
                            count = groupCounts[tgtProd] || 0;
                        } else {
                            count = sSales.filter(s => {
                                const v = String(s.producto || '').toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
                                const t = tgtProd.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
                                return v === t || v.includes(t);
                            }).length;
                        }
                    }

                    if (count >= qtyReq) {
                        let appliesToSeller = true;
                        let indivCount = 0;
                        if (scope === 'TEAM' && indivMin > 0) {
                            if (ALL_GROUPS.includes(tgtProd)) {
                                indivCount = groupCounts[tgtProd] || 0;
                            } else {
                                indivCount = sSales.filter(s => {
                                    const v = String(s.producto || '').toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
                                    const t = tgtProd.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
                                    return v === t || v.includes(t);
                                }).length;
                            }
                            if (indivCount < indivMin) appliesToSeller = false;
                        }

                        let multiplier = 1;
                        if (multToken) {
                            if (ALL_GROUPS.includes(multToken)) multiplier = groupCounts[multToken] || 0;
                            else {
                                multiplier = sSales.filter(s => {
                                    const v = String(s.producto || '').toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
                                    const t = multToken.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
                                    return v === t || v.includes(t);
                                }).length;
                            }
                        }
                        if (multiplier <= 0) return;

                        const rewardTeleco = (rule.telecomRewardAmount || 0) * multiplier;
                        const rewardSeller = appliesToSeller ? ((rule.sellerRewardAmount || 0) * multiplier) : 0;

                        const activePeriodId = monthSales.length > 0 ? monthSales[0].periodId : null;
                        if (!activePeriodId) return;

                        const triggerKey = `${activePeriodId}-${rule.id}-${name}-KPI_QTY_AUTOPILOT`;
                        const alreadyExists = extraAssignments.some(ea => ea.triggerKey === triggerKey);

                        if (!alreadyExists) {
                            virtualKpiExtras.push({
                                ruleId: rule.id,
                                periodId: activePeriodId,
                                seller: name,
                                sourceType: 'AUTOMATIC',
                                customerName: 'Bono Reto Unidades',
                                customerNif: 'GENERAL',
                                triggerKey: triggerKey,
                                triggerSummary: `Reto Superado: >=${qtyReq} uds de ${tgtProd} (Alcanzado: ${count})${!appliesToSeller ? ' [SIN COBRO COMERCIAL: Mín No Alcanzado]' : ''}${multToken ? ` (x${multiplier} ${multToken})` : ''}`,
                                telecomRewardAmount: rewardTeleco,
                                sellerRewardAmount: rewardSeller,
                                status: 'LIQUIDATED',
                                rule: rule
                            });
                        }
                    }
                } else if (rule.combinationLabel.startsWith('[KPI_PERCENT]')) {
                    const str = rule.combinationLabel;
                    const tgtMatch = str.match(/TGT=(.*?)\s+MIN_PCT=/);
                    const minPctMatch = str.match(/MIN_PCT=(\d+)/);

                    if (!tgtMatch || !minPctMatch) return;

                    const targets = tgtMatch[1].split(',').map((t: string) => t.trim().toUpperCase());
                    const minPct = Number(minPctMatch[1]);

                    const telecoPct = Number(rule.telecomRewardAmount || 0);
                    const sellerPct = Number(rule.sellerRewardAmount || 0);

                    let allMeetPct = true;
                    let totalSalesVolume = 0;

                    for (const tgt of targets) {
                        const qtty = groupCounts[tgt] || 0;
                        const targetVal = groupObj2[tgt] > 0 ? groupObj2[tgt] : (groupObj1[tgt] || 0);
                        const perce = targetVal > 0 ? (qtty / targetVal) * 100 : (qtty > 0 ? 100 : 0);

                        if (perce < minPct) {
                            allMeetPct = false;
                        }

                        totalSalesVolume += (groupCounts[tgt] || 0);
                    }

                    if (allMeetPct && totalSalesVolume > 0) {
                        const rewardTeleco = totalSalesVolume * (telecoPct / 100);
                        const rewardSeller = totalSalesVolume * (sellerPct / 100);

                        const activePeriodId = monthSales.length > 0 ? monthSales[0].periodId : null;
                        if (!activePeriodId) return;

                        const triggerKey = `${activePeriodId}-${rule.id}-${name}-KPI_PERCENT_AUTOPILOT`;
                        const alreadyExists = extraAssignments.some(ea => ea.triggerKey === triggerKey);

                        if (!alreadyExists) {
                            virtualKpiExtras.push({
                                ruleId: rule.id,
                                periodId: activePeriodId,
                                seller: name,
                                sourceType: 'AUTOMATIC',
                                customerName: 'Bono Relativo',
                                customerNif: 'GENERAL',
                                triggerKey: triggerKey,
                                triggerSummary: `Objetivos Alcanzados: ${targets.join(' y ')} >= ${minPct}%. Bonos (${telecoPct}% Emp | ${sellerPct}% Com) sobre Facturación (€${totalSalesVolume.toFixed(2)})`,
                                telecomRewardAmount: rewardTeleco,
                                sellerRewardAmount: rewardSeller,
                                status: 'LIQUIDATED',
                                rule: rule
                            });
                        }
                    }
                }
            });
        }

        // --- AUTO-PILOTO TERRITORIAL O2 MOVILFREE (SOLO MARTA) ---
        if (isO2 && territorialO2Rules && territorialO2Rules.length > 0) {
            const TRAMOS_MES = [
              { key: '4_10', label: 'Mes de 4 a 10', min: 4, max: 10 },
              { key: '11_14', label: 'Mes de 11 a 14', min: 11, max: 14 },
              { key: '15_20', label: 'Mes de 15 a 20', min: 15, max: 20 },
              { key: '21_30', label: 'Mes de 21 a 30', min: 21, max: 30 },
              { key: '31_40', label: 'Mes de 31 a 40', min: 31, max: 40 },
              { key: '41_plus', label: 'Mes de >=41', min: 41, max: 99999 }
            ];
            const TRAMOS_TRIM = [
              { key: '5_9', label: 'Trim de 5 a 9', min: 5, max: 9 },
              { key: '10_plus', label: 'Trim >=10', min: 10, max: 99999 }
            ];
            const parseNumberLocal = (val: string) => {
                let s = String(val || '0').replace(/[^0-9.,\-]/g, '').trim();
                s = s.replace(/\./g, '').replace(',', '.');
                return parseFloat(s) || 0;
            };

            territorialO2Rules.forEach(rule => {
                const filtered = sSales.filter(s => {
                    const isPendingOrAnnulled = String(s.anulado || '').toLowerCase() === 'sí' || String(s.anulado || '').toLowerCase() === 'si' || String(s.pendiente || '').toLowerCase() === 'anulado';
                    if (isPendingOrAnnulled) return false;
                    return matchTipoVenta(s, rule.tipoVenta);
                });

                const isMoneyType = String(rule.tipoVenta).toLowerCase().includes('dispositivos') || String(rule.tipoVenta).toLowerCase().includes('importe');
                const totalSalesForRule = isMoneyType ? filtered.reduce((acc, s) => acc + (parseFloat(s.importe || s.cuota || '0') || 0), 0) : filtered.length;

                let bonus = 0;

                // Evaluar tramos mes
                const tm = rule.tramosMes || {};
                const achievedMes = TRAMOS_MES.find(t => totalSalesForRule >= t.min && totalSalesForRule <= t.max);
                if (achievedMes && tm[achievedMes.key]) {
                    bonus += parseNumberLocal(tm[achievedMes.key]);
                }

                // Evaluar tramos trim
                const tt = rule.tramosTrim || {};
                const achievedTrim = TRAMOS_TRIM.find(t => totalSalesForRule >= t.min && totalSalesForRule <= t.max);
                if (achievedTrim && tt[achievedTrim.key]) {
                    bonus += parseNumberLocal(tt[achievedTrim.key]);
                }

                // Evaluar conectividad
                if (totalSalesForRule > 0 && rule.conectividad) {
                   bonus += parseNumberLocal(rule.conectividad || '0');
                }

                // Mostrar siempre para que la comercial pueda ver su objetivo territorial aunque lleve 0 ventas
                const activePeriodId = monthSales.length > 0 ? monthSales[0].periodId : null;
                if (!activePeriodId) return;

                // Separar ventas consolidadas y pendientes
                const isPending = (s: any) => String(s.pendiente || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim() === 'si';
                const completedSalesList = filtered.filter(s => !isPending(s));
                const pendingSalesList = filtered.filter(s => isPending(s));

                let completedSalesForRule = 0;
                let pendingSalesForRule = 0;

                if (isMoneyType) {
                    completedSalesForRule = completedSalesList.reduce((acc, s) => acc + (parseFloat(s.importe || s.cuota || '0') || 0), 0);
                    pendingSalesForRule = pendingSalesList.reduce((acc, s) => acc + (parseFloat(s.importe || s.cuota || '0') || 0), 0);
                } else {
                    completedSalesForRule = completedSalesList.length;
                    pendingSalesForRule = pendingSalesList.length;
                }

                let completedBonus = 0;
                let pendingBonus = 0;

                if (totalSalesForRule > 0) {
                    pendingBonus = Math.round((bonus * (pendingSalesForRule / totalSalesForRule)) * 100) / 100;
                    completedBonus = Math.round((bonus - pendingBonus) * 100) / 100;
                }

                if (bonus === 0 || totalSalesForRule === 0) {
                    const triggerKey = `TERRITORIAL_O2_${rule.id}_${activePeriodId}_LIQUIDATED`;
                    virtualKpiExtras.push({
                        ruleId: `TERRITORIAL_${rule.id}`,
                        periodId: activePeriodId,
                        seller: name,
                        sourceType: 'AUTOMATIC',
                        customerName: 'Bono Territorial O2',
                        customerNif: 'TERRITORIAL',
                        triggerKey: triggerKey,
                        triggerSummary: `Territorial O2: ${rule.nombre} (0 ${isMoneyType ? '€' : 'ventas'})`,
                        telecomRewardAmount: 0,
                        sellerRewardAmount: 0,
                        status: 'LIQUIDATED',
                        rule: { name: `TERRITORIAL O2 MOVILFREE - ${rule.nombre}` }
                    });
                } else {
                    // Si hay parte consolidada > 0
                    if (completedBonus > 0) {
                        const triggerKeyLiq = `TERRITORIAL_O2_${rule.id}_${activePeriodId}_LIQUIDATED`;
                        virtualKpiExtras.push({
                            ruleId: `TERRITORIAL_${rule.id}`,
                            periodId: activePeriodId,
                            seller: name,
                            sourceType: 'AUTOMATIC',
                            customerName: 'Bono Territorial O2',
                            customerNif: 'TERRITORIAL',
                            triggerKey: triggerKeyLiq,
                            triggerSummary: `Territorial O2: ${rule.nombre} (${totalSalesForRule} ${isMoneyType ? '€' : 'ventas'})`,
                            telecomRewardAmount: completedBonus,
                            sellerRewardAmount: 0,
                            status: 'LIQUIDATED',
                            rule: { name: `TERRITORIAL O2 MOVILFREE - ${rule.nombre}` }
                        });
                    }

                    // Si hay parte pendiente > 0
                    if (pendingBonus > 0) {
                        const triggerKeyPend = `TERRITORIAL_O2_${rule.id}_${activePeriodId}_PENDING`;
                        virtualKpiExtras.push({
                            ruleId: `TERRITORIAL_${rule.id}`,
                            periodId: activePeriodId,
                            seller: name,
                            sourceType: 'AUTOMATIC',
                            customerName: 'Bono Territorial O2',
                            customerNif: 'TERRITORIAL',
                            triggerKey: triggerKeyPend,
                            triggerSummary: `Territorial O2: ${rule.nombre} (${totalSalesForRule} ${isMoneyType ? '€' : 'ventas'})`,
                            telecomRewardAmount: pendingBonus,
                            sellerRewardAmount: 0,
                            status: 'PENDING',
                            rule: { name: `TERRITORIAL O2 MOVILFREE - ${rule.nombre}` }
                        });
                    }
                }
            });
        }

        let totalExtras = sExtras.reduce((acc, curr) => {
            if (curr.status === 'CANCELLED') return acc;
            return acc + (curr.sellerRewardAmount || 0);
        }, 0);
        totalExtras += virtualKpiExtras.reduce((acc, v) => acc + (v.sellerRewardAmount || 0), 0);

        internalTotalComision += totalExtras;

        const extraGroupsMap: Record<string, { count: number, amount: number }> = {};
        const processExtraList = (lista: any[]) => {
            lista.forEach(ex => {
                if (ex.status === 'CANCELLED') return;
                const ruleName = ex.rule?.name || 'Extra Manual';
                if (!extraGroupsMap[ruleName]) extraGroupsMap[ruleName] = { count: 0, amount: 0 };
                extraGroupsMap[ruleName].count++;
                extraGroupsMap[ruleName].amount += (ex.sellerRewardAmount || 0);
            });
        };
        processExtraList(sExtras);
        processExtraList(virtualKpiExtras);

        const extraGroups = Object.keys(extraGroupsMap).map(k => ({
            name: k,
            count: extraGroupsMap[k].count,
            totalAmount: extraGroupsMap[k].amount
        }));

        // ── ADICIÓN (liquidación): extras como conceptos etiquetados ─────────────
        // persistido=true -> asignación real de BD: al excluir ventas NO se recalcula,
        // solo se etiqueta. persistido=false -> bono virtual recién computado (KPI /
        // Territorial O2) con las ventas recibidas.
        const extrasConceptos: ExtraConceptoTienda[] = [];
        sExtras.forEach(ex => {
            extrasConceptos.push({
                concepto: ex.rule?.name || 'Extra Manual',
                detalle: ex.triggerSummary || ex.customerName || '',
                importe: ex.sellerRewardAmount || 0,
                persistido: true,
            });
        });
        virtualKpiExtras.forEach(ex => {
            extrasConceptos.push({
                concepto: ex.rule?.name || ex.customerName || 'Bono KPI',
                detalle: ex.triggerSummary || '',
                importe: ex.sellerRewardAmount || 0,
                persistido: false,
            });
        });

        const numSalesTotal = sSales.length;
        const completedSalesCount = numSalesTotal - pendientes;

        const sellerObj = {
            name,
            profile,
            isPlus: profile === 'Plus',
            totalComision: internalTotalComision,
            totalConsolidada: internalTotalConsolidada + totalExtras,
            totalPendiente: internalTotalPendiente,
            totalExtras: totalExtras,
            pendientes,
            ultimaVenta,
            totalSales: completedSalesCount,
            groupCounts,
            groupSales,
            groupPending,
            groupObj1,
            groupObj2,
            groupObj3,
            groupComisions,
            groupConsolidada,
            o2OtrasSales,
            totalValueGroupsAmount,
            totalUnitGroupsAmount,
            rawSales: sSales,
            rawExtras: [...sExtras, ...virtualKpiExtras],
            virtualKpiExtras, // Exporting to emit later
            extraGroups,
            groupIsConsolidado,
            groupTopeMotivo,
            activeTeamGroupCounts,
            activeTeamGroupPending,
            o2Otras: { confirmed: o2OtrasConfirmed, pending: o2OtrasPending, comision: o2OtrasComision, sales: o2OtrasSales },
            // ── ADICIONES (liquidación) ──
            lineasDetalle,
            extrasConceptos,
            objetivosResumen,
        };
        return sellerObj;
    });

    return {
        sellerStats,
        adjustedTiendaRules,
        teamGroupCounts,
        teamGroupPending,
        o2TeamGroupCounts,
        o2TeamGroupPending,
        totalStoreFttrSales,
    };
}
