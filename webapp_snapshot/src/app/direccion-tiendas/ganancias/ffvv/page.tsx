'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useGuard } from '@/hooks/useGuard'
import { PageHeader } from '@/components/PageHeader'
import { Users, ArrowLeft, Info } from 'lucide-react'
import { GANANCIAS_DATA } from '../data'
import { cargarIngresosFfvv, mediaConDato, type MesFfvv } from '@/lib/gananciasFfvv'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// «—» cuando NO HAY DATO, que no es lo mismo que 0 €.
// Euros REDONDOS, sin céntimos. Son 15 columnas por bloque y con decimales la
// tabla no cabía en pantalla: había que arrastrarla de lado para ver diciembre.
// Aquí se mira la tendencia de un año, no se cuadra una liquidación: los céntimos
// costaban más de lo que aportaban. El cálculo sigue siendo exacto por dentro.
const eur2 = (n: number | null | undefined) =>
    (n === null || n === undefined || !isFinite(n)) ? '—'
        : Math.round(n).toLocaleString('es-ES') + ' €'

// Clave del navegador de la época anterior. Se lee UNA vez para rescatarla.
const LS_KEY = 'ffvv_reparto_v2'
// La misma clave en el servidor: se teclea una vez y lo ve todo el mundo.
const CLAVE = 'ffvv_reparto_v2'
/** Comerciales de la fuerza de ventas. El dueño confirmó 6 para 2026. */
const POR_DEFECTO = 6

// ─────────────────────────────────────────────────────────────────────────────
// CUÁNTOS COMERCIALES HUBO CADA AÑO (dicho por el dueño, 01-ago-2026).
//
// Casi todos los años llevan DOS cifras porque la plantilla se movió, y él quiere
// ver el mismo mes calculado de las dos maneras para compararlas — no una media
// inventada entre las dos. Por eso cada año pinta un bloque por cada número.
//
// Los años que no están aquí no tienen dato («del resto de años ya no tengo
// datos de comerciales»): esos siguen con la casilla editable en ámbar.
// ─────────────────────────────────────────────────────────────────────────────
const PLANTILLA_POR_ANIO: Record<string, number[]> = {
    '2026': [6],
    '2025': [6, 7],
    '2024': [6, 7],
    '2022': [6, 7],
    '2021': [6, 8],
    '2020': [6, 7],
    '2019': [7, 9],
    '2018': [7, 9],
    '2017': [7, 10],
}

// año -> { ffvv: "6" }. Se conserva el nombre del campo para no perder lo ya
// guardado; el antiguo «banquillo» se ignora (ver la nota de la cabecera).
type NMap = Record<string, Partial<Record<'ffvv' | 'banquillo', string>>>

