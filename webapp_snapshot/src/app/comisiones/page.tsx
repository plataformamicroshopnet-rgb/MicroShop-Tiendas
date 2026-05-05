'use client'

import React from 'react'
import { Trophy, Target, Euro, Calendar, Clock, AlertCircle, Medal, BadgeCheck, ListFilter, XCircle, Sparkles, Crown, Diamond } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { useComisionesData } from '@/hooks/useComisionesData'
import { ALL_GROUPS } from '@/lib/comisiones'
import { useGuard } from '@/hooks/useGuard'
import { useRouter } from 'next/navigation'
import { normalizeRole } from '@/lib/appConfig'
import { useEffect } from 'react'

import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'

const SIMULATOR_CONFIG = {
    // TODO: Confirmar cifras exactas con el usuario
    PLUS: {
        GROUP_RATES: {
            'TMA': { type: 'percent', value: 0.02 }, // 2% 
            'TI': { type: 'percent', value: 0.02 },  // 2%
            'MIC': { type: 'percent', value: 0.02 }, // 2%
            'BAF': { type: 'fixed', value: 18 },
            'PORTA': { type: 'fixed', value: 12, label: 'Porta Móvil MV' },
            'FD': { type: 'fixed', value: 65 },
            'VOZ': { type: 'fixed', value: 10 },
            'ACC': { type: 'percent', value: 0.05 },
            'SVA': { type: 'fixed', value: 5 },
            'CIBER': { type: 'fixed', value: 15 }
        },
        EXTRAS_SIMULATED: [
            { name: 'Extra FD Nuevo + TMA o Micro 4 Unidades a 5€', amount: 20 },
            { name: 'Extra FD Nuevo o en Planta + TMA o Micro + Respaldo 5G + TGT 8 Unidades a 30€', amount: 240 },
            { name: 'Respaldo 5G 15 Unidades entre todo Plus 3 mínimo por Tiendas Bolsa económica de 40€', amount: 40 },
            { name: 'Bolsa económica de 200€ al trimestre aprobando la nota. Total mensual: 66,66€', amount: 66.66 },
            { name: 'Extra FD (BAF >=120% FD>=80%) 10 € por FD Total 30€', amount: 30 }
        ]
    },
    BASICO: {
        GROUP_RATES: { // Importes calcados del Plus por indicación del usuario
            'TMA': { type: 'percent', value: 0.02 }, 
            'TI': { type: 'percent', value: 0.02 },  
            'MIC': { type: 'percent', value: 0.02 }, 
            'BAF': { type: 'fixed', value: 18 },  
            'PORTA': { type: 'fixed', value: 12, label: 'Porta Móvil MV' },
            'FD': { type: 'fixed', value: 65 },   
            'VOZ': { type: 'fixed', value: 10 },
            'ACC': { type: 'percent', value: 0.05 },
            'SVA': { type: 'fixed', value: 5 },
            'CIBER': { type: 'fixed', value: 15 }
        },
        EXTRAS_SIMULATED: [
            { name: 'Extra Alta FN Flex (BAF >=100% FD>=80%) Obligatorio portar una línea Fija o una línea móvil 6 Unidades a 40€', amount: 240 }
        ]
    }
}

