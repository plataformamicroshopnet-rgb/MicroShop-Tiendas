'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { textoCondicionantes } from '@/lib/condicionantesTexto'
import { useComisionesData } from '@/hooks/useComisionesData'
import { useGuard } from '@/hooks/useGuard'
import { useRouter } from 'next/navigation'
import { AuditableCell } from '@/components/AuditableCell'
import {
    computeComisionJefeTiendas,
    JEFE_PCT_SETTING_KEYS,
    jefePctKeyMes,
    jefePctKeysTodas,
    normalizarMesJefe,
    resolverJefePcts,
    type JefePctOrigen,
    type JefePcts,
} from '@/lib/comisionJefeTiendas'

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const mesLargo = (mes: string) => {
    const m = normalizarMesJefe(mes)
    if (!m) return ''
    const [a, n] = m.split('_')
    return `${MESES_ES[Number(n) - 1] || n} de ${a}`
}

export default function ComisionesJefeTiendasPage() {
    const router = useRouter()
    const { authorized, user } = useGuard('MODULE_JEFE_TIENDAS')
    const { loading, sellerStats, tiendaRules, tiendaHours, monthSales, catalogs, activePeriodKey } = useComisionesData()
    
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
    // Altas Repos UP: EUROS POR ALTA (no un %), un solo objetivo.
    const [reposEur1, setReposEur1] = useState<number>(0)
    // Reglas de TERRITORIAL TIENDAS (objetivos 87/101, 50/58 + base de comisiones).
    const [territorialTiendasRules, setTerritorialTiendasRules] = useState<any[]>([])

    // Los porcentajes son DE CADA MES (ago-2026). De dónde ha salido cada uno:
    // 'mes' = ya tiene el suyo, 'global'/'defecto' = todavía heredado.
    const mesPct = normalizarMesJefe(String(activePeriodKey || ''))
    const [pctOrigen, setPctOrigen] = useState<Record<keyof JefePcts, JefePctOrigen> | null>(null)
    // 'cargando' | 'ok' | 'error'. Sin 'ok' NO se puede editar: si la carga falla,
    // los useState valen los defectos del código y guardarlos sería grabar un
    // porcentaje inventado en la clave del mes, que es la que paga.
    const [pctEstado, setPctEstado] = useState<'cargando' | 'ok' | 'error'>('cargando')
    const pctCargados = pctEstado === 'ok'
    const [avisoGuardado, setAvisoGuardado] = useState<string | null>(null)

    useEffect(() => {
        if (!mesPct) { setPctEstado('error'); return }
        let cancelado = false
        setPctEstado('cargando')
        fetch(`/api/settings?keys=${encodeURIComponent(jefePctKeysTodas(mesPct).join(','))}`)
            .then(res => res.json())
            .then(d => {
                if (cancelado) return
                // Si el API no dice que ha ido bien, NO se toca nada: mejor pantalla
                // bloqueada con un aviso que nueve defectos disfrazados de configuración.
                if (!d || d.success !== true || !d.values) { setPctEstado('error'); return }
                const mapa = new Map<string, string | null>(Object.entries(d.values))
                // Se asignan SIEMPRE los 9, incluso los que caen al defecto: si no,
                // al cambiar de mes se quedarían los del mes anterior en pantalla.
                const { pcts, origen } = resolverJefePcts(mapa, mesPct)
                setDispPct1(pcts.dispPct1); setDispPct2(pcts.dispPct2); setDispPct3(pcts.dispPct3)
                setArpuPct1(pcts.arpuPct1); setArpuPct2(pcts.arpuPct2)
                setBafPct1(pcts.bafPct1); setBafPct2(pcts.bafPct2)
                setConvPct1(pcts.convPct1); setConvPct2(pcts.convPct2)
                setReposEur1(pcts.reposEur1)
                setPctOrigen(origen)
                setPctEstado('ok')
            })
            .catch(err => { if (!cancelado) { console.error("Error loading settings", err); setPctEstado('error') } })
        return () => { cancelado = true }
    }, [mesPct])

    // Reglas del territorial (objetivos + base de comisiones) del periodo activo.
    // Con guarda de cancelación: fijan los objetivos en uds de BAF y Convergente, o
    // sea qué tramo se da por alcanzado, y una respuesta tardía de otro mes pintaría
    // el tramo equivocado.
    useEffect(() => {
        if (!activePeriodKey) return
        let cancelado = false
        fetch(`/api/territorial?periodKey=${activePeriodKey}`).then(r => r.json())
            .then(d => { if (!cancelado && d && d.success) setTerritorialTiendasRules(d.tiendas || []) })
            .catch(err => console.error("Error loading territorial", err))
        return () => { cancelado = true }
    }, [activePeriodKey])

    // Guarda el % en la clave DE ESTE MES, nunca en la global: cambiar agosto ya
    // no le toca julio ni ningún otro mes ya pagado. Con espera (debounce): el
    // onChange de un <input type=number> dispara en cada tecla y los estados
    // intermedios valen 0 — sin esta espera se podía grabar un 0 en el mes.
    const guardadoPendiente = React.useRef<Record<string, any>>({})
    const handleSavePct = (claveGlobal: string, value: number) => {
        if (!pctCargados || !mesPct) return
        const clave = jefePctKeyMes(claveGlobal, mesPct)
        if (!clave) return
        const campo = (Object.keys(JEFE_PCT_SETTING_KEYS) as (keyof JefePcts)[])
            .find(k => JEFE_PCT_SETTING_KEYS[k] === claveGlobal)
        if (guardadoPendiente.current[clave]) clearTimeout(guardadoPendiente.current[clave])
        guardadoPendiente.current[clave] = setTimeout(async () => {
            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: clave, value: String(value) })
                })
                if (!res.ok) throw new Error(String(res.status))
                // Solo AHORA es propio del mes. Marcarlo antes sería mentir en el aviso.
                if (campo) setPctOrigen(prev => (prev ? { ...prev, [campo]: 'mes' as JefePctOrigen } : prev))
                setAvisoGuardado('ok')
                setTimeout(() => setAvisoGuardado(null), 2000)
            } catch (e) {
                console.error("Error saving setting", e)
                setAvisoGuardado('error')
            }
        }, 600)
    }

    // Qué casillas siguen colgando del ajuste general (no son propias del mes).
    const ETIQUETA_PCT: Record<keyof JefePcts, string> = {
        dispPct1: 'Disp+Seg 1', dispPct2: 'Disp+Seg 2', dispPct3: 'Disp+Seg 3',
        arpuPct1: 'Arpu 1', arpuPct2: 'Arpu 2',
        bafPct1: 'BAF 1', bafPct2: 'BAF 2', convPct1: 'Converg. 1', convPct2: 'Converg. 2',
        reposEur1: 'Repos UP',
    }
    const heredados = pctOrigen
        ? (Object.keys(ETIQUETA_PCT) as (keyof JefePcts)[]).filter(k => pctOrigen[k] !== 'mes').map(k => ETIQUETA_PCT[k])
        : []

    // ── FUENTE ÚNICA: el mismo helper que usa /api/comisiones-liquidacion ──
    // (src/lib/comisionJefeTiendas). Aquí solo se pinta lo que devuelve.
    const cj = useMemo(() => computeComisionJefeTiendas({
        sellerStats: sellerStats || [],
        adjustedTiendaRules: tiendaRules || [],
        territorialTiendasRules: territorialTiendasRules || [],
        monthSales: monthSales || [],
        catalogs: catalogs || {},
        viewingPeriod: activePeriodKey ? String(activePeriodKey).replace(/[_-]/g, '') : '',
        // Para el condicionante de mínimo POR TIENDA hace falta saber qué tiendas
        // hay y quién trabaja en cada una: la plantilla del mes.
        tiendaHours: tiendaHours || [],
        pcts: { dispPct1, dispPct2, dispPct3, arpuPct1, arpuPct2, bafPct1, bafPct2, convPct1, convPct2, reposEur1 },
    }), [sellerStats, tiendaRules, territorialTiendasRules, monthSales, catalogs, activePeriodKey,
        dispPct1, dispPct2, dispPct3, arpuPct1, arpuPct2, bafPct1, bafPct2, convPct1, convPct2, reposEur1])

    const [pDisp, pArpu, pBaf, pConv, pRepos] = cj.palancas
    const tableData = cj.porComercial
    const totalDispVentas = pDisp.base
    const totalArpuVentas = pArpu.base
    const globalDispObj1 = pDisp.obj1
    const globalDispObj2 = pDisp.obj2
    const globalDispObj3 = pDisp.obj3 || 0
    const globalArpuObj1 = pArpu.obj1
    const globalArpuObj2 = pArpu.obj2
    const baf = { obj1: pBaf.obj1, obj2: pBaf.obj2, uds: pBaf.uds || 0, base: pBaf.base }
    const conv = { obj1: pConv.obj1, obj2: pConv.obj2, uds: pConv.uds || 0, base: pConv.base }

    // Total Condicionado (máximo teórico) y Comisión Final (tramo más alto manda)
    const totalCondicionado = cj.totalCondicionado
    const comisionFinal = cj.total

    // Celda "Avance de Importe": cada tramo con su icono (1/2/3). SOLO el tramo más alto
    // alcanzado se pone VERDE con ✓ (es el ÚNICO que se cobra). Los tramos inferiores ya
    // alcanzados se apagan (gris + tachado = "alcanzado pero superado, no se cobra") para
    // que quede claro que no se cobran los dos. Los no alcanzados, gris normal.
    const renderAvance = (tramos: { n: number; amount: number; reached: boolean }[]) => {
        const lastReachedIdx = tramos.reduce((acc, t, i) => (t.reached ? i : acc), -1)
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: `${tableData.length * 35}px` }}>
                {tramos.map((t, i) => {
                    const active = i === lastReachedIdx       // el que se cobra
                    const superseded = t.reached && !active   // alcanzado pero superado por uno mayor
                    return (
                        <div key={t.n} style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            borderBottom: i < tramos.length - 1 ? '1px solid #d1d5db' : 'none',
                            background: active ? 'rgba(16,185,129,0.12)' : 'transparent',
                            color: active ? '#10b981' : '#94a3b8', fontWeight: active ? 700 : 500
                        }}>
                            <span title={`Objetivo ${t.n}`} style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 18, height: 18, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                                color: '#fff', background: active ? '#10b981' : '#cbd5e1', flexShrink: 0
                            }}>{t.n}</span>
                            <span style={{ textDecoration: superseded ? 'line-through' : 'none' }}>
                                {t.amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </span>
                            {active && <span style={{ fontWeight: 700 }}>✓</span>}
                        </div>
                    )
                })}
            </div>
        )
    }

    // Un tono de azul distinto por palanca para distinguir las columnas a golpe de vista
    // (cabecera fuerte + tinte claro en la columna "Ventas {palanca}").
    const PAL = {
        disp: { head: '#0a4f86', tint: '#eaf1f8' },
        arpu: { head: '#1976c4', tint: '#e9f2fb' },
        baf:  { head: '#1f9bb3', tint: '#e8f6fa' },
        conv: { head: '#3aaed6', tint: '#ecf8fc' },
        repos: { head: '#0f766e', tint: '#e6f5f3' },
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

            {/* EL «OJO» DE LAS PALANCAS CONDICIONADAS.
                Se escribe SOLO a partir de lo que cada regla tiene configurado
                (lib/condicionantesTexto), igual que en el Panel de Comisiones: asi
                lo que se lee aqui es exactamente lo que se paga, y si un dia se
                cambia una condicion el aviso cambia con ella. Solo salen las
                palancas que tienen letra pequeña de verdad. */}
            {(() => {
                const conAviso = (tiendaRules || [])
                    .map((r: any) => ({ nombre: r.nombre, lineas: textoCondicionantes(r) }))
                    .filter((x: any) => x.lineas.some((l: string) => !l.startsWith('Se sube de tramo')))
                if (conAviso.length === 0) return null
                return (
                    <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 10,
                                  background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.4)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
                            OJO: palancas con condiciones
                        </div>
                        {conAviso.map((x: any) => (
                            <div key={x.nombre} style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5, marginBottom: 3 }}>
                                <b>{x.nombre}:</b> {x.lineas.join(' ')}
                            </div>
                        ))}
                    </div>
                )
            })()}

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
                    /* Filas de la tabla de comerciales un pelín más bajas (~3px) para que entre en pantalla */
                    .excel-table.main-table th, .excel-table.main-table td { padding-top: 8.5px; padding-bottom: 8.5px; }
                `}} />

                {/* Aviso: los % son de ESTE mes y solo de este mes (ago-2026) */}
                {isSuperAdmin && (
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14,
                        padding: '9px 14px', borderRadius: 8, fontSize: 13,
                        background: pctEstado === 'error' ? '#fef2f2' : '#eff6ff',
                        border: `1px solid ${pctEstado === 'error' ? '#fecaca' : '#bfdbfe'}`,
                        color: pctEstado === 'error' ? '#991b1b' : '#1e40af'
                    }}>
                        <span style={{ fontSize: 16 }}>{pctEstado === 'error' ? '⚠️' : '🗓️'}</span>
                        {pctEstado === 'error' ? (
                            <span>
                                <b>No se han podido leer los porcentajes de este mes.</b> Los números que
                                ves NO son los que se pagan y las casillas están bloqueadas a propósito.
                                Recarga la pantalla; si sigue igual, avísame.
                            </span>
                        ) : (
                            <span>
                                Estos porcentajes son los de <b>{mesLargo(mesPct) || 'este mes'}</b>. Lo que
                                cambies aquí <b>solo afecta a este mes</b>: los meses anteriores se quedan
                                como estén.
                                {pctCargados && heredados.length > 0 && (
                                    <span style={{ color: '#b45309' }}>
                                        {' '}Todavía {heredados.length === 1 ? 'hay 1 casilla que sigue heredada' :
                                            `hay ${heredados.length} casillas que siguen heredadas`} de la
                                        configuración general ({heredados.join(', ')}): en cuanto las toques
                                        pasan a ser de este mes.
                                    </span>
                                )}
                                {avisoGuardado === 'ok' && <b style={{ color: '#047857' }}> · Guardado ✓</b>}
                                {avisoGuardado === 'error' && (
                                    <b style={{ color: '#b91c1c' }}> · NO se ha podido guardar; vuelve a intentarlo.</b>
                                )}
                            </span>
                        )}
                    </div>
                )}

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
                                        disabled={!isSuperAdmin || !pctCargados}
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
                                        disabled={!isSuperAdmin || !pctCargados}
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
                                        disabled={!isSuperAdmin || !pctCargados}
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
                                        disabled={!isSuperAdmin || !pctCargados}
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
                                        disabled={!isSuperAdmin || !pctCargados}
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

                    {/* Altas Repos UP (regla «Repo Fútbol»): UN solo objetivo, el primer
                        tramo de Reglas Globales y Tramos de Comisiones, y se paga por ALTA. */}
                    <table className="excel-table compact" style={{ width: 'auto', minWidth: 170 }}>
                        <thead>
                            <tr>
                                <th className="header-blue">Altas Repos UP</th>
                            </tr>
                            <tr style={{ color: '#0078d4', fontWeight: 'bold' }}>
                                <td>Objetivo 1</td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ color: '#0078d4', fontWeight: 'bold' }}>
                                <td>{(pRepos?.obj1 || 0).toLocaleString('es-ES')} uds</td>
                            </tr>
                            <tr>
                                <td>
                                    <input
                                        className="input-pct"
                                        type="number" step="0.01"
                                        value={reposEur1}
                                        disabled={!isSuperAdmin || !pctCargados}
                                        onChange={e => { const v = Number(e.target.value); setReposEur1(v); handleSavePct('COMISION_JEFE_REPOSUP_EUR1', v); }}
                                        style={{ opacity: isSuperAdmin ? 1 : 0.7 }}
                                    /> € por alta
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
                                        disabled={!isSuperAdmin || !pctCargados}
                                        onChange={e => { const v = Number(e.target.value); setBafPct1(v); handleSavePct('COMISION_JEFE_BAF_PCT1', v); }}
                                        style={{ opacity: isSuperAdmin ? 1 : 0.7 }}
                                    /> %
                                </td>
                                <td>
                                    <input
                                        className="input-pct"
                                        type="number" step="0.01"
                                        value={bafPct2}
                                        disabled={!isSuperAdmin || !pctCargados}
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
                                        disabled={!isSuperAdmin || !pctCargados}
                                        onChange={e => { const v = Number(e.target.value); setConvPct1(v); handleSavePct('COMISION_JEFE_CONV_PCT1', v); }}
                                        style={{ opacity: isSuperAdmin ? 1 : 0.7 }}
                                    /> %
                                </td>
                                <td>
                                    <input
                                        className="input-pct"
                                        type="number" step="0.01"
                                        value={convPct2}
                                        disabled={!isSuperAdmin || !pctCargados}
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
                                    {pctCargados
                                        ? `${totalCondicionado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                                        : <span style={{ fontSize: 15, color: '#94a3b8' }}>calculando…</span>}
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
                                    {/* Sin los % del mes cargados, esta cifra saldría con los del mes
                                        anterior (o con los defectos del código): mejor no enseñarla. */}
                                    {!pctCargados
                                        ? <span style={{ fontSize: 15, color: '#94a3b8' }}>calculando…</span>
                                        : comisionFinal > 0
                                            ? `${comisionFinal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                                            : '- €'}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    </div>
                </div>

                {/* TABLA PRINCIPAL DE COMERCIALES */}
                <table className="excel-table main-table">
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
                            <th className="header-lightblue" style={{ background: PAL.repos.head }}>Altas Repos UP</th>
                            <th className="header-lightblue" style={{ background: PAL.repos.head }}>Total Altas</th>
                            <th className="header-lightblue" style={{ background: PAL.repos.head }}>Avance de Importe</th>
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
                                            {renderAvance(pDisp.tramos)}
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
                                            {renderAvance(pArpu.tramos)}
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
                                            {renderAvance(pBaf.tramos)}
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
                                            {renderAvance(pConv.tramos)}
                                        </td>
                                    </>
                                )}

                                {/* Altas Repos UP — en unidades, no en euros */}
                                <td className="cell-currency" style={{ background: PAL.repos.tint }}>
                                    {row.reposUds > 0 ? `${row.reposUds.toLocaleString('es-ES')} uds` : '-'}
                                </td>
                                {index === 0 && (
                                    <>
                                        <td rowSpan={tableData.length} style={{ fontWeight: 'bold', fontSize: 13, whiteSpace: 'nowrap', verticalAlign: 'middle', background: PAL.repos.tint }}>
                                            {(pRepos?.uds || 0) > 0 ? `${(pRepos?.uds || 0).toLocaleString('es-ES')} uds` : '-'}
                                        </td>
                                        <td rowSpan={tableData.length} style={{ verticalAlign: 'middle', padding: 0 }}>
                                            {renderAvance(pRepos?.tramos || [])}
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                        {tableData.length === 0 && (
                            <tr>
                                <td colSpan={16} style={{ padding: 24, color: '#64748b' }}>No hay comerciales disponibles.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
