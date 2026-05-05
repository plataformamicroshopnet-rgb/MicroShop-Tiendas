import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { getGroupVisual } from './comisiones'
const prisma = new PrismaClient()

/**
 * Normaliza un string para comparaciones tolerantes
 */
function normalizeStr(str: string | null | undefined): string {
    if (!str) return ''
    return str.trim().toLowerCase()
}

/**
 * Genera el hash inmutable (idempotencia)
 */
function generateTriggerKey(periodId: string, ruleId: string, seller: string, nif: string, index: number = 0): string {
    const raw = `${periodId}-${ruleId}-${seller}-${nif}-${index}`
    return crypto.createHash('sha256').update(raw).digest('hex')
}

export async function runExtrasEngine(periodId?: string) {
    console.log('[Engine] Iniciando Motor de Cruces de Extras...')
    
    // 1. Resolver el Periodo Activo (necesitamos year+month para filtrar reglas por fecha)
    let targetPeriodId = periodId;
    let periodYear: number;
    let periodMonth: number;

    if (!targetPeriodId) {
        const activePeriod = await prisma.workPeriod.findFirst({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' }
        });
        if (!activePeriod) throw new Error('No hay ningún periodo activo para ejecutar cruces.');
        targetPeriodId = activePeriod.id;
        periodYear  = activePeriod.year;
        periodMonth = activePeriod.month;
    } else {
        const resolvedPeriod = await prisma.workPeriod.findUnique({ where: { id: targetPeriodId } });
        if (!resolvedPeriod) throw new Error(`Periodo ${targetPeriodId} no encontrado.`);
        periodYear  = resolvedPeriod.year;
        periodMonth = resolvedPeriod.month;
    }

    // Rango de fechas del periodo (primer y último día del mes)
    const periodStart = new Date(periodYear, periodMonth - 1, 1);   // ej: 2026-05-01
    const periodEnd   = new Date(periodYear, periodMonth, 0, 23, 59, 59); // ej: 2026-05-31

    // 2. Traer las Reglas Activas filtradas por vigencia respecto al periodo evaluado
    //    - Sin fechas → aplica siempre (regla permanente)
    //    - Solo validFrom → aplica si el periodo empieza en o después de ese día
    //    - Solo validTo   → aplica si el periodo no ha terminado aún
    //    - Ambas          → el periodo debe solaparse con el rango
    const activeRules = await prisma.extraRule.findMany({
        where: {
            isActive: true,
            OR: [
                { validFrom: null, validTo: null },
                { validFrom: { lte: periodEnd }, validTo: null },
                { validFrom: null, validTo: { gte: periodStart } },
                { validFrom: { lte: periodEnd }, validTo: { gte: periodStart } },
            ]
        },
        orderBy: { telecomRewardAmount: 'desc' }
    });

    if (activeRules.length === 0) {
        return { rulesEvaluated: 0, crossesDetected: 0, newAssignmentsInserted: 0, duplicatesSkipped: 0 };
    }

    // Registro global para "consumir" operaciones y evitar que reglas de menor jerarquía
    // reciclen ventas ya premiadas por reglas mayores.
    const globalConsumedSaleIds = new Set<string>();
    
    // Novedad Crítica B2B: Solo se puede otorgar UN extra por CIF/NIF en total por periodo.
    // Si un CIF recibe el extra mayor, queda bloqueado para cualquier otro extra.
    const globalRewardedNifs = new Set<string>();

    // 3. Traer Ventas Válidas del Periodo (Sin anuladas. SÍ traemos pendientes para marcarlos)
    const validSales = await prisma.sale.findMany({
        where: {
            periodId: targetPeriodId,
            OR: [
                { anulado: null },
                { anulado: { not: 'Si' } }
            ]
        }
    });

    // 4. Agrupar Ventas por Vendedor -> NIF (Cliente)
    // Map: sellerName -> (Map: nif -> Sale[])
    const salesTree = new Map<string, Map<string, typeof validSales>>();

    for (const sale of validSales) {
        const seller = sale.vendedor;
        if (!seller) continue;
        
        let normalizedNif = sale.nif ? normalizeStr(sale.nif) : 'genérico-' + sale.id;

        if (!salesTree.has(seller)) salesTree.set(seller, new Map());
        const customerMap = salesTree.get(seller)!;
        
        if (!customerMap.has(normalizedNif)) customerMap.set(normalizedNif, []);
        customerMap.get(normalizedNif)!.push(sale);
    }

    // 5. Motor de Cruce por NIF separado estrictamente por Vendedor
    let crossesDetected = 0;
    let duplicatesSkipped = 0;
    const validDetectedKeys = new Set<string>();
    const debugLog: string[] = [];
    
    debugLog.push(`[ENGINE START] Periodo Evaluado: ${periodYear}-${periodMonth} (ID: ${targetPeriodId})`);
    debugLog.push(`[ENGINE START] Reglas Activas Encontradas para este periodo: ${activeRules.length}`);
    debugLog.push(`[ENGINE START] Ventas Base Encontradas para este periodo: ${validSales.length}`);
    
    // Obtenemos los extras asignados automáticamente en este periodo
    const existingAssignments = await prisma.extraAssignment.findMany({
        where: { periodId: targetPeriodId, sourceType: 'AUTOMATIC' }
    });

    // Mapeamos lo existente por triggerKey
    const existingMap = new Map();
    for (const a of existingAssignments) {
        existingMap.set(a.triggerKey, a);
    }

    const assignmentsToInsert: any[] = [];
    const assignmentsToUpdate: any[] = [];

    // Por cada regla activa (ordenadas por la que más paga)
    for (const rule of activeRules) {
        // ─────────────────────────────────────────────────────
        // KPI_QTY: Objetivo por unidades con tramos (ej. TGT)
        // Detectado por el prefijo [KPI_QTY] en combinationLabel
        // ─────────────────────────────────────────────────────
        if (rule.combinationLabel.startsWith('[KPI_QTY]')) {
            // Parsear tokens de producto (qué cuentan)
            let productTokens: string[] = [];
            try {
                productTokens = JSON.parse(rule.requiredGroups).map((t: string) => normalizeStr(t));
            } catch {
                productTokens = rule.combinationLabel.replace('[KPI_QTY]', '').split('+').map(t => normalizeStr(t));
            }
            if (productTokens.length === 0) continue;

            // Parsear tramos desde description (JSON: { tiers: [{maxPct, telecom, seller},...] })
            let tiers: Array<{maxPct?: number; telecom: number; seller: number}> = [];
            try { tiers = JSON.parse(rule.description || '{}').tiers || []; } catch { /* sin tramos */ }
            if (tiers.length === 0) {
                // Fallback: tramo único con los valores fijos del registro
                tiers = [{ telecom: rule.telecomRewardAmount, seller: rule.sellerRewardAmount }];
            }

            const teamObjective = rule.maxPayoutUnits || 1; // total uds objetivo del equipo

            // Identificar los códigos PLUS válidos
            const plusCodesExact = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7'];

            // Contar unidades por vendedor que coincidan con los tokens de producto
            const unitsBySeller = new Map<string, number>();
            for (const sale of validSales) {
                const codigoLower = normalizeStr(sale.codigo);
                const isPlus = plusCodesExact.some(c => codigoLower.includes(c));
                const isBasico = codigoLower.includes('básico xcu') || codigoLower.includes('basico xcu');
                if (rule.channelType === 'PLUS' && !isPlus) continue;
                if (rule.channelType === 'BASICO' && !isBasico) continue;

                const prodNorm = normalizeStr(sale.producto);
                const matchesProduct = productTokens.some(token =>
                    prodNorm.includes(token) ||
                    normalizeStr(sale.grupo).includes(token) ||
                    normalizeStr(sale.sheet).includes(token)
                );
                if (!matchesProduct) continue;

                const seller = sale.vendedor || 'UNKNOWN';
                unitsBySeller.set(seller, (unitsBySeller.get(seller) || 0) + 1);
            }

            const teamTotal = Array.from(unitsBySeller.values()).reduce((a, b) => a + b, 0);
            const teamPct = (teamTotal / teamObjective) * 100;

            // Determinar tramo activo
            let activeTier = tiers[tiers.length - 1]; // último = tramo máximo
            for (const tier of tiers) {
                if (tier.maxPct !== undefined && teamPct < tier.maxPct) {
                    activeTier = tier;
                    break;
                }
            }

            const tierLabel = activeTier.maxPct ? `<${activeTier.maxPct}%` : `≥${tiers[tiers.length - 2]?.maxPct ?? 100}%`;

            // Generar un ExtraAssignment por vendedor que tenga unidades
            for (const [sellerName, sellerUnits] of unitsBySeller.entries()) {
                const telecomAmount = parseFloat((activeTier.telecom * sellerUnits).toFixed(2));
                const sellerAmount  = parseFloat((activeTier.seller  * sellerUnits).toFixed(2));

                const triggerKey = generateTriggerKey(targetPeriodId, rule.id, sellerName, 'KPI_QTY_TEAM', 0);
                validDetectedKeys.add(triggerKey);

                const summary = `KPI TGT: ${sellerUnits} uds propias (equipo ${teamTotal}/${teamObjective} = ${Math.round(teamPct)}% → Tramo ${tierLabel}) → ${telecomAmount}€`;

                if (existingMap.has(triggerKey)) {
                    const existing = existingMap.get(triggerKey);
                    // Actualizar si cambió el importe o el resumen
                    if (
                        existing.telecomRewardAmount !== telecomAmount ||
                        existing.sellerRewardAmount  !== sellerAmount ||
                        existing.triggerSummary      !== summary
                    ) {
                        assignmentsToUpdate.push({
                            id: existing.id,
                            telecomRewardAmount: telecomAmount,
                            sellerRewardAmount:  sellerAmount,
                            triggerSummary: summary
                        });
                    } else {
                        duplicatesSkipped++;
                    }
                    continue;
                }

                assignmentsToInsert.push({
                    ruleId: rule.id,
                    periodId: targetPeriodId,
                    sourceType: 'AUTOMATIC',
                    seller: sellerName,
                    customerNif: null,
                    customerName: null,
                    triggerKey,
                    triggerSummary: summary,
                    sourceSaleIds: JSON.stringify([]),
                    telecomRewardAmount: telecomAmount,
                    sellerRewardAmount:  sellerAmount,
                    status: 'LIQUIDATED'
                });
                crossesDetected++;
            }
            continue; // ← Saltar la lógica B2B para esta regla
        }

        // ─────────────────────────────────────────────────────
        // PRICE_LIST: Pago por lista pegada (cada venta es un hit)
        // Detectado por el prefijo [PRICE_LIST] en combinationLabel
        // ─────────────────────────────────────────────────────
        if (rule.combinationLabel.startsWith('[PRICE_LIST]')) {
            debugLog.push(`[PRICE_LIST] Evaluando Regla: ${rule.name}`);
            const multStr = rule.combinationLabel.match(/MULT=([\d.]+)/)?.[1] || '0';
            const sellerMult = parseFloat(multStr);

            const lines = (rule.description || '').split('\n');
            const priceMap: Array<{prod: string, telecom: number, seller: number}> = [];

            for (const line of lines) {
                if (!line.trim()) continue;
                
                const cols = line.split('\t').map(c => c.trim()).filter(Boolean);
                if (cols.length >= 2) {
                    const prodName = cols[0];
                    const tStr = cols[1].replace(/[^\d,\.-]/g, '').replace(',', '.');
                    const telecom = parseFloat(tStr) || 0;
                    
                    let seller = 0;
                    if (cols.length >= 3) {
                        const sStr = cols[2].replace(/[^\d,\.-]/g, '').replace(',', '.');
                        seller = parseFloat(sStr) || 0;
                    } else {
                        seller = telecom * sellerMult;
                    }
                    
                    if (prodName && telecom > 0) {
                        priceMap.push({ prod: normalizeStr(prodName), telecom, seller });
                    }
                } else {
                    // Fallback parse by words
                    const strNoEuro = line.replace(/€/g, '').trim();
                    const words = strNoEuro.split(/\s+/);
                    const lastWord = words.pop() || '';
                    const num = parseFloat(lastWord.replace(',', '.'));
                    if (!isNaN(num)) {
                        const prod = words.join(' ');
                        priceMap.push({ prod: normalizeStr(prod), telecom: num, seller: num * sellerMult });
                    }
                }
            }

            if (priceMap.length === 0) {
                debugLog.push(`[PRICE_LIST] ⚠️ WARNING: priceMap está VACÍO. No se detectaron productos válidos en el texto de la regla.`);
                continue;
            } else {
                debugLog.push(`[PRICE_LIST] Parseados ${priceMap.length} productos correctamente (Ej: ${priceMap[0].prod})`);
            }

            const plusCodesExact = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7'];

            for (const sale of validSales) {
                const codigoLower = normalizeStr(sale.codigo);
                const isPlus = plusCodesExact.some(c => codigoLower.includes(c));
                const isBasico = codigoLower.includes('básico xcu') || codigoLower.includes('basico xcu');
                
                if (rule.channelType === 'PLUS' && !isPlus) continue;
                if (rule.channelType === 'BASICO' && !isBasico) continue;

                if (sale.producto && (sale.producto.toLowerCase().includes('thinkbook') || sale.producto.toLowerCase().includes('elitebook') || sale.producto.toLowerCase().includes('macbook'))) {
                    debugLog.push(`[PRICE_LIST] -> Revisando venta ID ${sale.id}: Producto="${sale.producto}" Código="${sale.codigo}"`);
                }

                const prodNorm = normalizeStr(sale.producto);
                const matchedItem = priceMap.find(p => prodNorm.includes(p.prod) || p.prod.includes(prodNorm));
                if (!matchedItem) {
                    if (sale.producto && (sale.producto.toLowerCase().includes('thinkbook') || sale.producto.toLowerCase().includes('elitebook'))) {
                        debugLog.push(`   ❌ Falló el cruce de texto para "${prodNorm}"`);
                    }
                    continue;
                }

                if (sale.producto && (sale.producto.toLowerCase().includes('thinkbook') || sale.producto.toLowerCase().includes('elitebook'))) {
                    debugLog.push(`   ✅ ¡CRUCE DETECTADO! matchedItem: ${matchedItem.prod}`);
                }

                const sellerName = sale.vendedor || 'UNKNOWN';
                // Generamos un triggerKey único POR VENTA para no limitar a uno por NIF
                const triggerKey = generateTriggerKey(targetPeriodId, rule.id, sellerName, sale.id, 0);
                validDetectedKeys.add(triggerKey);

                const telecomAmount = parseFloat(matchedItem.telecom.toFixed(2));
                const sellerAmount = parseFloat(matchedItem.seller.toFixed(2));
                const summary = `Lista Precios (${matchedItem.prod}): ${sale.producto} → ${telecomAmount}€`;

                const computedStatus = (sale.pendiente === 'Si' || sale.pendiente === 'Anulado') ? 'PENDING' : 'LIQUIDATED';

                if (existingMap.has(triggerKey)) {
                    const existing = existingMap.get(triggerKey);
                    if (
                        existing.telecomRewardAmount !== telecomAmount ||
                        existing.sellerRewardAmount  !== sellerAmount ||
                        existing.triggerSummary      !== summary ||
                        existing.status              !== computedStatus
                    ) {
                        assignmentsToUpdate.push({
                            id: existing.id,
                            telecomRewardAmount: telecomAmount,
                            sellerRewardAmount:  sellerAmount,
                            triggerSummary: summary,
                            status: computedStatus
                        });
                    } else {
                        duplicatesSkipped++;
                    }
                    continue;
                }

                assignmentsToInsert.push({
                    ruleId: rule.id,
                    periodId: targetPeriodId,
                    sourceType: 'AUTOMATIC',
                    seller: sellerName,
                    customerNif: sale.nif || null,
                    customerName: sale.nombreCliente || null,
                    triggerKey: triggerKey,
                    triggerSummary: summary,
                    sourceSaleIds: JSON.stringify([sale.id]),
                    telecomRewardAmount: telecomAmount,
                    sellerRewardAmount: sellerAmount,
                    status: computedStatus
                });
                crossesDetected++;
            }
            continue;
        }

        // ─────────────────────────────────────────────────────
        // Lógica B2B original (cruces por NIF)
        // ─────────────────────────────────────────────────────
        let requiredTokens: string[] = [];
        try {
            requiredTokens = JSON.parse(rule.requiredGroups).map((t: string) => normalizeStr(t));
        } catch(e) {
            requiredTokens = rule.combinationLabel.split('+').map(t => normalizeStr(t));
        }

        if (requiredTokens.length === 0) continue;

        // Por cada vendedor
        for (const [sellerName, customerMap] of salesTree.entries()) {
            
            // Por cada cliente (NIF)
            for (const [nif, customerSales] of customerMap.entries()) {
                
                // [BLOQUEO CIF] Si este CIF ya ha recibido un Extra en este mes, se bloquea por completo.
                if (globalRewardedNifs.has(nif)) continue;

                // Buscar si encontramos al menos UNA venta que satisfaga CADA requerimiento
                let matchedCriteriaCount = 0;
                let usedSaleIds: string[] = [];

                for (const token of requiredTokens) {
                    // Buscar una venta que coincida con el token y que no haya sido consumida
                    const matchingSale = customerSales.find(s => {
                        if (usedSaleIds.includes(s.id)) return false;
                        if (globalConsumedSaleIds.has(s.id)) return false; // Bloqueo de Consumo Global
                        
                        const codigoLower = normalizeStr(s.codigo);
                        const isBasico = codigoLower.includes('básico xcu') || codigoLower.includes('basico xcu');
                        const plusCodesExact = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7'];
                        const isPlus = plusCodesExact.some(c => codigoLower.includes(c));

                        // Validar el Segmento de la Regla (Si es PLUS, solo aplica a códigos PLUS, etc.)
                        if (rule.channelType === 'PLUS' && !isPlus) return false;
                        if (rule.channelType === 'BASICO' && !isBasico) return false;
                        if (rule.channelType === 'AMBOS' && !isPlus && !isBasico) return false;

                        return (
                            codigoLower.includes(token) || 
                            normalizeStr(s.producto).includes(token) ||
                            normalizeStr(s.grupo).includes(token) ||
                            normalizeStr(s.sheet).includes(token) ||
                            normalizeStr(getGroupVisual(s.producto || '', s.sheet || '')).includes(token)
                        )
                    });

                    if (matchingSale) {
                        matchedCriteriaCount++;
                        usedSaleIds.push(matchingSale.id);
                    }
                }

                // ¿Se completó la combinación entera en este cliente?
                if (matchedCriteriaCount === requiredTokens.length) {
                    crossesDetected++;
                    
                    // [BLOQUEO CIF] Añadimos este CIF a la lista de recompensados.
                    // Nadie más podrá generar un extra para este CIF en este periodo.
                    globalRewardedNifs.add(nif);

                    // Marcar ventas como consumidas globalmente
                    usedSaleIds.forEach(id => globalConsumedSaleIds.add(id));
                    
                    const triggerKey = generateTriggerKey(targetPeriodId, rule.id, sellerName, nif);
                    
                    // Comprobar si hay algún origen pendiente
                    const hasPendingSource = usedSaleIds.some(id => {
                        const s = validSales.find(vs => vs.id === id);
                        return s && (s.pendiente === 'Si' || s.pendiente === 'Anulado');
                    });
                    const computedStatus = hasPendingSource ? 'PENDING' : 'LIQUIDATED';

                    validDetectedKeys.add(triggerKey); // Añadir a la lista de válidos de la sesión actual
                    
                    if (existingMap.has(triggerKey)) {
                        const existing = existingMap.get(triggerKey);
                        if (existing.status !== computedStatus) {
                            assignmentsToUpdate.push({ id: existing.id, status: computedStatus });
                        } else {
                            duplicatesSkipped++;
                        }
                        continue;
                    }

                    // Preparamos para volcar a Prisma
                    assignmentsToInsert.push({
                        ruleId: rule.id,
                        periodId: targetPeriodId,
                        sourceType: 'AUTOMATIC',
                        seller: customerSales[0].vendedor, // usar casing original
                        customerNif: customerSales[0].nif, // usar casing original
                        customerName: customerSales[0].nombreCliente,
                        triggerKey: triggerKey,
                        triggerSummary: `Regla: ${rule.name} (Cruce en cliente ${customerSales[0].nif})`,
                        sourceSaleIds: JSON.stringify(usedSaleIds),
                        telecomRewardAmount: rule.telecomRewardAmount,
                        sellerRewardAmount: rule.sellerRewardAmount,
                        status: computedStatus
                    });
                }
            }
        }
    }

    let newAssignmentsInserted = 0;
    
    // 6. Inserción Masiva
    if (assignmentsToInsert.length > 0) {
        const batch = await prisma.extraAssignment.createMany({
            data: assignmentsToInsert
        });
        newAssignmentsInserted = batch.count;
    }

    // 7. Cleanup the Orphaned Assignments
    // Si un extra estaba en BD pero ya no cumplió la condición esta vez (porque la venta base se anuló), lo borramos
    const keysToDelete: string[] = [];
    for (const [key, mapData] of existingMap.entries()) {
        if (!validDetectedKeys.has(key)) {
            keysToDelete.push(mapData.id);
        }
    }

    if (keysToDelete.length > 0) {
        await prisma.extraAssignment.deleteMany({
            where: { id: { in: keysToDelete } }
        });
        console.log(`[Engine] Eliminados ${keysToDelete.length} extras huérfanos ya que alguna de sus operaciones base pasó a Anulada/Eliminada.`);
    }

    // 8. Actualizaciones de Estado (Aprobado <-> Pendiente)
    let assignmentsUpdatedCount = 0;
    if (assignmentsToUpdate.length > 0) {
        for (const update of assignmentsToUpdate) {
            await prisma.extraAssignment.update({
                where: { id: update.id },
                data: {
                    status: update.status,
                    ...(update.telecomRewardAmount !== undefined && { telecomRewardAmount: update.telecomRewardAmount }),
                    ...(update.sellerRewardAmount  !== undefined && { sellerRewardAmount:  update.sellerRewardAmount  }),
                    ...(update.triggerSummary      !== undefined && { triggerSummary:      update.triggerSummary      }),
                }
            });
            assignmentsUpdatedCount++;
        }
        console.log(`[Engine] Actualizados ${assignmentsUpdatedCount} estados de extras por cambios en ventas base.`);
    }

    return {
        rulesEvaluated: activeRules.length,
        crossesDetected,
        newAssignmentsInserted,
        duplicatesSkipped,
        debugLog
    }
}
