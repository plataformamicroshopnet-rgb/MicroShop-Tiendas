'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useGuard } from '@/hooks/useGuard'
import { PageHeader } from '@/components/PageHeader'
import { Users, ArrowLeft, Info } from 'lucide-react'
import { GANANCIAS_DATA } from '../data'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// € con 2 decimales (formato del ejemplo: "5.368,32 €")
const eur2 = (n: number | null | undefined) =>
    (n === null || n === undefined || !isFinite(n)) ? '—'
        : n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

// media de los valores no vacíos
const media = (vals: (number | null)[]): number | null => {
    const ok = vals.filter((v): v is number => v != null && isFinite(v))
    return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null
}

const LS_KEY = 'ffvv_reparto_v1'
const DEF: Record<'ffvv' | 'banquillo', number> = { ffvv: 6, banquillo: 7 }

type NCfg = { base?: string; m?: Record<number, string> }
type NMap = Record<string, { ffvv?: NCfg; banquillo?: NCfg }>
type RowKey = 'ffvv' | 'banquillo'

// Importe mensual que se reparte = fila «Total Ingresos FFVV» de ese año (32.209,94 €
// en enero-2025 → ÷6 = 5.368,32 €, que cuadra con el ejemplo).
function importeFFVVMonths(year: string): (number | null)[] | null {
    const rows = GANANCIAS_DATA[year]
    if (!rows) return null
    const r = rows.find(row => /^Total Ingresos FFVV/i.test(row.label))
    return r ? r.months : null
}

export default function FFVVGananciasPage() {
    const { authorized } = useGuard('MODULE_DIRECCION')
    const [nmap, setNmap] = useState<NMap>({})

    useEffect(() => {
        try { const raw = localStorage.getItem(LS_KEY); if (raw) setNmap(JSON.parse(raw)) } catch { /* noop */ }
    }, [])
    const persist = (next: NMap) => { setNmap(next); try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch { /* noop */ } }

    const setBase = (year: string, key: RowKey, val: string) =>
        persist({ ...nmap, [year]: { ...(nmap[year] || {}), [key]: { base: val, m: {} } } })   // «aplicar a todos»
    const setMonth = (year: string, key: RowKey, m: number, val: string) => {
        const cur = nmap[year]?.[key] || {}
        persist({ ...nmap, [year]: { ...(nmap[year] || {}), [key]: { ...cur, m: { ...(cur.m || {}), [m]: val } } } })
    }
    const nFor = (year: string, key: RowKey, m: number): number => {
        const cfg = nmap[year]?.[key]
        const parse = (s?: string) => { if (s === undefined || s === '') return null; const v = parseFloat(s.replace(',', '.')); return isFinite(v) && v > 0 ? v : null }
        return parse(cfg?.m?.[m]) ?? parse(cfg?.base) ?? DEF[key]
    }

    const years = useMemo(() => Object.keys(GANANCIAS_DATA)
        .filter(y => { const p = importeFFVVMonths(y); return p && p.some(v => v != null) })
        .sort((a, b) => b.localeCompare(a)), [])

    if (!authorized) return null

    const thBlue: React.CSSProperties = { padding: '8px 6px', textAlign: 'center', fontWeight: 700, borderLeft: '1px solid rgba(255,255,255,0.2)', whiteSpace: 'nowrap', fontSize: 12 }
    const nInput: React.CSSProperties = { width: 40, padding: '2px 3px', textAlign: 'center', border: '1px solid #93c5fd', borderRadius: 5, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-main)', outline: 'none', fontWeight: 700 }

    const renderYear = (year: string) => {
        const prv = importeFFVVMonths(year) || []
        const ROWS: { key: RowKey; label: string }[] = [
            { key: 'ffvv', label: 'PRV FFVV' },
            { key: 'banquillo', label: 'PRV FFVV + Banquillo' },
        ]
        return (
            <div key={year} style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', marginBottom: 18 }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(90deg, #0ea5e9, #0284c7)', color: '#fff' }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, minWidth: 190 }}>Ingresos y Gastos {year}</th>
                                <th style={{ ...thBlue, borderLeft: '2px solid rgba(255,255,255,0.3)' }}>Nº Com.</th>
                                {MESES.map(m => <th key={m} style={thBlue}>{m}</th>)}
                                <th style={{ ...thBlue, borderLeft: '2px solid rgba(255,255,255,0.3)', fontWeight: 800 }}>Totales</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ROWS.map((r, ri) => {
                                const vals = MESES.map((_, m) => { const n = nFor(year, r.key, m); return (prv[m] != null && n > 0) ? (prv[m] as number) / n : null })
                                const isBanq = r.key === 'banquillo'
                                return (
                                    <tr key={r.key} style={{ background: isBanq ? 'rgba(2,132,199,0.06)' : 'transparent', borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '6px 12px', textAlign: 'left', fontWeight: isBanq ? 800 : 700, color: 'var(--text-main)' }}>{r.label}</td>
                                        <td style={{ padding: '4px 4px', textAlign: 'center', borderLeft: '2px solid var(--border-light)' }}>
                                            <input type="number" step="0.01" min="0" title="Aplica a todos los meses"
                                                value={nmap[year]?.[r.key]?.base ?? String(DEF[r.key])}
                                                onChange={e => setBase(year, r.key, e.target.value)} style={{ ...nInput, width: 46 }} />
                                        </td>
                                        {MESES.map((_, m) => (
                                            <td key={m} style={{ padding: '3px 4px', textAlign: 'center', borderLeft: '1px solid var(--border-light)', fontVariantNumeric: 'tabular-nums' }}>
                                                <input type="number" step="0.01" min="0" title="Nº comerciales de este mes"
                                                    value={String(nFor(year, r.key, m))}
                                                    onChange={e => setMonth(year, r.key, m, e.target.value)} style={nInput} />
                                                <div style={{ fontWeight: 700, color: '#16a34a', marginTop: 2, fontSize: 11.5 }}>{eur2(vals[m])}</div>
                                            </td>
                                        ))}
                                        <td style={{ padding: '4px 8px', textAlign: 'right', borderLeft: '2px solid var(--border-light)', fontWeight: 800, color: '#0284c7', fontVariantNumeric: 'tabular-nums' }}>{eur2(media(vals))}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    return (
        <div style={{ padding: '20px 24px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
            <PageHeader
                title={<span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Users color="#00adef" size={28} /> FFVV — Reparto por comercial</span>}
                subtitle="Reparto del PRV FFVV entre los comerciales, por año y mes. Pon el Nº de comerciales de cada mes (fila normal y fila con banquillo) y el € por comercial se recalcula solo. Totales = media de los meses."
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                <Link href="/direccion-tiendas/ganancias" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                    <ArrowLeft size={16} /> Volver a Ganancias
                </Link>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0369a1', fontWeight: 600 }}>
                    <Info size={14} /> El importe FFVV mensual (T. Importe FFVV) se coge automático de Ganancias; el Nº de comerciales lo pones tú (se guarda en este navegador). La casilla «Nº Com.» aplica a todos los meses; luego puedes afinar mes a mes.
                </span>
            </div>

            {years.length === 0
                ? <div style={{ padding: 24, color: 'var(--text-muted)' }}>No hay datos de PRV FFVV.</div>
                : years.map(renderYear)}
        </div>
    )
}
