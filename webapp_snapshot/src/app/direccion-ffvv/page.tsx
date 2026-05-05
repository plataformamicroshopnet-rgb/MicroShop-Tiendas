'use client'

import React from 'react'
import Link from 'next/link'
import { Building2, Trophy, Target, AlertTriangle, AlertCircle, CheckCircle, Compass, Euro, TrendingUp } from 'lucide-react'
import { useComisionesData } from '@/hooks/useComisionesData'
import { ALL_GROUPS } from '@/lib/comisiones'
import { useGuard } from '@/hooks/useGuard'
import { PeriodSelector } from '@/components/PeriodSelector'

export default function DireccionFFVVPage() {
    const { authorized } = useGuard('MODULE_DIRECCION')
    const {
        loading,
        sellerStats,
        teamTotalComisiones,
        teamTotalSales,
        maxSalesSeller
    } = useComisionesData()

    if (authorized === null) {
        return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>;
    }

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--light-text)' }}>Cargando Dirección Comercial...</div>

    // Lógica Global de Grupos
    const globalGroups: Record<string, any> = {}
    
    let sumCumplido = 0;
    let sumObjetivoGlobal = 0;

    ALL_GROUPS.forEach(gName => {
        let globalObj1 = 0;
        let globalVentas = 0;
        let globalComision = 0;
        
        sellerStats.forEach(s => {
            globalObj1 += s.groupObj1[gName] || 0;
            globalVentas += s.groupCounts[gName] || 0;
            globalComision += s.groupComisions[gName] || 0;
        });

        const isValue = ['TMA', 'TI', 'MIC'].includes(gName);
        let pct = globalObj1 > 0 ? (globalVentas / globalObj1) * 100 : (globalVentas > 0 ? 100 : 0);
        
        globalGroups[gName] = {
            name: gName,
            ventas: globalVentas,
            obj1: globalObj1,
            comision: globalComision,
            pct: Math.min(100, pct),
            isValue
        }
        
        if (!isValue) {
            sumCumplido += globalVentas;
            sumObjetivoGlobal += globalObj1;
        }
    })

    const globalPercent = sumObjetivoGlobal > 0 ? (sumCumplido / sumObjetivoGlobal) * 100 : 0;
    
    // Top Grupo & Risk Group
    const groupsArray = Object.values(globalGroups).filter(g => !g.isValue && g.obj1 > 0);
    groupsArray.sort((a,b) => b.pct - a.pct);
    const topGroup = groupsArray.length > 0 ? groupsArray[0].name : '-';
    // The lowest percentage group:
    groupsArray.sort((a,b) => a.pct - b.pct);
    let riskGroup = '-';
    if (groupsArray.length > 0 && groupsArray[0].pct < 50) {
        riskGroup = groupsArray[0].name;
    }

    // Alertas
    const cercaOblig: string[] = []
    const lejosOblig: string[] = []
    const sinActividad: string[] = []
    const superados: string[] = []

    sellerStats.forEach(s => {
        if (s.totalSales === 0) {
            sinActividad.push(s.name)
        } else {
             let sVentas = 0; let sObj = 0;
             ALL_GROUPS.forEach(g => {
                 if (!['TMA', 'TI', 'MIC'].includes(g)) {
                     sVentas += s.groupCounts[g] || 0;
                     sObj += s.groupObj1[g] || 0;
                 }
             })
             const sPct = sObj > 0 ? (sVentas / sObj) * 100 : 0;
             
             if (sPct >= 100) superados.push(s.name)
             else if (sPct >= 80) cercaOblig.push(s.name)
             else if (sPct < 50 && sVentas > 0) lejosOblig.push(s.name)
        }
    });

    const getGradient = (pct: number) => {
        if (pct < 50) return 'linear-gradient(90deg, #fdba74, #f97316)'
        if (pct < 100) return 'linear-gradient(90deg, #fde68a, #f59e0b)'
        return 'linear-gradient(90deg, #86efac, #22c55e)'
    }

    const formatV = (v: number, isV: boolean) => isV ? `${v.toFixed(2)} €` : v

    return (
        <div style={{ padding: 30, maxWidth: 1750, margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                    <Building2 className="mercedes-text" size={32} color="#A855F7" />
                    Dirección Comercial
                </h1>
                <PeriodSelector />
            </header>

            {/* Fila 1: KPIs Ejecutivos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 32 }}>
                <div className="card" style={{ padding: 20, borderLeft: '4px solid #34d399', backgroundColor: 'rgba(52, 211, 153, 0.05)' }}>
                    <div style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase' }}>Comisiones</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#34d399' }}>{teamTotalComisiones.toFixed(2)}€</div>
                </div>
                <div className="card" style={{ padding: 20, borderLeft: '4px solid var(--mercedes-cyan)', backgroundColor: 'rgba(0, 173, 239, 0.05)' }}>
                    <div style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase' }}>Operaciones</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#1f2937' }}>{teamTotalSales}</div>
                </div>
                <div className="card" style={{ padding: 20, borderLeft: '4px solid #A855F7', backgroundColor: 'rgba(168, 85, 247, 0.05)' }}>
                    <div style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase' }}>Cumplimiento</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: '#1f2937' }}>{globalPercent.toFixed(1)}</span>
                        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>%</span>
                    </div>
                </div>
                <div className="card" style={{ padding: 20, borderLeft: '4px solid #FFD700', backgroundColor: 'rgba(255, 215, 0, 0.05)' }}>
                    <div style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase' }}>Top Comercial</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#FFD700', overflow: 'hidden', whiteSpace: 'nowrap' }}>{maxSalesSeller?.name || '-'}</div>
                </div>
                <div className="card" style={{ padding: 20, borderLeft: '4px solid #34C759', backgroundColor: 'rgba(52, 199, 89, 0.05)' }}>
                    <div style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase' }}>Grupo Top</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#34C759' }}>{topGroup}</div>
                </div>
                <div className="card" style={{ padding: 20, borderLeft: '4px solid #FF453A', backgroundColor: 'rgba(255, 69, 58, 0.05)' }}>
                    <div style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase' }}>Grupo Riesgo</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#FF453A' }}>{riskGroup}</div>
                </div>
            </div>

            {/* Fila 2: Ranking del equipo */}
            <div className="card" style={{ padding: 24, marginBottom: 32 }}>
                <h2 style={{ fontSize: 18, color: 'var(--light-text)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={20} color="var(--mercedes-cyan)" /> Ranking Comercial
                </h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                        <tr style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--medium-gray)', textTransform: 'uppercase', fontSize: 11 }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left' }}>Comercial</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ventas</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Cumplimiento</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Comisión</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...sellerStats].sort((a,b) => b.totalComision - a.totalComision).map(s => {
                            let sVentas = 0; let sObj = 0;
                            ALL_GROUPS.forEach(g => {
                                if (!['TMA', 'TI', 'MIC'].includes(g)) {
                                    sVentas += s.groupCounts[g] || 0;
                                    sObj += s.groupObj1[g] || 0;
                                }
                            })
                            const pct = sObj > 0 ? (sVentas / sObj) * 100 : (sVentas > 0 ? 100 : 0);
                            
                            let estado = 'Peligro'
                            let colorE = '#FF453A'
                            if (pct >= 100) { estado = 'Excelente'; colorE = '#34d399' }
                            else if (pct >= 75) { estado = 'Buen Ritmo'; colorE = '#FFD700' }
                            else if (s.totalSales === 0) { estado = 'Inactivo'; colorE = 'var(--medium-gray)' }

                            return (
                                <tr key={s.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.2px' }}>{s.name} <span style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(0,0,0,0.05)', color: 'var(--medium-gray)', borderRadius: 4, marginLeft: 8 }}>{s.profile}</span></td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800 }}>{s.totalSales}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                                            <div style={{ width: 80, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                                                <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: getGradient(pct), borderRadius: 3 }} />
                                            </div>
                                            <span style={{ fontSize: 12 }}>{pct.toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#34d399' }}>{s.totalComision.toFixed(2)} €</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center', color: colorE, fontWeight: 700, fontSize: 13 }}>{estado}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Fila 3: Mapa de grupos */}
            <h2 style={{ fontSize: 18, color: 'var(--light-text)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Compass size={20} color="#FF9500" /> Mapa de Grupos (Global)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
                {Object.values(globalGroups).map((g: any) => (
                    <div key={g.name} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1d4ed8' }}>{g.name}</h3>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#34d399' }}>{g.comision.toFixed(2)} €</div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--medium-gray)', fontSize: 13 }}>
                            <span>Ventas: <strong style={{ color: '#1d4ed8' }}>{formatV(g.ventas, g.isValue)}</strong></span>
                            <span>Objetivo: <strong style={{ color: '#1d4ed8' }}>{formatV(g.obj1, g.isValue)}</strong></span>
                        </div>

                        <div style={{ height: 8, background: 'rgba(0,0,0,0.05)', borderRadius: 4, width: '100%', overflow: 'hidden' }}>
                            <div style={{ width: `${g.pct}%`, height: '100%', background: getGradient(g.pct), transition: 'width 0.5s' }} />
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--medium-gray)' }}>{g.pct.toFixed(1)}% Alcanzado</div>
                    </div>
                ))}
            </div>

            {/* Fila 4: Alertas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div className="card" style={{ padding: 20, borderTop: '4px solid #34d399', background: 'rgba(52, 211, 153, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34d399', fontWeight: 700, marginBottom: 12 }}>
                        <CheckCircle size={18} /> Supereficaces
                    </div>
                    {superados.length > 0 ? superados.map(n => <div key={n} style={{ color: '#374151', fontSize: 14, fontWeight: 600, padding: '4px 0' }}>{n}</div>) : <div style={{ color: 'var(--medium-gray)', fontSize: 13 }}>Ninguno aún</div>}
                </div>

                <div className="card" style={{ padding: 20, borderTop: '4px solid #FFD700', background: 'rgba(255, 215, 0, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FFD700', fontWeight: 700, marginBottom: 12 }}>
                        <TrendingUp size={18} /> Cerca de Objetivos
                    </div>
                    {cercaOblig.length > 0 ? cercaOblig.map(n => <div key={n} style={{ color: '#374151', fontSize: 14, fontWeight: 600, padding: '4px 0' }}>{n}</div>) : <div style={{ color: 'var(--medium-gray)', fontSize: 13 }}>Ninguno</div>}
                </div>

                <div className="card" style={{ padding: 20, borderTop: '4px solid #FF9500', background: 'rgba(255, 149, 0, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FF9500', fontWeight: 700, marginBottom: 12 }}>
                        <AlertTriangle size={18} /> Lejos de Objetivos
                    </div>
                    {lejosOblig.length > 0 ? lejosOblig.map(n => <div key={n} style={{ color: '#374151', fontSize: 14, fontWeight: 600, padding: '4px 0' }}>{n}</div>) : <div style={{ color: 'var(--medium-gray)', fontSize: 13 }}>Ninguno</div>}
                </div>

                <div className="card" style={{ padding: 20, borderTop: '4px solid #FF453A', background: 'rgba(255, 69, 58, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FF453A', fontWeight: 700, marginBottom: 12 }}>
                        <AlertCircle size={18} /> Sin Actividad
                    </div>
                    {sinActividad.length > 0 ? sinActividad.map(n => <div key={n} style={{ color: '#374151', fontSize: 14, fontWeight: 600, padding: '4px 0' }}>{n}</div>) : <div style={{ color: 'var(--medium-gray)', fontSize: 13 }}>Todos activos</div>}
                </div>
            </div>

        </div>
    )
}
