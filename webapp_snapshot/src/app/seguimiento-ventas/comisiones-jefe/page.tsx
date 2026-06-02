'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { useComisionesData, matchTipoVenta, parseSafeFloat } from '@/hooks/useComisionesData'
import { useGuard } from '@/hooks/useGuard'
import { useRouter } from 'next/navigation'

export default function ComisionesJefeTiendasPage() {
    const router = useRouter()
    const { authorized, user } = useGuard('MODULE_JEFE_TIENDAS')
    const { loading, sellerStats, tiendaRules } = useComisionesData()
    
    // Solo el administrador puede editar los porcentajes
    const isSuperAdmin = user && user.role?.toUpperCase() === 'ADMIN'

    const [dispPct1, setDispPct1] = useState<number>(0.40)
    const [dispPct2, setDispPct2] = useState<number>(0.60)
    const [arpuPct1, setArpuPct1] = useState<number>(4.00)
    const [arpuPct2, setArpuPct2] = useState<number>(6.00)

    useEffect(() => {
        Promise.all([
            fetch('/api/settings?key=COMISION_JEFE_DISP_PCT1').then(res => res.json()),
            fetch('/api/settings?key=COMISION_JEFE_DISP_PCT2').then(res => res.json()),
            fetch('/api/settings?key=COMISION_JEFE_ARPU_PCT1').then(res => res.json()),
            fetch('/api/settings?key=COMISION_JEFE_ARPU_PCT2').then(res => res.json())
        ]).then(([disp1, disp2, arpu1, arpu2]) => {
            if (disp1.success && disp1.value !== null) setDispPct1(Number(disp1.value))
            if (disp2.success && disp2.value !== null) setDispPct2(Number(disp2.value))
            if (arpu1.success && arpu1.value !== null) setArpuPct1(Number(arpu1.value))
            if (arpu2.success && arpu2.value !== null) setArpuPct2(Number(arpu2.value))
        }).catch(err => console.error("Error loading settings", err))
    }, [])

    const handleSavePct = async (key: string, value: number) => {
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value: String(value) })
            })
        } catch (e) {
            console.error("Error saving setting", e)
        }
    }

    const { tableData, totalDispVentas, totalArpuVentas, globalDispObj1, globalDispObj2, globalArpuObj1, globalArpuObj2 } = useMemo(() => {
        if (!sellerStats || sellerStats.length === 0) {
            return { tableData: [], totalDispVentas: 0, totalArpuVentas: 0, globalDispObj1: 0, globalDispObj2: 0, globalArpuObj1: 0, globalArpuObj2: 0 }
        }

        const dispRule = tiendaRules?.find(r => r.nombre?.toLowerCase().includes('dispositivo') && r.nombre?.toLowerCase().includes('seguro'))
        const arpuRule = tiendaRules?.find(r => r.nombre?.toLowerCase().includes('arpu'))

        const gDispObj1 = dispRule ? Number(dispRule.objPrimerTramo || 0) : 0
        const gDispObj2 = dispRule ? Number(dispRule.objSegundoTramo || 0) : 0
        const gArpuObj1 = arpuRule ? Number(arpuRule.objPrimerTramo || 0) : 0
        const gArpuObj2 = arpuRule ? Number(arpuRule.objSegundoTramo || 0) : 0

        let tDisp = 0
        let tArpu = 0

            // Filtrar a Marta
        const validSellers = sellerStats.filter(s => !s.name.toLowerCase().includes('marta'))

        const data = validSellers.map(s => {
            // Utilizar groupCounts que ya viene calculado y validado por useComisionesData
            const dispKey = Object.keys(s.groupCounts || {}).find(k => k.toLowerCase().includes('dispositivo') && k.toLowerCase().includes('seguro'))
            const arpuKey = Object.keys(s.groupCounts || {}).find(k => k.toLowerCase().includes('arpu'))

            const dispEur = dispKey ? (s.groupCounts[dispKey] || 0) : 0
            const arpuEur = arpuKey ? (s.groupCounts[arpuKey] || 0) : 0

            tDisp += dispEur
            tArpu += arpuEur

            return {
                name: s.name,
                dispEur,
                arpuEur
            }
        })

        return { 
            tableData: data, 
            totalDispVentas: tDisp, 
            totalArpuVentas: tArpu,
            globalDispObj1: gDispObj1,
            globalDispObj2: gDispObj2,
            globalArpuObj1: gArpuObj1,
            globalArpuObj2: gArpuObj2
        }
    }, [sellerStats, tiendaRules])

    // Cálculos de Avance
    const avanceDisp1 = totalDispVentas * (dispPct1 / 100)
    const avanceDisp2 = totalDispVentas * (dispPct2 / 100)
    
    const avanceArpu1 = totalArpuVentas * (arpuPct1 / 100)
    const avanceArpu2 = totalArpuVentas * (arpuPct2 / 100)

    // Total Condicionado (El máximo posible: Obj 2)
    const totalCondicionado = avanceDisp2 + avanceArpu2

    // Comisión Final (Real)
    let finalDisp = 0
    if (totalDispVentas >= globalDispObj2 && globalDispObj2 > 0) finalDisp = avanceDisp2
    else if (totalDispVentas >= globalDispObj1 && globalDispObj1 > 0) finalDisp = avanceDisp1

    let finalArpu = 0
    if (totalArpuVentas >= globalArpuObj2 && globalArpuObj2 > 0) finalArpu = avanceArpu2
    else if (totalArpuVentas >= globalArpuObj1 && globalArpuObj1 > 0) finalArpu = avanceArpu1

    const comisionFinal = finalDisp + finalArpu

    if (authorized === null) {
        return <div style={{ padding: 40, color: '#0078d4', fontWeight: 600 }}>Verificando credenciales del módulo...</div>;
    }

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#64748b' }}>Cargando datos...</div>
    }

    return (
        <div style={{ padding: '24px 32px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            <PageHeader 
                title={<span style={{ color: '#0078d4', fontWeight: 800 }}>Comisiones Jefe Tiendas</span>}
                showBack={true}
            />

            <div style={{ marginTop: 24, overflowX: 'auto' }}>
                <style dangerouslySetInnerHTML={{__html: `
                    .excel-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        font-size: 14px;
                        background: #fff;
                    }
                    .excel-table th, .excel-table td {
                        border: 1px solid #d1d5db;
                        padding: 10px 14px;
                        text-align: center;
                    }
                    .header-blue {
                        background-color: #0078d4;
                        color: #ffffff;
                        font-weight: bold;
                    }
                    .header-lightblue {
                        background-color: #00b0f0;
                        color: #ffffff;
                        font-weight: bold;
                    }
                    .cell-green {
                        color: #10b981;
                        font-weight: bold;
                    }
                    .cell-currency {
                        text-align: right;
                    }
                    .input-pct {
                        width: 70px;
                        text-align: center;
                        border: 1px solid #cbd5e1;
                        border-radius: 4px;
                        padding: 4px;
                        font-weight: bold;
                        color: #0078d4;
                        background: #f8fafc;
                    }
                `}} />

                {/* TARJETAS SUPERIORES (Estilo Excel) */}
                <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
                    
                    {/* Condiciones Disp+Seg */}
                    <table className="excel-table" style={{ width: 'auto', minWidth: 280 }}>
                        <thead>
                            <tr>
                                <th colSpan={2} className="header-blue">Condiciones Disp+Seg</th>
                            </tr>
                            <tr style={{ color: '#0078d4', fontWeight: 'bold' }}>
                                <td>Objetivo 1</td>
                                <td>Objetivo 2</td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ color: '#0078d4', fontWeight: 'bold' }}>
                                <td>{globalDispObj1.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                                <td>{globalDispObj2.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                            </tr>
                            <tr>
                                <td>
                                    <input 
                                        className="input-pct"
                                        type="number" step="0.01" 
                                        value={dispPct1}
                                        disabled={!isSuperAdmin}
                                        onChange={e => {
                                            const v = Number(e.target.value);
                                            setDispPct1(v);
                                            handleSavePct('COMISION_JEFE_DISP_PCT1', v);
                                        }}
                                        style={{ opacity: isSuperAdmin ? 1 : 0.7 }}
                                    /> %
                                </td>
                                <td>
                                    <input 
                                        className="input-pct"
                                        type="number" step="0.01" 
                                        value={dispPct2}
                                        disabled={!isSuperAdmin}
                                        onChange={e => {
                                            const v = Number(e.target.value);
                                            setDispPct2(v);
                                            handleSavePct('COMISION_JEFE_DISP_PCT2', v);
                                        }}
                                        style={{ opacity: isSuperAdmin ? 1 : 0.7 }}
                                    /> %
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Condiciones Arpu (Repos) */}
                    <table className="excel-table" style={{ width: 'auto', minWidth: 280 }}>
                        <thead>
                            <tr>
                                <th colSpan={2} className="header-blue">Codiciones Arpu (Repos)</th>
                            </tr>
                            <tr style={{ color: '#0078d4', fontWeight: 'bold' }}>
                                <td>Objetivo 1</td>
                                <td>Objetivo 2</td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ color: '#0078d4', fontWeight: 'bold' }}>
                                <td>{globalArpuObj1.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                                <td>{globalArpuObj2.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                            </tr>
                            <tr>
                                <td>
                                    <input 
                                        className="input-pct"
                                        type="number" step="0.01" 
                                        value={arpuPct1}
                                        disabled={!isSuperAdmin}
                                        onChange={e => {
                                            const v = Number(e.target.value);
                                            setArpuPct1(v);
                                            handleSavePct('COMISION_JEFE_ARPU_PCT1', v);
                                        }}
                                        style={{ opacity: isSuperAdmin ? 1 : 0.7 }}
                                    /> %
                                </td>
                                <td>
                                    <input 
                                        className="input-pct"
                                        type="number" step="0.01" 
                                        value={arpuPct2}
                                        disabled={!isSuperAdmin}
                                        onChange={e => {
                                            const v = Number(e.target.value);
                                            setArpuPct2(v);
                                            handleSavePct('COMISION_JEFE_ARPU_PCT2', v);
                                        }}
                                        style={{ opacity: isSuperAdmin ? 1 : 0.7 }}
                                    /> %
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ flex: 1 }}></div>

                    {/* Total Condicionado */}
                    <table className="excel-table" style={{ width: 'auto', minWidth: 200 }}>
                        <thead>
                            <tr>
                                <th className="header-blue" style={{ height: 48 }}>Total (€)<br/>condicionado a cumplir objetivos</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="cell-green" style={{ fontSize: 28, height: 70 }}>
                                    {totalCondicionado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Comisión Final */}
                    <table className="excel-table" style={{ width: 'auto', minWidth: 150 }}>
                        <thead>
                            <tr>
                                <th className="header-blue" style={{ height: 48 }}>Comisión Final<br/>Jefe Tiendas</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="cell-green" style={{ fontSize: 20, height: 70 }}>
                                    {comisionFinal > 0 ? `${comisionFinal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* TABLA PRINCIPAL DE COMERCIALES */}
                <table className="excel-table">
                    <thead>
                        <tr>
                            <th className="header-lightblue">Comercial</th>
                            <th className="header-lightblue">Ventas Disp+Seg</th>
                            <th className="header-lightblue">Total Ventas</th>
                            <th className="header-lightblue">Avance de Importe</th>
                            <th className="header-lightblue">Ventas Arpu (Repos)</th>
                            <th className="header-lightblue">Total Ventas</th>
                            <th className="header-lightblue">Avance de Importe</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((row, index) => (
                            <tr key={row.name}>
                                <td style={{ fontWeight: 'bold', textAlign: 'left' }}>{row.name}</td>
                                <td className="cell-currency">
                                    {row.dispEur > 0 ? `${row.dispEur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                </td>
                                
                                {/* Celdas combinadas para Total y Avance (Solo se renderizan en la primera fila) */}
                                {index === 0 && (
                                    <>
                                        <td rowSpan={tableData.length} style={{ fontWeight: 'bold', fontSize: 16, verticalAlign: 'middle' }}>
                                            {totalDispVentas > 0 ? `${totalDispVentas.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                        </td>
                                        <td rowSpan={tableData.length} className="cell-green" style={{ verticalAlign: 'middle', padding: 0 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: `${tableData.length * 35}px` }}>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #d1d5db' }}>
                                                    {avanceDisp1.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                </div>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {avanceDisp2.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                </div>
                                            </div>
                                        </td>
                                    </>
                                )}

                                <td className="cell-currency">
                                    {row.arpuEur > 0 ? `${row.arpuEur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                </td>

                                {index === 0 && (
                                    <>
                                        <td rowSpan={tableData.length} style={{ fontWeight: 'bold', fontSize: 16, verticalAlign: 'middle' }}>
                                            {totalArpuVentas > 0 ? `${totalArpuVentas.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                        </td>
                                        <td rowSpan={tableData.length} className="cell-green" style={{ verticalAlign: 'middle', padding: 0 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: `${tableData.length * 35}px` }}>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #d1d5db' }}>
                                                    {avanceArpu1.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                </div>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {avanceArpu2.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                </div>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                        {tableData.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ padding: 24, color: '#64748b' }}>No hay comerciales disponibles.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
