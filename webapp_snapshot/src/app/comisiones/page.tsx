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



    // TODO: Confirmar cifras exactas con el usuario


const AspirationalSimulatorButton = ({ s }: { s: any }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const router = useRouter();

    // Activado para perfiles validos (Básico o Plus)
    const isValidProfile = s.profile === 'Plus' || s.profile === 'Básico' || s.profile === 'Basico';

    if (!isValidProfile) return null;

    return (
        <div 
            onClick={() => router.push(`/comisiones/simulador?seller=${encodeURIComponent(s.name)}`)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ 
                display: 'flex', alignItems: 'center', gap: 8, backgroundColor: isHovered ? '#eff6ff' : '#ffffff', 
                padding: '6px 14px', borderRadius: 12, border: '1px solid', borderColor: isHovered ? '#0078D4' : '#e2e8f0', 
                boxShadow: isHovered ? '0 8px 20px rgba(0,120,212,0.15)' : '0 2px 5px rgba(0,0,0,0.05)',
                cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isHovered ? 'scale(1.02)' : 'none'
            }} 
            title="Modo Dios: Simula El Mes Perfecto"
        >
            <Diamond size={18} color="#0078D4" fill={isHovered ? 'rgba(0,120,212,0.1)' : 'transparent'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#0078D4', letterSpacing: 0.5, fontWeight: 800 }}>Simulador</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: '#1e293b' }}>Mes Perfecto</span>
            </div>
        </div>
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
                display: 'flex', alignItems: 'center', gap: 8, backgroundColor: isHovered ? '#f0fdf4' : '#ffffff', 
                padding: '6px 14px', borderRadius: 12, border: '1px solid', borderColor: isHovered ? '#10b981' : '#e2e8f0', 
                boxShadow: isHovered ? '0 8px 20px rgba(16,185,129,0.15)' : '0 2px 5px rgba(0,0,0,0.05)',
                cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isHovered ? 'scale(1.02)' : 'none'
            }} 
            title="Telemetría Detallada"
        >
            {/* Semicírculo Velocímetro Escala Reducida */}
            <div style={{ position: 'relative', width: 32, height: 32, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="16" cy="16" r={14} fill="transparent" stroke="#f1f5f9" strokeWidth="3" />
                    <circle 
                        cx="16" cy="16" r={14} 
                        fill="transparent" 
                        stroke={progressPercentage >= 100 ? '#10B981' : '#0ea5e9'} 
                        strokeWidth="3" 
                        strokeDasharray={2 * Math.PI * 14} 
                        strokeDashoffset={mounted ? (2 * Math.PI * 14) - (progressPercentage / 100) * (2 * Math.PI * 14) : (2 * Math.PI * 14)} 
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s' }} 
                    />
                </svg>
                <div style={{ position: 'absolute', color: progressPercentage >= 100 ? '#10B981' : '#0ea5e9', transition: 'color 0.5s' }}>
                    <Target size={14} strokeWidth={2.5} />
                </div>
            </div>

            {/* Datos Escala Reducida */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5, fontWeight: 800 }}>Proyección Regateo</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: progressPercentage >= 100 ? '#10B981' : '#0ea5e9', lineHeight: 1, textShadow: 'none' }}>
                    {targetHito.toLocaleString('es-ES')} €
                </span>
            </div>
            
            {/* Mini porcentaje lateral Escala Reducida */}
            {mounted && progressPercentage > 0 && (
                <div style={{ marginLeft: 4, fontSize: 10, fontWeight: 800, color: progressPercentage >= 100 ? '#10B981' : (progressPercentage < 50 ? '#f59e0b' : '#0ea5e9'), backgroundColor: '#f8fafc', padding: '2px 5px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
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
        monthSales,
        tiendaRules,
        o2Rules,
        territorialO2Rules
    } = useComisionesData(user)

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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--light-text)' }}>{s.name}</div>
                                        <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(0,0,0,0.05)', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                                            <img 
                                                src={`/${s.name}.${['Vanesa', 'Lara', 'Nuria'].includes(s.name) ? 'jpeg' : 'jpg'}`} 
                                                alt={s.name} 
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        </div>
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
                                
                                {/* DERECHA: Totales Desglosados */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Importe Consolidado:</div>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{s.totalConsolidada.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Importe por Consolidar:</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>{s.totalPendiente.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                                    </div>
                                    <div style={{ width: '100%', height: 1, backgroundColor: 'var(--border-color)', margin: '2px 0' }}></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--light-text)', textTransform: 'uppercase' }}>Total (Fin + Pte):</div>
                                        <div style={{ fontSize: 18, fontWeight: 900, color: '#3b82f6' }}>{s.totalComision.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                                    </div>
                                    {s.totalExtras > 0 && <div style={{ fontSize: 10, color: '#a855f7', fontWeight: 700 }}>(Base: {Math.round(s.totalComision - s.totalExtras).toLocaleString()} + Ext: {Math.round(s.totalExtras).toLocaleString()})</div>}
                                </div>
                            </div>
                            
                                {/* GRÁFICO DE BARRAS DE VENTAS POR GRUPO */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ backgroundColor: '#ffffff', borderRadius: 8, overflow: 'hidden', border: '1px solid #bfdbfe', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                        <thead>
                                            <tr style={{ 
                                                backgroundColor: '#0078D4', 
                                                color: '#FFFFFF', 
                                                textTransform: 'uppercase',
                                                fontSize: 11,
                                                borderBottom: 'none'
                                            }}>
                                                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Nombre Comisión</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Importe<br/>Primer Tramo</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Importe<br/>Segundo Tramo</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Ventas</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Pte.</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Obj. 1</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Obj. 2</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Falta 1</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Falta 2</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>Comisión</th>
                                            </tr>
                                        </thead>
                                        <tbody style={{ backgroundColor: '#ffffff' }}>
                                            {(() => {
                                                const activeRulesForSeller = String(s.name).toLowerCase().includes('marta') ? (o2Rules || []) : (tiendaRules || []);
                                                return activeRulesForSeller.length > 0 ? activeRulesForSeller.map((rule: any, idx: number) => {
                                                const isAlternate = idx % 2 === 0;
                                                const rowBg = isAlternate ? '#ffffff' : '#f8fafc';
                                                const gName = rule.nombre;
                                                const qtty = s.groupCounts[gName] || 0
                                                const pendingQtty = s.groupPending[gName] || 0
                                                const obj1 = s.groupObj1[gName] || 0
                                                const obj2 = s.groupObj2[gName] || 0
                                                const isValueGroup = String(rule.importePrimerTramo || '').includes('%');
                                                
                                                const maxObj = obj2 > 0 ? obj2 : (obj1 > 0 ? obj1 : 0)
                                                const percent = maxObj > 0 ? Math.min(100, (qtty / maxObj) * 100) : (qtty > 0 ? 100 : 0)
                                                const obj1Percent = maxObj > 0 && obj1 > 0 ? Math.min(100, (obj1 / maxObj) * 100) : 0
                                                
                                                let gradientColor = 'linear-gradient(90deg, #fdba74, #f97316)' // Naranja (Bajo rendimiento)
                                                if (qtty >= obj2 && obj2 > 0) gradientColor = 'linear-gradient(90deg, #86efac, #22c55e)' // Verde (Alto rendimiento)
                                                else if (qtty >= obj1 && obj1 > 0) gradientColor = 'linear-gradient(90deg, #fde68a, #f59e0b)' // Amarillo (Medio rendimiento)
                                                else if (qtty > 0 && obj1 === 0 && obj2 === 0) gradientColor = 'linear-gradient(90deg, #86efac, #22c55e)' // Verde Default (sin objetivos configurados)
                                                
                                                const falt1 = Math.max(0, obj1 - qtty)
                                                const falt2 = Math.max(0, obj2 - qtty)
                                                
                                                const format = (v: number) => {
                                                    if (v === 0) return '0';
                                                    if (isValueGroup || v > 100) return `${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;
                                                    return Math.round(v).toString();
                                                }
                                                const formatQtty = (v: number) => {
                                                    if (v === 0) return '0';
                                                    if (isValueGroup || v > 100) return `${v.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;
                                                    return Math.round(v).toString();
                                                }
                                                const comisionCalculada = s.groupComisions[gName] || 0;
                                                const isConsolidada = s.groupIsConsolidado[gName] ?? false;

                                                const formatImporteTramo = (val: string | null | undefined) => {
                                                    if (!val) return '-';
                                                    const s = String(val).trim();
                                                    if (s.includes('%') || s === '-') return s;
                                                    const num = parseFloat(s.replace(',', '.'));
                                                    if (!isNaN(num)) return `${num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
                                                    return s;
                                                }

                                                return (
                                                    <React.Fragment key={gName}>
                                                    <tr style={{ backgroundColor: rowBg, borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s', color: '#334155' }}>
                                                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                                            {gName}
                                                        </td>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 13, color: '#334155' }}>
                                                            {formatImporteTramo(rule.importePrimerTramo)}
                                                        </td>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 13, color: '#334155' }}>
                                                            {formatImporteTramo(rule.importeSegundoTramo)}
                                                        </td>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.05)' }}>
                                                            {formatQtty(qtty)}
                                                        </td>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
                                                            {pendingQtty > 0 ? formatQtty(pendingQtty) : '-'}
                                                        </td>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 13 }}>
                                                            {obj1 === 0 ? '-' : format(obj1)}
                                                        </td>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 13 }}>
                                                            {obj2 === 0 ? '-' : format(obj2)}
                                                        </td>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
                                                            {obj1 === 0 ? '-' : (falt1 > 0 ? <span style={{ color: '#ef4444' }}>{format(falt1)}</span> : <span style={{ color: '#10b981' }}>✓</span>)}
                                                        </td>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
                                                            {obj2 === 0 ? '-' : (falt2 > 0 ? <span style={{ color: '#ef4444' }}>{format(falt2)}</span> : <span style={{ color: '#10b981' }}>✓</span>)}
                                                        </td>
                                                        <td style={{ 
                                                            padding: '10px 12px', 
                                                            textAlign: 'right', 
                                                            fontSize: 14, 
                                                            fontWeight: 800, 
                                                            color: comisionCalculada > 0 ? (isConsolidada ? '#10b981' : '#d97706') : '#10b981',
                                                            backgroundColor: comisionCalculada > 0 ? (isConsolidada ? 'transparent' : 'rgba(245, 158, 11, 0.05)') : 'transparent'
                                                        }}>
                                                            {comisionCalculada.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                        </td>
                                                    </tr>
                                                    {idx === activeRulesForSeller.length - 1 && String(s.name).toLowerCase().includes('marta') && territorialO2Rules && territorialO2Rules.length > 0 && territorialO2Rules.map((rule: any, rIdx: number) => {
                                                        const vkMatches = s.rawExtras ? s.rawExtras.filter((vk: any) => vk.ruleId === `TERRITORIAL_${rule.id}` || vk.triggerKey?.startsWith(`TERRITORIAL_O2_${rule.id}`)) : [];
                                                        if (vkMatches.length === 0) return null;
                                                        
                                                        const vk = vkMatches[0];
                                                        const match = vk.triggerSummary ? vk.triggerSummary.match(/\((\d+)/) : null;
                                                        const totalSales = match ? parseInt(match[1], 10) : 0;
                                                        
                                                        const tm = rule.tramosMes || {};
                                                        const tt = rule.tramosTrim || {};
                                                        
                                                        const checkAchievedMes = (min: number, max: number) => totalSales >= min && totalSales <= max;
                                                        const checkAchievedTrim = (min: number, max: number) => totalSales >= min && totalSales <= max;
                                                        
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

                                                        const renderCell = (val: string, isAchieved: boolean) => {
                                                            if (!val) val = '-';
                                                            return (
                                                                <div style={{
                                                                    padding: '4px 8px',
                                                                    borderRadius: '4px',
                                                                    backgroundColor: isAchieved ? '#dcfce7' : '#f8fafc',
                                                                    border: `1px solid ${isAchieved ? '#22c55e' : '#e2e8f0'}`,
                                                                    color: isAchieved ? '#166534' : '#334155',
                                                                    fontWeight: isAchieved ? 800 : 500,
                                                                    display: 'inline-block',
                                                                    minWidth: '50px'
                                                                }}>
                                                                    {val}
                                                                </div>
                                                            );
                                                        };

                                                        return (
                                                            <tr key={`terr-${rIdx}`} style={{ backgroundColor: '#ffffff' }}>
                                                                <td colSpan={10} style={{ padding: '0 0 16px 0' }}>
                                                                    <div style={{ margin: '0', border: '1px solid #38bdf8', borderRadius: '0' }}>
                                                                        <div style={{ backgroundColor: '#38bdf8', color: 'white', padding: '8px 16px', fontWeight: 800, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                            TERRITORIAL O2 MOVILFREE
                                                                        </div>
                                                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                            <thead>
                                                                                <tr style={{ backgroundColor: '#0284c7', color: 'white', fontSize: '12px', fontWeight: 700 }}>
                                                                                    {TRAMOS_MES.map(t => <th key={t.key} style={{ padding: '10px 4px', textAlign: 'center', width: '9%' }}>{t.label}</th>)}
                                                                                    {TRAMOS_TRIM.map(t => <th key={t.key} style={{ padding: '10px 4px', textAlign: 'center', width: '9%' }}>{t.label}</th>)}
                                                                                    <th style={{ padding: '10px 4px', textAlign: 'center', width: '9%' }}>Conect.</th>
                                                                                    <th style={{ padding: '10px 4px', textAlign: 'center', width: '19%' }}>VENTAS TOTAL O2</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                                                                                    {TRAMOS_MES.map(t => (
                                                                                        <td key={t.key} style={{ padding: '12px 4px', textAlign: 'center', fontSize: '14px' }}>
                                                                                            {renderCell(tm[t.key], checkAchievedMes(t.min, t.max))}
                                                                                        </td>
                                                                                    ))}
                                                                                    {TRAMOS_TRIM.map(t => (
                                                                                        <td key={t.key} style={{ padding: '12px 4px', textAlign: 'center', fontSize: '14px' }}>
                                                                                            {renderCell(tt[t.key], checkAchievedTrim(t.min, t.max))}
                                                                                        </td>
                                                                                    ))}
                                                                                    <td style={{ padding: '12px 4px', textAlign: 'center', fontSize: '14px' }}>
                                                                                        {renderCell(rule.conectividad, totalSales > 0 && !!rule.conectividad)}
                                                                                    </td>
                                                                                    <td style={{ padding: '12px 4px', textAlign: 'center', fontSize: '16px', fontWeight: 800, color: '#0284c7' }}>
                                                                                        <span style={{ borderBottom: '2px solid #0284c7', paddingBottom: '2px' }}>{totalSales}</span>
                                                                                    </td>
                                                                                </tr>
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    </React.Fragment>
                                                )
                                            }) : <tr><td colSpan={10} style={{padding: 20, textAlign: 'center', color: '#64748b'}}>No hay reglas de comisión configuradas para este mes.</td></tr>
                                            })()}
                                            {s.extraGroups && s.extraGroups.length > 0 && s.extraGroups.filter((eg: any) => !String(eg.name).includes('TERRITORIAL O2 MOVILFREE')).map((eg: any, idx: number) => {
                                                const safeName = eg.name || 'Bono Extra';
                                                return (
                                                <tr key={`extra-${idx}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ecfdf5', transition: 'background 0.2s', color: '#065f46' }}>
                                                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Trophy size={14} color="#10b981" /> {safeName}
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#10b981' }}>
                                                        {eg.count}
                                                    </td>
                                                    <td colSpan={7} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 13, color: '#a7f3d0' }}>
                                                        N/A
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: '#10b981' }}>
                                                        {Math.round(eg.totalAmount).toLocaleString('es-ES')} €
                                                    </td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                    </div>
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
                                                    <th style={{ padding: '12px 16px' }}>Tipo de Venta</th>
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
                                                            <td style={{ padding: '12px 16px', color: 'var(--light-text)' }}>{venta.categoria || venta.detalle || venta.sheet || '-'}</td>
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
