'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { Crown, Euro, Sparkles, Target } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { useComisionesData } from '@/hooks/useComisionesData'
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts'

const formatNum = (val: number) => Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

function SimulatorContent() {
    const searchParams = useSearchParams()
    const sellerName = searchParams.get('seller')
    
    const {
        loading,
        sellerStats,
        tiendaRules
    } = useComisionesData()

    if (loading) {
        return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Cargando Simulador...</div>
    }

    const s = sellerStats.find(st => st.name === sellerName)
    if (!s) {
        return <div style={{ padding: 40, color: '#ef4444', fontWeight: 600 }}>No se encontró el comercial seleccionado.</div>
    }

    // Calcular Base Perfecta
    const baseBreakdown: any[] = [];
    let baseIdeal = 0;

    const normProfile = s.profile ? s.profile.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';

    tiendaRules.forEach(rule => {
        const ruleName = rule.nombre;
        let obj2 = s.groupObj2[ruleName] > 0 ? s.groupObj2[ruleName] : (s.groupObj1[ruleName] || 0);
        
        if (ruleName === 'FTTR' || ruleName === 'Fttr' || ruleName.includes('FTTR')) {
            obj2 = 3;
        }

        if (obj2 > 0) {
            const isPercentage = String(rule.importePrimerTramo || '').includes('%');
            
            const parseImporte = (val: any) => {
                let str = String(val || '0').replace(/[^0-9.,\-]/g, '').trim();
                str = str.replace(',', '.');
                return Number(str) || 0;
            };

            const imp1 = parseImporte(rule.importePrimerTramo);
            const imp2 = parseImporte(rule.importeSegundoTramo);
            const activeImp = imp2 > 0 ? imp2 : imp1;

            if (activeImp > 0) {
                let gImport = 0;
                if (isPercentage) {
                    gImport = obj2 * (activeImp / 100);
                } else {
                    gImport = obj2 * activeImp;
                }
                
                baseBreakdown.push({ 
                    name: ruleName, 
                    label: ruleName, 
                    obj2, 
                    amount: gImport, 
                    rate: activeImp, 
                    type: isPercentage ? 'percent' : 'fixed' 
                });
                baseIdeal += gImport;
            }
        }
    });

    const godModeTotal = baseIdeal;

    const combinedElements = [
        ...baseBreakdown.map(b => ({ name: b.label || b.name, amount: b.amount, isExtra: false }))
    ];
    
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

    return (
        <div style={{ padding: '0 20px 40px 20px', animation: 'fadeIn 0.4s ease-out' }}>
            <PageHeader 
                title={<><Crown size={28} color="#A855F7" /> Simulador Mes Perfecto</>}
                showBack={true}
                helpContent={
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', color: '#A855F7', fontSize: 15 }}>Simulador Aspiracional</h4>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>Muestra el potencial máximo de ganancias ("Modo Dios") asumiendo que el comercial alcanza el 100% de su Objetivo 2 en todas las métricas.</p>
                  </div>
                }
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '32px', marginTop: '16px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'transparent', background: 'linear-gradient(90deg, #A855F7, #D946EF)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>{s.name}</h2>
                    <span style={{ fontSize: '15px', color: 'var(--medium-gray)', fontWeight: 600 }}>
                        Desglose al 100% de Objetivo 2
                    </span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '32px' }}>
                
                {/* MATRIZ DE TABLA BASE */}
                <div style={{ backgroundColor: '#ffffff', padding: '0', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <h3 style={{ fontSize: 16, backgroundColor: '#0078D4', padding: '16px 24px', margin: '0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                        <Euro size={18} color="#ffffff" /> Importe potencial del mes por Comisión
                    </h3>
                    <div style={{ padding: '24px' }}>
                        {/* CABECERA DE COLUMNAS */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px 12px 16px', borderBottom: '2px solid #e2e8f0', marginBottom: 12 }}>
                            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', width: 180 }}>Nombre Comisión</span>
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', width: 40, textAlign: 'center' }}>Tramo</span>
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', width: 60, textAlign: 'center' }}>Obj.</span>
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', width: 80, textAlign: 'center' }}>Importe</span>
                            </div>
                            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Comisión</span>
                        </div>

                    {baseBreakdown.map(g => (
                        <div key={g.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 8, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor='#eff6ff'} onMouseLeave={e => e.currentTarget.style.backgroundColor='#f8fafc'}>
                            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                                <span style={{ fontWeight: 800, color: '#0078D4', width: 180, fontSize: 15 }}>{g.label || g.name}</span> 
                                <span style={{ fontSize: 14, color: '#64748b', fontWeight: 500, width: 40, textAlign: 'center' }}>
                                    Obj2:
                                </span>
                                <strong style={{ fontSize: 14, color: '#1e293b', fontWeight: 800, width: 60, textAlign: 'center' }}>
                                    {formatNum(g.obj2)}{g.name.toUpperCase().includes('RENT') || g.name.toUpperCase().includes('ARPU') || g.name.toUpperCase().includes('ARPO') ? '€' : ''}
                                </strong>
                                <span style={{ fontSize: 14, color: '#475569', fontWeight: 500, width: 80, textAlign: 'center' }}>
                                    {g.type === 'percent' ? `${g.rate}%` : `${g.rate}€`}
                                </span>
                            </div>
                            <div style={{ fontWeight: 800, color: '#059669', fontSize: 16 }}>+{formatNum(g.amount)} €</div>
                        </div>
                    ))}
                    </div>
                </div>

                {/* CAJA DERECHA: TOTAL Y ESTADÍSTICAS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ 
                        background: 'linear-gradient(135deg, #0078D4 0%, #005A9E 100%)', 
                        border: '1px solid #005A9E', 
                        borderRadius: '16px', padding: '32px', textAlign: 'center',
                        boxShadow: '0 10px 25px rgba(0, 120, 212, 0.3)'
                    }}>
                        <div style={{ fontSize: 14, color: '#e0f2fe', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Importe potencial del mes</div>
                        <div style={{ fontSize: 56, fontWeight: 900, color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.1)', lineHeight: 1 }}>
                            {formatNum(godModeTotal)} <span style={{fontSize: 28, color: '#bae6fd'}}>€</span>
                        </div>
                        <p style={{ margin: '20px 0 0 0', fontSize: 13, color: '#bae6fd' }}>
                            Suma de la potencia base proyectada.
                        </p>
                    </div>

                    {/* GRÁFICA: TODAS LAS PALANCAS */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <h4 style={{ margin: '0 0 20px 0', fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                            <Target size={14} color="#0078D4" /> Top Palancas (Peso %)
                        </h4>
                        <div style={{ flex: 1, minHeight: 350 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barchartData} layout="vertical" margin={{ top: 0, right: 30, left: -10, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} width={160} />
                                    <RechartsTooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} formatter={(value: any) => [`${Number(value).toLocaleString('es-ES')} €`, 'Inyección']} contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#1e293b' }} itemStyle={{ color: '#0078D4' }} />
                                    <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={16}>
                                        {barchartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function SimuladorPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, color: 'var(--mercedes-cyan)' }}>Cargando...</div>}>
            <SimulatorContent />
        </Suspense>
    )
}
