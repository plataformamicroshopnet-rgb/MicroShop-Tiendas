import fs from 'fs';

const path = 'src/hooks/useComisionesData.ts';
let code = fs.readFileSync(path, 'utf8');

// We need to add the fetch for `/api/tiendas-comisiones?periodKey=${activePeriodKey}`

code = code.replace(
    /const \[activeRules, setActiveRules\] = useState<any\[\]>\(\[\]\); \/\/ KPI Rules fetch/g,
    `const [activeRules, setActiveRules] = useState<any[]>([]); // KPI Rules fetch
    const [tiendaRules, setTiendaRules] = useState<any[]>([]);
    const [tiendaHours, setTiendaHours] = useState<any[]>([]);`
);

code = code.replace(
    /fetch\('\/api\/extras\/rules'\)\.then\(res => res\.json\(\)\)\.catch\(\(\) => \(\{ rules: \[\] \}\)\)/g,
    `fetch('/api/extras/rules').then(res => res.json()).catch(() => ({ rules: [] })),
            fetch(\`/api/tiendas-comisiones?periodKey=\${activePeriodKey}\`).then(res => res.json()).catch(() => ({ rules: [], hours: [] }))`
);

code = code.replace(
    /\]\)\n\s*\.then\(\(\[data, condData, extrasData, rulesData\]\) => \{/g,
    `])
        .then(([data, condData, extrasData, rulesData, tiendasData]) => {`
);

code = code.replace(
    /if \(rulesData && rulesData\.rules\) \{\n\s*\/\/ Filtramos solo las reglas KPI activas \n\s*setActiveRules\(rulesData\.rules\.filter\(\(r: any\) => r\.isActive && r\.combinationLabel\?\.startsWith\('\[KPI\]'\)\)\);\n\s*\}/g,
    `if (rulesData && rulesData.rules) {
                // Filtramos solo las reglas KPI activas 
                setActiveRules(rulesData.rules.filter((r: any) => r.isActive && r.combinationLabel?.startsWith('[KPI]')));
            }
            if (tiendasData && tiendasData.success) {
                setTiendaRules(tiendasData.rules || []);
                setTiendaHours(tiendasData.hours || []);
            }`
);

// Now the logic for the rules!
// Find where ALL_GROUPS is used to initialize groupCounts
const replaceBlock1 = `const groupCounts: Record<string, number> = {};
        const groupObj1: Record<string, number> = {};
        const groupObj2: Record<string, number> = {};
        
        ALL_GROUPS.forEach(g => {
            groupCounts[g] = 0;
            groupObj1[g] = 0;
            groupObj2[g] = 0;
        });`;

const newBlock1 = `const groupCounts: Record<string, number> = {};
        const groupObj1: Record<string, number> = {};
        const groupObj2: Record<string, number> = {};
        const groupComisions: Record<string, number> = {};

        // INICIALIZAR OBJETIVOS Y CONTADORES BASADOS EN REGLAS DINAMICAS
        const comercialHour = tiendaHours.find(h => h.comercial.toLowerCase() === name.toLowerCase());
        const horario = comercialHour ? Number(comercialHour.horario) : 0;

        tiendaRules.forEach(rule => {
            const ruleName = rule.nombre;
            groupCounts[ruleName] = 0;
            groupComisions[ruleName] = 0;
            
            const totalHoras = rule.totalHoras || 0;
            if (totalHoras > 0 && horario > 0) {
                groupObj1[ruleName] = (rule.objPrimerTramo / totalHoras) * horario;
                groupObj2[ruleName] = (rule.objSegundoTramo / totalHoras) * horario;
            } else {
                groupObj1[ruleName] = 0;
                groupObj2[ruleName] = 0;
            }
        });

        // Parseador de Fórmulas de Productos
        const matchProductFormula = (productName, formula) => {
            if (!formula || !productName) return false;
            const p = String(productName).toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim();
            const blocks = formula.split('+').map(b => b.trim().toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, ""));
            for (const block of blocks) {
                if (block && p.includes(block)) return true;
            }
            return false;
        };`;

code = code.replace(replaceBlock1, newBlock1);

// Now replacing the counting logic and parsing
const countLogicStart = `        let totalValueGroupsAmount = 0;
        let totalUnitGroupsAmount = 0;
        const VALUE_GROUPS = ['TMA', 'TI', 'MIC'];

        sSales.forEach(s => {
            const g = getGroupVisual(s.producto, s.detalle || s.sheet || s.categoria);
            if (g && groupCounts[g] !== undefined) {
                if (VALUE_GROUPS.includes(g)) {
                    const cuotaValue = Number(s.cuota) || 0;
                    groupCounts[g] += cuotaValue;
                    totalValueGroupsAmount += cuotaValue;
                } else {
                    groupCounts[g] += 1;
                    totalUnitGroupsAmount += 1;
                }
            }
        });

        // 1. BLOQUE EXACTO PARSEVAL (Para Obj1/Obj2 numérico español y tarifas)`;

const countLogicEnd = `        ALL_GROUPS.forEach(gName => {
            let comisionCalculada = 0;
            const qtty = groupCounts[gName] || 0;
            const obj1 = groupObj1[gName] || 0;
            const obj2 = groupObj2[gName] || 0;
            const isValueGroup = VALUE_GROUPS.includes(gName);
            
            // Hito superado: 2 -> Obj2, 1 -> Obj1, 0 -> Sin objetivo superado
            const milestone = (qtty >= obj2 && obj2 > 0) ? 2 : ((qtty >= obj1 && obj1 > 0) ? 1 : 0);

            if (milestone > 0) {
                const comCol = milestone === 2 ? 'Comisiones Objetivo 2' : 'Comisiones Objetivo 1';
                
                if (isValueGroup) {
                    const gRow = condiciones.find((r:any) => mapObjectiveGroup(r['Productos Tiendas']) === gName);
                    // Regla TI/TMA: (Volumen euros) * (Tasa tarifa % / 100)
                    if (gRow) comisionCalculada = qtty * (parseVal(gRow[comCol]) / 100);
                } else {
                    const ventasDelGrupo = sSales.filter(venta => getGroupVisual(venta.producto, venta.detalle || venta.sheet || venta.categoria) === gName);
                    comisionCalculada = ventasDelGrupo.reduce((acc, venta) => {
                        const pNorm = String(venta.producto).toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim();
                        // Cruzar con Tarifas Excel (Condiciones Tiendas) buscando la fila exacta del producto de esa familia
                        const filaTarifa = condiciones.find((r:any) => {
                            const rP = String(r['Productos Tiendas']).toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim();
                            return rP === pNorm;
                        });
                        return acc + (filaTarifa ? parseVal(filaTarifa[comCol]) : 0);
                    }, 0);
                }
            }
            
            groupComisions[gName] = comisionCalculada;
            internalTotalComision += comisionCalculada;
        });`;

const newCountLogic = `        let totalValueGroupsAmount = 0;
        let totalUnitGroupsAmount = 0;

        // COUNTING LOGIC BASED ON RULES
        sSales.forEach(s => {
            let cuotaValue = Number(s.cuota) || 0;
            if (isNaN(cuotaValue)) cuotaValue = 0;
            
            // Un producto puede contar para multiples reglas si las formulas coinciden
            tiendaRules.forEach(rule => {
                if (matchProductFormula(s.producto, rule.productosCuentan)) {
                    // Determinar si el tramo pide % o Euros (heuristic)
                    // If the importe is a percentage (e.g. "9%"), we usually sum the value.
                    const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                    if (isPercentage) {
                        groupCounts[rule.nombre] += cuotaValue;
                        totalValueGroupsAmount += cuotaValue;
                    } else {
                        groupCounts[rule.nombre] += 1;
                        totalUnitGroupsAmount += 1;
                    }
                }
            });
        });

        let internalTotalComision = 0;

        tiendaRules.forEach(rule => {
            const ruleName = rule.nombre;
            const qtty = groupCounts[ruleName] || 0;
            const obj1 = groupObj1[ruleName] || 0;
            const obj2 = groupObj2[ruleName] || 0;
            
            let comisionCalculada = 0;
            const isPercentage = String(rule.importePrimerTramo || '').includes('%');
            
            const parseImporte = (val: any) => {
                let s = String(val || '0').replace('%', '').trim();
                s = s.replace(',', '.');
                return Number(s) || 0;
            };

            const imp1 = parseImporte(rule.importePrimerTramo);
            const imp2 = parseImporte(rule.importeSegundoTramo);

            const milestone = (qtty >= obj2 && obj2 > 0) ? 2 : ((qtty >= obj1 && obj1 > 0) ? 1 : 0);

            if (milestone > 0) {
                if (isPercentage) {
                    const percentage = milestone === 2 ? imp2 : imp1;
                    comisionCalculada = qtty * (percentage / 100);
                } else {
                    const perUnit = milestone === 2 ? imp2 : imp1;
                    comisionCalculada = qtty * perUnit;
                }
            }

            groupComisions[ruleName] = comisionCalculada;
            internalTotalComision += comisionCalculada;
        });`;

code = code.substring(0, code.indexOf(countLogicStart)) + newCountLogic + code.substring(code.indexOf(countLogicEnd) + countLogicEnd.length);


code = code.replace(
    /        return \{\n            loading,\n            selectedSellerFilter,\n            setSelectedSellerFilter,\n            sellerStats,\n            teamTotalComisiones,\n            teamTotalSales,\n            top3,\n            maxComisionSeller,\n            maxSalesSeller,\n            monthSales,\n            extraAssignments\n        \};/g,
    `        return {
            loading,
            selectedSellerFilter,
            setSelectedSellerFilter,
            sellerStats,
            teamTotalComisiones,
            teamTotalSales,
            top3,
            maxComisionSeller,
            maxSalesSeller,
            monthSales,
            extraAssignments,
            tiendaRules // EXPORT NEW RULES FOR UI
        };`
);

fs.writeFileSync(path, code);
console.log('useComisionesData.ts patched.');
