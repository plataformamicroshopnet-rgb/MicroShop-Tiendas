'use client'

import React, { useState, useEffect } from 'react'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'
import { PeriodSelector } from '@/components/PeriodSelector'
import { TrendingUp, ArrowLeft, Globe, BarChart2, LineChart } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useRouter } from 'next/navigation'
import { renderDashboardData, calculateDynamicCommission, sanitizeSale, normalizeString, isVentaWithinDates } from '@/lib/salesUtils'
import { getSaleCommissionBase } from '@/lib/saleCommission'
import { computeMonthMetrics } from '@/lib/modMetrics'

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
            fetch(`/api/movilfree/products`).then(r => r.json()).catch(() => []),
            fetch(`/api/territorial?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({ o2: [] }))
        ]).then(([currSalesRes, prevSalesRes, catRes, currConfigs, prevConfigs, periodsRes, mfSalesRes, mfProductsRes, territorialRes]) => {
            const currSalesRaw = currSalesRes.logs || [];
            const prevSalesRaw = prevSalesRes.logs || [];
            const catalogs = catRes.catalogs || {};

            // Métricas MOD del mes — FUENTE ÚNICA en lib/modMetrics (computeMonthMetrics),
            // que usa también el panel de Ganancias para "Caja Tiendas". No duplicar aquí.
            const processMetrics = (salesListRaw: any[], configs: any[], y: number, m: number, periodKeyForConfig: string) =>
                computeMonthMetrics({
                    salesRaw: salesListRaw,
                    configs,
                    catalogs,
                    periods: periodsRes.periods || [],
                    mfSales: mfSalesRes || [],
                    mfProducts: mfProductsRes || [],
                    year: y,
                    month: m,
                    periodKeyForConfig,
                    o2Rules: territorialRes.o2 || [],
                });

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
