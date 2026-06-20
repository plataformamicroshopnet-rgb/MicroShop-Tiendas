'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useGuard } from '@/hooks/useGuard'
import { PageHeader } from '@/components/PageHeader'
import { Wallet, TrendingUp, TrendingDown, Building2, Briefcase } from 'lucide-react'
import { GANANCIAS_DATA, GananciaRow } from './data'
import { computeMonthMetrics } from '@/lib/modMetrics'
import { computeTerritorialTotal } from '@/lib/territorialConsolidado'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const eur = (n: number | null | undefined) =>
    (n === null || n === undefined) ? '' : Math.round(n).toLocaleString('es-ES') + ' €'

const findTotal = (rows: GananciaRow[], re: RegExp) => {
    const r = rows.find(row => re.test(row.label))
    return r ? r.total : null
}

export default function GananciasPage() {
    const { authorized } = useGuard('MODULE_DIRECCION')

    const years = useMemo(
        () => Object.keys(GANANCIAS_DATA).sort((a, b) => Number(b) - Number(a)),
        []
    )
    const [year, setYear] = useState<string>(years[0])

    // ── Tentáculo: para el año conectado (>=2026) los GASTOS se traen EN VIVO de
    // "Informes de Gastos" (/api/gastos). Cada partida guarda por mes importe_c
    // (Comerciales), importe_r (Tiendas) e importe_dif (Movilfree) de los grupos
    // Gastos Fijos + Variables. => Gastos Tiendas = Tiendas+Movilfree (r+dif);
    // Gastos FFVV = Comerciales (c). Se recalcula al abrir/cambiar de año.
    const LIVE_FROM_YEAR = 2026
    const [gastosOverride, setGastosOverride] = useState<{ tiendas: number[]; ffvv: number[] } | null>(null)

    // ── Tentáculo: "Caja Tiendas" en vivo = Importe Mensual del MOD (Media Operaciones
    // Diaria) de cada mes, desde Junio 2026. Se calcula con la MISMA fuente única que la
    // página MOD (lib/modMetrics → computeMonthMetrics): para cada mes se piden ventas +
    // configs de ese periodo y se obtiene totalImporte. Meses Ene-May 2026 y años previos
    // siguen con el dato estático del Excel.
    const CAJA_FROM_YEAR = 2026
    const CAJA_FROM_MONTH = 6
    const [cajaModOverride, setCajaModOverride] = useState<Record<number, number> | null>(null)

    // ── Tentáculo: "Comisiones Tiendas Locales" en vivo = "Total Consolidado Tiendas" de
    // Territorial PDV de cada mes, desde Junio 2026. Misma fuente única que la página
    // Territorial (lib/territorialConsolidado → computeTerritorialTotal): por cada mes se
    // piden ventas + reglas tienda/territorial + catálogos y se suma el importe de las
    // palancas. Meses Ene-May 2026 y años previos siguen con el dato estático del Excel.
    const [comisLocalesOverride, setComisLocalesOverride] = useState<Record<number, number> | null>(null)

    // ── Tentáculo: fila "PRV" en vivo desde el ERP (mi-nuevo-erp). El scheduler del ERP
    // publica el "Beneficio Neto Total" mensual del PRV en /api/prv-feed (POST con secreto)
    // y aquí se lee (GET). Aplica desde Septiembre 2025. Meses previos: dato del Excel.
    const PRV_FROM_YEAR = 2025
    const PRV_FROM_MONTH = 9
    const [prvOverride, setPrvOverride] = useState<Record<number, number> | null>(null)

    useEffect(() => {
        setGastosOverride(null)
        if (Number(year) < LIVE_FROM_YEAR) return
        let cancel = false
        fetch(`/api/gastos?year=${year}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(d => {
                if (cancel || !d?.success || !Array.isArray(d.data)) return
                const tiendas = new Array(12).fill(0)
                const ffvv = new Array(12).fill(0)
                let any = false
                d.data.forEach((g: any) => {
                    if (g.grupo === 'Gastos Fijos' || g.grupo === 'Gastos Variables') {
                        const m = (Number(g.month) || 1) - 1
                        if (m < 0 || m > 11) return
                        tiendas[m] += (Number(g.importe_r) || 0) + (Number(g.importe_dif) || 0)
                        ffvv[m] += (Number(g.importe_c) || 0)
                        any = true
                    }
                })
                if (any) setGastosOverride({ tiendas, ffvv })
            })
            .catch(() => {})
        return () => { cancel = true }
    }, [year])

    useEffect(() => {
        setCajaModOverride(null)
        const yNum = Number(year)
        if (yNum < CAJA_FROM_YEAR) return
        const now = new Date()
        const isCurrentYear = yNum === now.getFullYear()
        const lastMonth = isCurrentYear ? (now.getMonth() + 1) : 12
        const startMonth = yNum === CAJA_FROM_YEAR ? CAJA_FROM_MONTH : 1
        const months: number[] = []
        for (let m = startMonth; m <= lastMonth; m++) months.push(m)
        if (months.length === 0) return

        let cancel = false
        const j = (r: Response) => r.json()
        ;(async () => {
            try {
                // Datos compartidos (no dependen del mes)
                const [catRes, periodsRes, mfSales, mfProducts] = await Promise.all([
                    fetch('/api/catalogs', { cache: 'no-store' }).then(j).catch(() => ({ catalogs: {} })),
                    fetch('/api/period', { cache: 'no-store' }).then(j).catch(() => ({ periods: [] })),
                    fetch('/api/movilfree/sales', { cache: 'no-store' }).then(j).catch(() => []),
                    fetch('/api/movilfree/products', { cache: 'no-store' }).then(j).catch(() => []),
                ])
                const result: Record<number, number> = {}
                for (const m of months) {
                    const pk = `${yNum}_${String(m).padStart(2, '0')}`
                    const [salesRes, objData, pymeData, plusData, extrasData] = await Promise.all([
                        fetch(`/api/sales?periodKey=${pk}`, { cache: 'no-store' }).then(j).catch(() => ({ logs: [] })),
                        fetch(`/api/objetivos?periodKey=${pk}&strictPeriod=1`, { cache: 'no-store' }).then(j).catch(() => ({})),
                        fetch(`/api/importes-pyme?periodKey=${pk}&strictPeriod=1`, { cache: 'no-store' }).then(j).catch(() => ({})),
                        fetch(`/api/importes-plus?periodKey=${pk}&strictPeriod=1`, { cache: 'no-store' }).then(j).catch(() => ({})),
                        fetch(`/api/extras/assignments?periodKey=${pk}`, { cache: 'no-store' }).then(j).catch(() => ({})),
                    ])
                    if (cancel) return
                    const metrics = computeMonthMetrics({
                        salesRaw: salesRes.logs || [],
                        configs: [objData, pymeData, plusData, extrasData],
                        catalogs: catRes.catalogs || {},
                        periods: periodsRes.periods || [],
                        mfSales: mfSales || [],
                        mfProducts: mfProducts || [],
                        year: yNum,
                        month: m,
                        periodKeyForConfig: pk,
                    })
                    result[m] = metrics.totalImporte
                }
                if (!cancel) setCajaModOverride(result)
            } catch { /* sin conexión: se queda el dato del Excel */ }
        })()
        return () => { cancel = true }
    }, [year])

    useEffect(() => {
        setComisLocalesOverride(null)
        const yNum = Number(year)
        if (yNum < CAJA_FROM_YEAR) return
        const now = new Date()
        const isCurrentYear = yNum === now.getFullYear()
        const lastMonth = isCurrentYear ? (now.getMonth() + 1) : 12
        const startMonth = yNum === CAJA_FROM_YEAR ? CAJA_FROM_MONTH : 1
        const months: number[] = []
        for (let m = startMonth; m <= lastMonth; m++) months.push(m)
        if (months.length === 0) return

        let cancel = false
        const j = (r: Response) => r.json()
        ;(async () => {
            try {
                const catRes = await fetch('/api/catalogs', { cache: 'no-store' }).then(j).catch(() => ({ catalogs: {} }))
                const result: Record<number, number> = {}
                for (const m of months) {
                    const pk = `${yNum}_${String(m).padStart(2, '0')}`
                    const [salesRes, tiendasRes, territorialRes] = await Promise.all([
                        fetch(`/api/sales?periodKey=${pk}&dashboard=true`, { cache: 'no-store' }).then(j).catch(() => ({ logs: [] })),
                        fetch(`/api/tiendas-comisiones?periodKey=${pk}`, { cache: 'no-store' }).then(j).catch(() => ({ rules: [] })),
                        fetch(`/api/territorial?periodKey=${pk}`, { cache: 'no-store' }).then(j).catch(() => ({ tiendas: [] })),
                    ])
                    if (cancel) return
                    result[m] = computeTerritorialTotal({
                        sales: salesRes.logs || [],
                        tiendaRules: tiendasRes.rules || [],
                        territorialRules: territorialRes.tiendas || [],
                        catalogs: catRes.catalogs || {},
                    })
                }
                if (!cancel) setComisLocalesOverride(result)
            } catch { /* sin conexión: se queda el dato del Excel */ }
        })()
        return () => { cancel = true }
    }, [year])

    useEffect(() => {
        setPrvOverride(null)
        const yNum = Number(year)
        if (yNum < PRV_FROM_YEAR) return
        let cancel = false
        fetch('/api/prv-feed', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => {
                if (cancel || !d?.success || !d.data) return
                const ov: Record<number, number> = {}
                for (let m = 1; m <= 12; m++) {
                    // Respetar "desde Septiembre 2025"
                    if (yNum === PRV_FROM_YEAR && m < PRV_FROM_MONTH) continue
                    const key = `${yNum}_${String(m).padStart(2, '0')}`
                    const v = d.data[key]
                    if (v !== undefined && v !== null && !isNaN(Number(v))) ov[m] = Number(v)
                }
                if (Object.keys(ov).length) setPrvOverride(ov)
            })
            .catch(() => {})
        return () => { cancel = true }
    }, [year])

    const rows = GANANCIAS_DATA[year] || []

    const displayRows: GananciaRow[] = useMemo(() => {
        if (!gastosOverride && !cajaModOverride && !comisLocalesOverride && !prvOverride) return rows
        const build = (months: number[]) => {
            const total = months.reduce((a, b) => a + b, 0)
            const active = months.filter(m => m !== 0).length
            return { months, total, media: active ? total / active : null }
        }
        // Sustituye, mes a mes, los valores del Excel por los del override (solo los meses
        // que tienen dato en vivo; el resto se queda como estaba) y recalcula Total/Media.
        const applyMonthly = (row: GananciaRow, ov: Record<number, number>): GananciaRow => {
            const months = row.months.map((v, i) => ov[i + 1] !== undefined ? ov[i + 1] : v)
            const nums = months.filter((x): x is number => x !== null && x !== undefined)
            const total = nums.reduce((a, b) => a + b, 0)
            const active = months.filter(m => m !== null && m !== undefined && m !== 0).length
            return { label: row.label, months, total, media: active ? total / active : null }
        }
        return rows.map(row => {
            if (gastosOverride && row.label === 'Gastos Tiendas') return { label: row.label, ...build(gastosOverride.tiendas) }
            if (gastosOverride && row.label === 'Gastos FFVV') return { label: row.label, ...build(gastosOverride.ffvv) }
            if (cajaModOverride && row.label === 'Caja Tiendas') return applyMonthly(row, cajaModOverride)
            if (comisLocalesOverride && row.label === 'Comisiones Tiendas Locales') return applyMonthly(row, comisLocalesOverride)
            if (prvOverride && row.label === 'PRV') return applyMonthly(row, prvOverride)
            return row
        })
    }, [rows, gastosOverride, cajaModOverride, comisLocalesOverride, prvOverride])

    const gTiendas = findTotal(rows, /real ganancias tiendas/i)
    const gFFVV = findTotal(rows, /real ganancias ffvv/i)
    const gTotal = findTotal(rows, /^total ganancias/i)
        ?? ((gTiendas || 0) + (gFFVV || 0))

    if (authorized === null) {
        return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>
    }

    const isGanancia = (label: string) => /real ganancias|^total ganancias/i.test(label)
    const isSubtotal = (label: string) => /^diferencia$/i.test(label)

    const kpi = (label: string, value: number | null, Icon: any, accent: string) => (
        <div style={{
            flex: 1, minWidth: 200, background: 'var(--bg-card)', border: '1px solid var(--border-light)',
            borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 4px 12px rgba(15,23,42,0.05)'
        }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: accent + '22', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={24} />
            </div>
            <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: (value ?? 0) >= 0 ? '#16a34a' : '#dc2626', marginTop: 2 }}>
                    {value === null || value === undefined ? '—' : eur(value)}
                </div>
            </div>
        </div>
    )

    return (
        <div style={{ padding: '20px 24px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
            <PageHeader
                title={<span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Wallet color="#00adef" size={28} /> Ganancias desde el 2014</span>}
                subtitle="Ingresos, gastos y rentabilidad por año (Tiendas + FFVV)"
                showBack={true}
                backFallback="/direccion-tiendas"
            />

            {/* Selector de años */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '20px 0' }}>
                {years.map(y => {
                    const active = y === year
                    return (
                        <button
                            key={y}
                            onClick={() => setYear(y)}
                            style={{
                                padding: '7px 16px', borderRadius: 20, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                                border: active ? 'none' : '1px solid var(--border-strong)',
                                background: active ? 'var(--mercedes-cyan)' : 'var(--bg-card)',
                                color: active ? '#fff' : 'var(--text-muted)',
                                boxShadow: active ? '0 4px 12px rgba(0,173,239,0.3)' : 'none',
                                transition: 'all 0.15s'
                            }}
                        >
                            {y}
                        </button>
                    )
                })}
            </div>

            {/* KPIs del año */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                {kpi('Real Ganancias Tiendas', gTiendas, Building2, '#a855f7')}
                {gFFVV !== null && kpi('Real Ganancias FFVV', gFFVV, Briefcase, '#0ea5e9')}
                {kpi(`Total Ganancias ${year}`, gTotal, (gTotal ?? 0) >= 0 ? TrendingUp : TrendingDown, '#22c55e')}
            </div>

            {(gastosOverride || cajaModOverride || comisLocalesOverride || prvOverride) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: '#0369a1', fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    Ingresos Gastos ({year})
                </div>
            )}

            {/* Tabla detalle mensual */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap', minWidth: 1100 }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(90deg, #0ea5e9, #0284c7)', color: '#fff' }}>
                                <th style={{ padding: '7px 12px', textAlign: 'left', position: 'sticky', left: 0, background: '#0ea5e9', minWidth: 210 }}>Concepto</th>
                                {MESES.map(m => <th key={m} style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700 }}>{m}</th>)}
                                <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, borderLeft: '2px solid rgba(255,255,255,0.25)' }}>Total</th>
                                <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>Media</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayRows.map((row, ri) => {
                                const gan = isGanancia(row.label)
                                const sub = isSubtotal(row.label)
                                const cobrado = /total cobrado/i.test(row.label)
                                const rojo = ['Gastos Tiendas', 'Comisiones Tiendas', 'Gastos FFVV'].includes(row.label)
                                const tip = row.label === 'Gastos Tiendas'
                                    ? (gastosOverride ? 'En vivo de «Informes de Gastos»: Tiendas + Movilfree (Total gastos Fijos + Variables)' : 'Dato del Excel «Ganancias 2014-2026»')
                                    : row.label === 'Gastos FFVV'
                                    ? (gastosOverride ? 'En vivo de «Informes de Gastos»: Comerciales (Total gastos Fijos + Variables)' : 'Dato del Excel «Ganancias 2014-2026»')
                                    : row.label === 'Caja Tiendas'
                                    ? (cajaModOverride ? 'En vivo de «MOD» (Media Operaciones Diaria): Importe Mensual del mes (comisiones reales + MovilFree)' : 'Dato del Excel «Ganancias 2014-2026»')
                                    : row.label === 'Comisiones Tiendas Locales'
                                    ? (comisLocalesOverride ? 'En vivo de «Territorial PDV»: Total Consolidado Tiendas (suma de las palancas territoriales)' : 'Dato del Excel «Ganancias 2014-2026»')
                                    : row.label === 'PRV'
                                    ? (prvOverride ? 'En vivo del ERP «mi-nuevo-erp»: Retribución Variable (PRV), Beneficio Neto Total del mes' : 'Dato del Excel «Ganancias 2014-2026»')
                                    : row.label === 'Comisiones Tiendas'
                                    ? 'Dato del Excel «Ganancias 2014-2026»'
                                    : undefined
                                const bg = gan ? 'rgba(34,197,94,0.10)' : (sub ? 'rgba(2,132,199,0.06)' : (cobrado ? '#bfdbfe' : (ri % 2 === 0 ? 'transparent' : 'var(--active-bg)')))
                                const totalColor = (gan || sub)
                                    ? ((row.total ?? 0) >= 0 ? '#16a34a' : '#dc2626')
                                    : 'var(--text-main)'
                                return (
                                    <tr key={ri} style={{ background: bg, borderBottom: '1px solid var(--border-light)' }}>
                                        <td title={tip} style={{ padding: '4px 12px', textAlign: 'left', fontWeight: gan ? 800 : 600, color: rojo ? '#dc2626' : 'var(--text-main)', position: 'sticky', left: 0, background: gan ? '#dcfce7' : (sub ? '#e0f2fe' : (cobrado ? '#bfdbfe' : 'var(--bg-card)')), cursor: tip ? 'help' : undefined }}>
                                            {row.label}
                                        </td>
                                        {row.months.map((v, mi) => {
                                            const neg = v != null && v < 0
                                            const c = (rojo || neg) ? '#dc2626' : (gan ? '#16a34a' : 'var(--text-muted)')
                                            return (
                                                <td key={mi} style={{ padding: '4px 8px', textAlign: 'right', color: c, fontWeight: (gan || rojo) ? 700 : 400 }}>
                                                    {eur(v)}
                                                </td>
                                            )
                                        })}
                                        <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: 800, color: (rojo || (row.total != null && row.total < 0)) ? '#dc2626' : totalColor, borderLeft: '2px solid var(--border-light)' }}>{eur(row.total)}</td>
                                        <td style={{ padding: '4px 10px', textAlign: 'right', color: (rojo || (row.media != null && row.media < 0)) ? '#dc2626' : 'var(--text-muted)', fontWeight: 600 }}>{eur(row.media)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                Fase 1: cifras importadas del Excel «Ganancias 2014-2026». En la Fase 2 se automatizarán desde la base de datos.
            </p>
        </div>
    )
}
