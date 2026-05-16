'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { TrendingUp, RefreshCw } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts'
import { usePeriod } from '@/components/PeriodProvider'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const formatCurrency = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const getWorkingDaysInMonth = (year: number, month: number) => {
    let days = 0;
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
        if (date.getDay() !== 0 && date.getDay() !== 6) days++; // Lunes a Viernes
        date.setDate(date.getDate() + 1);
    }
    return days;
};

export default function ModPage() {
    const { activePeriodKey } = usePeriod();
    const [yearStr, monthStr] = (activePeriodKey || '').split('_');
    const selectedYear = parseInt(yearStr, 10) || new Date().getFullYear();
    const selectedMonth = parseInt(monthStr, 10) || (new Date().getMonth() + 1);

    const [loading, setLoading] = useState(false);
    
    const [currentPeriodData, setCurrentPeriodData] = useState<{sales: any[], catalogs: any[]}>({sales: [], catalogs: []});
    const [pastPeriodData, setPastPeriodData] = useState<{sales: any[], catalogs: any[]}>({sales: [], catalogs: []});
    
    const [manualPastMetrics, setManualPastMetrics] = useState<any>(null);
    const [pastEditMode, setPastEditMode] = useState(false);
    const [pastEdits, setPastEdits] = useState({ ops: 0, days: 0, importe: 0 });
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // 1. Fetch periods to find IDs for current and past year
                const pRes = await fetch('/api/period');
                if (!pRes.ok) throw new Error('Failed to fetch periods');
                const pData = await pRes.json();
                const periodsList = Array.isArray(pData) ? pData : (pData.periods || []);
                
                const currPeriod = periodsList.find((p: any) => p.year === selectedYear && p.month === selectedMonth);
                const pastPeriod = periodsList.find((p: any) => p.year === selectedYear - 1 && p.month === selectedMonth);

                const fetchPeriodFullData = async (period: any) => {
                    if (!period) return { sales: [], catalogs: [] };
                    const [sRes, cRes] = await Promise.all([
                        fetch(`/api/sales?periodKey=${period.period_key}`),
                        fetch(`/api/catalogs?periodKey=${period.period_key}&strictPeriod=1`)
                    ]);
                    
                    const sData = sRes.ok ? await sRes.json().catch(()=>[]) : [];
                    const cData = cRes.ok ? await cRes.json().catch(()=>[]) : [];

                    const extractedCat = cData.catalogs || cData.data || cData;
                    let flatCatalogs: any[] = [];
                    if (Array.isArray(extractedCat)) {
                        flatCatalogs = extractedCat;
                    } else if (typeof extractedCat === 'object' && extractedCat !== null) {
                        flatCatalogs = Object.values(extractedCat).flat();
                    }

                    return {
                        sales: Array.isArray(sData) ? sData : (sData.logs || sData.sales || sData.data || []),
                        catalogs: flatCatalogs
                    };
                };

                const [currData, pastData] = await Promise.all([
                    fetchPeriodFullData(currPeriod),
                    fetchPeriodFullData(pastPeriod)
                ]);

                setCurrentPeriodData(currData);
                setPastPeriodData(pastData);
                
                // Fetch overrides for past metrics
                try {
                    const res = await fetch(`/api/settings?key=mod_past_${selectedYear - 1}_${selectedMonth}`);
                    if (res.ok) {
                        const sData = await res.json();
                        if (sData.value) setManualPastMetrics(JSON.parse(sData.value));
                    }
                } catch(e) {}

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [selectedYear, selectedMonth]);

    const calculateMetrics = (data: {sales: any[], catalogs: any[]}, year: number, month: number) => {
        // Build catalog map
        const catalogMap: Record<string, any> = {};
        data.catalogs.forEach(c => {
            catalogMap[c.producto] = c;
        });

        // Filter sales (no anuladas)
        const validSales = data.sales.filter(s => s.anulado !== 'Si' && s.anulado !== 'Sí' && s.pendiente !== 'Anulado');

        // Group by day
        const daysInMonth = new Date(year, month, 0).getDate();
        let currentWeek = 0;
        const dailyStats = Array.from({length: daysInMonth}, (_, i) => {
            const dDate = new Date(year, month - 1, i + 1);
            let letter = dDate.toLocaleDateString('es-ES', { weekday: 'short' }).charAt(0).toUpperCase();
            if (dDate.getDay() === 3) letter = 'X'; // Miércoles
            
            if (dDate.getDay() === 1 && i > 0) {
                currentWeek++;
            }

            return {
                day: i + 1,
                weekday: letter,
                weekIndex: currentWeek,
                ops: 0,
                importe: 0,
                accumOps: 0
            };
        });

        validSales.forEach(sale => {
            if (!sale.fecha) return;
            
            let day = -1;
            if (sale.fecha.includes('/')) {
                const parts = sale.fecha.split('/');
                if (parts.length >= 3) day = parseInt(parts[0], 10);
            } else if (sale.fecha.includes('-')) {
                const parts = sale.fecha.split('-');
                if (parts.length >= 3) {
                    // Usually YYYY-MM-DD
                    day = parseInt(parts[2], 10);
                }
            }

            if (day >= 1 && day <= daysInMonth) {
                dailyStats[day - 1].ops += 1;
                const cat = catalogMap[sale.producto];
                if (cat) {
                    const val = Number(cat.comisionConCoste || cat.comision || 0);
                    dailyStats[day - 1].importe += val;
                }
            }
        });

        let accum = 0;
        let daysWorked = 0;
        let totalImporte = 0;
        
        const now = new Date();
        const isPastOrToday = (dDay: number) => {
            if (year < now.getFullYear()) return true;
            if (year > now.getFullYear()) return false;
            if (month < now.getMonth() + 1) return true;
            if (month > now.getMonth() + 1) return false;
            return dDay <= now.getDate();
        };

        const workingDailyStats = dailyStats.filter(d => d.weekday !== 'S' && d.weekday !== 'D');

        workingDailyStats.forEach(d => {
            accum += d.ops;
            if (isPastOrToday(d.day) || d.ops > 0) {
                d.accumOps = accum;
            } else {
                d.accumOps = null as any;
            }
            totalImporte += d.importe;
        });

        const totalWorkingDaysInMonth = getWorkingDaysInMonth(year, month);
        
        // Count how many working days have passed (up to today, or all if past month)
        const isCurrentMonth = new Date().getFullYear() === year && new Date().getMonth() + 1 === month;
        let workingDaysElapsed = 0;
        if (isCurrentMonth) {
            const today = new Date().getDate();
            for (let i = 1; i <= today; i++) {
                const d = new Date(year, month - 1, i);
                if (d.getDay() !== 0 && d.getDay() !== 6) workingDaysElapsed++;
            }
        } else {
            workingDaysElapsed = totalWorkingDaysInMonth;
        }

        // Avoid division by zero
        const effectiveWorkingDays = workingDaysElapsed || 1;

        const totalOps = accum;
        const mediaOpsDiaria = totalOps / effectiveWorkingDays;
        const mediaPorOp = totalOps > 0 ? totalImporte / totalOps : 0;
        const mediaImporteDiario = totalImporte / effectiveWorkingDays;

        return {
            dailyStats: workingDailyStats,
            totalOps,
            daysWorked: workingDaysElapsed,
            totalWorkingDaysInMonth,
            mediaOpsDiaria,
            mediaPorOp,
            totalImporte,
            mediaImporteDiario,
            estOps: mediaOpsDiaria * totalWorkingDaysInMonth,
            estRentabilidad: mediaImporteDiario * totalWorkingDaysInMonth
        };
    };

    const currMetrics = useMemo(() => calculateMetrics(currentPeriodData, selectedYear, selectedMonth), [currentPeriodData, selectedYear, selectedMonth]);
    const pastMetricsRaw = useMemo(() => calculateMetrics(pastPeriodData, selectedYear - 1, selectedMonth), [pastPeriodData, selectedYear, selectedMonth]);

    const pastMetrics = useMemo(() => {
        if (manualPastMetrics) {
            return {
                ...pastMetricsRaw,
                totalOps: manualPastMetrics.ops,
                daysWorked: manualPastMetrics.days,
                totalImporte: manualPastMetrics.importe,
                mediaOpsDiaria: manualPastMetrics.days ? manualPastMetrics.ops / manualPastMetrics.days : 0,
                mediaPorOp: manualPastMetrics.ops ? manualPastMetrics.importe / manualPastMetrics.ops : 0,
                mediaImporteDiario: manualPastMetrics.days ? manualPastMetrics.importe / manualPastMetrics.days : 0
            };
        }
        return pastMetricsRaw;
    }, [pastMetricsRaw, manualPastMetrics]);

    const startPastEdit = () => {
        setPastEdits({ ops: pastMetrics.totalOps, days: pastMetrics.daysWorked, importe: pastMetrics.totalImporte });
        setPastEditMode(true);
    };

    const savePastEdit = async () => {
        setManualPastMetrics(pastEdits);
        setPastEditMode(false);
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: `mod_past_${selectedYear - 1}_${selectedMonth}`,
                    value: JSON.stringify(pastEdits)
                })
            });
        } catch(e) {}
    };

    const pctOps = pastMetrics.totalOps > 0 ? ((currMetrics.totalOps - pastMetrics.totalOps) / pastMetrics.totalOps) * 100 : 0;
    const pctImporte = pastMetrics.totalImporte > 0 ? ((currMetrics.totalImporte - pastMetrics.totalImporte) / pastMetrics.totalImporte) * 100 : 0;

    return (
        <div style={{ padding: '24px 32px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
            <PageHeader 
                title={<span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><TrendingUp color="#10b981" size={28} /> MOD (Media Operaciones Diaria)</span>}
                subtitle={`Monitorización avanzada de rentabilidad y promedios diarios (${MONTHS[selectedMonth-1]} ${selectedYear}).`}
                showBack={true}
                backFallback="/seguimiento-ventas"
            />

            {loading ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#6b7280' }}>
                    <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 16px' }} />
                    Calculando medias y cruzando catálogos de {MONTHS[selectedMonth-1]}...
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    
                    {/* TABLA RESUMEN COMPARATIVA */}
                    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #0ea5e9', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#0ea5e9', color: '#fff' }}>
                                    <th style={{ padding: '5px 8px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Año y Mes</th>
                                    <th style={{ padding: '5px 8px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Operaciones Realizadas</th>
                                    <th style={{ padding: '5px 8px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Días Trabajados</th>
                                    <th style={{ padding: '5px 8px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Media de Operaciones Diaria</th>
                                    <th style={{ padding: '5px 8px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Media por Operación</th>
                                    <th style={{ padding: '5px 8px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Importe Mensual</th>
                                    <th style={{ padding: '5px 8px' }}>Media Importe Diario</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '6px', fontWeight: 600, borderRight: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={pastEditMode ? savePastEdit : startPastEdit}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                            {MONTHS[selectedMonth-1]} {selectedYear - 1} 
                                            <span style={{ fontSize: 14 }}>{pastEditMode ? '💾' : '✏️'}</span>
                                        </div>
                                    </td>
                                    {pastEditMode ? (
                                        <>
                                            <td style={{ padding: '6px', borderRight: '1px solid #e5e7eb' }}>
                                                <input type="number" value={pastEdits.ops} onChange={e => setPastEdits({...pastEdits, ops: Number(e.target.value)})} style={{ width: 60, textAlign: 'center', border: '1px solid #0ea5e9', borderRadius: 4, outline: 'none' }} />
                                            </td>
                                            <td style={{ padding: '6px', borderRight: '1px solid #e5e7eb' }}>
                                                <input type="number" value={pastEdits.days} onChange={e => setPastEdits({...pastEdits, days: Number(e.target.value)})} style={{ width: 60, textAlign: 'center', border: '1px solid #0ea5e9', borderRadius: 4, outline: 'none' }} />
                                            </td>
                                            <td style={{ padding: '6px', fontWeight: 600, borderRight: '1px solid #e5e7eb', color: '#6b7280' }}>
                                                {(pastEdits.days ? pastEdits.ops / pastEdits.days : 0).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '6px', fontWeight: 600, borderRight: '1px solid #e5e7eb', color: '#6b7280' }}>
                                                {formatCurrency(pastEdits.ops ? pastEdits.importe / pastEdits.ops : 0)}
                                            </td>
                                            <td style={{ padding: '6px', borderRight: '1px solid #e5e7eb' }}>
                                                <input type="number" value={pastEdits.importe} onChange={e => setPastEdits({...pastEdits, importe: Number(e.target.value)})} style={{ width: 80, textAlign: 'center', border: '1px solid #0ea5e9', borderRadius: 4, outline: 'none' }} />
                                            </td>
                                            <td style={{ padding: '6px', fontWeight: 600, color: '#6b7280' }}>
                                                {formatCurrency(pastEdits.days ? pastEdits.importe / pastEdits.days : 0)}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td style={{ padding: '6px', fontWeight: 600, borderRight: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={startPastEdit}>{pastMetrics.totalOps}</td>
                                            <td style={{ padding: '6px', fontWeight: 600, borderRight: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={startPastEdit}>{pastMetrics.daysWorked}</td>
                                            <td style={{ padding: '6px', fontWeight: 600, borderRight: '1px solid #e5e7eb' }}>{pastMetrics.mediaOpsDiaria.toFixed(2)}</td>
                                            <td style={{ padding: '6px', fontWeight: 600, borderRight: '1px solid #e5e7eb' }}>{formatCurrency(pastMetrics.mediaPorOp)}</td>
                                            <td style={{ padding: '6px', fontWeight: 600, borderRight: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={startPastEdit}>{formatCurrency(pastMetrics.totalImporte)}</td>
                                            <td style={{ padding: '6px', fontWeight: 600 }}>{formatCurrency(pastMetrics.mediaImporteDiario)}</td>
                                        </>
                                    )}
                                </tr>
                                <tr style={{ background: '#84cc16', color: '#fff', borderBottom: '1px solid #a3e635' }}>
                                    <td style={{ padding: '6px', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.2)' }}>{MONTHS[selectedMonth-1]} {selectedYear}</td>
                                    <td style={{ padding: '6px', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.2)' }}>{currMetrics.totalOps}</td>
                                    <td style={{ padding: '6px', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.2)' }}>{currMetrics.daysWorked}</td>
                                    <td style={{ padding: '6px', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.2)' }}>{currMetrics.mediaOpsDiaria.toFixed(2)}</td>
                                    <td style={{ padding: '6px', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.2)' }}>{formatCurrency(currMetrics.mediaPorOp)}</td>
                                    <td style={{ padding: '6px', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.2)' }}>{formatCurrency(currMetrics.totalImporte)}</td>
                                    <td style={{ padding: '6px', fontWeight: 700 }}>{formatCurrency(currMetrics.mediaImporteDiario)}</td>
                                </tr>
                                <tr style={{ background: '#0284c7', color: '#fff' }}>
                                    <td style={{ padding: '5px 6px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Estimación Operaciones</td>
                                    <td style={{ padding: '5px 6px', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.2)' }}>{currMetrics.estOps.toFixed(0)}</td>
                                    <td style={{ padding: '5px 6px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Operaciones en %</td>
                                    <td style={{ padding: '5px 6px', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.2)' }}>{pctOps > 0 ? '+' : ''}{pctOps.toFixed(2)}%</td>
                                    <td style={{ padding: '5px 6px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Estimación Rentabilidad Mes</td>
                                    <td style={{ padding: '5px 6px', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.2)' }}>{formatCurrency(currMetrics.estRentabilidad)}</td>
                                    <td style={{ padding: '5px 6px', fontWeight: 700 }}>{pctImporte > 0 ? '+' : ''}{pctImporte.toFixed(2)}% (Importe en %)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'stretch' }}>
                        
                        {/* TABLA DÍAS LATERAL */}
                        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: '#0ea5e9', color: '#fff' }}>
                                        <th style={{ padding: '4px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Día</th>
                                        <th style={{ padding: '4px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Día</th>
                                        <th style={{ padding: '4px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Operac.</th>
                                        <th style={{ padding: '4px' }}>Media</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currMetrics.dailyStats.map((d: any, i: number) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: d.weekIndex % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                            <td style={{ padding: '3px 4px', fontWeight: 600, borderRight: '1px solid #f3f4f6' }}>{d.day}</td>
                                            <td style={{ padding: '3px 4px', borderRight: '1px solid #f3f4f6' }}>{d.weekday}</td>
                                            <td style={{ padding: '3px 4px', fontWeight: 600, borderRight: '1px solid #f3f4f6' }}>{d.accumOps !== null && d.accumOps > 0 ? d.accumOps : ''}</td>
                                            <td style={{ padding: '3px 4px' }}>{d.ops > 0 ? d.ops : ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* GRÁFICOS */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
                            
                            <div style={{ background: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: 15, color: '#1d4ed8', flexShrink: 0 }}>Media Operaciones Diarias (Evolución Acumulada)</h3>
                                <div style={{ flex: 1, minHeight: 0 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={currMetrics.dailyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                                            <Tooltip contentStyle={{borderRadius: 8, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)'}} />
                                            <Area type="monotone" dataKey="accumOps" name="Operaciones Acumuladas" stroke="#2563eb" fill="#93c5fd" fillOpacity={0.6} strokeWidth={3} connectNulls={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div style={{ background: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: 15, color: '#1d4ed8', flexShrink: 0 }}>Media Importe Diario</h3>
                                <div style={{ flex: 1, minHeight: 0 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={currMetrics.dailyStats.map((d: any) => ({ ...d, importeAcum: d.accumOps !== null ? currMetrics.dailyStats.filter((x: any) => x.day <= d.day).reduce((acc: number, curr: any) => acc + curr.importe, 0) : null }))} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={(val) => `${(val/1000).toFixed(1)}k`} />
                                            <Tooltip formatter={(value: any) => formatCurrency(Number(value))} contentStyle={{borderRadius: 8, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)'}} />
                                            <Area type="monotone" dataKey="importeAcum" name="Importe Acumulado" stroke="#ca8a04" fill="#fde047" fillOpacity={0.8} strokeWidth={3} connectNulls={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
