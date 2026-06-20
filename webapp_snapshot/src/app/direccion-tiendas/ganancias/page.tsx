'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useGuard } from '@/hooks/useGuard'
import { PageHeader } from '@/components/PageHeader'
import { Wallet, TrendingUp, TrendingDown, Building2, Briefcase } from 'lucide-react'
import { GANANCIAS_DATA, GananciaRow } from './data'

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

    const rows = GANANCIAS_DATA[year] || []

    const displayRows: GananciaRow[] = useMemo(() => {
        if (!gastosOverride) return rows
        const build = (months: number[]) => {
            const total = months.reduce((a, b) => a + b, 0)
            const active = months.filter(m => m !== 0).length
            return { months, total, media: active ? total / active : null }
        }
        return rows.map(row => {
            if (row.label === 'Gastos Tiendas') return { label: row.label, ...build(gastosOverride.tiendas) }
            if (row.label === 'Gastos FFVV') return { label: row.label, ...build(gastosOverride.ffvv) }
            return row
        })
    }, [rows, gastosOverride])

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

            {gastosOverride && (
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