export default function FFVVGananciasPage() {
    const { authorized } = useGuard('MODULE_DIRECCION')
    const [nmap, setNmap] = useState<NMap>({})
    const [estado, setEstado] = useState<string>('')
    const [datos, setDatos] = useState<Record<string, MesFfvv[]>>({})
    const [cargando, setCargando] = useState(true)

    // ── El Nº de comerciales de cada año ───────────────────────────────────────
    // Vive en el servidor (AppSetting), no en el navegador: antes se tecleaba en
    // un ordenador y desde otro la tabla volvía a dividir por el valor de fábrica.
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
                // Rescate del navegador, solo si el servidor no tiene NADA: si
                // mirásemos «está vacío», borrarlo a propósito lo resucitaría.
                if (j?.value === null || j?.value === undefined) {
                    try {
                        const raw = localStorage.getItem(LS_KEY)
                        if (raw) { mapa = JSON.parse(raw); guardar(mapa, true) }
                    } catch { /* noop */ }
                }
                if (vivo) setNmap(mapa)
            } catch { /* sin servidor, valores de fábrica */ }
        })()
        return () => { vivo = false }
    }, [])

    const setN = (year: string, val: string) => {
        const next = { ...nmap, [year]: { ...(nmap[year] || {}), ffvv: val } }
        setNmap(next)
        guardar(next)
    }
    /** true si el número lo ha puesto una persona; false si es el de fábrica. */
    const esPuesto = (year: string): boolean => {
        const s = nmap[year]?.ffvv
        if (s === undefined || s === '') return false
        const v = parseFloat(String(s).replace(',', '.'))
        return isFinite(v) && v > 0
    }
    const nDe = (year: string): number => {
        const s = nmap[year]?.ffvv
        if (s !== undefined && s !== '') {
            const v = parseFloat(String(s).replace(',', '.'))
            if (isFinite(v) && v > 0) return v
        }
        return POR_DEFECTO
    }

    const years = useMemo(() => Object.keys(GANANCIAS_DATA)
        .sort((a, b) => b.localeCompare(a)), [])

    // Los ingresos de cada año se piden UNA vez, a la fuente común que usa
    // también el cuadro grande de Ganancias.
    useEffect(() => {
        let vivo = true
        ;(async () => {
            const fuera: Record<string, MesFfvv[]> = {}
            for (const y of years) fuera[y] = await cargarIngresosFfvv(y)
            if (vivo) { setDatos(fuera); setCargando(false) }
        })()
        return () => { vivo = false }
    }, [years])

    if (!authorized) return null

    const thBlue: React.CSSProperties = { padding: '7px 4px', textAlign: 'center', fontWeight: 700, borderLeft: '1px solid rgba(255,255,255,0.2)', whiteSpace: 'nowrap', fontSize: 11.5 }
    const nInput: React.CSSProperties = { width: 46, padding: '2px 3px', textAlign: 'center', border: '1px solid #93c5fd', borderRadius: 5, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-main)', outline: 'none', fontWeight: 700 }

    /** Un bloque = un año calculado con UN número de comerciales. */
    const renderBloque = (year: string, n: number, fija: boolean, primero: boolean) => {
        const meses = datos[year] || []

        // Las tres lecturas: lo que entra, lo que cuesta, y lo que queda.
        const FILAS: { clave: 'ingreso' | 'coste' | 'diferencia'; label: string; ayuda: string }[] = [
            { clave: 'ingreso', label: 'Ingresos por comercial', ayuda: 'Caja FFVV + Producción + PRV, dividido entre los comerciales' },
            { clave: 'coste', label: 'Coste por comercial', ayuda: 'Gastos FFVV del mes, dividido entre los comerciales' },
            { clave: 'diferencia', label: 'Diferencia', ayuda: 'Lo que queda por comercial después de los gastos' },
        ]
        const valorDe = (m: MesFfvv, clave: string): number | null => {
            if (n <= 0) return null
            if (clave === 'ingreso') return m.total === null ? null : m.total / n
            if (clave === 'coste') return m.gastos === null ? null : m.gastos / n
            return m.ganancia === null ? null : m.ganancia / n
        }

        return (
            <div key={`${year}-${n}`} style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', marginBottom: primero && fija ? 8 : 18 }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap', tableLayout: 'auto' }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(90deg, #0ea5e9, #0284c7)', color: '#fff' }}>
                                <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 800, minWidth: 150 }}>
                                    Por comercial · {year}
                                    {fija && <span style={{ fontWeight: 600, opacity: 0.85 }}>{'  —  con '}{n} comerciales</span>}
                                </th>
                                <th style={{ ...thBlue, borderLeft: '2px solid rgba(255,255,255,0.3)' }}>Nº Com.</th>
                                {MESES.map(m => <th key={m} style={thBlue}>{m}</th>)}
                                <th style={{ ...thBlue, borderLeft: '2px solid rgba(255,255,255,0.3)', fontWeight: 800 }}>Media</th>
                            </tr>
                        </thead>
                        <tbody>
                            {FILAS.map((f, idx) => {
                                const vals = meses.map(m => valorDe(m, f.clave))
                                const esDif = f.clave === 'diferencia'
                                const esCoste = f.clave === 'coste'
                                return (
                                    <tr key={f.clave} style={{ background: esDif ? 'rgba(2,132,199,0.06)' : 'transparent', borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: esDif ? 800 : 700, color: 'var(--text-main)' }} title={f.ayuda}>
                                            {f.label}
                                        </td>
                                        {/* La casilla del divisor va UNA sola vez, en la primera fila */}
                                        {idx === 0 ? (
                                            <td rowSpan={FILAS.length} style={{ padding: '6px 4px', textAlign: 'center', borderLeft: '2px solid var(--border-light)', verticalAlign: 'middle' }}>
                                                {/* Si el dueño ya dijo cuántos hubo ese año, es un DATO y se
                                                    enseña, no se teclea. La casilla editable (en ámbar) queda
                                                    solo para los años de los que no hay constancia. */}
                                                {fija ? (
                                                    <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-main)' }}
                                                        title={`En ${year} hubo ${n} comerciales`}>{n}</span>
                                                ) : (
                                                <input type="number" step="1" min="1"
                                                    title={esPuesto(year)
                                                        ? 'Nº de comerciales del año (divide todos los meses)'
                                                        : `Valor de fábrica (${POR_DEFECTO}): nadie ha puesto el nº de comerciales de ${year}`}
                                                    value={nmap[year]?.ffvv ?? String(POR_DEFECTO)}
                                                    onChange={e => setN(year, e.target.value)}
                                                    style={{
                                                        ...nInput,
                                                        borderColor: esPuesto(year) ? '#93c5fd' : '#f59e0b',
                                                        color: esPuesto(year) ? 'var(--text-main)' : '#f59e0b',
                                                    }} />
                                                )}
                                            </td>
                                        ) : null}
                                        {vals.map((v, m) => (
                                            <td key={m} style={{
                                                padding: '8px 4px', textAlign: 'center', borderLeft: '1px solid var(--border-light)',
                                                fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 12,
                                                color: v === null ? 'var(--text-muted)'
                                                    : esCoste ? '#dc2626'
                                                        : (esDif && v < 0) ? '#dc2626' : '#16a34a',
                                            }}>
                                                {eur2(v)}
                                            </td>
                                        ))}
                                        <td style={{ padding: '8px 8px', textAlign: 'right', borderLeft: '2px solid var(--border-light)', fontWeight: 800, color: '#0284c7', fontVariantNumeric: 'tabular-nums' }}>
                                            {eur2(mediaConDato(vals))}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                {/* Aquí iba el aviso de «meses incompletos». Fuera por decisión del
                    dueño (01-ago-2026): cada bloque son la cabecera y tres filas, y
                    ese cartel metía una cuarta que no aportaba. Los meses a los que
                    les falta un concepto ya se ven solos, con su raya en vez de un
                    importe. El aviso sigue existiendo en el cuadro grande de
                    Ganancias, que es donde se rellenan los datos. */}
            </div>
        )
    }

    /**
     * Un año = un bloque por cada plantilla conocida (casi todos llevan dos, p.ej.
     * 2025 con 6 y con 7). Los años sin dato de comerciales siguen con un bloque
     * y su casilla editable.
     */
    const renderYear = (year: string) => {
        const meses = datos[year] || []
        if (!meses.some(m => m.total !== null)) return null
        const plantilla = PLANTILLA_POR_ANIO[year]
        if (!plantilla || !plantilla.length) {
            return renderBloque(year, nDe(year), false, true)
        }
        return (
            <div key={year} style={{ marginBottom: 18 }}>
                {plantilla.map((n, i) => renderBloque(year, n, true, i === 0))}
            </div>
        )
    }

    return (
        <div style={{ padding: '20px 24px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
            <PageHeader
                title={<span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Users color="#00adef" size={28} /> FFVV — Por comercial</span>}
                subtitle="Cuánto ingresa la empresa por cada comercial de la fuerza de ventas, cuánto cuesta y qué queda. Pon el Nº de comerciales del año y las tres filas se recalculan solas."
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                <Link href="/direccion-tiendas/ganancias" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                    <ArrowLeft size={16} /> Volver a Ganancias
                </Link>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0369a1', fontWeight: 600 }}>
                    <Info size={14} /> Los importes salen de la MISMA fuente que el cuadro de Ganancias
                    (Caja FFVV + Producción + PRV, menos los Gastos), con el dato en vivo del ERP y de FFVV.
                    La media es de los meses que tienen dato, no de los doce.
                    Las casillas en <span style={{ color: '#f59e0b' }}>ámbar</span> son valores de fábrica:
                    nadie ha dicho cuántos comerciales hubo ese año.
                </span>
                {estado && (
                    <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: estado === 'Guardado' ? '#16a34a'
                            : estado === 'Guardando…' ? 'var(--text-muted)' : '#dc2626',
                    }}>{estado}</span>
                )}
            </div>

            {cargando
                ? <div style={{ padding: 24, color: 'var(--text-muted)' }}>Cargando…</div>
                : (years.map(renderYear).filter(Boolean).length === 0
                    ? <div style={{ padding: 24, color: 'var(--text-muted)' }}>No hay datos de FFVV.</div>
                    : years.map(renderYear))}
        </div>
    )
}
