'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Trophy, Target, Euro, Calendar, Settings2, XCircle, Save, User, ArrowLeft, Info, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useComisionesData } from '@/hooks/useComisionesData'
import { useGuard } from '@/hooks/useGuard'
import { useRouter } from 'next/navigation'
import { normalizeRole } from '@/lib/appConfig'

export default function ComisionesJefePage() {
    const router = useRouter()
    const { authorized, user } = useGuard('MODULE_JEFE_TIENDAS')
    const { loading, sellerStats } = useComisionesData()
    const isAdmin = user && ['ADMIN', 'JEFE DE TIENDAS', 'JEFE DE VENTAS'].includes(normalizeRole(user.role))

    const [dispPct1, setDispPct1] = useState<number>(0)
    const [dispPct2, setDispPct2] = useState<number>(0)
    const [arpuPct1, setArpuPct1] = useState<number>(0)
    const [arpuPct2, setArpuPct2] = useState<number>(0)
    
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    
    const [tempDispPct1, setTempDispPct1] = useState<string>('0')
    const [tempDispPct2, setTempDispPct2] = useState<string>('0')
    const [tempArpuPct1, setTempArpuPct1] = useState<string>('0')
    const [tempArpuPct2, setTempArpuPct2] = useState<string>('0')
    
    const [savingSettings, setSavingSettings] = useState(false)

    useEffect(() => {
        Promise.all([
            fetch('/api/settings?key=COMISION_JEFE_DISP_PCT1').then(res => res.json()),
            fetch('/api/settings?key=COMISION_JEFE_DISP_PCT2').then(res => res.json()),
            fetch('/api/settings?key=COMISION_JEFE_ARPU_PCT1').then(res => res.json()),
            fetch('/api/settings?key=COMISION_JEFE_ARPU_PCT2').then(res => res.json())
        ]).then(([disp1, disp2, arpu1, arpu2]) => {
            if (disp1.success && disp1.value !== null) { setDispPct1(Number(disp1.value)); setTempDispPct1(disp1.value); }
            if (disp2.success && disp2.value !== null) { setDispPct2(Number(disp2.value)); setTempDispPct2(disp2.value); }
            if (arpu1.success && arpu1.value !== null) { setArpuPct1(Number(arpu1.value)); setTempArpuPct1(arpu1.value); }
            if (arpu2.success && arpu2.value !== null) { setArpuPct2(Number(arpu2.value)); setTempArpuPct2(arpu2.value); }
        }).catch(err => console.error("Error loading settings", err))
    }, [])

    const handleSaveSettings = async () => {
        setSavingSettings(true)
        try {
            await Promise.all([
                fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'COMISION_JEFE_DISP_PCT1', value: tempDispPct1 }) }),
                fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'COMISION_JEFE_DISP_PCT2', value: tempDispPct2 }) }),
                fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'COMISION_JEFE_ARPU_PCT1', value: tempArpuPct1 }) }),
                fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'COMISION_JEFE_ARPU_PCT2', value: tempArpuPct2 }) })
            ])
            setDispPct1(Number(tempDispPct1))
            setDispPct2(Number(tempDispPct2))
            setArpuPct1(Number(tempArpuPct1))
            setArpuPct2(Number(tempArpuPct2))
            setIsSettingsOpen(false)
        } catch (error) {
            console.error("Error saving:", error)
            alert("Error al guardar ajustes")
        }
        setSavingSettings(false)
    }

    const { comsTable, totalJefe } = useMemo(() => {
        if (!sellerStats || sellerStats.length === 0) {
            return { comsTable: [], totalJefe: 0 }
        }

        let granTotal = 0

        const coms = sellerStats.map(s => {
            // Find rule keys
            let dispKey = Object.keys(s.groupCounts).find(k => k.toLowerCase().includes('dispositivo'));
            let arpuKey = Object.keys(s.groupCounts).find(k => k.toLowerCase() === 'arpu');

            const dispCount = dispKey ? (s.groupCounts[dispKey] || 0) : 0;
            const dispObj1 = dispKey ? (s.groupObj1[dispKey] || 0) : 0;
            const dispObj2 = dispKey ? (s.groupObj2[dispKey] || 0) : 0;

            const arpuCount = arpuKey ? (s.groupCounts[arpuKey] || 0) : 0;
            const arpuObj1 = arpuKey ? (s.groupObj1[arpuKey] || 0) : 0;
            const arpuObj2 = arpuKey ? (s.groupObj2[arpuKey] || 0) : 0;

            let dispComision = 0;
            if (dispObj2 > 0 && dispCount >= dispObj2) {
                dispComision = dispCount * (dispPct2 / 100);
            } else if (dispObj1 > 0 && dispCount >= dispObj1) {
                dispComision = dispCount * (dispPct1 / 100);
            } else {
                dispComision = dispCount * (dispPct1 / 100); // Si no hay obj o no llega, usa el base (obj1)? Wait, they usually apply percent to everything?
                // El usuario dijo "y pueda poner el porcentaje que quiero darle en cada objetivo". 
                // Asumimos: Si llega a obj2 usa obj2_%, si llega a obj1 usa obj1_%, sino 0?
                // Vamos a pagar siempre usando Obj 1% si no llega a Obj 2, al igual que en las comisiones normales.
                // Wait, if they don't reach Obj1, they might earn 0. Let's do:
                // if >= obj2 -> pct2, else if >= obj1 -> pct1, else 0.
            }
            // Actually, to be safe, if they just want to give a percentage, I will apply pct2 if reached, else pct1.
            // Si el objetivo es 0, siempre se cuenta.
            if (dispCount >= dispObj2 && dispObj2 > 0) dispComision = dispCount * (dispPct2 / 100);
            else if (dispCount >= dispObj1 && dispObj1 > 0) dispComision = dispCount * (dispPct1 / 100);
            else if (dispObj1 === 0) dispComision = dispCount * (dispPct1 / 100);
            else dispComision = 0; // Si no llega a obj1, no cobra esa parte (se puede cambiar)

            let arpuComision = 0;
            if (arpuCount >= arpuObj2 && arpuObj2 > 0) arpuComision = arpuCount * (arpuPct2 / 100);
            else if (arpuCount >= arpuObj1 && arpuObj1 > 0) arpuComision = arpuCount * (arpuPct1 / 100);
            else if (arpuObj1 === 0) arpuComision = arpuCount * (arpuPct1 / 100);
            else arpuComision = 0;

            const total = dispComision + arpuComision;
            granTotal += total;

            return {
                name: s.name,
                dispCount, dispObj1, dispObj2, dispComision,
                arpuCount, arpuObj1, arpuObj2, arpuComision,
                total
            }
        })

        coms.sort((a, b) => b.total - a.total)

        return { comsTable: coms, totalJefe: granTotal }
    }, [sellerStats, dispPct1, dispPct2, arpuPct1, arpuPct2])

    if (authorized === null) {
        return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>;
    }

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--light-text)' }}>Cargando datos de comisiones...</div>
    }

    return (
        <div style={{ padding: 20 }}>
            <PageHeader 
                title={<><Trophy size={28} color="#ef4444" /> Comisiones del Jefe Tiendas</>}
                showBack={true}
                helpContent={
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', color: '#ef4444', fontSize: 15 }}>Cálculo de Comisiones Jefe Tiendas</h4>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>
                        Se suman las ventas de Dispositivos + Seguros y ARPU de cada comercial. Dependiendo de si llegan al Objetivo 1 o al Objetivo 2 (FALTA 2), se aplica el porcentaje configurado para el jefe sobre la facturación de cada comercial.
                    </p>
                  </div>
                }
                headerActions={
                    isAdmin ? (
                        <button 
                            onClick={() => setIsSettingsOpen(true)}
                            title="Ajustes de Jefe"
                            style={{ 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                width: 40, height: 40, borderRadius: '50%', background: 'transparent', 
                                border: '1px solid var(--border-strong)', color: 'var(--text-muted)', 
                                cursor: 'pointer', transition: 'all 0.2s' 
                            }} 
                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} 
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                            <Settings2 size={20} />
                        </button>
                    ) : null
                }
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 32 }}>
                
                {/* Gran Total */}
                <div style={{ 
                    backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #ef4444', 
                    boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.1)', padding: 24,
                    background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)', maxWidth: 400
                }}>
                    <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Trophy size={16} /> Comisión Final Jefe Tiendas
                    </div>
                    <div style={{ fontSize: 42, fontWeight: 900, color: '#0f172a' }}>
                        {totalJefe.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{fontSize: 24, color: '#ef4444'}}>€</span>
                    </div>
                </div>

                {/* Tabla de Comerciales */}
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: 24, overflowX: 'auto' }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User size={20} color="#0ea5e9" /> Desglose por Comercial
                    </h2>
                    
                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Comercial</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>Ventas Disp+Seg</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>Falta 2 (Disp)</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>Ventas ARPU</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>Falta 2 (ARPU)</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Total (€)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comsTable.map((c, i) => {
                                    
                                    const dispMet1 = c.dispCount >= c.dispObj1 && c.dispObj1 > 0;
                                    const dispMet2 = c.dispCount >= c.dispObj2 && c.dispObj2 > 0;
                                    const arpuMet1 = c.arpuCount >= c.arpuObj1 && c.arpuObj1 > 0;
                                    const arpuMet2 = c.arpuCount >= c.arpuObj2 && c.arpuObj2 > 0;

                                    return (
                                        <tr key={c.name} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{c.name}</td>
                                            
                                            {/* Disp + Seg */}
                                            <td style={{ padding: '12px 16px', backgroundColor: 'rgba(59, 130, 246, 0.02)' }}>
                                                {c.dispCount.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                                    {dispMet2 ? `Aplicado Obj2 (${dispPct2}%)` : (dispMet1 ? `Aplicado Obj1 (${dispPct1}%)` : 'No llega al Obj')}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', backgroundColor: 'rgba(59, 130, 246, 0.02)' }}>
                                                <div style={{ fontSize: 12, color: '#475569' }}>
                                                    Obj 1: {c.dispObj1.toLocaleString('es-ES', { maximumFractionDigits: 2 })} <br/>
                                                    Obj 2: {c.dispObj2.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                                                </div>
                                            </td>

                                            {/* ARPU */}
                                            <td style={{ padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
                                                {c.arpuCount.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                                    {arpuMet2 ? `Aplicado Obj2 (${arpuPct2}%)` : (arpuMet1 ? `Aplicado Obj1 (${arpuPct1}%)` : 'No llega al Obj')}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
                                                <div style={{ fontSize: 12, color: '#475569' }}>
                                                    Obj 1: {c.arpuObj1.toLocaleString('es-ES', { maximumFractionDigits: 2 })} <br/>
                                                    Obj 2: {c.arpuObj2.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                                                </div>
                                            </td>

                                            {/* TOTAL */}
                                            <td style={{ padding: '12px 16px', fontWeight: 800, color: '#10b981', textAlign: 'right', fontSize: 16 }}>
                                                {c.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                            </td>
                                        </tr>
                                    )
                                })}
                                {comsTable.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No hay datos de comerciales en este periodo</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Modal de Configuración (Solo Admin) */}
            {isSettingsOpen && isAdmin && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <div style={{
                        backgroundColor: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '600px', width: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', position: 'relative'
                    }}>
                        <button onClick={() => setIsSettingsOpen(false)} style={{
                            position: 'absolute', top: '16px', right: '16px',
                            background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer'
                        }}>
                            <XCircle size={24} />
                        </button>

                        <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Settings2 color="#ef4444" /> Ajustes Porcentajes Jefe Tiendas
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                            {/* DISPOSITIVOS */}
                            <div style={{ padding: 16, backgroundColor: 'rgba(59, 130, 246, 0.05)', borderRadius: 12, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#1e40af' }}>Dispositivos + Seguros</h3>
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                                        % si llega a Obj 1
                                    </label>
                                    <input 
                                        type="number" step="0.01"
                                        value={tempDispPct1} 
                                        onChange={e => setTempDispPct1(e.target.value)}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                                        % si llega a Obj 2
                                    </label>
                                    <input 
                                        type="number" step="0.01"
                                        value={tempDispPct2} 
                                        onChange={e => setTempDispPct2(e.target.value)}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    />
                                </div>
                            </div>

                            {/* ARPU */}
                            <div style={{ padding: 16, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#065f46' }}>ARPU (Repos)</h3>
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                                        % si llega a Obj 1
                                    </label>
                                    <input 
                                        type="number" step="0.01"
                                        value={tempArpuPct1} 
                                        onChange={e => setTempArpuPct1(e.target.value)}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                                        % si llega a Obj 2
                                    </label>
                                    <input 
                                        type="number" step="0.01"
                                        value={tempArpuPct2} 
                                        onChange={e => setTempArpuPct2(e.target.value)}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleSaveSettings}
                            disabled={savingSettings}
                            style={{ 
                                width: '100%', padding: '12px', borderRadius: '8px', background: '#ef4444', 
                                border: 'none', color: '#fff', fontWeight: 700, fontSize: 16, cursor: savingSettings ? 'not-allowed' : 'pointer' 
                            }}
                        >
                            {savingSettings ? 'Guardando...' : 'Guardar Ajustes'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
