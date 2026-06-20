'use client'

import React, { useState, useMemo } from 'react'
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

    const rows = GANANCIAS_DATA[year] || []

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
                            {rows.map((row, ri) => {
                                const gan = isGanancia(row.label)
                                const sub = isSubtotal(row.label)
                                const cobrado = /total cobrado/i.test(row.label)
                                const bg = gan ? 'rgba(34,197,94,0.10)' : (sub ? 'rgba(2,132,199,0.06)' : (cobrado ? '#bfdbfe' : (ri % 2 === 0 ? 'transparent' : 'var(--active-bg)')))
                                const totalColor = (gan || sub)
                                    ? ((row.total ?? 0) >= 0 ? '#16a34a' : '#dc2626')
                                    : 'var(--text-main)'
                                return (
                                    <tr key={ri} style={{ background: bg, borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '3px 12px', textAlign: 'left', fontWeight: gan ? 800 : 600, color: 'var(--text-main)', position: 'sticky', left: 0, background: gan ? '#dcfce7' : (sub ? '#e0f2fe' : (cobrado ? '#bfdbfe' : 'var(--bg-card)')) }}>
                                            {row.label}
                                        </td>
                                        {row.months.map((v, mi) => (
                                            <td key={mi} style={{ padding: '3px 8px', textAlign: 'right', color: gan ? totalColor : 'var(--text-muted)', fontWeight: gan ? 700 : 400 }}>
                                                {eur(v)}
                                            </td>
                                        ))}
                                        <td style={{ padding: '3px 10px', textAlign: 'right', fontWeight: 800, color: totalColor, borderLeft: '2px solid var(--border-light)' }}>{eur(row.total)}</td>
                                        <td style={{ padding: '3px 10px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>{eur(row.media)}</td>
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
