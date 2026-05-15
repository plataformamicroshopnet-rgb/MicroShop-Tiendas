import { useState, useEffect } from 'react';
import { getProfile, getGroupVisual, mapObjectiveGroup, ALL_GROUPS, FIXED_SELLERS } from '@/lib/comisiones';
import { usePeriod } from '@/components/PeriodProvider';

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
    
    // El MultiSelectDropdown separa los valores con comas
    const tipos = tipoVentaRaw.split(',').map(s => s.trim()).filter(Boolean);
    
    const cat = sale.categoria || sale.detalle || sale.sheet || '';
    const prod = sale.producto || '';

    for (const tipoVenta of tipos) {
        if (tipoVenta === 'FORMULA_LIBRE') continue;
        
        let matched = false;
        switch(tipoVenta) {
            case 'Alta BAF Total':
                matched = cat === 'miMovistar' || cat === 'Resto BAF';
                break;
            case 'Alta BAF Convergente':
                matched = cat === 'miMovistar';
                break;
            case 'Dispositivos + Seguro':
                matched = cat === 'Rent' || cat === 'Seguro';
                break;
            case 'Dispositivos':
                matched = cat === 'Rent';
                break;
            case 'Seguro':
                matched = cat === 'Seguro';
                break;
            case 'MPA':
                matched = prod.includes('Movistar Prosegur Alarmas');
                break;
            case 'FTTR':
                matched = prod.includes('Solución FTTR') || prod.includes('FTTR');
                break;
            case 'Señalización Solar 360':
                matched = prod.includes('Solar360');
                break;
            case 'ARPU':
                matched = cat === 'Repos' && !prod.includes('Fútbol');
                break;
            case 'Repo Fútbol':
                matched = prod.includes('Fútbol') && cat === 'Repos';
                break;
            default:
                if (tipoVenta.toLowerCase().trim() === cat.toLowerCase().trim()) {
                    matched = true;
                } else {
                    const searchString = `${prod} ${sale.detalle || ''} ${sale.grupo || ''}`;
                    matched = matchProductFormula(searchString, tipoVenta);
                }
                break;
        }
        if (matched) return true;
    }
    return false;
};


