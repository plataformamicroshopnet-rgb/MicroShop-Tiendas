'use client'

import React, { useState } from 'react';
import { useGuard } from '@/hooks/useGuard';
import { useComisionesData } from '@/hooks/useComisionesData';
import { PageHeader } from '@/components/PageHeader';
import { Trophy, TrendingUp, DollarSign, Users, Award, ShieldAlert, Star } from 'lucide-react';

export default function ComisionesEquipoPage() {
    const { authorized } = useGuard('MODULE_JEFE_TIENDAS');
    const { loading, sellerStats, teamTotalComisiones, teamTotalSales, tiendaRules } = useComisionesData();
    const [sortKey, setSortKey] = useState<'totalComision' | 'totalSales' | 'name'>('totalComision');
    const [viewMode, setViewMode] = useState<'comerciales' | 'comisiones'>('comerciales');

    if (authorized === null) return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales...</div>;
    if (loading) return <div style={{ padding: 40, color: 'var(--light-text)' }}>Cargando inteligencia de comisiones...</div>;

    const sortedStats = [...sellerStats].sort((a, b) => {
        if (sortKey === 'name') return a.name.localeCompare(b.name);
        return b[sortKey] - a[sortKey]; // default desc for numbers
    });

    const ruleStats = tiendaRules.map(rule => {
        const rName = rule.nombre;
        let totalVentas = 0;
        let totalComision = 0;
        sellerStats.forEach(s => {
            totalVentas += (s.groupCounts[rName] || 0);
            totalComision += (s.groupComisions[rName] || 0);
        });
        return { name: rName, totalVentas, totalComision, isExtra: false };
    });

    const extrasAgg = new Map<string, { totalVentas: number, totalComision: number }>();
    sellerStats.forEach(s => {
        s.extraGroups.forEach(eg => {
            if (!extrasAgg.has(eg.name)) extrasAgg.set(eg.name, { totalVentas: 0, totalComision: 0 });
            const agg = extrasAgg.get(eg.name)!;
            agg.totalVentas += eg.count;
            agg.totalComision += eg.totalAmount;
        });
    });

    const extrasStats = Array.from(extrasAgg.entries()).map(([name, data]) => ({
        name,
        totalVentas: data.totalVentas,
        totalComision: data.totalComision,
        isExtra: true
    }));

    const combinedRuleStats = [...ruleStats, ...extrasStats].filter(r => r.totalVentas > 0 || r.totalComision > 0).sort((a, b) => b.totalComision - a.totalComision);


    return (
        <div style={{ padding: '24px 32px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
            <PageHeader 
                title={<><Trophy color="#a855f7" size={28} /> Comisiones de Todo el Equipo</>}
                subtitle="Clasificación general y rendimiento económico unificado."
                showBack={true}
                backFallback="/seguimiento-ventas"
            />

            {/* KPIs Globales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', margin: '32px 0' }}>
                <div className="card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)', border: '1px solid rgba(168, 85, 247, 0.3)', borderLeft: '4px solid #a855f7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{ background: 'rgba(168, 85, 247, 0.2)', padding: 10, borderRadius: 12 }}><DollarSign color="#a855f7" size={24} /></div>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Inversión Total Comisiones</div>
                    </div>
                    <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--text-main)' }}>
                        {teamTotalComisiones.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ color: '#a855f7', fontSize: 24 }}>€</span>
                    </div>
                </div>

                <div className="card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(52, 211, 153, 0.05) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)', borderLeft: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: 10, borderRadius: 12 }}><TrendingUp color="#10b981" size={24} /></div>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Volumen de Ventas Equipo</div>
                    </div>
                    <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--text-main)' }}>
                        {teamTotalSales.toLocaleString('es-ES')} <span style={{ color: '#10b981', fontSize: 24 }}>operaciones</span>
                    </div>
                </div>
            </div>

            {/* Premium Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-strong)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                    <h2 style={{ fontSize: 20, margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-main)' }}>
                        <Users size={20} color="#3b82f6" /> Ranking Comercial
                    </h2>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 12 }}>
                            <button onClick={() => setViewMode('comerciales')} style={{ background: viewMode === 'comerciales' ? '#3b82f6' : 'transparent', color: viewMode === 'comerciales' ? '#fff' : 'var(--text-muted)', padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, border: 'none', transition: 'all 0.2s' }}>Por Comercial</button>
                            <button onClick={() => setViewMode('comisiones')} style={{ background: viewMode === 'comisiones' ? '#a855f7' : 'transparent', color: viewMode === 'comisiones' ? '#fff' : 'var(--text-muted)', padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, border: 'none', transition: 'all 0.2s' }}>Por Nombre Comisión</button>
                        </div>
                        {viewMode === 'comerciales' && (
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button onClick={() => setSortKey('totalComision')} style={{ background: sortKey === 'totalComision' ? 'rgba(168, 85, 247, 0.2)' : 'transparent', border: `1px solid ${sortKey === 'totalComision' ? '#a855f7' : 'var(--border-strong)'}`, color: sortKey === 'totalComision' ? '#a855f7' : 'var(--text-muted)', padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>Por Comisión</button>
                                <button onClick={() => setSortKey('totalSales')} style={{ background: sortKey === 'totalSales' ? 'rgba(16, 185, 129, 0.2)' : 'transparent', border: `1px solid ${sortKey === 'totalSales' ? '#10b981' : 'var(--border-strong)'}`, color: sortKey === 'totalSales' ? '#10b981' : 'var(--text-muted)', padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>Por Ventas</button>
                            </div>
                        )}
                    </div>
                </div>
                
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: viewMode === 'comerciales' ? 900 : 600 }}>
                        {viewMode === 'comerciales' ? (
                            <>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.2)', textTransform: 'uppercase', fontSize: 12, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
                                        <th style={{ padding: '16px 24px', width: 60, textAlign: 'center' }}>Pos</th>
                                        <th style={{ padding: '16px 24px' }}>Comercial</th>
                                        <th style={{ padding: '16px 24px', textAlign: 'center' }}>Perfil</th>
                                        <th style={{ padding: '16px 24px', textAlign: 'center' }}>Ventas</th>
                                        <th style={{ padding: '16px 24px', textAlign: 'center' }}>Pdte.</th>
                                        <th style={{ padding: '16px 24px', textAlign: 'right' }}>Com. Base</th>
                                        <th style={{ padding: '16px 24px', textAlign: 'right' }}>Extras</th>
                                        <th style={{ padding: '16px 24px', textAlign: 'right' }}>Total Comisión</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedStats.map((s, index) => {
                                        const rank = index + 1;
                                        let rankBadge = <div style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: 16 }}>{rank}</div>;
                                        if (rank === 1) rankBadge = <Award size={28} color="#fbbf24" fill="rgba(251, 191, 36, 0.2)" />;
                                        else if (rank === 2) rankBadge = <Award size={26} color="#94a3b8" fill="rgba(148, 163, 184, 0.2)" />;
                                        else if (rank === 3) rankBadge = <Award size={24} color="#b45309" fill="rgba(180, 83, 9, 0.2)" />;

                                        const baseCom = s.totalComision - s.totalExtras;

                                        return (
                                            <tr key={s.name} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '16px 24px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                    {rankBadge}
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: s.isPlus ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                                                            {s.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>{s.name}</div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                    <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: s.isPlus ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: s.isPlus ? '#60a5fa' : '#fbbf24', border: `1px solid ${s.isPlus ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'}` }}>
                                                        {s.profile}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>{s.totalSales}</div>
                                                </td>
                                                <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                    {s.pendientes > 0 ? (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#f59e0b', fontWeight: 700, background: 'rgba(245, 158, 11, 0.1)', padding: '4px 12px', borderRadius: 20 }}>
                                                            <ShieldAlert size={14} /> {s.pendientes}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--border-strong)' }}>-</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                    {baseCom.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                </td>
                                                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                    {s.totalExtras > 0 ? (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#a855f7', fontWeight: 700, background: 'rgba(168, 85, 247, 0.1)', padding: '4px 10px', borderRadius: 8 }}>
                                                            <Star size={14} fill="#a855f7" /> +{s.totalExtras.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--border-strong)' }}>-</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                    <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981', textShadow: '0 0 20px rgba(16, 185, 129, 0.2)' }}>
                                                        {s.totalComision.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </>
                        ) : (
                            <>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.2)', textTransform: 'uppercase', fontSize: 12, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
                                        <th style={{ padding: '16px 24px', width: 60, textAlign: 'center' }}>Pos</th>
                                        <th style={{ padding: '16px 24px' }}>Nombre Comisión</th>
                                        <th style={{ padding: '16px 24px', textAlign: 'center' }}>Volumen (Ventas)</th>
                                        <th style={{ padding: '16px 24px', textAlign: 'right' }}>Inversión (Comisiones)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {combinedRuleStats.map((r, index) => {
                                        const rank = index + 1;
                                        let rankBadge = <div style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: 16 }}>{rank}</div>;
                                        if (rank === 1) rankBadge = <Award size={28} color="#fbbf24" fill="rgba(251, 191, 36, 0.2)" />;
                                        else if (rank === 2) rankBadge = <Award size={26} color="#94a3b8" fill="rgba(148, 163, 184, 0.2)" />;
                                        else if (rank === 3) rankBadge = <Award size={24} color="#b45309" fill="rgba(180, 83, 9, 0.2)" />;

                                        return (
                                            <tr key={r.name} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '16px 24px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                    {rankBadge}
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        {r.isExtra ? (
                                                            <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
                                                                <Star size={18} />
                                                            </div>
                                                        ) : (
                                                            <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                                                                <DollarSign size={18} />
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>{r.name}</div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>{Math.round(r.totalVentas).toLocaleString('es-ES')}</div>
                                                </td>
                                                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                    <div style={{ fontSize: 20, fontWeight: 900, color: r.isExtra ? '#a855f7' : '#10b981', textShadow: r.isExtra ? '0 0 20px rgba(168, 85, 247, 0.2)' : '0 0 20px rgba(16, 185, 129, 0.2)' }}>
                                                        {r.totalComision.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </>
                        )}
                    </table>
                </div>
                {sortedStats.length === 0 && (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>No hay datos de comisiones para mostrar en este periodo.</div>
                )}
            </div>
        </div>
    );
}
