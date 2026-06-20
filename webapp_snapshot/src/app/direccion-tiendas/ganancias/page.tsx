'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useGuard } from '@/hooks/useGuard'
import { PageHeader } from '@/components/PageHeader'
import { Wallet, TrendingUp, TrendingDown, Building2, Briefcase, Pencil, Save, X, Plus, Trash2, CalendarPlus } from 'lucide-react'
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

    // Versión EDITABLE guardada en BD (si existe) sustituye al Excel estático como base.
    // Encima se aplican las cifras en vivo (Caja, Comisiones, PRV, Totales).
    const [storedData, setStoredData] = useState<Record<string, GananciaRow[]> | null>(null)
    const [editMode, setEditMode] = useState(false)
    const [draft, setDraft] = useState<Record<string, GananciaRow[]> | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetch('/api/ganancias-data', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => { if (d?.success && d.data && typeof d.data === 'object') setStoredData(d.data) })
            .catch(() => {})
    }, [])

    const baseData = storedData ?? GANANCIAS_DATA
    const years = useMemo(
        () => Object.keys(baseData).sort((a, b) => Number(b) - Number(a)),
        [baseData]
    )
    const [year, setYear] = useState<string>(
        Object.keys(GANANCIAS_DATA).sort((a, b) => Number(b) - Number(a))[0]
    )
    // Si el año seleccionado deja de existir (tras cargar/editar), saltar al más reciente.
    useEffect(() => { if (years.length && !years.includes(year)) setYear(years[0]) }, [years, year])

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

    // ── Tentáculo: "TOTAL COBRADO IVA Inc" en vivo = "Resumen Evolutivo: Ingresos Totales
    // Telefónica/Movistar" del ERP (mi-nuevo-erp), por mes de VENTAS, vía /api/cobrado-feed.
    // "TOTAL COBRADO sin IVA" se calcula = IVA Inc / 1,21. Meses sin dato: del Excel.
    const [cobradoOverride, setCobradoOverride] = useState<Record<number, number> | null>(null)

    // ── Tentáculo: "Producción Plus" / "Producción Básico" en vivo = "Total Acumulado
    // PLUS/BÁSICO" de la Liquidación (Operaciones Telefónica) de MicroShop FFVV, por mes,
    // DESDE ABRIL 2026. La FFVV lo publica en /api/produccion-feed; aquí se lee.
    const PRODUCCION_FROM = '2026_04'
    const [produccionOverride, setProduccionOverride] = useState<Record<number, { plus: number; basico: number }> | null>(null)

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
                    const [salesRes, objData, pymeData, plusData, extrasData, terrRes] = await Promise.all([
                        fetch(`/api/sales?periodKey=${pk}`, { cache: 'no-store' }).then(j).catch(() => ({ logs: [] })),
                        fetch(`/api/objetivos?periodKey=${pk}&strictPeriod=1`, { cache: 'no-store' }).then(j).catch(() => ({})),
                        fetch(`/api/importes-pyme?periodKey=${pk}&strictPeriod=1`, { cache: 'no-store' }).then(j).catch(() => ({})),
                        fetch(`/api/importes-plus?periodKey=${pk}&strictPeriod=1`, { cache: 'no-store' }).then(j).catch(() => ({})),
                        fetch(`/api/extras/assignments?periodKey=${pk}`, { cache: 'no-store' }).then(j).catch(() => ({})),
                        fetch(`/api/territorial?periodKey=${pk}`, { cache: 'no-store' }).then(j).catch(() => ({ o2: [] })),
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
                        o2Rules: terrRes.o2 || [],
                    })
                    // Caja Tiendas = "Resumen de Métricas MOD": el Importe Mensual del MOD ya
                    // incluye Tiendas Movistar + MovilFree + O2 + PRV Territorial O2.
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

    useEffect(() => {
        setCobradoOverride(null)
        const yNum = Number(year)
        let cancel = false
        fetch('/api/cobrado-feed', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => {
                if (cancel || !d?.success || !d.data) return
                const ov: Record<number, number> = {}
                for (let m = 1; m <= 12; m++) {
                    const key = `${yNum}_${String(m).padStart(2, '0')}`
                    const v = d.data[key]
                    if (v !== undefined && v !== null && !isNaN(Number(v))) ov[m] = Number(v)
                }
                if (Object.keys(ov).length) setCobradoOverride(ov)
            })
            .catch(() => {})
        return () => { cancel = true }
    }, [year])

    useEffect(() => {
        setProduccionOverride(null)
        const yNum = Number(year)
        let cancel = false
        fetch('/api/produccion-feed', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => {
                if (cancel || !d?.success || !d.data) return
                const ov: Record<number, { plus: number; basico: number }> = {}
                for (let m = 1; m <= 12; m++) {
                    const key = `${yNum}_${String(m).padStart(2, '0')}`
                    if (key < PRODUCCION_FROM) continue   // desde Abril 2026
                    const v = d.data[key]
                    if (v && typeof v === 'object') ov[m] = { plus: Number(v.plus) || 0, basico: Number(v.basico) || 0 }
                }
                if (Object.keys(ov).length) setProduccionOverride(ov)
            })
            .catch(() => {})
        return () => { cancel = true }
    }, [year])

    const rows = baseData[year] || []

    const displayRows: GananciaRow[] = useMemo(() => {
        if (!gastosOverride && !cajaModOverride && !comisLocalesOverride && !prvOverride && !cobradoOverride && !produccionOverride) return rows
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
        // El PRV del ERP (Retribución Variable) es SOLO el de Tiendas; la fila "PRV" de la
        // sección FFVV es un valor propio (16.020) y NO debe pisarse con el override.
        const ffvvStart = rows.findIndex(r => r.label === 'Total Ingresos FFVV')
        // 1) Override de filas individuales.
        const overridden: GananciaRow[] = rows.map((row, i) => {
            if (gastosOverride && row.label === 'Gastos Tiendas') return { label: row.label, ...build(gastosOverride.tiendas) }
            if (gastosOverride && row.label === 'Gastos FFVV') return { label: row.label, ...build(gastosOverride.ffvv) }
            if (cajaModOverride && row.label === 'Caja Tiendas') return applyMonthly(row, cajaModOverride)
            if (comisLocalesOverride && row.label === 'Comisiones Tiendas Locales') return applyMonthly(row, comisLocalesOverride)
            if (prvOverride && row.label === 'PRV' && (ffvvStart < 0 || i < ffvvStart)) return applyMonthly(row, prvOverride)
            if (cobradoOverride && row.label === 'TOTAL COBRADO IVA Inc') return applyMonthly(row, cobradoOverride)
            if (produccionOverride && (row.label === 'Producción Plus' || row.label === 'Producción Básico')) {
                const field: 'plus' | 'basico' = row.label === 'Producción Plus' ? 'plus' : 'basico'
                const ov: Record<number, number> = {}
                for (const m in produccionOverride) ov[Number(m)] = produccionOverride[Number(m)][field]
                return applyMonthly(row, ov)
            }
            return row
        })

        // 2) Recalcular las filas de TOTAL como suma de sus componentes. Se usan rangos por
        //    sección para distinguir las DOS filas "PRV" (una en Tiendas, otra en FFVV):
        //    Total Ingresos Tiendas = Caja Tiendas + Comisiones Tiendas Locales + PRV;
        //    Total Ingresos FFVV    = Caja FFVV + Producción Plus + Producción Básico + PRV;
        //    Total Ingresos Tiendas+FFVV = los dos anteriores.
        const idxTT = overridden.findIndex(r => r.label === 'Total Ingresos Tiendas')
        const idxTF = overridden.findIndex(r => r.label === 'Total Ingresos FFVV')
        if (idxTT < 0 || idxTF < 0) return overridden

        const sumRange = (labels: string[], from: number, to: number): (number | null)[] => {
            const set = new Set(labels)
            const months: (number | null)[] = new Array(12).fill(null)
            for (let i = from; i < to; i++) {
                if (!set.has(overridden[i].label)) continue
                overridden[i].months.forEach((v, mi) => { if (v !== null && v !== undefined) months[mi] = (months[mi] || 0) + v })
            }
            return months
        }
        const totalize = (label: string, months: (number | null)[]): GananciaRow => {
            const nums = months.filter((x): x is number => x !== null && x !== undefined)
            const total = nums.reduce((a, b) => a + b, 0)
            const active = months.filter(m => m !== null && m !== undefined && m !== 0).length
            return { label, months, total, media: active ? total / active : null }
        }

        const ttMonths = sumRange(['Caja Tiendas', 'Comisiones Tiendas Locales', 'PRV'], idxTT + 1, idxTF)
        const tfMonths = sumRange(['Caja FFVV', 'Producción Plus', 'Producción Básico', 'PRV'], idxTF + 1, overridden.length)
        const bothMonths: (number | null)[] = ttMonths.map((v, i) => {
            const b = tfMonths[i]
            if ((v === null || v === undefined) && (b === null || b === undefined)) return null
            return (v || 0) + (b || 0)
        })

        // "TOTAL COBRADO sin IVA" = "TOTAL COBRADO IVA Inc" / 1,21 (quita el 21% de IVA).
        const ivaIncRow = overridden.find(r => r.label === 'TOTAL COBRADO IVA Inc')
        const sinIvaMonths: (number | null)[] | null = ivaIncRow
            ? ivaIncRow.months.map(v => (v === null || v === undefined) ? v : v / 1.21)
            : null

        // "Real Ganancias" y "Total Ganancias" también se recalculan en vivo; si no, no
        // cuadran en cuanto un ingreso/gasto viene de un override (Caja, Gastos, Producción…):
        //   Real Ganancias Tiendas = Total Ingresos Tiendas − Gastos Tiendas − Comisiones Tiendas
        //   Real Ganancias FFVV    = Total Ingresos FFVV − Gastos FFVV
        //   Total Ganancias        = Real Ganancias Tiendas + Real Ganancias FFVV
        const monthsOf = (label: string): (number | null)[] => {
            const r = overridden.find(x => x.label === label)
            return r ? r.months : new Array(12).fill(null)
        }
        const n0 = (x: number | null | undefined) => (x === null || x === undefined) ? 0 : x
        const gastosTM = monthsOf('Gastos Tiendas')
        const comisTM = monthsOf('Comisiones Tiendas')
        const gastosFM = monthsOf('Gastos FFVV')
        const rgTiendasMonths: (number | null)[] = ttMonths.map((v, i) => n0(v) - n0(gastosTM[i]) - n0(comisTM[i]))
        const rgFFVVMonths: (number | null)[] = tfMonths.map((v, i) => n0(v) - n0(gastosFM[i]))
        const totGanMonths: (number | null)[] = rgTiendasMonths.map((v, i) => n0(v) + n0(rgFFVVMonths[i]))

        return overridden.map(row => {
            if (row.label === 'Total Ingresos Tiendas') return totalize(row.label, ttMonths)
            if (row.label === 'Total Ingresos FFVV') return totalize(row.label, tfMonths)
            if (row.label === 'Total Ingresos Tiendas+FFVV') return totalize(row.label, bothMonths)
            if (sinIvaMonths && row.label === 'TOTAL COBRADO sin IVA') return totalize(row.label, sinIvaMonths)
            if (row.label === 'Real Ganancias Tiendas') return totalize(row.label, rgTiendasMonths)
            if (row.label === 'Real Ganancias FFVV') return totalize(row.label, rgFFVVMonths)
            if (/^Total Ganancias/i.test(row.label)) return totalize(row.label, totGanMonths)
            return row
        })
    }, [rows, gastosOverride, cajaModOverride, comisLocalesOverride, prvOverride, cobradoOverride, produccionOverride])

    const gTiendas = findTotal(displayRows, /real ganancias tiendas/i)
    const gFFVV = findTotal(displayRows, /real ganancias ffvv/i)
    const gTotal = findTotal(displayRows, /^total ganancias/i)
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

    // ── Edición ──────────────────────────────────────────────────────────────
    const enterEdit = () => { setDraft(JSON.parse(JSON.stringify(baseData))); setEditMode(true) }
    const cancelEdit = () => { setDraft(null); setEditMode(false) }
    const saveEdit = async () => {
        if (!draft) return
        setSaving(true)
        try {
            const res = await fetch('/api/ganancias-data', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: draft }),
            })
            const d = await res.json()
            if (d?.success) { setStoredData(draft); setEditMode(false); setDraft(null) }
            else alert('Error al guardar: ' + (d?.error || 'desconocido'))
        } catch { alert('Error de conexión al guardar.') }
        setSaving(false)
    }
    const mutateYear = (fn: (rows: GananciaRow[]) => GananciaRow[]) =>
        setDraft(prev => prev ? { ...prev, [year]: fn(prev[year] || []) } : prev)
    const recalc = (months: (number | null)[]) => {
        const nums = months.filter((x): x is number => x !== null && x !== undefined)
        const total = nums.reduce((a, b) => a + b, 0)
        const active = months.filter(m => m !== null && m !== undefined && m !== 0).length
        return { total, media: active ? total / active : null }
    }
    const addRow = () => mutateYear(rs => [...rs, { label: 'Nuevo concepto', months: new Array(12).fill(null), total: null, media: null }])
    const deleteRow = (idx: number) => mutateYear(rs => rs.filter((_, i) => i !== idx))
    const updateRowLabel = (idx: number, label: string) => mutateYear(rs => rs.map((r, i) => i === idx ? { ...r, label } : r))
    const updateRowCell = (idx: number, mi: number, raw: string) => mutateYear(rs => rs.map((r, i) => {
        if (i !== idx) return r
        const months = [...r.months]
        const clean = raw.replace(/[^\d,.\-]/g, '').replace(/\./g, '').replace(',', '.')
        months[mi] = raw.trim() === '' ? null : (isNaN(Number(clean)) ? r.months[mi] : Number(clean))
        return { ...r, months, ...recalc(months) }
    }))
    const addYear = () => {
        const maxY = years.length ? Math.max(...years.map(Number)) : new Date().getFullYear()
        const input = window.prompt('¿Qué año quieres añadir? (misma estructura, importes vacíos)', String(maxY + 1))
        if (!input) return
        const ny = input.trim()
        if (!/^\d{4}$/.test(ny)) { alert('Pon un año de 4 cifras.'); return }
        if (draft && draft[ny]) { alert('Ese año ya existe.'); return }
        const template = (draft?.[year] || baseData[year] || []).map(r => ({ label: r.label, months: new Array(12).fill(null) as (number | null)[], total: null, media: null }))
        setDraft(prev => ({ ...(prev || {}), [ny]: template }))
        setYear(ny)
    }
    const editRows = (draft?.[year] || [])

    return (
        <div style={{ padding: '20px 24px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
            <PageHeader
                title={<span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Wallet color="#00adef" size={28} /> Ganancias desde el 2014</span>}
                subtitle="Ingresos, gastos y rentabilidad por año (Tiendas + FFVV)"
                showBack={true}
                backFallback="/direccion-tiendas"
                headerActions={
                    editMode ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={cancelEdit} title="Cancelar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                            <button onClick={saveEdit} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 40, borderRadius: 20, background: '#10b981', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                                <Save size={18} /> {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    ) : (
                        <button onClick={enterEdit} title="Editar (añadir años, filas, importes)" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <Pencil size={18} />
                        </button>
                    )
                }
            />

            {/* Selector de años */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '20px 0' }}>
                {(editMode && draft ? Object.keys(draft).sort((a, b) => Number(b) - Number(a)) : years).map(y => {
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
                {editMode && (
                    <button
                        onClick={addYear}
                        title="Añadir un año nuevo"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, fontWeight: 700, fontSize: 14, cursor: 'pointer', border: '1px dashed var(--mercedes-cyan)', background: 'transparent', color: 'var(--mercedes-cyan)' }}
                    >
                        <CalendarPlus size={16} /> Añadir año
                    </button>
                )}
            </div>

            {/* KPIs del año (solo vista) */}
            {!editMode && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                {kpi('Real Ganancias Tiendas', gTiendas, Building2, '#a855f7')}
                {gFFVV !== null && kpi('Real Ganancias FFVV', gFFVV, Briefcase, '#0ea5e9')}
                {kpi(`Total Ganancias ${year}`, gTotal, (gTotal ?? 0) >= 0 ? TrendingUp : TrendingDown, '#22c55e')}
            </div>
            )}

            {!editMode && (gastosOverride || cajaModOverride || comisLocalesOverride || prvOverride) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: '#0369a1', fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    Ingresos Gastos ({year})
                </div>
            )}

            {/* Tabla detalle mensual (modo vista) */}
            {!editMode && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap', minWidth: 1100 }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(90deg, #0ea5e9, #0284c7)', color: '#fff' }}>
                                <th style={{ padding: '7px 12px', textAlign: 'left', position: 'sticky', left: 0, background: '#0ea5e9', minWidth: 210 }}>Concepto</th>
                                {MESES.map(m => <th key={m} style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700 }}>{m}</th>)}
                                <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 800, borderLeft: '2px solid rgba(255,255,255,0.25)' }}>Total</th>
                                <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700 }}>Media</th>
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
                                    ? (cajaModOverride ? 'En vivo del «Resumen de Métricas MOD»: Tiendas Movistar + MovilFree + O2 + PRV Territorial O2' : 'Dato del Excel «Ganancias 2014-2026»')
                                    : row.label === 'Comisiones Tiendas Locales'
                                    ? (comisLocalesOverride ? 'En vivo de «Territorial PDV»: Total Consolidado Tiendas (suma de las palancas territoriales)' : 'Dato del Excel «Ganancias 2014-2026»')
                                    : row.label === 'PRV'
                                    ? (prvOverride ? 'En vivo del ERP «mi-nuevo-erp»: Retribución Variable (PRV), Desglose Mensual Interactivo del mes' : 'Dato del Excel «Ganancias 2014-2026»')
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
            )}

            {/* Tabla EDITABLE */}
            {editMode && (
                <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(15,23,42,0.05)' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap', minWidth: 1100 }}>
                            <thead>
                                <tr style={{ background: 'linear-gradient(90deg, #0ea5e9, #0284c7)', color: '#fff' }}>
                                    <th style={{ padding: '7px 12px', textAlign: 'left', minWidth: 210 }}>Concepto</th>
                                    {MESES.map(m => <th key={m} style={{ padding: '7px 6px', textAlign: 'center', fontWeight: 700 }}>{m}</th>)}
                                    <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 800 }}>Total</th>
                                    <th style={{ padding: '7px 8px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {editRows.map((row, ri) => (
                                    <tr key={ri} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '3px 6px' }}>
                                            <input value={row.label} onChange={e => updateRowLabel(ri, e.target.value)}
                                                style={{ width: 200, padding: '4px 6px', border: '1px solid var(--border-strong)', borderRadius: 5, fontSize: 12, fontWeight: 600, background: 'var(--bg-input)', color: 'var(--text-main)' }} />
                                        </td>
                                        {row.months.map((v, mi) => (
                                            <td key={mi} style={{ padding: '3px 2px' }}>
                                                <input value={v ?? ''} onChange={e => updateRowCell(ri, mi, e.target.value)}
                                                    style={{ width: 64, padding: '4px 4px', textAlign: 'right', border: '1px solid var(--border-light)', borderRadius: 5, fontSize: 12, background: 'var(--bg-input)', color: 'var(--text-main)' }} />
                                            </td>
                                        ))}
                                        <td style={{ padding: '3px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>{eur(row.total)}</td>
                                        <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                                            <button onClick={() => deleteRow(ri)} title="Borrar fila" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {editRows.length === 0 && (
                                    <tr><td colSpan={15} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Año sin filas. Pulsa «Añadir fila».</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ padding: 12, borderTop: '1px solid var(--border-light)' }}>
                        <button onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--active-bg)', border: '1px solid var(--border-strong)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', color: 'var(--text-main)', fontSize: 13, fontWeight: 700 }}>
                            <Plus size={16} /> Añadir fila
                        </button>
                    </div>
                </div>
            )}

            <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                {editMode
                    ? 'Modo edición: añade años/filas, edita importes y guarda. Las filas en vivo (Caja, Comisiones, PRV, Totales) se recalculan solas en la vista.'
                    : 'Cifras del Excel «Ganancias 2014-2026» (editables con el lápiz). Las filas conectadas se actualizan solas.'}
            </p>
        </div>
    )
}