export function useComisionesData(user?: any) {
    const { activePeriodKey } = usePeriod();
    const [loading, setLoading] = useState(true);
    const [allSales, setAllSales] = useState<any[]>([]);
    const [condiciones, setCondiciones] = useState<any[]>([]);
    const [extraAssignments, setExtraAssignments] = useState<any[]>([]);
    const [activeRules, setActiveRules] = useState<any[]>([]); // KPI Rules fetch
    const [tiendaRules, setTiendaRules] = useState<any[]>([]);
    const [tiendaHours, setTiendaHours] = useState<any[]>([]);
    const [o2Rules, setO2Rules] = useState<any[]>([]);
    const [o2Hours, setO2Hours] = useState<any[]>([]);
    const [territorialO2Rules, setTerritorialO2Rules] = useState<any[]>([]);
    
    const [selectedSellerFilter, setSelectedSellerFilter] = useState<string | null>(null);

    useEffect(() => {
        if (!activePeriodKey) return;
        setLoading(true);
        Promise.all([
            fetch(`/api/sales?periodKey=${activePeriodKey}`).then(res => res.json()),
            fetch(`/api/condiciones-plus?periodKey=${activePeriodKey}&strictPeriod=1`).then(res => res.json()).catch(() => ({ rows: [] })),
            fetch(`/api/extras/assignments?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({ data: [] })),
            fetch('/api/extras/rules').then(res => res.json()).catch(() => ({ rules: [] })),
            fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({ success: false, rules: [], hours: [] })),
            fetch(`/api/settings?key=o2_rules_v2_${activePeriodKey}`).then(res => res.json()).catch(() => ({ value: null })),
            fetch(`/api/territorial?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({ success: false, tiendas: [], o2: [] }))
        ])
        .then(([data, condData, extrasData, rulesData, tiendasData, o2Data, territorialData]) => {
            if (data.success && data.logs) {
                setAllSales(data.logs);
            }
            if (condData && condData.rows) {
                setCondiciones(condData.rows);
            }
            if (extrasData && extrasData.assignments) {
                setExtraAssignments(extrasData.assignments);
            }
            if (rulesData && rulesData.rules) {
                // Filtramos solo las reglas KPI activas 
                setActiveRules(rulesData.rules.filter((r: any) => r.isActive && r.combinationLabel?.startsWith('[KPI]')));
            }
            if (tiendasData && tiendasData.success) {
                setTiendaRules(tiendasData.rules || []);
                setTiendaHours(tiendasData.hours || []);
            }
            if (o2Data && o2Data.value) {
                try {
                    const parsed = JSON.parse(o2Data.value);
                    setO2Rules(parsed.rules || []);
                    setO2Hours(parsed.hours || []);
                } catch(e) {}
            } else {
                setO2Rules([]);
                setO2Hours([]);
            }
            if (territorialData && territorialData.success) {
                setTerritorialO2Rules(territorialData.o2 || []);
            }
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, [activePeriodKey]);

    const monthSales = allSales;

    // Precalcular totales del equipo
    const teamGroupCounts: Record<string, number> = {};
    const o2TeamGroupCounts: Record<string, number> = {};
    
    tiendaRules.forEach(rule => { teamGroupCounts[rule.nombre] = 0; });
    o2Rules.forEach(rule => { o2TeamGroupCounts[rule.nombre] = 0; });

    monthSales.forEach(s => {
        let cuotaValue = Number(s.cuota) || 0;
        if (isNaN(cuotaValue)) cuotaValue = 0;
        
        // Movistar
        if (!String(s.vendedor).toLowerCase().includes('marta')) {
            tiendaRules.forEach(rule => {
                if (matchTipoVenta(s, rule.productosCuentan)) {
                    const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                    if (isPercentage) {
                        teamGroupCounts[rule.nombre] += cuotaValue;
                    } else {
                        teamGroupCounts[rule.nombre] += 1;
                    }
                }
            });
        }
        
        // O2
        if (String(s.vendedor).toLowerCase().includes('marta')) {
            o2Rules.forEach(rule => {
                if (matchTipoVenta(s, rule.productosCuentan)) {
                    const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                    if (isPercentage) {
                        o2TeamGroupCounts[rule.nombre] += cuotaValue;
                    } else {
                        o2TeamGroupCounts[rule.nombre] += 1;
                    }
                }
            });
        }
    });

    const sellerStats = FIXED_SELLERS.map(name => {
        const sSales = monthSales.filter(s => {
            const v = String(s.vendedor || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const tgt = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            return v === tgt;
        });

        const sExtras = extraAssignments.filter(ea => {
            const v = String(ea.seller || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const tgt = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            
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
            const tgt = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const isMarta = tgt.includes('marta');
            const isTerritorial = String(ea.customerNif) === 'TERRITORIAL' || String(ea.customerName).includes('Territorial') || String(ea.triggerKey).includes('TERRITORIAL');
            
            // Si es un bono territorial para Marta, forzamos que no sume importe (informativo)
            if (isMarta && isTerritorial) {
                return { ...ea, sellerRewardAmount: 0 };
            }
            return ea;
        });
        
        const pendientes = sSales.filter(s => {
            const val = String(s.pendiente || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            return val === 'si';
        }).length;

        const fechas = sSales.map(s => s.timestamp).filter(t => !isNaN(t)).sort((a, b) => b - a);
        const ultimaVenta = fechas.length > 0 ? new Date(fechas[0]).toLocaleDateString('es-ES') : '-';

        const groupCounts: Record<string, number> = {};
        const groupPending: Record<string, number> = {};
        const groupObj1: Record<string, number> = {};
        const groupObj2: Record<string, number> = {};
        const groupComisions: Record<string, number> = {};

        // INICIALIZAR OBJETIVOS Y CONTADORES BASADOS EN REGLAS DINAMICAS
        const isO2 = String(name).toLowerCase().includes('marta');
        const activeTiendaRules = isO2 ? o2Rules : tiendaRules;
        const activeTiendaHours = isO2 ? o2Hours : tiendaHours;
        
        const activeTeamGroupCounts = isO2 ? o2TeamGroupCounts : teamGroupCounts;
        const comercialHour = activeTiendaHours.find(h => String(h.comercial).toLowerCase() === String(name).toLowerCase());
        const horario = comercialHour ? Number(comercialHour.horario) : 0;

        activeTiendaRules.forEach(rule => {
            const ruleName = rule.nombre;
            groupCounts[ruleName] = 0;
            groupPending[ruleName] = 0;
            groupComisions[ruleName] = 0;
            
            const totalHoras = rule.totalHoras || 0;
            if (totalHoras > 0 && horario > 0) {
                groupObj1[ruleName] = (rule.objPrimerTramo / totalHoras) * horario;
                groupObj2[ruleName] = (rule.objSegundoTramo / totalHoras) * horario;
            } else {
                groupObj1[ruleName] = rule.objPrimerTramo || 0;
                groupObj2[ruleName] = rule.objSegundoTramo || 0;
            }
            

        });


        let totalValueGroupsAmount = 0;
        let totalUnitGroupsAmount = 0;

        // COUNTING LOGIC BASED ON RULES
        sSales.forEach(s => {
            let cuotaValue = Number(s.cuota) || 0;
            if (isNaN(cuotaValue)) cuotaValue = 0;
            
            // Un producto puede contar para multiples reglas si encaja en el Tipo de Venta
            activeTiendaRules.forEach(rule => {
                if (matchTipoVenta(s, rule.productosCuentan)) {
                    // Determinar si el tramo pide % o Euros (heuristic)
                    const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                    const isPending = String(s.pendiente || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === 'si';
                    if (isPercentage) {
                        groupCounts[rule.nombre] += cuotaValue;
                        if (isPending) groupPending[rule.nombre] += cuotaValue;
                        totalValueGroupsAmount += cuotaValue;
                    } else {
                        groupCounts[rule.nombre] += 1;
                        if (isPending) groupPending[rule.nombre] += 1;
                        totalUnitGroupsAmount += 1;
                    }
                }
            });
        });

        const profile = getProfile(name);
        let internalTotalComision = 0;
        let internalTotalConsolidada = 0;
        let internalTotalPendiente = 0;

        const groupIsConsolidado: Record<string, boolean> = {};

        activeTiendaRules.forEach(rule => {
            const ruleName = rule.nombre;
            const qtty = groupCounts[ruleName] || 0;
            const obj1 = groupObj1[ruleName] || 0;
            const obj2 = groupObj2[ruleName] || 0;
            
            let comisionCalculada = 0;
            const isPercentage = String(rule.importePrimerTramo || '').includes('%');
            
            const parseImporte = (val: any) => {
                let s = String(val || '0').replace(/[^0-9.,\-]/g, '').trim();
                s = s.replace(',', '.');
                return Number(s) || 0;
            };

            const imp1 = parseImporte(rule.importePrimerTramo);
            const imp2 = parseImporte(rule.importeSegundoTramo);

            const qttyTotal = groupCounts[ruleName] || 0;
            const qttyPending = groupPending[ruleName] || 0;
            const qttyFinalizadas = qttyTotal - qttyPending;

            let comTotal = 0;
            let comConsolidada = 0;
            let comPendiente = 0;

            if (qttyTotal > 0) {
                let activeImp = imp1;
                let isConsolidado = (obj1 === 0 && obj2 === 0) || (qttyTotal >= obj1 && obj1 > 0);
                let isTeamObj2 = false;
                let isAccumulative = false;
                let isAccumulativeFixed = false;

                // Evaluar reglas dinámicas del Constructor Visual
                if (rule.condicionantes && rule.condicionantes.startsWith('[')) {
                    try {
                        const conds = JSON.parse(rule.condicionantes);
                        if (Array.isArray(conds)) {
                            for (const cond of conds) {
                                if (cond.type === 'REQUIRE_TEAM_OBJ2') {
                                    isTeamObj2 = true;
                                } else if (cond.type === 'ACCUMULATIVE_TRAMOS') {
                                    isAccumulative = true;
                                } else if (cond.type === 'ACCUMULATIVE_FIXED_BASE') {
                                    isAccumulativeFixed = true;
                                } else if (cond.type === 'REQUIRE_GROUP_QTY') {
                                    const targetQtty = groupCounts[cond.targetGroup] || 0;
                                    if (targetQtty < cond.value) {
                                        isConsolidado = false;
                                    }
                                } else if (cond.type === 'REQUIRE_GROUP_PCT') {
                                    const targetQtty = groupCounts[cond.targetGroup] || 0;
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

                if (isTeamObj2) {
                    const globalObj2 = rule.objSegundoTramo || 0;
                    const teamTotal = activeTeamGroupCounts[ruleName] || 0;
                    if (teamTotal >= globalObj2 && globalObj2 > 0 && qttyTotal >= obj1 && obj1 > 0) {
                        activeImp = imp2;
                    } else if (qttyTotal >= obj1 && obj1 > 0) {
                        activeImp = imp1;
                    } else {
                        activeImp = imp1;
                    }
                } else {
                    if (qttyTotal >= obj2 && obj2 > 0) activeImp = imp2;
                    else if (qttyTotal >= obj1 && obj1 > 0) activeImp = imp1;
                    else activeImp = imp1; // Valorar siempre al Tramo 1 aunque no llegue al objetivo
                }

                if (isPercentage) {
                    if (isAccumulativeFixed) {
                        if (qttyTotal >= obj1 && obj1 > 0) {
                            const extraQty = Math.max(0, qttyTotal - (obj2 > 0 ? obj2 - 1 : obj1));
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
                            const extraQty = Math.max(0, qttyTotal - (obj2 > 0 ? obj2 - 1 : obj1));
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

                if (isConsolidado) {
                    comConsolidada = comTotal;
                    comPendiente = 0;
                } else {
                    comConsolidada = 0;
                    comPendiente = comTotal;
                }
                groupIsConsolidado[ruleName] = isConsolidado;
            } else {
                groupIsConsolidado[ruleName] = false;
            }

            groupComisions[ruleName] = comTotal;
            internalTotalComision += comTotal;
            internalTotalConsolidada += comConsolidada;
            internalTotalPendiente += comPendiente;
        });

        // Apuntar las comisiones del motor de reglas extra
        const virtualKpiExtras: any[] = [];
        
        // --- AUTO-PILOTO RENDIMIENTOS GLOBALES (KPI BONOS) ---
        if (activePeriodKey && activeRules.length > 0) {
            
            const qttyBaf = groupCounts['BAF'] || 0;
            const targetBaf = groupObj2['BAF'] > 0 ? groupObj2['BAF'] : (groupObj1['BAF'] || 0);
            const perceBaf = targetBaf > 0 ? (qttyBaf / targetBaf) * 100 : (qttyBaf > 0 ? 100 : 0);

            const qttyFd = groupCounts['FD'] || 0;
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

                            const v = String(s.producto || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                            const t = tgtProd.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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
                                const v = String(s.producto || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                                const t = tgtProd.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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
                                    const v = String(s.producto || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                                    const t = tgtProd.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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
                                    const v = String(s.producto || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                                    const t = multToken.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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
                
                const triggerKey = `TERRITORIAL_O2_${rule.id}_${activePeriodId}`;
                const alreadyExists = extraAssignments.some(ea => ea.triggerKey === triggerKey);
                
                if (!alreadyExists) {
                    virtualKpiExtras.push({
                        ruleId: `TERRITORIAL_${rule.id}`,
                        periodId: activePeriodId,
                        seller: name,
                        sourceType: 'AUTOMATIC',
                        customerName: 'Bono Territorial O2',
                        customerNif: 'TERRITORIAL',
                        triggerKey: triggerKey,
                        triggerSummary: `Territorial O2: ${rule.nombre} (${totalSalesForRule} ${isMoneyType ? '€' : 'ventas'})`,
                        telecomRewardAmount: bonus,
                        sellerRewardAmount: 0,
                        status: 'LIQUIDATED',
                        rule: { name: `TERRITORIAL O2 MOVILFREE - ${rule.nombre}` }
                    });
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

        const numSalesTotal = sSales.length;

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
            totalSales: numSalesTotal,
            groupCounts,
            groupPending,
            groupObj1,
            groupObj2,
            groupComisions,
            totalValueGroupsAmount,
            totalUnitGroupsAmount,
            rawSales: sSales,
            rawExtras: [...sExtras, ...virtualKpiExtras],
            virtualKpiExtras, // Exporting to emit later
            extraGroups,
            groupIsConsolidado
        };
        return sellerObj;
    });

    // EFFECT: Envío subrepticio de extras KPI a base de datos para grabarlos eternamente
    useEffect(() => {
        if (loading || sellerStats.length === 0) return;
        const allVirtual = sellerStats.flatMap(s => s.virtualKpiExtras || []);
        if (allVirtual.length > 0) {
            console.log('[Auto-Piloto] Sincronizando bonos KPI globales con servidor:', allVirtual.length);
            fetch('/api/extras/kpi-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignments: allVirtual })
            }).catch(console.error);
        }
    }, [loading, sellerStats]);

    const isRestrictedComercial = user && typeof user.role === 'string' && user.role.toUpperCase().includes('COMERCIAL');
    const displayedSellerStats = isRestrictedComercial ? sellerStats.filter(s => { const sName = s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); const uName = (user?.username || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); return sName === uName; }) : sellerStats;
    const teamTotalComisiones = displayedSellerStats.reduce((acc, s) => acc + s.totalComision, 0);
    const teamTotalSales = displayedSellerStats.reduce((acc, s) => acc + s.totalSales, 0);

    const orderedDesc = [...displayedSellerStats].sort((a, b) => b.totalComision - a.totalComision);
    const top3 = orderedDesc.slice(0, 3);
    const maxComisionSeller = orderedDesc.length > 0 ? orderedDesc[0] : null;

    const orderedBySales = [...displayedSellerStats].sort((a, b) => b.totalSales - a.totalSales);
    const maxSalesSeller = orderedBySales.length > 0 ? orderedBySales[0] : null;

    return {
        loading,
        selectedSellerFilter,
        setSelectedSellerFilter,
        sellerStats: displayedSellerStats,
          teamTotalComisiones,
        teamTotalSales,
        top3,
        maxComisionSeller,
        maxSalesSeller,
        monthSales,
        extraAssignments,
        tiendaRules,
        o2Rules,
        territorialO2Rules
    };
}
