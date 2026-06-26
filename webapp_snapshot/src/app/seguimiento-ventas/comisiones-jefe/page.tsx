'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { useComisionesData, matchTipoVenta, parseSafeFloat } from '@/hooks/useComisionesData'
import { useGuard } from '@/hooks/useGuard'
import { useRouter } from 'next/navigation'
import { AuditableCell } from '@/components/AuditableCell'
import { computeTerritorialRows } from '@/lib/territorialConsolidado'
import { getSaleCommission } from '@/lib/saleCommission'

export default function ComisionesJefeTiendasPage() {
    const router = useRouter()
    const { authorized, user } = useGuard('MODULE_JEFE_TIENDAS')
    const { loading, sellerStats, tiendaRules, monthSales, catalogs, activePeriodKey } = useComisionesData()
    
    // Solo el administrador puede editar los porcentajes
    const isSuperAdmin = user && user.role?.toUpperCase() === 'ADMIN'

    const [dispPct1, setDispPct1] = useState<number>(0.40)
    const [dispPct2, setDispPct2] = useState<number>(0.60)
    const [dispPct3, setDispPct3] = useState<number>(0)
    const [arpuPct1, setArpuPct1] = useState<number>(4.00)
    const [arpuPct2, setArpuPct2] = useState<number>(6.00)
    // Comisiones nuevas del Jefe: Altas Total BAF y Altas BAF Movistar Convergente.
    const [bafPct1, setBafPct1] = useState<number>(0)
    const [bafPct2, setBafPct2] = useState<number>(0)
    const [convPct1, setConvPct1] = useState<number>(0)
    const [convPct2, setConvPct2] = useState<number>(0)
    // Reglas de TERRITORIAL TIENDAS (objetivos 87/101, 50/58 + base de comisiones).
    const [territorialTiendasRules, setTerritorialTiendasRules] = useState<any[]>([])

    useEffect(() => {
        Promise.all([
            fetch('/api/settings?key=COMISION_JEFE_DISP_PCT1').then(res => res.json()),
            fetch('/api/settings?key=COMISION_JEFE_DISP_PCT2').then(res => res.json()),
            fetch('/api/settings?key=COMISION_JEFE_ARPU_PCT1').then(res => res.json()),
            fetch('/api/settings?key=COMISION_JEFE_ARPU_PCT2').then(res => res.json()),
            fetch('/api/settings?key=COMISION_JEFE_DISP_PCT3').then(res => res.json()),
            fetch('/api/settings?key=COMISION_JEFE_BAF_PCT1').then(res => res.json()).catch(() => ({ value: null })),
            fetch('/api/settings?key=COMISION_JEFE_BAF_PCT2').then(res => res.json()).catch(() => ({ value: null })),
            fetch('/api/settings?key=COMISION_JEFE_CONV_PCT1').then(res => res.json()).catch(() => ({ value: null })),
            fetch('/api/settings?key=COMISION_JEFE_CONV_PCT2').then(res => res.json()).catch(() => ({ value: null }))
        ]).then(([disp1, disp2, arpu1, arpu2, disp3, baf1, baf2, conv1, conv2]) => {
            if (disp1.success && disp1.value !== null) setDispPct1(Number(disp1.value))
            if (disp2.success && disp2.value !== null) setDispPct2(Number(disp2.value))
            if (arpu1.success && arpu1.value !== null) setArpuPct1(Number(arpu1.value))
            if (arpu2.success && arpu2.value !== null) setArpuPct2(Number(arpu2.value))
            if (disp3 && disp3.success && disp3.value !== null) setDispPct3(Number(disp3.value))
            if (baf1 && baf1.success && baf1.value !== null) setBafPct1(Number(baf1.value))
            if (baf2 && baf2.success && baf2.value !== null) setBafPct2(Number(baf2.value))
            if (conv1 && conv1.success && conv1.value !== null) setConvPct1(Number(conv1.value))
            if (conv2 && conv2.success && conv2.value !== null) setConvPct2(Number(conv2.value))
        }).catch(err => console.error("Error loading settings", err))
    }, [])

    // Reglas del territorial (objetivos + base de comisiones) del periodo activo.
    useEffect(() => {
        if (!activePeriodKey) return
        fetch(`/api/territorial?periodKey=${activePeriodKey}`).then(r => r.json())
            .then(d => { if (d && d.success) setTerritorialTiendasRules(d.tiendas || []) })
            .catch(err => console.error("Error loading territorial", err))
    }, [activePeriodKey])

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

    const { tableData, totalDispVentas, totalArpuVentas, globalDispObj1, globalDispObj2, globalDispObj3, globalArpuObj1, globalArpuObj2 } = useMemo(() => {
        if (!sellerStats || sellerStats.length === 0) {
            return { tableData: [], totalDispVentas: 0, totalArpuVentas: 0, globalDispObj1: 0, globalDispObj2: 0, globalDispObj3: 0, globalArpuObj1: 0, globalArpuObj2: 0 }
        }

        const dispRule = tiendaRules?.find(r => r.nombre?.toLowerCase().includes('dispositivo') && r.nombre?.toLowerCase().includes('seguro'))
        const arpuRule = tiendaRules?.find(r => r.nombre?.toLowerCase().includes('arpu'))

        const gDispObj1 = dispRule ? Number(dispRule.objPrimerTramo || 0) : 0
        const gDispObj2 = dispRule ? Number(dispRule.objSegundoTramo || 0) : 0
        const gDispObj3 = dispRule ? Number(dispRule.objTercerTramo || 0) : 0
        const gArpuObj1 = arpuRule ? Number(arpuRule.objPrimerTramo || 0) : 0
        const gArpuObj2 = arpuRule ? Number(arpuRule.objSegundoTramo || 0) : 0

        // tipoVenta de las palancas BAF para el desglose por comercial (mismo filtro que el
        // territorial). Comisión por venta de empresa, O2 excluido (cuadra con la base).
        const _n = (x: string) => String(x || '').toLowerCase()
        const bafTipo = (territorialTiendasRules.find(r => _n(r.nombre).includes('baf') && !_n(r.nombre).includes('convergente'))?.tipoVenta) || 'Alta BAF Total'
        const convTipo = (territorialTiendasRules.find(r => _n(r.nombre).includes('baf') && _n(r.nombre).includes('convergente'))?.tipoVenta) || 'Alta BAF Convergente'
        const _ctx = {
            catalogs,
            dashRowsPlus: [] as any[],
            dashRowsBasico: [] as any[],
            viewingPeriod: activePeriodKey ? String(activePeriodKey).replace(/[_-]/g, '') : ''
        }
        const _notO2 = (sale: any) => String(sale.detalle || sale.categoria || '').toLowerCase().trim() !== 'o2'
        const comisionPalanca = (rawSales: any[], tipo: string) =>
            (rawSales || []).filter(sale => _notO2(sale) && matchTipoVenta(sale, tipo))
                            .reduce((acc, sale) => acc + getSaleCommission(sale, _ctx), 0)

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
            const bafEur = comisionPalanca(s.rawSales, bafTipo)
            const convEur = comisionPalanca(s.rawSales, convTipo)

            tDisp += dispEur
            tArpu += arpuEur

            return {
                name: s.name,
                dispEur,
                arpuEur,
                bafEur,
                convEur
            }
        })

        return {
            tableData: data,
            totalDispVentas: tDisp,
            totalArpuVentas: tArpu,
            globalDispObj1: gDispObj1,
            globalDispObj2: gDispObj2,
            globalDispObj3: gDispObj3,
            globalArpuObj1: gArpuObj1,
            globalArpuObj2: gArpuObj2
        }
    }, [sellerStats, tiendaRules, territorialTiendasRules, catalogs, activePeriodKey])

    // BAF y Convergente: objetivos (uds) + base de comisiones (€) desde TERRITORIAL TIENDAS.
    // Reusa el mismo motor (computeTerritorialRows) → cuadra con el territorial por construcción.
    const { baf, conv } = useMemo(() => {
        const empty = { obj1: 0, obj2: 0, uds: 0, base: 0 }
        if (!monthSales || monthSales.length === 0 || !territorialTiendasRules || territorialTiendasRules.length === 0) {
            return { baf: empty, conv: empty }
        }
        const rows = computeTerritorialRows({
            sales: monthSales,
            territorialRules: territorialTiendasRules,
            catalogs,
            viewingPeriod: activePeriodKey ? String(activePeriodKey).replace(/[_-]/g, '') : ''
        } as any)
        const get = (key: string) => {
            const r = rows.find((x: any) => x.key === key)
            if (!r) return empty
            return { obj1: r.obj1Target || 0, obj2: r.obj2Target || 0, uds: r.ventasBase || 0, base: r.comisionBase || 0 }
        }
        return { baf: get('altas_baf'), conv: get('altas_baf_conv') }
    }, [monthSales, territorialTiendasRules, catalogs, activePeriodKey])

    // Avance del Jefe: su % sobre la base de comisiones de la palanca; el tramo (más alto
    // alcanzado) se decide por las UNIDADES vs el objetivo del territorial.
    const avanceBaf1 = baf.base * (bafPct1 / 100)
    const avanceBaf2 = baf.base * (bafPct2 / 100)
    const avanceConv1 = conv.base * (convPct1 / 100)
    const avanceConv2 = conv.base * (convPct2 / 100)

    let finalBaf = 0
    if (baf.obj2 > 0 && baf.uds >= baf.obj2) finalBaf = avanceBaf2
    else if (baf.obj1 > 0 && baf.uds >= baf.obj1) finalBaf = avanceBaf1
    let finalConv = 0
    if (conv.obj2 > 0 && conv.uds >= conv.obj2) finalConv = avanceConv2
    else if (conv.obj1 > 0 && conv.uds >= conv.obj1) finalConv = avanceConv1

    // Cálculos de Avance
    const avanceDisp1 = totalDispVentas * (dispPct1 / 100)
    const avanceDisp2 = totalDispVentas * (dispPct2 / 100)
    const avanceDisp3 = totalDispVentas * (dispPct3 / 100)

    const avanceArpu1 = totalArpuVentas * (arpuPct1 / 100)
    const avanceArpu2 = totalArpuVentas * (arpuPct2 / 100)

    // Total Condicionado (El máximo posible: el tramo más alto configurado)
    const totalCondicionado = (globalDispObj3 > 0 ? avanceDisp3 : avanceDisp2) + avanceArpu2 + avanceBaf2 + avanceConv2

    // Comisión Final (Real) - el tramo más alto alcanzado manda
    let finalDisp = 0
    if (totalDispVentas >= globalDispObj3 && globalDispObj3 > 0) finalDisp = avanceDisp3
    else if (totalDispVentas >= globalDispObj2 && globalDispObj2 > 0) finalDisp = avanceDisp2
    else if (totalDispVentas >= globalDispObj1 && globalDispObj1 > 0) finalDisp = avanceDisp1

    let finalArpu = 0
    if (totalArpuVentas >= globalArpuObj2 && globalArpuObj2 > 0) finalArpu = avanceArpu2
    else if (totalArpuVentas >= globalArpuObj1 && globalArpuObj1 > 0) finalArpu = avanceArpu1

    const comisionFinal = finalDisp + finalArpu + finalBaf + finalConv

    // Celda "Avance de Importe": cada tramo con su icono (1/2/3) y en VERDE cuando se ha
    // cumplido el objetivo (gris si aún no). Tramos = [{ n, amount, reached }].
    const renderAvance = (tramos: { n: number; amount: number; reached: boolean }[]) => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: `${tableData.length * 35}px` }}>
            {tramos.map((t, i) => (
                <div key={t.n} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    borderBottom: i < tramos.length - 1 ? '1px solid #d1d5db' : 'none',
                    background: t.reached ? 'rgba(16,185,129,0.10)' : 'transparent',
                    color: t.reached ? '#10b981' : '#94a3b8', fontWeight: t.reached ? 700 : 500
                }}>
                    <span title={`Objetivo ${t.n}`} style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 18, height: 18, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                        color: '#fff', background: t.reached ? '#10b981' : '#cbd5e1', flexShrink: 0
                    }}>{t.n}</span>
                    <span>{t.amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                    {t.reached && <span style={{ fontWeight: 700 }}>✓</span>}
                </div>
            ))}
        </div>
    )

    // Un tono de azul distinto por palanca para distinguir las columnas a golpe de vista
    // (cabecera fuerte + tinte claro en la columna "Ventas {palanca}").
    const PAL = {
        disp: { head: '#0a4f86', tint: '#eaf1f8' },
        arpu: { head: '#1976c4', tint: '#e9f2fb' },
        baf:  { head: '#1f9bb3', tint: '#e8f6fa' },
        conv: { head: '#3aaed6', tint: '#ecf8fc' },
    }

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
                    /* Tarjetas de condiciones compactadas para que entren las 4 */
                    .excel-table.compact th, .excel-table.compact td { padding: 5px 8px; font-size: 12.5px; }
                    .excel-table.compact .input-pct { width: 52px; padding: 3px; }
                    .card-progress { font-size: 10px; color: #64748b; font-weight: 600; }
                `}} />

                {/* TARJETAS SUPERIORES (Estilo Excel) */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

                    {/* Área de condiciones: envuelve sola, deja los resultados fijos a la derecha */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0, alignItems: 'flex-start' }}>

                    {/* Condiciones Disp+Seg */}
                    <table className="excel-table compact" style={{ width: 'auto', minWidth: 200 }}>
                        <thead>
                            <tr>
                                <th colSpan={3} className="header-blue">Condiciones Disp+Seg</th>
                            </tr>
                            <tr style={{ color: '#0078d4', fontWeight: 'bold' }}>
                                <td>Objetivo 1</td>
                                <td>Objetivo 2</td>
                                <td>Objetivo 3</td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ color: '#0078d4', fontWeight: 'bold' }}>
                                <td>{globalDispObj1.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                                <td>{globalDispObj2.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                                <td>{globalDispObj3.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
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
                                <td>
                                    <input
                                        className="input-pct"
                                        type="number" step="0.01"
                                        value={dispPct3}
                                        disabled={!isSuperAdmin}
                                        onChange={e => {
                                            const v = Number(e.target.value);
                                            setDispPct3(v);
                                            handleSavePct('COMISION_JEFE_DISP_PCT3', v);
                                        }}
                                        style={{ opacity: isSuperAdmin ? 1 : 0.7 }}
                                    /> %
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Condiciones Arpu (Repos) */}
                    <table className="excel-table compact" style={{ width: 'auto', minWidth: 200 }}>
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

                    {/* Condiciones Altas Total BAF (objetivos en uds desde TERRITORIAL TIENDAS) */}
                    <table className="excel-table compact" style={{ width: 'auto', minWidth: 200 }}>
                        <thead>
                            <tr>
                                <th colSpan={2} className="header-blue">Altas Total BAF</th>
                            </tr>
                            <tr style={{ color: '#0078d4', fontWeight: 'bold' }}>
                                <td>Objetivo 1</td>
                                <td>Objetivo 2</td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ color: '#0078d4', fontWeight: 'bold' }}>
                                <td>{baf.obj1} uds</td>
                                <td>{baf.obj2} uds</td>
                            </tr>
                            <tr>
                                <td>
                                    <input
                                        className="input-pct"
                                        type="number" step="0.01"
                                        value={bafPct1}
                                        disabled={!isSuperAdmin}
                                        onChange={e => { const v = Number(e.target.value); setBafPct1(v); handleSavePct('COMISION_JEFE_BAF_PCT1', v); }}
                                        style={{ opacity: isSuperAdmin ? 1 : 0.7 }}
                                    /> %
                                </td>
                                <td>
                                    <input
                                        className="input-pct"
                                        type="number" step="0.01"
                                        value={bafPct2}
                                        disabled={!isSuperAdmin}
                                        onChange={e => { const v = Number(e.target.value); setBafPct2(v); handleSavePct('COMISION_JEFE_BAF_PCT2', v); }}
                                        style={{ opacity: isSuperAdmin ? 1 : 0.7 }}
                                    /> %
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2} className="card-progress">
                                    {baf.base.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € · {baf.uds} uds
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Condiciones Altas BAF Movistar Convergente */}
                    <table className="excel-table compact" style={{ width: 'auto', minWidth: 200 }}>
                        <thead>
                            <tr>
                                <th colSpan={2} className="header-blue">Altas BAF Movistar Convergente</th>
                            </tr>
                            <tr style={{ color: '#0078d4', fontWeight: 'bold' }}>
                                <td>Objetivo 1</td>
                                <td>Objetivo 2</td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ color: '#0078d4', fontWeight: 'bold' }}>
                                <td>{conv.obj1} uds</td>
                                <td>{conv.obj2} uds</td>
                            </tr>
                            <tr>
                                <td>
                                    <input
                                        className="input-pct"
                                        type="number" step="0.01"
                                        value={convPct1}
                                        disabled={!isSuperAdmin}
                                        onChange={e => { const v = Number(e.target.value); setConvPct1(v); handleSavePct('COMISION_JEFE_CONV_PCT1', v); }}
                                        style={{ opacity: isSuperAdmin ? 1 : 0.7 }}
                                    /> %
                                </td>
                                <td>
                                    <input
                                        className="input-pct"
                                        type="number" step="0.01"
                                        value={convPct2}
                                        disabled={!isSuperAdmin}
                                        onChange={e => { const v = Number(e.target.value); setConvPct2(v); handleSavePct('COMISION_JEFE_CONV_PCT2', v); }}
                                        style={{ opacity: isSuperAdmin ? 1 : 0.7 }}
                                    /> %
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2} className="card-progress">
                                    {conv.base.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € · {conv.uds} uds
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    </div>

                    {/* Resultados (Total condicionado + Comisión Final) fijos arriba a la derecha. */}
                    <div style={{ display: 'flex', gap: 12, flexShrink: 0, alignItems: 'flex-start' }}>

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
                </div>

                {/* TABLA PRINCIPAL DE COMERCIALES */}
                <table className="excel-table">
                    <thead>
                        <tr>
                            <th className="header-lightblue" style={{ background: '#0078d4' }}>Comercial</th>
                            <th className="header-lightblue" style={{ background: PAL.disp.head }}><AuditableCell metricKey="DISP_SEG_VENTAS">Ventas Disp+Seg</AuditableCell></th>
                            <th className="header-lightblue" style={{ background: PAL.disp.head }}>Total Ventas</th>
                            <th className="header-lightblue" style={{ background: PAL.disp.head }}><AuditableCell metricKey="AVANCE_IMPORTE_JEFE_DISP">Avance de Importe</AuditableCell></th>
                            <th className="header-lightblue" style={{ background: PAL.arpu.head }}><AuditableCell metricKey="ARPU_VENTAS">Ventas Arpu (Repos)</AuditableCell></th>
                            <th className="header-lightblue" style={{ background: PAL.arpu.head }}>Total Ventas</th>
                            <th className="header-lightblue" style={{ background: PAL.arpu.head }}><AuditableCell metricKey="AVANCE_IMPORTE_JEFE_ARPU">Avance de Importe</AuditableCell></th>
                            <th className="header-lightblue" style={{ background: PAL.baf.head }}>Ventas Altas BAF</th>
                            <th className="header-lightblue" style={{ background: PAL.baf.head }}>Total Ventas</th>
                            <th className="header-lightblue" style={{ background: PAL.baf.head }}>Avance de Importe</th>
                            <th className="header-lightblue" style={{ background: PAL.conv.head }}>Ventas BAF Convergente</th>
                            <th className="header-lightblue" style={{ background: PAL.conv.head }}>Total Ventas</th>
                            <th className="header-lightblue" style={{ background: PAL.conv.head }}>Avance de Importe</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((row, index) => (
                            <tr key={row.name}>
                                <td style={{ fontWeight: 'bold', textAlign: 'left' }}>{row.name}</td>
                                <td className="cell-currency" style={{ background: PAL.disp.tint }}>
                                    {row.dispEur > 0 ? `${row.dispEur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                </td>

                                {/* Celdas combinadas para Total y Avance (Solo se renderizan en la primera fila) */}
                                {index === 0 && (
                                    <>
                                        <td rowSpan={tableData.length} style={{ fontWeight: 'bold', fontSize: 13, whiteSpace: 'nowrap', verticalAlign: 'middle', background: PAL.disp.tint }}>
                                            {totalDispVentas > 0 ? `${totalDispVentas.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                        </td>
                                        <td rowSpan={tableData.length} style={{ verticalAlign: 'middle', padding: 0 }}>
                                            {renderAvance([
                                                { n: 1, amount: avanceDisp1, reached: globalDispObj1 > 0 && totalDispVentas >= globalDispObj1 },
                                                { n: 2, amount: avanceDisp2, reached: globalDispObj2 > 0 && totalDispVentas >= globalDispObj2 },
                                                ...(globalDispObj3 > 0 ? [{ n: 3, amount: avanceDisp3, reached: totalDispVentas >= globalDispObj3 }] : [])
                                            ])}
                                        </td>
                                    </>
                                )}

                                <td className="cell-currency" style={{ background: PAL.arpu.tint }}>
                                    {row.arpuEur > 0 ? `${row.arpuEur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                </td>

                                {index === 0 && (
                                    <>
                                        <td rowSpan={tableData.length} style={{ fontWeight: 'bold', fontSize: 13, whiteSpace: 'nowrap', verticalAlign: 'middle', background: PAL.arpu.tint }}>
                                            {totalArpuVentas > 0 ? `${totalArpuVentas.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                        </td>
                                        <td rowSpan={tableData.length} style={{ verticalAlign: 'middle', padding: 0 }}>
                                            {renderAvance([
                                                { n: 1, amount: avanceArpu1, reached: globalArpuObj1 > 0 && totalArpuVentas >= globalArpuObj1 },
                                                { n: 2, amount: avanceArpu2, reached: globalArpuObj2 > 0 && totalArpuVentas >= globalArpuObj2 }
                                            ])}
                                        </td>
                                    </>
                                )}

                                {/* Altas Total BAF */}
                                <td className="cell-currency" style={{ background: PAL.baf.tint }}>
                                    {row.bafEur > 0 ? `${row.bafEur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                </td>
                                {index === 0 && (
                                    <>
                                        <td rowSpan={tableData.length} style={{ fontWeight: 'bold', fontSize: 13, whiteSpace: 'nowrap', verticalAlign: 'middle', background: PAL.baf.tint }}>
                                            {baf.base > 0 ? `${baf.base.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                        </td>
                                        <td rowSpan={tableData.length} style={{ verticalAlign: 'middle', padding: 0 }}>
                                            {renderAvance([
                                                { n: 1, amount: avanceBaf1, reached: baf.obj1 > 0 && baf.uds >= baf.obj1 },
                                                { n: 2, amount: avanceBaf2, reached: baf.obj2 > 0 && baf.uds >= baf.obj2 }
                                            ])}
                                        </td>
                                    </>
                                )}

                                {/* Altas BAF Movistar Convergente */}
                                <td className="cell-currency" style={{ background: PAL.conv.tint }}>
                                    {row.convEur > 0 ? `${row.convEur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                </td>
                                {index === 0 && (
                                    <>
                                        <td rowSpan={tableData.length} style={{ fontWeight: 'bold', fontSize: 13, whiteSpace: 'nowrap', verticalAlign: 'middle', background: PAL.conv.tint }}>
                                            {conv.base > 0 ? `${conv.base.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '- €'}
                                        </td>
                                        <td rowSpan={tableData.length} style={{ verticalAlign: 'middle', padding: 0 }}>
                                            {renderAvance([
                                                { n: 1, amount: avanceConv1, reached: conv.obj1 > 0 && conv.uds >= conv.obj1 },
                                                { n: 2, amount: avanceConv2, reached: conv.obj2 > 0 && conv.uds >= conv.obj2 }
                                            ])}
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                        {tableData.length === 0 && (
                            <tr>
                                <td colSpan={13} style={{ padding: 24, color: '#64748b' }}>No hay comerciales disponibles.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
