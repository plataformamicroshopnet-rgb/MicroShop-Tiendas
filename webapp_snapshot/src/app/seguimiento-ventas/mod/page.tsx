'use client'

import React, { useState, useEffect } from 'react'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'
import { PeriodSelector } from '@/components/PeriodSelector'
import { TrendingUp, ArrowLeft, Globe, BarChart2, LineChart } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useRouter } from 'next/navigation'
import { renderDashboardData, calculateDynamicCommission, sanitizeSale, normalizeString, isVentaWithinDates } from '@/lib/salesUtils'

export default function ModPage() {
    const router = useRouter()
    const { authorized } = useGuard('MODULE_JEFE_TIENDAS')
    const { activePeriodKey } = usePeriod()

    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>(null)
    const [manualImportePrev, setManualImportePrev] = useState<string>('')
    const [manualOpsPrev, setManualOpsPrev] = useState<string>('')
    const [manualDaysPrev, setManualDaysPrev] = useState<string>('')

    useEffect(() => {
        if (!activePeriodKey) return;
        const savedImporte = localStorage.getItem(`mod_manual_importe_prev_${activePeriodKey}`);
        const savedOps = localStorage.getItem(`mod_manual_ops_prev_${activePeriodKey}`);
        const savedDays = localStorage.getItem(`mod_manual_days_prev_${activePeriodKey}`);
        setManualImportePrev(savedImporte || '');
        setManualOpsPrev(savedOps || '');
        setManualDaysPrev(savedDays || '');
    }, [activePeriodKey]);

    const handleManualImporteChange = (val: string) => {
        setManualImportePrev(val);
        if (val.trim() === '') {
            localStorage.removeItem(`mod_manual_importe_prev_${activePeriodKey}`);
        } else {
            localStorage.setItem(`mod_manual_importe_prev_${activePeriodKey}`, val);
        }
    };

    const handleManualOpsChange = (val: string) => {
        setManualOpsPrev(val);
        if (val.trim() === '') {
            localStorage.removeItem(`mod_manual_ops_prev_${activePeriodKey}`);
        } else {
            localStorage.setItem(`mod_manual_ops_prev_${activePeriodKey}`, val);
        }
    };

    const handleManualDaysChange = (val: string) => {
        setManualDaysPrev(val);
        if (val.trim() === '') {
            localStorage.removeItem(`mod_manual_days_prev_${activePeriodKey}`);
        } else {
            localStorage.setItem(`mod_manual_days_prev_${activePeriodKey}`, val);
        }
    };

    useEffect(() => {
        if (!activePeriodKey) return;
        setLoading(true);

        const [yearStr, monthStr] = activePeriodKey.split('_');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);

        const prevYearKey = `${year - 1}_${monthStr}`;

        const fetchConfigs = (periodKey: string) => {
            return Promise.all([
                fetch(`/api/objetivos?periodKey=${periodKey}&strictPeriod=1`).then(r => r.json()).catch(() => ({ success: true, objetivos: { Pyme: {}, Captador: {} } })),
                fetch(`/api/importes-pyme?periodKey=${periodKey}&strictPeriod=1`).then(r => r.json()).catch(() => ({})),
                fetch(`/api/importes-plus?periodKey=${periodKey}&strictPeriod=1`).then(r => r.json()).catch(() => ({})),
                fetch(`/api/extras/assignments?periodKey=${periodKey}`).then(r => r.json()).catch(() => ({}))
            ]);
        };

        Promise.all([
            fetch(`/api/sales?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({ logs: [] })),
            fetch(`/api/sales?periodKey=${prevYearKey}`).then(r => r.json()).catch(() => ({ logs: [] })),
            fetch(`/api/catalogs`).then(r => r.json()).catch(() => ({ catalogs: {} })),
            fetchConfigs(activePeriodKey),
            fetchConfigs(prevYearKey),
            fetch(`/api/period`).then(r => r.json()).catch(() => ({ periods: [] })),
            fetch(`/api/movilfree/sales`).then(r => r.json()).catch(() => []),
            fetch(`/api/movilfree/products`).then(r => r.json()).catch(() => [])
        ]).then(([currSalesRes, prevSalesRes, catRes, currConfigs, prevConfigs, periodsRes, mfSalesRes, mfProductsRes]) => {
            const currSalesRaw = currSalesRes.logs || [];
            const prevSalesRaw = prevSalesRes.logs || [];
            const catalogs = catRes.catalogs || {};

            // Helper for Salamanca holidays (excluding Saturdays, Sundays and local/regional holidays)
            const isHoliday = (y: number, m: number, d: number) => {
                if (m === 1 && (d === 1 || d === 6)) return true;
                if (m === 4 && d === 23) return true;
                if (m === 5 && d === 1) return true;
                if (m === 6 && d === 12) return true; // San Juan de Sahagún (Salamanca local)
                if (m === 8 && d === 15) return true;
                if (m === 9 && d === 8) return true;  // Virgen de la Vega (Salamanca local)
                if (m === 10 && d === 12) return true;
                if (m === 11 && d === 1) return true;
                if (y === 2026 && m === 11 && d === 2) return true;
                if (y === 2025 && m === 10 && d === 13) return true;
                if (m === 12 && (d === 6 || d === 8 || d === 25)) return true;
                if (y === 2026 && m === 12 && d === 7) return true;
                if (y === 2025 && m === 4 && (d === 17 || d === 18)) return true;
                if (y === 2026 && m === 4 && (d === 2 || d === 3)) return true;
                return false;
            };

            // Función Base: Días laborables en el mes
            const getWorkingDaysInMonth = (y: number, m: number) => {
                let days = 0;
                const date = new Date(y, m - 1, 1);
                while (date.getMonth() === m - 1) {
                    const dayOfWeek = date.getDay();
                    const dayOfMonth = date.getDate();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(y, m, dayOfMonth)) {
                        days++;
                    }
                    date.setDate(date.getDate() + 1);
                }
                return days;
            };

            // Días laborables hasta hoy
            const calcularDiasLaborablesHastaHoy = (y: number, m: number) => {
                const today = new Date();
                const targetIsPast = (today.getFullYear() > y) || (today.getFullYear() === y && today.getMonth() > m - 1);

                let lastDayToCount = new Date(y, m, 0).getDate(); // Por defecto fin de mes
                if (!targetIsPast && today.getFullYear() === y && today.getMonth() === m - 1) {
                    lastDayToCount = today.getDate();
                }

                let elapsed = 0;
                for (let d = 1; d <= lastDayToCount; d++) {
                    const dt = new Date(y, m - 1, d);
                    const dayOfWeek = dt.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(y, m, d)) {
                        elapsed++;
                    }
                }
                return elapsed;
            };

            const daysInMonth = new Date(year, month, 0).getDate();

            // Proceso de agregación
            const processMetrics = (salesListRaw: any[], configs: any[], y: number, m: number, periodKeyForConfig: string) => {
                const [objData, pymeData, plusData, extrasData] = configs;
                const objetivos = objData.objetivos || { Pyme: {}, Captador: {} };
                const objGrupos = objData.grupos || { Pyme: {}, Captador: {} };
                const importesPyme = pymeData.importes || pymeData.data || [];
                const importesPlus = plusData.importes || plusData.data || [];
                const activeExtras = (extrasData.assignments || []).filter((ea: any) => ea.status !== 'CANCELLED');

                // Extras NO territoriales: el TERRITORIAL O2 (PRV Territorial O2) NO suma en MOD,
                // solo en el Resumen de Métricas MOD.
                const nonTerritorialExtras = activeExtras.filter((ex: any) =>
                    String(ex.customerNif || '').toUpperCase() !== 'TERRITORIAL' &&
                    !String(ex.rule?.name || '').toUpperCase().includes('TERRITORIAL O2')
                );

                // MovilFree: margen neto (ingreso sin IVA − coste) de ventas COMPLETADAS del mes.
                // SÍ suma en MOD.
                const mfSalesMonth = (mfSalesRes || []).filter((s: any) => {
                    const d = new Date(s.fechaVenta);
                    return s.estado === 'COMPLETADA' && d.getFullYear() === y && (d.getMonth() + 1) === m;
                });
                const movilFreeReal = mfSalesMonth.reduce((acc: number, s: any) => {
                    try {
                        const list = JSON.parse(s.listaProductos);
                        const cost = list.reduce((cAcc: number, item: any) => {
                            const prodCost = item.coste !== undefined ? item.coste : ((mfProductsRes || []).find((p: any) => p.id === item.id)?.coste || 0);
                            return cAcc + (prodCost * item.cantidad);
                        }, 0);
                        return acc + ((s.importeTotal / 1.21) - cost);
                    } catch (e) { return acc; }
                }, 0);

                const salesList = salesListRaw.map(sanitizeSale);
                let periodData = (periodsRes.periods || []).find((p: any) => p.period_key === periodKeyForConfig);
                if (!periodData) {
                    periodData = (periodsRes.periods || []).find((p: any) => p.status === 'ACTIVE');
                    if (!periodData) {
                        periodData = periodsRes.periods?.[0];
                    }
                }

                const stats = Array.from({ length: daysInMonth }, (_, i) => ({
                    day: i + 1,
                    dayOfWeek: ['D', 'L', 'M', 'X', 'J', 'V', 'S'][new Date(y, m - 1, i + 1).getDay()],
                    isWeekend: [0, 6].includes(new Date(y, m - 1, i + 1).getDay()),
                    ops: 0,
                    importe: 0,
                    accumOps: 0,
                    accumImporte: 0
                }));

                salesList.forEach((sale: any) => {
                    if (sale.pendiente === 'Anulado' || sale.anulado === 'Si') return;

                    let saleDay = -1;
                    if (sale.timestamp) {
                        const d = new Date(sale.timestamp);
                        if (d.getFullYear() === y && d.getMonth() === m - 1) {
                            saleDay = d.getDate();
                        }
                    }
                    // Fallback for missing timestamp but having date string
                    if (saleDay === -1 && sale.fecha) {
                        const match = String(sale.fecha).match(/^(\d{1,2})\//);
                        if (match) saleDay = parseInt(match[1], 10);
                    }
                    // Fechas en formato ISO (YYYY-MM-DD) que el patrón anterior no captura
                    if (saleDay === -1 && sale.fecha) {
                        const iso = String(sale.fecha).match(/^\d{4}-\d{1,2}-(\d{1,2})/);
                        if (iso) saleDay = parseInt(iso[1], 10);
                    }
                    // Último recurso: la operación pertenece al periodo (la API ya la filtró),
                    // así que se cuenta usando el día de createdAt para no descuadrar el total
                    // (las operaciones deben cuadrar con realizadas + pendientes en todo informe).
                    if (saleDay === -1 && sale.timestamp) {
                        const d = new Date(sale.timestamp);
                        if (!isNaN(d.getTime())) saleDay = Math.min(Math.max(d.getDate(), 1), daysInMonth);
                    }

                    if (saleDay >= 1 && saleDay <= daysInMonth) {
                        stats[saleDay - 1].ops += 1;
                    }
                });

                // Obtener el total global del mes a través de renderDashboardData o tubería de liquidación para Junio 2026
                let globalImporte = 0;
                const saleMonth = `${y}${m.toString().padStart(2, '0')}`;

                if (y === 2026 && m === 6) {
                    // --- TUBERÍA DE COMISIONES REALES PARA JUNIO 2026 ---
                    const parseSafeFloat = (val: any): number => {
                        if (val === null || val === undefined) return 0;
                        if (typeof val === 'number') return isNaN(val) ? 0 : val;
                        const clean = String(val).replace('€', '').replace(/\s/g, '').replace(',', '.').trim();
                        const num = parseFloat(clean);
                        return isNaN(num) ? 0 : num;
                    };

                    const pymeMonthObj = objetivos.Pyme?.[saleMonth] || {};
                    const captadorMonthObj = objetivos.Captador?.[saleMonth] || {};
                    const pymeData = renderDashboardData('Pyme', importesPyme, pymeMonthObj, salesList, objGrupos, periodData);
                    const captadorData = renderDashboardData('Captador', importesPlus, captadorMonthObj, salesList, objGrupos, periodData);

                    const getCommissionBase = (sale: any) => {
                        if (sale.anulado === 'Si' || sale.pendiente === 'Anulado') return 0;

                        let sMonth = ''
                        if (sale.fecha) {
                           const parts = sale.fecha.split('/')
                           if (parts.length === 3) sMonth = `${parts[2]}${parts[1]}`
                           else if (sale.fecha.includes('-')) {
                               const p = sale.fecha.split('-')
                               if (p.length >= 2) sMonth = `${p[0]}${p[1]}`
                           }
                        }
                        
                        const getFallbackValue = () => {
                             let val = sale.importe || sale.cuota || 0;
                             const det = (sale.detalle || '').toLowerCase();
                             if (!val && (det === 'ti' || det === 'tma' || det === 'rent' || det === 'micro')) {
                                 let catalogKey = '';
                                 if (det === 'ti') catalogKey = 'Ti';
                                 if (det === 'tma' || det === 'rent') catalogKey = 'Rent';
                                 if (det === 'micro') catalogKey = 'Micro';
                                 
                                 const list = catalogs[catalogKey] || [];
                                 const found = list.find((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
                                 if (found) {
                                     val = parseSafeFloat(found.anual);
                                 }
                             }
                             return parseSafeFloat(val);
                        }

                        if (!sMonth) return getFallbackValue();
                        if (sMonth !== saleMonth) return getFallbackValue();
                        
                        const det = (sale.detalle || '').toLowerCase();
                        const isTV = det === 'suscripciones tv' || det === 'suscripcion tv';
                        
                        if (det === 'o2' || det === 'seguro' || det === 'mimovistar' || det === 'repos' || det === 'varios' || isTV || det === 'prepago' || det === 'resto baf' || det === 'traslado mimovistar') {
                            if (det === 'seguro') {
                                const list = catalogs['Seguro'] || [];
                                const found = list.find((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
                                if (found && found.comision) {
                                    return parseSafeFloat(found.comision);
                                }
                            }
                            return parseSafeFloat(sale.importe || sale.cuota || 0);
                        }
                        
                        let overrideBaseValue: number | undefined = undefined;
                        if (det === 'ti' || det === 'tma' || det === 'rent' || det === 'micro') {
                            let catalogKey = '';
                            if (det === 'ti') catalogKey = 'Ti';
                            if (det === 'tma' || det === 'rent') catalogKey = 'Rent';
                            if (det === 'micro') catalogKey = 'Micro';
                            
                            const list = catalogs[catalogKey] || [];
                            const matchingProducts = list.filter((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
                            
                            let found = matchingProducts[0];
                            if (matchingProducts.length > 1) {
                                const correctlyDated = matchingProducts.find((c: any) => isVentaWithinDates(sale.fecha, c.validFrom, c.validTo));
                                if (correctlyDated) found = correctlyDated;
                            }

                            if (found) {
                                overrideBaseValue = Number(String(found.anual || 0).replace(',','.'));
                                
                                if (det === 'ti') {
                                    return overrideBaseValue;
                                }
                                
                                if (det === 'tma' || det === 'rent') {
                                    const isConCoste = sale.rentConCoste && (sale.rentConCoste.toLowerCase() === 'sí' || sale.rentConCoste.toLowerCase() === 'si');
                                    if (isConCoste) {
                                        return Number(String(found.comisionConCoste || 0).replace(',','.'));
                                    } else {
                                        return Number(String(found.comision || 0).replace(',','.'));
                                    }
                                }
                            }
                        }

                        const plusCodesExact = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7'];
                        const isPlus = plusCodesExact.some(c => String(sale.codigo || '').toLowerCase().includes(c));
                        const dashboardRows = isPlus ? pymeData.rows : captadorData.rows;
                        return calculateDynamicCommission(sale, dashboardRows, overrideBaseValue);
                    };

                    // La empresa cobra 15€ extra por cada Swap (venta con ¿Swap? marcado)
                    const getCommission = (sale: any) => getCommissionBase(sale) + (sale.isSwap === true ? 15 : 0);

                    // Filter out Solar360 sales as done in the screen table of liquidacion
                    const salesForTable = salesList.filter((s: any) => {
                        const p = String(s.producto || '').toLowerCase()
                        const c = String(s.categoria || '').toLowerCase()
                        const d = String(s.detalle || '').toLowerCase()
                        return !p.includes('solar360') && !p.includes('solar 360') && 
                               !c.includes('solar360') && !c.includes('solar 360') && 
                               !d.includes('solar360') && !d.includes('solar 360')
                    });

                    const salesCommissions = salesForTable.reduce((acc: number, s: any) => acc + getCommission(s), 0);
                    const telecomExtras = nonTerritorialExtras.reduce((acc: number, ex: any) => acc + Number(ex.telecomRewardAmount || 0), 0);
                    globalImporte = salesCommissions + telecomExtras;
                } else {
                    // --- CÁLCULO ESTÁNDAR ORIGINAL ---
                    if (importesPyme.length > 0) {
                        const dashPyme = renderDashboardData('Pyme', importesPyme, objetivos.Pyme?.[saleMonth] || {}, salesList, objGrupos, periodData);
                        globalImporte += dashPyme.totalImporte;
                    }
                    if (importesPlus.length > 0) {
                        const dashCaptador = renderDashboardData('Captador', importesPlus, objetivos.Captador?.[saleMonth] || {}, salesList, objGrupos, periodData);
                        globalImporte += dashCaptador.totalImporte;
                    }

                    // Añadir extras (NO territoriales) al total global
                    nonTerritorialExtras.forEach((ex: any) => {
                        const amount = Number(ex.amount || ex.telecomRewardAmount) || 0;
                        globalImporte += amount;
                    });
                }

                // MovilFree SÍ suma en MOD (margen neto del mes)
                globalImporte += movilFreeReal;

                // Prorratear el importe global sobre el número total de operaciones
                let totalOpsGlobal = stats.reduce((acc, d) => acc + d.ops, 0);
                const avgImportePerOp = totalOpsGlobal > 0 ? (globalImporte / totalOpsGlobal) : 0;

                // Asignar el importe proporcional a cada día y sumar acumulados
                let totalOps = 0;
                let totalImporte = 0;

                stats.forEach(d => {
                    d.importe = d.ops * avgImportePerOp;

                    // Contar ops y euros todos los días para no descuadrar el total (incluyendo fines de semana)
                    totalOps += d.ops;
                    totalImporte += d.importe;

                    d.accumOps = totalOps;
                    d.accumImporte = totalImporte;
                });

                const workingDaysElapsed = calcularDiasLaborablesHastaHoy(y, m);
                const effectiveDays = workingDaysElapsed || 1;
                const totalWorkingDaysInMonth = getWorkingDaysInMonth(y, m);

                return {
                    stats,
                    totalOps,
                    totalImporte,
                    mediaOpsDiaria: totalOps / effectiveDays,
                    mediaImporteDiario: totalImporte / effectiveDays,
                    mediaPorOp: totalOps > 0 ? (totalImporte / totalOps) : 0,
                    estOps: (totalOps / effectiveDays) * totalWorkingDaysInMonth,
                    estRentabilidad: (totalImporte / effectiveDays) * totalWorkingDaysInMonth,
                    workingDaysElapsed
                };
            };

            const currMetrics = processMetrics(currSalesRaw, currConfigs, year, month, activePeriodKey);
            const prevMetrics = processMetrics(prevSalesRaw, prevConfigs, year - 1, month, prevYearKey);

            const pctOps = prevMetrics.totalOps > 0
                ? ((currMetrics.estOps - prevMetrics.totalOps) / prevMetrics.totalOps) * 100
                : 0;

            const pctImporte = prevMetrics.totalImporte > 0
                ? ((currMetrics.estRentabilidad - prevMetrics.totalImporte) / prevMetrics.totalImporte) * 100
                : 0;

            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const monthName = monthNames[month - 1];

            setData({
                currMetrics,
                prevMetrics,
                pctOps,
                pctImporte,
                year,
                monthName
            });

            setLoading(false);
        });

    }, [activePeriodKey]);

    if (authorized === null) {
        return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>;
    }

    if (loading || !data) {
        return <div style={{ padding: 40, color: 'var(--text-main)', fontWeight: 600 }}>Calculando métricas MOD...</div>;
    }

    const { currMetrics, prevMetrics, pctOps, pctImporte, year, monthName } = data;

    const overriddenPrevOps = manualOpsPrev !== '' ? parseInt(manualOpsPrev, 10) : prevMetrics.totalOps;
    const overriddenPrevDays = manualDaysPrev !== '' ? parseInt(manualDaysPrev, 10) : prevMetrics.workingDaysElapsed;
    const overriddenPrevImporte = manualImportePrev !== '' ? parseFloat(manualImportePrev) : prevMetrics.totalImporte;

    const overriddenPrevMediaOpsDiaria = overriddenPrevDays > 0 ? overriddenPrevOps / overriddenPrevDays : 0;
    const overriddenPrevMediaPorOp = overriddenPrevOps > 0 ? overriddenPrevImporte / overriddenPrevOps : 0;
    const overriddenPrevMediaImporteDiario = overriddenPrevDays > 0 ? overriddenPrevImporte / overriddenPrevDays : 0;

    const overriddenPctOps = overriddenPrevOps > 0
        ? ((currMetrics.estOps - overriddenPrevOps) / overriddenPrevOps) * 100
        : 0;

    const overriddenPctImporte = overriddenPrevImporte > 0
        ? ((currMetrics.estRentabilidad - overriddenPrevImporte) / overriddenPrevImporte) * 100
        : 0;

    const num = (n: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);

    // Custom tooltip formating for charts
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 700, color: '#1e293b' }}>Día {label}</p>
                    <p style={{ margin: 0, color: payload[0].color, fontWeight: 600 }}>
                        Acumulado: {payload[0].name === 'accumImporte' ? num(payload[0].value) + ' €' : payload[0].value}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ padding: '24px 32px', backgroundColor: 'var(--bg-app)', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'white', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TrendingUp size={24} color="#22c55e" /> MOD (Media Operaciones Diaria)
                        </h1>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                            Monitorización avanzada de rentabilidad y promedios diarios ({monthName} {year}).
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                        onClick={() => router.push('/seguimiento-ventas/mod-resumen')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            background: 'var(--mercedes-cyan)',
                            color: 'white',
                            border: 'none',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '13px',
                            boxShadow: '0 4px 12px rgba(0, 173, 239, 0.3)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                    >
                        <BarChart2 size={16} /> Resumen MOD
                    </button>
                    <button 
                        onClick={() => router.push('/seguimiento-ventas/tramitacion')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            background: '#ec4899',
                            color: 'white',
                            border: 'none',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '13px',
                            boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                    >
                        <LineChart size={16} /> Seguimiento Tramitación
                    </button>
                    <button 
                        onClick={() => router.push('/seguimiento-ventas/territorial-pdv')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            background: 'var(--mercedes-cyan)',
                            color: 'white',
                            border: 'none',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '13px',
                            boxShadow: '0 4px 12px rgba(0, 173, 239, 0.3)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                    >
                        <Globe size={16} /> Territorial PDV
                    </button>
                    <PeriodSelector />
                </div>
            </div>

            {/* TABLA COMPARATIVA PRINCIPAL */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '32px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#0ea5e9', color: 'white' }}>
                            <th style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700 }}>Año y Mes</th>
                            <th style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700 }}>Operaciones Realizadas</th>
                            <th style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700 }}>Días Trabajados</th>
                            <th style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700 }}>Media de Operaciones Diaria</th>
                            <th style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700 }}>Media por Operación</th>
                            <th style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700 }}>Importe Mensual</th>
                            <th style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700 }}>Media Importe Diario</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{monthName} {year - 1} 🚀</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <input
                                        type="text"
                                        value={manualOpsPrev}
                                        placeholder={String(prevMetrics.totalOps)}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            handleManualOpsChange(val);
                                        }}
                                        style={{
                                            width: '65px',
                                            textAlign: 'center',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '4px',
                                            padding: '2px 4px',
                                            fontWeight: 700,
                                            fontSize: '12px',
                                            color: '#1e293b',
                                            outline: 'none',
                                            backgroundColor: '#f8fafc'
                                        }}
                                    />
                                </div>
                            </td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <input
                                        type="text"
                                        value={manualDaysPrev}
                                        placeholder={String(prevMetrics.workingDaysElapsed)}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            handleManualDaysChange(val);
                                        }}
                                        style={{
                                            width: '60px',
                                            textAlign: 'center',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '4px',
                                            padding: '2px 4px',
                                            fontWeight: 700,
                                            fontSize: '12px',
                                            color: '#1e293b',
                                            outline: 'none',
                                            backgroundColor: '#f8fafc'
                                        }}
                                    />
                                </div>
                            </td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{num(overriddenPrevMediaOpsDiaria)}</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{num(overriddenPrevMediaPorOp)} €</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    <input
                                        type="text"
                                        value={manualImportePrev}
                                        placeholder={num(prevMetrics.totalImporte)}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9.,]/g, '');
                                            const parsedVal = val.replace(',', '.');
                                            handleManualImporteChange(parsedVal);
                                        }}
                                        style={{
                                            width: '95px',
                                            textAlign: 'center',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '4px',
                                            padding: '2px 4px',
                                            fontWeight: 700,
                                            fontSize: '12px',
                                            color: '#1e293b',
                                            outline: 'none',
                                            backgroundColor: '#f8fafc'
                                        }}
                                    />
                                    <span>€</span>
                                </div>
                            </td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{num(overriddenPrevMediaImporteDiario)} €</td>
                        </tr>
                        <tr style={{ backgroundColor: '#84cc16', color: 'white' }}>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 800 }}>{monthName} {year}</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 800 }}>{currMetrics.totalOps}</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 800 }}>{currMetrics.workingDaysElapsed}</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 800 }}>{num(currMetrics.mediaOpsDiaria)}</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 800 }}>{num(currMetrics.mediaPorOp)} €</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 800 }}>{num(currMetrics.totalImporte)} €</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 800 }}>{num(currMetrics.mediaImporteDiario)} €</td>
                        </tr>
                        <tr style={{ backgroundColor: '#0284c7', color: 'white' }}>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 600 }}>Estimación Operaciones</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 800 }}>{Math.round(currMetrics.estOps)}</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 600 }}>Operaciones en %</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 800, color: overriddenPctOps >= 0 ? '#bbf7d0' : '#fecdd3' }}>{overriddenPctOps > 0 ? '+' : ''}{overriddenPctOps.toFixed(2)}%</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 600 }}>Estimación Rentabilidad</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 800 }}>{num(currMetrics.estRentabilidad)} €</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 800, color: overriddenPctImporte >= 0 ? '#bbf7d0' : '#fecdd3' }}>{overriddenPctImporte > 0 ? '+' : ''}{overriddenPctImporte.toFixed(2)}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                <style dangerouslySetInnerHTML={{
                    __html: `
                @media (min-width: 1024px) {
                    .mod-grid {
                        grid-template-columns: 340px 1fr !important;
                    }
                }
             `}} />
                <div className="mod-grid" style={{ display: 'grid', gap: '24px' }}>
                    {/* COLUMNA IZQUIERDA: DESGLOSE DIARIO */}
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#0ea5e9', color: 'white' }}>
                                    <th style={{ padding: '3px 4px', fontWeight: 700, fontSize: '11px' }}>Nº</th>
                                    <th style={{ padding: '3px 4px', fontWeight: 700, fontSize: '11px' }}>Día</th>
                                    <th style={{ padding: '3px 4px', fontWeight: 700, fontSize: '11px' }}>Acumulado</th>
                                    <th style={{ padding: '3px 4px', fontWeight: 700, fontSize: '11px' }}>Diarias</th>
                                    <th style={{ padding: '3px 4px', fontWeight: 700, fontSize: '11px' }}>Importe</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currMetrics.stats.map((row: any, i: number) => {
                                    if (row.isWeekend) return null;

                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '2px 4px', fontWeight: 700, color: '#475569', fontSize: '11px' }}>{row.day}</td>
                                            <td style={{ padding: '2px 4px', color: '#64748b', fontSize: '11px' }}>{row.dayOfWeek}</td>
                                            <td style={{ padding: '2px 4px', fontWeight: row.accumOps > 0 ? 800 : 400, color: row.accumOps > 0 ? '#0f172a' : '#cbd5e1', fontSize: '11px' }}>{(row.accumOps > 0 && row.ops > 0) ? row.accumOps : ''}</td>
                                            <td style={{ padding: '2px 4px', fontWeight: row.ops > 0 ? 700 : 400, color: '#64748b', fontSize: '11px' }}>{row.ops > 0 ? row.ops : ''}</td>
                                            <td style={{ padding: '2px 4px', fontWeight: row.ops > 0 ? 700 : 400, color: '#64748b', fontSize: '11px' }}>{row.ops > 0 ? num(row.importe) + ' €' : ''}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* COLUMNA DERECHA: GRAFICOS RECHARTS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', height: '240px' }}>
                            <h3 style={{ margin: '0 0 12px 0', color: '#1e3a8a', fontSize: '14px', fontWeight: 800 }}>Media Operaciones Diarias (Evolución Acumulada)</h3>
                            <ResponsiveContainer width="100%" height="80%">
                                <AreaChart data={currMetrics.stats.filter((r: any) => !r.isWeekend)} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorOps" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="accumOps" name="accumOps" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorOps)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', height: '240px' }}>
                            <h3 style={{ margin: '0 0 12px 0', color: '#b45309', fontSize: '14px', fontWeight: 800 }}>Media Importe Diario</h3>
                            <ResponsiveContainer width="100%" height="80%">
                                <AreaChart data={currMetrics.stats.filter((r: any) => !r.isWeekend)} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val} />
                                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="accumImporte" name="accumImporte" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorImp)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}