const AspirationalSimulatorModal = ({ isOpen, onClose, s }: { isOpen: boolean, onClose: () => void, s: any }) => {
    if (!isOpen) return null;

    // Calcular Base Perfecta (Cada meta de grupo cubierta al 100% de Objetivo 2)
    const baseBreakdown: any[] = [];
    let baseIdeal = 0;

    const normProfile = s.profile ? s.profile.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';

    ALL_GROUPS.forEach(gName => {
        const obj2 = s.groupObj2[gName] || 0;
        if (obj2 > 0) {
            const configObj = SIMULATOR_CONFIG[normProfile as keyof typeof SIMULATOR_CONFIG];
            if (!configObj) return;

            const rule = configObj.GROUP_RATES[gName as keyof typeof configObj.GROUP_RATES];
            let gImport = 0;
            if (rule) {
                if (rule.type === 'percent') {
                    gImport = obj2 * rule.value;
                } else if (rule.type === 'fixed') {
                    gImport = obj2 * rule.value;
                }
            }
            if (gImport > 0) {
                baseBreakdown.push({ name: gName, label: (rule as any).label, obj2, amount: gImport, rate: rule.value, type: rule.type });
                baseIdeal += gImport;
            }
        }
    });

    const configObj = SIMULATOR_CONFIG[normProfile as keyof typeof SIMULATOR_CONFIG];
    const extras = configObj ? configObj.EXTRAS_SIMULATED : [];
    const extrasTotal = extras.reduce((acc, curr) => acc + curr.amount, 0);

    const godModeTotal = baseIdeal + extrasTotal;

    // ----- DATOS PARA GRÁFICAS -----

    const combinedElements = [
        ...baseBreakdown.map(b => ({ name: b.label || b.name, amount: b.amount, isExtra: false })),
        ...extras.map(e => ({ name: e.name.substring(0, 20) + '...', amount: e.amount, isExtra: true }))
    ];
    
    // Renderizar todas las palancas ordenadas e inyectar su porcentaje
    const barchartData = combinedElements
                            .sort((a,b) => b.amount - a.amount)
                            .map(t => {
                                const perc = godModeTotal > 0 ? (t.amount / godModeTotal) * 100 : 0;
                                return {
                                    name: `${t.name.substring(0, 15)} (${perc.toFixed(0)}%)`,
                                    amount: t.amount,
                                    fill: t.isExtra ? '#F59E0B' : '#0D9488'
                                };
                            });
    // -------------------------------

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div style={{
                backgroundColor: 'var(--bg-card)', border: '2px solid rgba(168, 85, 247, 0.4)',
                borderRadius: '16px', padding: '24px 32px', maxWidth: '950px', width: '90%', maxHeight: '96vh', overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(168, 85, 247, 0.2)',
                position: 'relative'
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: '24px', right: '24px',
                    background: 'transparent', border: 'none', color: 'var(--medium-gray)', cursor: 'pointer', transition: 'color 0.2s'
                }} onMouseEnter={e => e.currentTarget.style.color = '#A855F7'} onMouseLeave={e => e.currentTarget.style.color = 'var(--medium-gray)'}>
                    <XCircle size={28} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '32px' }}>
                    <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '16px', borderRadius: '16px', color: '#A855F7', boxShadow: '0 0 20px rgba(168, 85, 247, 0.2)' }}>
                        <Crown size={36} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'transparent', background: 'linear-gradient(90deg, #A855F7, #D946EF)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>El Mes Perfecto: Perfil {s.profile}</h2>
                        <span style={{ fontSize: '15px', color: 'var(--medium-gray)', fontWeight: 600 }}>
                            Simulador Aspiracional (Desglose al 100% de Objetivo 2 + Combos Extra)
                        </span>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '32px' }}>
                    
                    {/* MATRIZ DE TABLA BASE */}
                    <div>
                        <h3 style={{ fontSize: 18, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8, margin: '0 0 16px 0', color: 'var(--light-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Euro size={16} color="#34d399" /> 1. Cuadrícula Base al Máx.
                        </h3>
                        {baseBreakdown.map(g => (
                            <div key={g.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 8 }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <span style={{ fontWeight: 800, color: 'var(--mercedes-cyan)', width: 100 }}>{g.label || g.name}</span> 
                                    <span style={{ fontSize: 13, color: 'var(--medium-gray)' }}>
                                        Obj2: {Math.round(g.obj2).toLocaleString('es-ES')} a {g.type === 'percent' ? `${g.rate * 100}%` : `${g.rate}€`}
                                    </span>
                                </div>
                                <div style={{ fontWeight: 800, color: '#34d399' }}>+{Math.round(g.amount).toLocaleString('es-ES')} €</div>
                            </div>
                        ))}

                        <h3 style={{ fontSize: 18, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8, margin: '24px 0 16px 0', color: 'var(--light-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Sparkles size={16} color="#F59E0B" /> 2. Misiones y Combos Extra
                        </h3>
                        {extras.map((ex, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '10px 14px', backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: 8, marginBottom: 8, borderLeft: '3px solid #F59E0B' }}>
                                <div style={{ fontSize: 13, color: 'var(--light-text)', fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{ex.name}</div>
                                <div style={{ fontWeight: 800, color: '#F59E0B', whiteSpace: 'nowrap' }}>+{Math.round(ex.amount).toLocaleString('es-ES')} €</div>
                            </div>
                        ))}
                    </div>

                    {/* CAJA DERECHA: TOTAL Y ESTADÍSTICAS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ 
                            background: 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(217,70,239,0.05) 100%)', 
                            border: '1px solid rgba(168,85,247,0.3)', 
                            borderRadius: '16px', padding: '24px', textAlign: 'center',
                            boxShadow: '0 10px 30px rgba(168,85,247,0.1)'
                        }}>
                            <div style={{ fontSize: 13, color: '#A855F7', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Potencial Modo Dios</div>
                            <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--light-text)', textShadow: '0 0 15px rgba(255,255,255,0.2)' }}>
                                {Math.round(godModeTotal).toLocaleString('es-ES')} <span style={{fontSize: 24, color: '#A855F7'}}>€</span>
                            </div>
                            <p style={{ margin: '16px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                                Suma de la potencia base proyectada más combos confirmados de tu segmento.
                            </p>
                        </div>

                        {/* GRÁFICA: TODAS LAS PALANCAS */}
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '16px 16px 8px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                                <Target size={12} color="#0D9488" /> Top Palancas (Peso %)
                            </h4>
                            <div style={{ flex: 1, minHeight: 250 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barchartData} layout="vertical" margin={{ top: 0, right: 30, left: -20, bottom: 0 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--medium-gray)', fontWeight: 600 }} width={140} />
                                        <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} formatter={(value: any) => [`${Number(value).toLocaleString('es-ES')} €`, 'Inyección']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, fontWeight: 700 }} itemStyle={{ color: 'var(--mercedes-cyan)' }} />
                                        <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={12}>
                                            {barchartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
        </div>
    );
}

const AspirationalSimulatorButton = ({ s }: { s: any }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const [showModal, setShowModal] = React.useState(false);

    const normProfile = s.profile ? s.profile.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';

    // Activado solo si existe configuración (PLUS o BÁSICO)
    if (!SIMULATOR_CONFIG[normProfile as keyof typeof SIMULATOR_CONFIG]) return null;

    return (
        <>
            <div 
                onClick={() => setShowModal(true)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{ 
                    display: 'flex', alignItems: 'center', gap: 8, backgroundColor: isHovered ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.05)', 
                    padding: '6px 14px', borderRadius: 12, border: '1px solid', borderColor: isHovered ? '#A855F7' : 'rgba(168, 85, 247, 0.3)', 
                    boxShadow: isHovered ? '0 8px 20px rgba(168,85,247,0.2)' : 'none',
                    cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isHovered ? 'scale(1.02)' : 'none'
                }} 
                title="Modo Dios: Simula El Mes Perfecto"
            >
                <Diamond size={18} color="#A855F7" fill={isHovered ? 'rgba(168, 85, 247, 0.2)' : 'transparent'} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#D946EF', letterSpacing: 0.5, fontWeight: 800 }}>Simulador {s.profile}</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--light-text)' }}>Mes Perfecto</span>
                </div>
            </div>

            <AspirationalSimulatorModal isOpen={showModal} onClose={() => setShowModal(false)} s={s} />
        </>
    )
}

const FinancialTelemetryModal = ({ isOpen, onClose, currentAmount, name }: { isOpen: boolean, onClose: () => void, currentAmount: number, name: string }) => {
    if (!isOpen) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const elapsedDays = Math.max(now.getDate(), 5);
    const remainingDays = Math.max(daysInMonth - now.getDate(), 0);
    
    // Matemática pura (Ritmo Base Diario)
    const runRate = currentAmount / elapsedDays;
    
    // Proyección Pura a fin de mes (Sin reto)
    const pureProjection = runRate * daysInMonth;

    // Proyección con Reto (+15%)
    let baseProjection = pureProjection * 1.15;
    let targetHito = Math.ceil(baseProjection / 50) * 50;
    if (targetHito < 250) targetHito = 250;

    const moneyOnTheTable = Math.max(targetHito - currentAmount, 0);
    
    // Datos para el gráfico de barras
    const chartData = [
        { name: 'Lo Ganado', value: Math.round(currentAmount), fill: '#F59E0B' }, // Ámbar
        { name: 'Cierre Proyectado', value: Math.round(pureProjection), fill: '#10B981' }, // Esmeralda suavizado
        { name: 'Hito Reto', value: Math.round(targetHito), fill: '#0D9488' } // Turquesa Vibrante
    ];

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--medium-gray)', textTransform: 'uppercase' }}>{payload[0].payload.name}</p>
                    <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: payload[0].payload.fill }}>{payload[0].value.toLocaleString('es-ES')} €</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div style={{
                backgroundColor: 'var(--bg-card)', border: '1px solid rgba(13, 148, 136, 0.4)',
                borderRadius: '16px', padding: '32px', maxWidth: '750px', width: '90%',
                boxShadow: '0 20px 50px rgba(13, 148, 136, 0.15)',
                position: 'relative'
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: '16px', right: '16px',
                    background: 'transparent', border: 'none', color: 'var(--medium-gray)', cursor: 'pointer', transition: 'color 0.2s'
                }} onMouseEnter={e => e.currentTarget.style.color = '#EF4444'} onMouseLeave={e => e.currentTarget.style.color = 'var(--medium-gray)'}>
                    <XCircle size={24} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '24px' }}>
                    <div style={{ backgroundColor: 'rgba(13, 148, 136, 0.1)', padding: '12px', borderRadius: '12px', color: '#0D9488' }}>
                        <Target size={32} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: 'var(--light-text)' }}>Telemetría Operativa</h2>
                        <span style={{ fontSize: '14px', color: '#0D9488', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                            Análisis Predictivo — {name}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px' }}>
                    {/* Ritmo Kardió */}
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: 12, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Clock size={16} color="var(--mercedes-cyan)" /> Ritmo de Generación
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--light-text)', display:'flex', alignItems: 'baseline', gap: 6 }}>
                            {Math.round(runRate)} <span style={{ fontSize: 16, color: 'var(--medium-gray)', fontWeight: 600 }}>€ / d.</span>
                        </div>
                    </div>

                    {/* Deadline */}
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: 12, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar size={16} color="#FF9500" /> Días de Combate Restantes
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--light-text)', display:'flex', alignItems: 'baseline', gap: 6 }}>
                            {remainingDays} <span style={{ fontSize: 16, color: 'var(--medium-gray)', fontWeight: 600 }}>días</span>
                        </div>
                    </div>
                </div>

                <div style={{ height: '220px', marginBottom: '32px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barSize={70}>
                            <XAxis dataKey="name" stroke="var(--medium-gray)" tick={{ fill: 'var(--medium-gray)', fontSize: 13, fontWeight: 700 }} axisLine={false} tickLine={false} />
                            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div style={{ backgroundColor: 'rgba(13, 148, 136, 0.1)', border: '1px dashed #0D9488', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--light-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Euro size={18} color="#0D9488" /> Dinero en la Mesa</h3>
                    <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        Tienes hasta <strong style={{ color: '#0D9488', fontSize: '18px', fontWeight: 900 }}>{moneyOnTheTable.toLocaleString('es-ES')}€ adicionales</strong> flotando, esperando que los cierres. <br/>
                        Para asegurar este récord necesitas mantener tu ritmo actual. No aflojes este mes.
                    </p>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeIn {
                    from { opacity: 0; backdrop-filter: blur(0px); }
                    to { opacity: 1; backdrop-filter: blur(10px); }
                }
            `}} />
        </div>
    );
}

const FinancialSpeedometer = ({ currentAmount, sellerName }: { currentAmount: number, sellerName: string }) => {
    const [mounted, setMounted] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const [showModal, setShowModal] = React.useState(false);
    
    React.useEffect(() => setMounted(true), []);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Suavizador para principios de mes para evitar picos irreales
    const elapsedDays = Math.max(now.getDate(), 5);
    
    // Proyección con reto (+15%)
    let projection = (currentAmount / elapsedDays) * daysInMonth;
    projection = projection * 1.15; 
    let targetHito = Math.ceil(projection / 50) * 50;
    
    // Suelo motivador si no hay ventas aún
    if (targetHito < 250) targetHito = 250;

    const progressPercentage = Math.min((currentAmount / targetHito) * 100, 100);
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (progressPercentage / 100) * circumference;

    return (
        <>
        <div 
            onClick={() => setShowModal(true)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ 
                display: 'flex', alignItems: 'center', gap: 8, backgroundColor: isHovered ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)', 
                padding: '6px 14px', borderRadius: 12, border: '1px solid', borderColor: isHovered ? '#0D9488' : 'rgba(13, 148, 136, 0.3)', 
                boxShadow: isHovered ? '0 8px 20px rgba(13,148,136,0.2)' : 'none',
                cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isHovered ? 'scale(1.02)' : 'none'
            }} 
            title="Telemetría Detallada"
        >
            {/* Semicírculo Velocímetro Escala Reducida */}
            <div style={{ position: 'relative', width: 32, height: 32, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="16" cy="16" r={14} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                    <circle 
                        cx="16" cy="16" r={14} 
                        fill="transparent" 
                        stroke={progressPercentage >= 100 ? '#10B981' : '#0D9488'} 
                        strokeWidth="3" 
                        strokeDasharray={2 * Math.PI * 14} 
                        strokeDashoffset={mounted ? (2 * Math.PI * 14) - (progressPercentage / 100) * (2 * Math.PI * 14) : (2 * Math.PI * 14)} 
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s' }} 
                    />
                </svg>
                <div style={{ position: 'absolute', color: progressPercentage >= 100 ? '#10B981' : '#0D9488', transition: 'color 0.5s' }}>
                    <Target size={14} strokeWidth={2.5} />
                </div>
            </div>

            {/* Datos Escala Reducida */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--medium-gray)', letterSpacing: 0.5, fontWeight: 800 }}>Proyección Regateo</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: progressPercentage >= 100 ? '#10B981' : '#0D9488', lineHeight: 1, textShadow: progressPercentage >= 100 ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none' }}>
                    {targetHito.toLocaleString('es-ES')} €
                </span>
            </div>
            
            {/* Mini porcentaje lateral Escala Reducida */}
            {mounted && progressPercentage > 0 && (
                <div style={{ marginLeft: 4, fontSize: 10, fontWeight: 800, color: progressPercentage >= 100 ? '#10B981' : (progressPercentage < 50 ? '#F59E0B' : '#0D9488'), backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 5px', borderRadius: 6 }}>
                    {Math.round(progressPercentage)}%
                </div>
            )}
        </div>

        <FinancialTelemetryModal isOpen={showModal} onClose={() => setShowModal(false)} currentAmount={currentAmount} name={sellerName} />
        </>
    );
}

export default function ComisionesDashboardPage() {
    const router = useRouter()
    const { authorized, user } = useGuard('MODULE_COMISIONES')
    const {
        loading,
        selectedSellerFilter,
        setSelectedSellerFilter,
        sellerStats,
        teamTotalComisiones,
        teamTotalSales,
        top3,
        maxComisionSeller,
        maxSalesSeller,
        monthSales
    } = useComisionesData()

    useEffect(() => {
        if (user && normalizeRole(user.role) === 'COMERCIAL' && user.username) {
            setSelectedSellerFilter(user.username)
        }
    }, [user, setSelectedSellerFilter])

    // Datos finales renderizados en tabla interactiva
    const filteredTableSales = selectedSellerFilter 
        ? monthSales.filter(s => {
            const v = String(s.vendedor || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
            const tgt = selectedSellerFilter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
            return v === tgt
          })
        : monthSales

    if (authorized === null) {
        return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>;
    }

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--light-text)' }}>Cargando Panel Premium...</div>
    }

    return (
        <div style={{ padding: 20 }}>
            <PageHeader 
                title={<><Trophy size={28} className="mercedes-text" color="var(--mercedes-cyan)" /> Panel de Comisiones</>}
                showBack={true}
                helpContent={
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Panel de Comisiones</h4>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>Resumen ejecutivo de comisiones. Muestra lo que cada comercial ha generado (Básico, Plus, Extras) cruzando las ventas reales con la configuración económica del periodo activo.</p>
                  </div>
                }
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, marginTop: -8 }}>
                {/* Filtro mensual gestionado por PeriodSelector global */}
            </div>

            {/* 1. PRIMERA FILA (KPIs SUPERIORES - ANCHURA TOTAL x 4) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginTop: 32, marginBottom: 32 }}>
                
                {/* Mayor Comisión */}
                <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '4px solid #FFD700', backgroundColor: 'rgba(255, 215, 0, 0.05)' }}>
                    <div style={{ color: 'var(--medium-gray)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Trophy size={16} color="#FFD700" /> Mayor Comisión
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--light-text)' }}>
                        {maxComisionSeller ? maxComisionSeller.name : '-'}
                    </div>
                    <div style={{ color: '#D97706', fontSize: 18, fontWeight: 800 }}>
                        {maxComisionSeller ? `${maxComisionSeller.totalComision.toFixed(2)} €` : '0.00 €'}
                    </div>
                </div>

                {/* Más Ventas */}
                <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '4px solid var(--mercedes-cyan)', backgroundColor: 'rgba(0, 173, 239, 0.05)' }}>
                    <div style={{ color: 'var(--medium-gray)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Target size={16} color="var(--mercedes-cyan)" /> Más Ventas
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--light-text)' }}>
                        {maxSalesSeller ? maxSalesSeller.name : '-'}
                    </div>
                    <div style={{ color: 'var(--mercedes-cyan)', fontSize: 18, fontWeight: 800 }}>
                        {maxSalesSeller ? `${maxSalesSeller.totalSales} operaciones` : '0'}
                    </div>
                </div>

                {/* Total Equipo */}
                <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '4px solid #34d399', backgroundColor: 'rgba(52, 211, 153, 0.05)' }}>
                    <div style={{ color: 'var(--medium-gray)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Euro size={16} color="#34d399" /> Total Comisiones
                        </div>
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#34d399' }}>
                        {teamTotalComisiones.toFixed(2)} €
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--medium-gray)' }}>Volumen total: <strong style={{color: 'var(--light-text)'}}>{teamTotalSales} operaciones</strong></div>
                </div>

                {/* RANKING TOP 3 */}
                <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 10, borderLeft: '4px solid #A855F7', backgroundColor: 'rgba(168, 85, 247, 0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ color: 'var(--medium-gray)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6, zIndex: 2 }}>
                        <BadgeCheck size={16} color="#A855F7" /> Ranking del Mes
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, zIndex: 2 }}>
                        {top3.map((t, index) => {
                            const icon = index === 0 ? '🥇' : (index === 1 ? '🥈' : '🥉')
                            const rankColor = index === 0 ? '#FBBF24' : (index === 1 ? '#CBD5E1' : '#D97706')
                            return (
                                <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, fontWeight: index === 0 ? 800 : 600, color: rankColor }}>
                                    <div style={{ display: 'flex', gap: 8 }}><span>{icon}</span> {t.name}</div>
                                    <div style={{ fontWeight: 800 }}>{t.totalComision.toFixed(2)} €</div>
                                </div>
                            )
                        })}
                    </div>
                </div>

            </div>

             {/* 2. TARJETAS DE AGENTES (GRID 2x3 OBLIGATORIA) */}
            <h2 style={{ fontSize: 18, color: 'var(--light-text)', margin: '32px 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: 8, display:'flex', justifyContent:'space-between' }}>
                Revisión Individual Operativa
                {selectedSellerFilter && (
                    <button 
                        onClick={() => setSelectedSellerFilter(null)}
                        style={{ fontSize: 12, backgroundColor: 'transparent', color: '#FF453A', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <XCircle size={14} /> Quitar filtro ({selectedSellerFilter})
                    </button>
                )}
            </h2>
            
            <style dangerouslySetInnerHTML={{__html: `
                .comisiones-grid-cards {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 24px;
                    margin-bottom: 40px;
                }
                .table-row-hover:hover {
                    background-color: rgba(255,255,255,0.03) !important;
                }
                @media (max-width: 1200px) {
                    .comisiones-grid-cards {
                        grid-template-columns: 1fr;
                    }
                }
            `}} />
            
            <div className="comisiones-grid-cards">
                {sellerStats.map(s => {
                    const isPlus = s.profile === 'Plus'
                    const isSelected = selectedSellerFilter === s.name
                    
                    return (
                        <div key={s.name} style={{ display: 'flex', flexDirection: 'column' }}>
                            <div 
                                className="card" 
                                onClick={() => setSelectedSellerFilter(isSelected ? null : s.name)}
                                style={{ 
                                    padding: '16px 20px', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    minHeight: 'auto',
                                    gap: 12,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    border: isSelected ? '2px solid var(--mercedes-cyan)' : '1px solid var(--border-color)',
                                    boxShadow: isSelected ? '0 0 15px rgba(0, 173, 239, 0.4)' : 'none',
                                    transform: isSelected ? 'translateY(-3px)' : 'none',
                                    borderBottomLeftRadius: isSelected ? 0 : 8,
                                    borderBottomRightRadius: isSelected ? 0 : 8,
                                    zIndex: isSelected ? 2 : 1
                                }}
                            >
                            {/* CABECERA ULTRA COMPACTA Y KPIS */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {/* IZQUIERDA: Info del Asesor */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                    <div style={{ 
                                        width: 28, height: 28, borderRadius: '50%', 
                                        backgroundColor: isPlus ? 'rgba(0,173,239,0.1)' : 'rgba(255,149,0,0.1)', 
                                        color: isPlus ? 'var(--mercedes-cyan)' : '#FF9500',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center', 
                                        fontSize: 14, fontWeight: 700 
                                    }}>
                                        {s.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--light-text)' }}>{s.name}</div>
                                        <span style={{ 
                                            display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                            backgroundColor: isPlus ? 'rgba(0,173,239,0.2)' : 'rgba(255,149,0,0.2)',
                                            color: isPlus ? 'var(--mercedes-cyan)' : '#FF9500'
                                        }}>
                                            Perfil {s.profile}
                                        </span>
                                    </div>
                                </div>

                                {/* CENTRO: Herramientas (Modo Dios y Telemetría) */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                                    <div className="no-print">
                                        <AspirationalSimulatorButton s={s} />
                                    </div>
                                    <div className="no-print">
                                        <FinancialSpeedometer currentAmount={s.totalComision} sellerName={s.name} />
                                    </div>
                                </div>
                                
                                {/* DERECHA: Total */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 1 }}>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>{Math.round(s.totalComision).toLocaleString('es-ES')} €</div>
                                    {s.totalExtras > 0 && <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>(Base: {Math.round(s.totalComision - s.totalExtras).toLocaleString()} + Ext: {Math.round(s.totalExtras).toLocaleString()})</div>}
                                </div>
                            </div>
                            
                                {/* GRÁFICO DE BARRAS DE VENTAS POR GRUPO */}
                                <div style={{ flex: 1 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                        <thead>
                                            <tr style={{ 
                                                backgroundColor: isPlus ? 'rgba(0,173,239,0.1)' : 'rgba(255,149,0,0.1)', 
                                                color: isPlus ? 'var(--mercedes-cyan)' : '#FF9500', 
                                                textTransform: 'uppercase',
                                                fontSize: 10
                                            }}>
                                                <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600 }}>Grupo</th>
                                                <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600 }}></th>
                                                <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>Ventas</th>
                                                <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>Objetivos (1 - 2)</th>
                                                <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>Te quedan (1 - 2)</th>
                                                <th style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>Comisión</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ALL_GROUPS.map(gName => {
                                                const qtty = s.groupCounts[gName]
                                                const obj1 = s.groupObj1[gName] || 0
                                                const obj2 = s.groupObj2[gName] || 0
                                                const isValueGroup = ['TMA', 'TI', 'MIC'].includes(gName)
                                                
                                                const maxObj = obj2 > 0 ? obj2 : (obj1 > 0 ? obj1 : 0)
                                                const percent = maxObj > 0 ? Math.min(100, (qtty / maxObj) * 100) : (qtty > 0 ? 100 : 0)
                                                const obj1Percent = maxObj > 0 && obj1 > 0 ? Math.min(100, (obj1 / maxObj) * 100) : 0
                                                
                                                let gradientColor = 'linear-gradient(90deg, #fdba74, #f97316)' // Naranja (Bajo rendimiento)
                                                if (qtty >= obj2 && obj2 > 0) gradientColor = 'linear-gradient(90deg, #86efac, #22c55e)' // Verde (Alto rendimiento)
                                                else if (qtty >= obj1 && obj1 > 0) gradientColor = 'linear-gradient(90deg, #fde68a, #f59e0b)' // Amarillo (Medio rendimiento)
                                                else if (qtty > 0 && obj1 === 0 && obj2 === 0) gradientColor = 'linear-gradient(90deg, #86efac, #22c55e)' // Verde Default (sin objetivos configurados)
                                                
                                                const falt1 = Math.max(0, obj1 - qtty)
                                                const falt2 = Math.max(0, obj2 - qtty)
                                                
                                                const format = (v: number) => isValueGroup ? `${Math.round(v).toLocaleString('es-ES')} €` : `${v}`
                                                const comisionCalculada = s.groupComisions[gName] || 0;

                                                return (
                                                    <tr className="table-row-hover" key={gName} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                                                        <td style={{ padding: '6px 4px', fontSize: 13, fontWeight: 700, color: 'var(--light-text)', width: 45 }}>
                                                            {gName}
                                                        </td>
                                                        <td style={{ padding: '6px 8px', width: '25%' }}>
                                                            <div style={{ position: 'relative', backgroundColor: 'rgba(255,255,255,0.08)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                                                                <div style={{ width: `${percent}%`, height: '100%', background: gradientColor, transition: 'width 0.5s ease', boxShadow: '0 0 6px rgba(0,0,0,0.2)', borderRadius: 4 }} />
                                                                {obj1Percent > 0 && obj1Percent < 100 && (
                                                                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${obj1Percent}%`, width: 2, backgroundColor: 'var(--bg-card)', boxShadow: '0 0 4px rgba(0,0,0,0.5)', zIndex: 1 }} title="Objetivo 1" />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: isPlus ? '#00ADEF' : '#FF9500' }}>
                                                            {format(qtty)}
                                                        </td>
                                                        <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 13, color: 'var(--medium-gray)' }}>
                                                            {format(obj1)} <span style={{opacity: 0.5}}>/</span> {format(obj2)}
                                                        </td>
                                                        <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 13, color: 'var(--medium-gray)' }}>
                                                            <span style={{ color: falt1 > 0 ? '#FF453A' : '#34d399' }}>{falt1 > 0 ? `-${format(falt1)}` : '✓'}</span> <span style={{opacity: 0.5}}>/</span> <span style={{ color: falt2 > 0 ? (falt1 === 0 ? '#FF9500' : '#FF453A') : '#34d399' }}>{falt2 > 0 ? `-${format(falt2)}` : '✓'}</span>
                                                        </td>
                                                        <td style={{ padding: '6px 4px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: '#34d399' }}>
                                                            {Math.round(comisionCalculada).toLocaleString('es-ES')} €
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                            {s.extraGroups && s.extraGroups.length > 0 && s.extraGroups.map((eg: any, idx: number) => (
                                                <tr className="table-row-hover" key={`extra-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(16, 185, 129, 0.05)', transition: 'background 0.2s' }}>
                                                    <td colSpan={2} style={{ padding: '6px 4px', fontSize: 12, fontWeight: 700, color: '#10b981' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={12} /> {eg.name}</span>
                                                    </td>
                                                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#10b981' }}>
                                                        {eg.count}
                                                    </td>
                                                    <td colSpan={2} style={{ padding: '6px 4px', textAlign: 'center', fontSize: 13, color: '#10b981' }}>
                                                        -
                                                    </td>
                                                    <td style={{ padding: '6px 4px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: '#34d399' }}>
                                                        {Math.round(eg.totalAmount).toLocaleString('es-ES')} €
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            {/* REGISTRO OPERATIVO ANIDADO (ACORDEÓN) */}
                            {isSelected && (
                                <div style={{ 
                                    marginTop: -3, 
                                    marginLeft: 16, 
                                    marginRight: 16,
                                    padding: '24px 32px',
                                    backgroundColor: 'var(--card-bg)',
                                    borderLeft: '2px solid var(--mercedes-cyan)',
                                    borderRight: '2px solid var(--mercedes-cyan)',
                                    borderBottom: '2px solid var(--mercedes-cyan)',
                                    borderBottomLeftRadius: 8,
                                    borderBottomRightRadius: 8,
                                    boxShadow: '0 10px 15px rgba(0,0,0,0.5)',
                                    zIndex: 1
                                }}>
                                    <h3 style={{ fontSize: 16, color: 'var(--mercedes-cyan)', margin: '0 0 16px 0', display:'flex', gap: 10, alignItems: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>
                                        <ListFilter size={18} /> Registro Operativo de {s.name}
                                    </h3>
                                    <div style={{ overflowX: 'auto', border: '1px solid rgba(0, 173, 239, 0.2)' }}>
                                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: 13 }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#00ADEF', color: 'var(--bg-card)' }}>
                                                    <th style={{ padding: '12px 16px' }}>Producto</th>
                                                    <th style={{ padding: '12px 16px' }}>Cliente</th>
                                                    <th style={{ padding: '12px 16px' }}>CIF</th>
                                                    <th style={{ padding: '12px 16px' }}>Grupo / Pestaña</th>
                                                    <th style={{ padding: '12px 16px' }}>Fecha</th>
                                                    <th style={{ padding: '12px 16px' }}>Pendiente</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {s.rawSales.map((venta: any, i: number) => {
                                                    const isPending = String(venta.pendiente).toLowerCase() === 'sí' || String(venta.pendiente).toLowerCase() === 'si'
                                                    const isAnnulled = String(venta.anulado).toLowerCase() === 'sí' || String(venta.anulado).toLowerCase() === 'si'
                                                    const badgeColor = isAnnulled ? '#FF453A' : (isPending ? '#FF9500' : '#34d399')
                                                    const badgeText = isAnnulled ? 'Anulado' : (isPending ? 'Pendiente' : 'Aprobado')
                                                    const badgeBg = isAnnulled ? 'rgba(255, 69, 58, 0.15)' : (isPending ? 'rgba(255, 149, 0, 0.15)' : 'rgba(52, 211, 153, 0.15)')
                                                    
                                                    return (
                                                        <tr key={venta.id || i} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                                            <td style={{ padding: '12px 16px', color: 'var(--light-text)', fontWeight: 600 }}>{venta.producto || '-'}</td>
                                                            <td style={{ padding: '12px 16px', color: 'var(--light-text)' }}>{venta.nombreCliente || '-'}</td>
                                                            <td style={{ padding: '12px 16px', color: 'var(--light-text)' }}>{venta.nif || '-'}</td>
                                                            <td style={{ padding: '12px 16px', color: 'var(--light-text)' }}>{venta.sheet || '-'}</td>
                                                            <td style={{ padding: '12px 16px', color: 'var(--light-text)' }}>{venta.fecha || '-'}</td>
                                                            <td style={{ padding: '12px 16px' }}>
                                                                <span style={{ 
                                                                    display: 'inline-block', 
                                                                    padding: '4px 10px', 
                                                                    borderRadius: '12px', 
                                                                    fontSize: '11px', 
                                                                    fontWeight: 600, 
                                                                    color: badgeColor, 
                                                                    backgroundColor: badgeBg 
                                                                }}>
                                                                    {badgeText}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                                {s.rawExtras?.length > 0 && s.rawExtras.map((ex: any, i: number) => (
                                                    <tr key={`extra-${ex.id || i}`} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
                                                        <td style={{ padding: '12px 16px', color: '#059669', fontWeight: 600 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                ⚡ {ex.rule?.name || 'Incentivo Manual'}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px 16px', color: '#059669' }}>{ex.customerName || '-'}</td>
                                                        <td style={{ padding: '12px 16px', color: '#059669' }}>{ex.customerNif || '-'}</td>
                                                        <td style={{ padding: '12px 16px', color: '#059669' }}>EXTRA TELEFÓNICA</td>
                                                        <td style={{ padding: '12px 16px', color: '#059669' }}>{new Date(ex.createdAt).toLocaleDateString()}</td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <span style={{ 
                                                                display: 'inline-block', 
                                                                padding: '4px 10px', 
                                                                borderRadius: '12px', 
                                                                fontSize: '11px', 
                                                                fontWeight: 600, 
                                                                color: ex.status === 'PENDING' ? '#FF9500' : '#059669', 
                                                                backgroundColor: ex.status === 'PENDING' ? 'rgba(255, 149, 0, 0.15)' : 'rgba(16, 185, 129, 0.15)' 
                                                            }}>
                                                                {ex.status === 'PENDING' ? 'Pendiente' : 'Aprobado'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {s.rawSales.length === 0 && (!s.rawExtras || s.rawExtras.length === 0) && (
                                                    <tr>
                                                        <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--medium-gray)' }}>
                                                            No hay registro operativo en este mes.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                        </div>
                    )
                })}
            </div>
        </div>
    )
}
