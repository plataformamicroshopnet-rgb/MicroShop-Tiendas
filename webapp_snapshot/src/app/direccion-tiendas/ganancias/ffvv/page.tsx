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

// Clave del navegador de la época anterior. Se sigue leyendo UNA vez para
// rescatar lo que hubiera y subirlo al servidor; ya no se escribe en ella.
const LS_KEY = 'ffvv_reparto_v2'
// La misma clave, ahora en AppSetting (servidor): se teclea una vez y lo ve
// todo el mundo, no solo el navegador donde se escribió.
const CLAVE = 'ffvv_reparto_v2'
const DEF: Record<'ffvv' | 'banquillo', number> = { ffvv: 6, banquillo: 7 }

type RowKey = 'ffvv' | 'banquillo'
type NMap = Record<string, Partial<Record<RowKey, string>>>   // año -> { ffvv:"6", banquillo:"7" }

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
    const [estado, setEstado] = useState<string>('')

    // ── El Nº de comerciales de cada año ───────────────────────────────────────
    // ANTES vivía en localStorage, la libretita privada del navegador: no llegaba
    // al servidor, así que desde otro ordenador la tabla volvía a dividir por los
    // valores de fábrica y nadie se enteraba. Ahora va a AppSetting, como el resto.
    const temporizador = React.useRef<any>(null)

    const guardar = (mapa: NMap, inmediato = false) => {
        if (temporizador.current) clearTimeout(temporizador.current)
        setEstado('Guardando…')
        const hacer = async () => {
            try {
                const r = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: CLAVE, value: JSON.stringify(mapa) }),
                })
                const j = await r.json().catch(() => ({}))
                setEstado(r.ok && j?.success ? 'Guardado' : (j?.error || 'No se ha podido guardar.'))
            } catch {
                setEstado('No se ha podido guardar.')
            }
        }
        if (inmediato) hacer(); else temporizador.current = setTimeout(hacer, 700)
    }

    useEffect(() => {
        let vivo = true
        ;(async () => {
            try {
                const r = await fetch(`/api/settings?key=${encodeURIComponent(CLAVE)}`)
                const j = await r.json().catch(() => ({}))
                let mapa: NMap = {}
                if (typeof j?.value === 'string' && j.value) {
                    try { mapa = JSON.parse(j.value) } catch { mapa = {} }
                }
                // Rescate: lo que quedara en ESTE navegador se sube al servidor.
                // Solo si el servidor no tiene NADA, para que borrarlo a propósito
                // no lo resucite en el siguiente refresco.
                if (j?.value === null || j?.value === undefined) {
                    try {
                        const raw = localStorage.getItem(LS_KEY)
                        if (raw) { mapa = JSON.parse(raw); guardar(mapa, true) }
                    } catch { /* noop */ }
                }
                if (vivo) setNmap(mapa)
            } catch {
                // Sin servidor, la tabla se queda con los valores de fábrica.
            }
        })()
        return () => { vivo = false }
    }, [])

    const setN = (year: string, key: RowKey, val: string) => {
        const next = { ...nmap, [year]: { ...(nmap[year] || {}), [key]: val } }
        setNmap(next)
        guardar(next)
    }
    /** true si el número lo ha puesto una persona; false si es el de fábrica. */
    const esPuesto = (year: string, key: RowKey): boolean => {
        const s = nmap[year]?.[key]
        if (s === undefined || s === '') return false
        const v = parseFloat(String(s).replace(',', '.'))
        return isFinite(v) && v > 0
    }
    const nFor = (year: string, key: RowKey): number => {
        const s = nmap[year]?.[key]
        if (s !== undefined && s !== '') { const v = parseFloat(s.replace(',', '.')); if (isFinite(v) && v > 0) return v }
        return DEF[key]
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
                            {ROWS.map((r) => {
                                const n = nFor(year, r.key)
                                const vals = prv.map(v => (v != null && n > 0) ? v / n : null)
                                const isBanq = r.key === 'banquillo'
                                return (
                                    <tr key={r.key} style={{ background: isBanq ? 'rgba(2,132,199,0.06)' : 'transparent', borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '10px 12px', textAlign: 'left', fontWeight: isBanq ? 800 : 700, color: 'var(--text-main)' }}>{r.label}</td>
                                        <td style={{ padding: '6px 4px', textAlign: 'center', borderLeft: '2px solid var(--border-light)' }}>
                                            {/* Si el número es el de fábrica se marca en ámbar: si no, la
                                                tabla enseñaba un € por comercial dividido entre 6 o 7 sin que
                                                nadie lo hubiera dicho, y parecía un dato bueno. */}
                                            <input type="number" step="1" min="1"
                                                title={esPuesto(year, r.key)
                                                    ? 'Nº de comerciales del año (divide todos los meses de esta fila)'
                                                    : `Valor de fábrica (${DEF[r.key]}): nadie ha puesto el nº de comerciales de ${year}`}
                                                value={nmap[year]?.[r.key] ?? String(DEF[r.key])}
                                                onChange={e => setN(year, r.key, e.target.value)}
                                                style={{
                                                    ...nInput, width: 46,
                                                    borderColor: esPuesto(year, r.key) ? '#93c5fd' : '#f59e0b',
                                                    color: esPuesto(year, r.key) ? 'var(--text-main)' : '#f59e0b',
                                                }} />
                                        </td>
                                        {MESES.map((_, m) => (
                                            <td key={m} style={{ padding: '10px 6px', textAlign: 'center', borderLeft: '1px solid var(--border-light)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#16a34a', fontSize: 12.5 }}>
                                                {eur2(vals[m])}
                                            </td>
                                        ))}
                                        <td style={{ padding: '10px 10px', textAlign: 'right', borderLeft: '2px solid var(--border-light)', fontWeight: 800, color: '#0284c7', fontVariantNumeric: 'tabular-nums' }}>{eur2(media(vals))}</td>
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
                subtitle="Reparto del PRV FFVV entre los comerciales, por año. Pon el Nº de comerciales del año en cada fila (normal y con banquillo) y el € por comercial de cada mes se recalcula solo. Totales = media de los meses."
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                <Link href="/direccion-tiendas/ganancias" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                    <ArrowLeft size={16} /> Volver a Ganancias
                </Link>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0369a1', fontWeight: 600 }}>
                    <Info size={14} /> El importe FFVV mensual (T. Importe FFVV) se coge automático de Ganancias; tú pones el Nº de comerciales del año en cada fila (casilla «Nº Com.», se guarda en el servidor y lo ve todo el mundo) y el € por comercial de cada mes se calcula solo. Totales = media de los meses. Las casillas en <span style={{ color: '#f59e0b' }}>ámbar</span> son valores de fábrica: nadie ha dicho todavía cuántos comerciales hubo ese año.
                </span>
                {estado && (
                    <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: estado === 'Guardado' ? '#16a34a'
                            : estado === 'Guardando…' ? 'var(--text-muted)' : '#dc2626',
                    }}>{estado}</span>
                )}
            </div>

            {years.length === 0
                ? <div style={{ padding: 24, color: 'var(--text-muted)' }}>No hay datos de PRV FFVV.</div>
                : years.map(renderYear)}
        </div>
    )
}
