'use client'

import React from 'react';
import { useAuditMode } from '@/hooks/useAuditMode';
import { X, ArrowRight, Database, Settings, BarChart2 } from 'lucide-react';

export function AuditDrawer() {
    const { selectedMetric, selectedMetricData, selectMetric } = useAuditMode();

    if (!selectedMetric) return null;

    const getNodeIcon = (type: string) => {
        if (type === 'source') return <Database size={16} color="#3b82f6" />;
        if (type === 'process') return <Settings size={16} color="#8b5cf6" />;
        return <BarChart2 size={16} color="#10b981" />;
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, right: 0, bottom: 0,
            width: 400,
            backgroundColor: '#ffffff',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            borderLeft: '1px solid #e2e8f0'
        }}>
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .audit-node {
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    background: #f8fafc;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
            `}} />
            
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1 }}>Trazabilidad de Dato</span>
                    <h2 style={{ margin: '4px 0 0 0', fontSize: 18, color: '#0f172a', fontWeight: 800 }}>{selectedMetric.title}</h2>
                </div>
                <button 
                    onClick={() => selectMetric(null)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                    <X size={24} />
                </button>
            </div>

            {/* Content */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                <div>
                    <h3 style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, marginTop: 0 }}>Descripción</h3>
                    <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.5 }}>{selectedMetric.description}</p>
                </div>

                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px dashed #3b82f6', padding: 16, borderRadius: 8 }}>
                    <h3 style={{ fontSize: 13, color: '#3b82f6', textTransform: 'uppercase', marginBottom: 8, marginTop: 0 }}>Fórmula Lógica</h3>
                    <code style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, fontFamily: 'monospace' }}>{selectedMetric.formula}</code>
                </div>

                {/* Orígenes */}
                <div>
                    <h3 style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', marginBottom: 12, marginTop: 0 }}>Orígenes de Datos</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selectedMetric.sources.map(s => (
                            <div key={s.id} className="audit-node">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                                    {getNodeIcon(s.type)} {s.label}
                                </div>
                                {s.description && <div style={{ fontSize: 12, color: '#64748b', paddingLeft: 24 }}>{s.description}</div>}
                                
                                {s.id === 's1' && selectedMetricData?.sales && selectedMetricData.sales.length > 0 && (
                                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #cbd5e1' }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Desglose de Operaciones ({selectedMetricData.sales.length})</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 250, overflowY: 'auto', paddingRight: 4 }}>
                                            {selectedMetricData.sales.map((sale: any, idx: number) => {
                                                const val = sale.categoria === 'seguro' && sale.seguroImporte ? sale.seguroImporte : (sale.cuota || sale.importe || 0);
                                                return (
                                                    <div key={idx} style={{ padding: '6px 8px', backgroundColor: '#ffffff', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ color: '#334155', fontWeight: 600 }}>{sale.producto || sale.detalle || sale.categoria}</span>
                                                            <span style={{ color: '#94a3b8', fontSize: 10 }}>{sale.fecha || sale.createdAt?.split('T')[0]}</span>
                                                        </div>
                                                        <span style={{ color: '#3b82f6', fontWeight: 700 }}>{Number(val).toFixed(2)}€</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <ArrowRight size={24} color="#cbd5e1" style={{ transform: 'rotate(90deg)' }} />
                </div>

                {/* Destinos */}
                <div>
                    <h3 style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', marginBottom: 12, marginTop: 0 }}>Dependencias (A dónde va)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selectedMetric.destinations.map(d => (
                            <div key={d.id} className="audit-node">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                                    {getNodeIcon(d.type)} {d.label}
                                </div>
                                {d.description && <div style={{ fontSize: 12, color: '#64748b', paddingLeft: 24 }}>{d.description}</div>}
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
