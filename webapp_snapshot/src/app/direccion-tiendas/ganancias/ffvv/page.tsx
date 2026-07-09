'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useGuard } from '@/hooks/useGuard'
import { PageHeader } from '@/components/PageHeader'
import { Users, ArrowLeft, Briefcase } from 'lucide-react'
import { GANANCIAS_DATA } from '../data'

const eur = (n: number | null | undefined) =>
    (n === null || n === undefined) ? '—' : Math.round(n).toLocaleString('es-ES') + ' €'
const eur2 = (n: number | null | undefined) =>
    (n === null || n === undefined || !isFinite(n)) ? '—'
        : n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'

// "Dividido entre 7 Comerciales" / "Dividido entre 9,83 Comerciales" → 7 / 9.83
const parseDiv = (label: string): number | null => {
    const m = label.match(/Dividido entre\s+([\d.,]+)/i)
    if (!m) return null
    const v = parseFloat(m[1].replace(',', '.'))
    return isFinite(v) ? v : null
}

const LS_KEY = 'ffvv_comerciales_v1'
type ComMap = Record<string, { plus?: string; basico?: string }>

export default function FFVVGananciasPage() {
    const { authorized } = useGuard('MODULE_DIRECCION')
    const [coms, setComs] = useState<ComMap>({})

    useEffect(() => {
        try { const raw = localStorage.getItem(LS_KEY); if (raw) setComs(JSON.parse(raw)) } catch { /* noop */ }
    }, [])

    const setCom = (year: string, tipo: 'plus' | 'basico', val: string) => {
        const next: ComMap = { ...coms, [year]: { ...(coms[year] || {}), [tipo]: val } }
        setComs(next)
        try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch { /* noop */ }
    }

    // Datos por año: T. Importe FFVV, Producción Plus/Básico y el Nº histórico de comerciales.
    const filas = useMemo(() => {
        const out: {
            year: string; tFFVV: number | null; prodPlus: number | null; prodBasico: number | null;
            nPlusHist: number | null; nBasicoHist: number | null;
        }[] = []
        for (const year of Object.keys(GANANCIAS_DATA)) {
            const rows = GANANCIAS_DATA[year]
            const tFFVV = rows.find(r => /^Total Ingresos FFVV/.test(r.label))?.total ?? null
            const prodPlus = rows.find(r => /Producci[oó]n Plus/i.test(r.label))?.total ?? null
            const prodBasico = rows.find(r => /Producci[oó]n B[aá]sico/i.test(r.label))?.total ?? null
            if (tFFVV == null && prodPlus == null && prodBasico == null) continue
            const divs = rows.filter(r => /Dividido entre/i.test(r.label))
            out.push({
                year, tFFVV, prodPlus, prodBasico,
                nPlusHist: divs[0] ? parseDiv(divs[0].label) : null,
                nBasicoHist: divs[1] ? parseDiv(divs[1].label) : null,
            })
        }
        return out.sort((a, b) => b.year.localeCompare(a.year))
    }, [])

    const nFor = (f: typeof filas[number], tipo: 'plus' | 'basico'): number | null => {
        const saved = coms[f.year]?.[tipo]
        if (saved !== undefined && saved !== '') { const v = parseFloat(saved.replace(',', '.')); return isFinite(v) ? v : null }
        return tipo === 'plus' ? f.nPlusHist : f.nBasicoHist
    }
    const perCom = (prod: number | null, n: number | null): number | null =>
        (prod == null || n == null || n <= 0) ? null : prod / n

    if (!authorized) return null

    const th: React.CSSProperties = { padding: '9px 10px', textAlign: 'center', fontWeight: 700, borderLeft: '1px solid rgba(255,255,255,0.18)', whiteSpace: 'nowrap' }
    const td: React.CSSProperties = { padding: '7px 10px', textAlign: 'right', borderLeft: '1px solid var(--border-light)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
    const inp: React.CSSProperties = { width: 58, padding: '4px 6px', textAlign: 'center', border: '1px solid #93c5fd', borderRadius: 6, fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-main)', outline: 'none', fontWeight: 700 }

    return (
        <div style={{ padding: '20px 24px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
            <PageHeader
                title={<span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Users color="#00adef" size={28} /> FFVV — Reparto por comercial</span>}
                subtitle="Importes de la fuerza de ventas por año (automáticos de Ganancias). Pon el Nº de comerciales de Plus y Básico y verás el reparto por comercial."
            />

            <Link href="/direccion-tiendas/ganancias" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                <ArrowLeft size={16} /> Volver a Ganancias
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: '#0369a1', fontWeight: 600 }}>
                <Briefcase size={14} /> El Nº de comerciales se guarda en este navegador; el € por comercial se recalcula solo (Producción ÷ Nº).
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(90deg, #0ea5e9, #0284c7)', color: '#fff' }}>
                                <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 800 }}>Año</th>
                                <th style={th}>T. Importe FFVV</th>
                                <th style={{ ...th, borderLeft: '2px solid rgba(255,255,255,0.3)' }}>Producción Plus</th>
                                <th style={th}>Nº Com. Plus</th>
                                <th style={th}>€ / comercial Plus</th>
                                <th style={{ ...th, borderLeft: '2px solid rgba(255,255,255,0.3)' }}>Producción Básico</th>
                                <th style={th}>Nº Com. Básico</th>
                                <th style={th}>€ / comercial Básico</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((f, i) => {
                                const nP = nFor(f, 'plus'), nB = nFor(f, 'basico')
                                return (
                                    <tr key={f.year} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--active-bg)', borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 800, color: 'var(--text-main)' }}>{f.year}</td>
                                        <td style={{ ...td, fontWeight: 700, color: '#0284c7' }}>{eur(f.tFFVV)}</td>
                                        <td style={{ ...td, borderLeft: '2px solid var(--border-light)', color: 'var(--text-main)' }}>{eur(f.prodPlus)}</td>
                                        <td style={{ ...td, textAlign: 'center' }}>
                                            <input type="number" step="0.01" min="0" value={coms[f.year]?.plus ?? (f.nPlusHist != null ? String(f.nPlusHist) : '')}
                                                onChange={e => setCom(f.year, 'plus', e.target.value)} style={inp} />
                                        </td>
                                        <td style={{ ...td, fontWeight: 800, color: '#16a34a' }}>{eur2(perCom(f.prodPlus, nP))}</td>
                                        <td style={{ ...td, borderLeft: '2px solid var(--border-light)', color: 'var(--text-main)' }}>{eur(f.prodBasico)}</td>
                                        <td style={{ ...td, textAlign: 'center' }}>
                                            <input type="number" step="0.01" min="0" value={coms[f.year]?.basico ?? (f.nBasicoHist != null ? String(f.nBasicoHist) : '')}
                                                onChange={e => setCom(f.year, 'basico', e.target.value)} style={inp} />
                                        </td>
                                        <td style={{ ...td, fontWeight: 800, color: '#16a34a' }}>{eur2(perCom(f.prodBasico, nB))}</td>
                                    </tr>
                                )
                            })}
                            {filas.length === 0 && (
                                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No hay datos de FFVV.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
