// Cálculo de métricas MOD (Media Operaciones Diaria) de un mes.
// FUENTE ÚNICA DE VERDAD: lo usan la página /seguimiento-ventas/mod y el endpoint
// /api/mod-importe (que alimenta "Caja Tiendas" del panel de Ganancias). No duplicar.

import { renderDashboardData, sanitizeSale, isSaleCancelled } from '@/lib/salesUtils'
import { getSaleCommissionBase } from '@/lib/saleCommission'
import { computeBonosO2, computeTerritorialTotal } from '@/lib/territorialConsolidado'

// Festivos de Salamanca (excluye sábados, domingos y festivos locales/regionales)
export const isHolidaySalamanca = (y: number, m: number, d: number) => {
    if (m === 1 && (d === 1 || d === 6)) return true
    if (m === 4 && d === 23) return true
    if (m === 5 && d === 1) return true
    if (m === 6 && d === 12) return true // San Juan de Sahagún (local Salamanca)
    if (m === 8 && d === 15) return true
    if (m === 9 && d === 8) return true  // Virgen de la Vega (local Salamanca)
    if (m === 10 && d === 12) return true
    if (m === 11 && d === 1) return true
    if (y === 2026 && m === 11 && d === 2) return true
    if (y === 2025 && m === 10 && d === 13) return true
    if (m === 12 && (d === 6 || d === 8 || d === 25)) return true
    if (y === 2026 && m === 12 && d === 7) return true
    if (y === 2025 && m === 4 && (d === 17 || d === 18)) return true
    if (y === 2026 && m === 4 && (d === 2 || d === 3)) return true
    return false
}

export const getWorkingDaysInMonth = (y: number, m: number) => {
    let days = 0
    const date = new Date(y, m - 1, 1)
    while (date.getMonth() === m - 1) {
        const dayOfWeek = date.getDay()
        const dayOfMonth = date.getDate()
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHolidaySalamanca(y, m, dayOfMonth)) days++
        date.setDate(date.getDate() + 1)
    }
    return days
}

export const calcDiasLaborablesHastaHoy = (y: number, m: number) => {
    const today = new Date()
    const targetIsPast = (today.getFullYear() > y) || (today.getFullYear() === y && today.getMonth() > m - 1)
    let lastDayToCount = new Date(y, m, 0).getDate()
    if (!targetIsPast && today.getFullYear() === y && today.getMonth() === m - 1) {
        lastDayToCount = today.getDate()
    }
    let elapsed = 0
    for (let d = 1; d <= lastDayToCount; d++) {
        const dt = new Date(y, m - 1, d)
        const dayOfWeek = dt.getDay()
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHolidaySalamanca(y, m, d)) elapsed++
    }
    return elapsed
}

export interface ModMonthInput {
    salesRaw: any[]
    configs: any[]          // [objData, pymeData, plusData, extrasData]
    catalogs: Record<string, any[]>
    periods: any[]
    mfSales: any[]
    mfProducts: any[]
    year: number
    month: number
    periodKeyForConfig: string
    o2Rules?: any[]   // reglas O2 de la Entrada de Datos (/api/territorial -> o2) para el bono PRV Territorial O2
    tiendasRules?: any[]  // reglas TIENDAS de la Entrada de Datos (/api/territorial -> tiendas) para el PRV Territorial Tiendas
    includeTerritorialTiendas?: boolean  // SOLO la página MOD lo suma; Ganancias lo añade por su cuenta (evita doble conteo)
}

// Reproduce EXACTAMENTE el processMetrics de la página MOD para un mes dado.
export function computeMonthMetrics(input: ModMonthInput) {
    const { salesRaw, configs, catalogs, periods, mfSales, mfProducts, year: y, month: m, periodKeyForConfig, o2Rules, tiendasRules, includeTerritorialTiendas } = input
    const daysInMonth = new Date(y, m, 0).getDate()

    const [objData, pymeData, plusData, extrasData] = configs
    const objetivos = objData?.objetivos || { Pyme: {}, Captador: {} }
    const objGrupos = objData?.grupos || { Pyme: {}, Captador: {} }
    const importesPyme = pymeData?.importes || pymeData?.data || []
    const importesPlus = plusData?.importes || plusData?.data || []
    const activeExtras = (extrasData?.assignments || []).filter((ea: any) => ea.status !== 'CANCELLED')

    // Extras NO territoriales (el TERRITORIAL O2 no suma en MOD)
    const nonTerritorialExtras = activeExtras.filter((ex: any) =>
        String(ex.customerNif || '').toUpperCase() !== 'TERRITORIAL' &&
        !String(ex.rule?.name || '').toUpperCase().includes('TERRITORIAL O2')
    )

    // MovilFree: margen neto (ingreso sin IVA − coste) de ventas COMPLETADAS del mes. SÍ suma.
    const mfSalesMonth = (mfSales || []).filter((s: any) => {
        const d = new Date(s.fechaVenta)
        return s.estado === 'COMPLETADA' && d.getFullYear() === y && (d.getMonth() + 1) === m
    })
    const movilFreeReal = mfSalesMonth.reduce((acc: number, s: any) => {
        try {
            const list = JSON.parse(s.listaProductos)
            const cost = list.reduce((cAcc: number, item: any) => {
                const prodCost = item.coste !== undefined ? item.coste : ((mfProducts || []).find((p: any) => p.id === item.id)?.coste || 0)
                return cAcc + (prodCost * item.cantidad)
            }, 0)
            return acc + ((s.importeTotal / 1.21) - cost)
        } catch (e) { return acc }
    }, 0)

    const salesList = (salesRaw || []).map(sanitizeSale)
    let periodData = (periods || []).find((p: any) => p.period_key === periodKeyForConfig)
    if (!periodData) {
        periodData = (periods || []).find((p: any) => p.status === 'ACTIVE') || periods?.[0]
    }

    const stats = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        dayOfWeek: ['D', 'L', 'M', 'X', 'J', 'V', 'S'][new Date(y, m - 1, i + 1).getDay()],
        isWeekend: [0, 6].includes(new Date(y, m - 1, i + 1).getDay()),
        ops: 0,
        importe: 0,
        accumOps: 0,
        accumImporte: 0
    }))

    salesList.forEach((sale: any) => {
        if (isSaleCancelled(sale)) return
        let saleDay = -1
        if (sale.timestamp) {
            const d = new Date(sale.timestamp)
            if (d.getFullYear() === y && d.getMonth() === m - 1) saleDay = d.getDate()
        }
        if (saleDay === -1 && sale.fecha) {
            const match = String(sale.fecha).match(/^(\d{1,2})\//)
            if (match) saleDay = parseInt(match[1], 10)
        }
        if (saleDay === -1 && sale.fecha) {
            const iso = String(sale.fecha).match(/^\d{4}-\d{1,2}-(\d{1,2})/)
            if (iso) saleDay = parseInt(iso[1], 10)
        }
        if (saleDay === -1 && sale.timestamp) {
            const d = new Date(sale.timestamp)
            if (!isNaN(d.getTime())) saleDay = Math.min(Math.max(d.getDate(), 1), daysInMonth)
        }
        if (saleDay >= 1 && saleDay <= daysInMonth) stats[saleDay - 1].ops += 1
    })

    let globalImporte = 0
    const saleMonth = `${y}${m.toString().padStart(2, '0')}`

    // Componentes del importe (para el desglose/tooltip de la página MOD).
    let bComisiones = 0          // comisión de ventas (Movistar + O2) + extras telco
    let bMovilFree = 0
    let bPrvTerritorialO2 = 0
    let bPrvTerritorialTiendas = 0

    if (y > 2026 || (y === 2026 && m >= 6)) {
        // --- TUBERÍA DE COMISIONES REALES (junio 2026 EN ADELANTE) ---
        // OJO: antes decía "y === 2026 && m === 6" (solo junio) → julio caía al cálculo
        // estándar antiguo y el Importe Mensual salía irreal (187,60 € con 64 ops).
        // Los meses ANTERIORES a junio 2026 se quedan con el cálculo antiguo (histórico intacto).
        const pymeMonthObj = objetivos.Pyme?.[saleMonth] || {}
        const captadorMonthObj = objetivos.Captador?.[saleMonth] || {}
        const pymeDataR = renderDashboardData('Pyme', importesPyme, pymeMonthObj, salesList, objGrupos, periodData)
        const captadorDataR = renderDashboardData('Captador', importesPlus, captadorMonthObj, salesList, objGrupos, periodData)

        const getCommissionBase = (sale: any) => getSaleCommissionBase(sale, {
            catalogs,
            dashRowsPlus: pymeDataR.rows,
            dashRowsBasico: captadorDataR.rows,
            viewingPeriod: saleMonth,
        })
        const getCommission = (sale: any) => getCommissionBase(sale) + (sale.isSwap === true ? 15 : 0)

        const salesForTable = salesList.filter((s: any) => {
            const p = String(s.producto || '').toLowerCase()
            const c = String(s.categoria || '').toLowerCase()
            const d = String(s.detalle || '').toLowerCase()
            return !p.includes('solar360') && !p.includes('solar 360') &&
                !c.includes('solar360') && !c.includes('solar 360') &&
                !d.includes('solar360') && !d.includes('solar 360')
        })

        const salesCommissions = salesForTable.reduce((acc: number, s: any) => acc + getCommission(s), 0)
        const telecomExtras = nonTerritorialExtras.reduce((acc: number, ex: any) => acc + Number(ex.telecomRewardAmount || 0), 0)
        bComisiones = salesCommissions + telecomExtras
    } else {
        // --- CÁLCULO ESTÁNDAR ORIGINAL ---
        if (importesPyme.length > 0) {
            const dashPyme = renderDashboardData('Pyme', importesPyme, objetivos.Pyme?.[saleMonth] || {}, salesList, objGrupos, periodData)
            bComisiones += dashPyme.totalImporte
        }
        if (importesPlus.length > 0) {
            const dashCaptador = renderDashboardData('Captador', importesPlus, objetivos.Captador?.[saleMonth] || {}, salesList, objGrupos, periodData)
            bComisiones += dashCaptador.totalImporte
        }
        nonTerritorialExtras.forEach((ex: any) => {
            const amount = Number(ex.amount || ex.telecomRewardAmount) || 0
            bComisiones += amount
        })
    }

    bMovilFree = movilFreeReal

    // PRV Territorial O2 (bono O2 del mes): SÍ suma en el MOD, para que su Importe Mensual
    // coincida con el "Resumen de Métricas MOD" y con la Caja Tiendas de Ganancias.
    bPrvTerritorialO2 = computeBonosO2(salesRaw, o2Rules || [])

    // PRV Territorial Tiendas: SOLO se suma cuando lo pide la página MOD (includeTerritorialTiendas).
    // Ganancias lo añade por su cuenta con computeTerritorialTotal → evitar doble conteo.
    if (includeTerritorialTiendas) {
        bPrvTerritorialTiendas = computeTerritorialTotal({
            sales: salesRaw,
            territorialRules: tiendasRules || [],
            catalogs,
            viewingPeriod: saleMonth
        } as any)
    }

    globalImporte = bComisiones + bMovilFree + bPrvTerritorialO2 + bPrvTerritorialTiendas

    const totalOpsGlobal = stats.reduce((acc, d) => acc + d.ops, 0)
    const avgImportePerOp = totalOpsGlobal > 0 ? (globalImporte / totalOpsGlobal) : 0

    let totalOps = 0
    let totalImporte = 0
    stats.forEach(d => {
        d.importe = d.ops * avgImportePerOp
        totalOps += d.ops
        totalImporte += d.importe
        d.accumOps = totalOps
        d.accumImporte = totalImporte
    })

    const workingDaysElapsed = calcDiasLaborablesHastaHoy(y, m)
    const effectiveDays = workingDaysElapsed || 1
    const totalWorkingDaysInMonth = getWorkingDaysInMonth(y, m)

    return {
        stats,
        totalOps,
        totalImporte,
        mediaOpsDiaria: totalOps / effectiveDays,
        mediaImporteDiario: totalImporte / effectiveDays,
        mediaPorOp: totalOps > 0 ? (totalImporte / totalOps) : 0,
        estOps: (totalOps / effectiveDays) * totalWorkingDaysInMonth,
        estRentabilidad: (totalImporte / effectiveDays) * totalWorkingDaysInMonth,
        workingDaysElapsed,
        // Desglose del Importe Mensual (para el tooltip de la página MOD). Suma = totalImporte.
        breakdown: {
            comisiones: bComisiones,
            movilFree: bMovilFree,
            prvTerritorialO2: bPrvTerritorialO2,
            prvTerritorialTiendas: bPrvTerritorialTiendas,
            total: globalImporte,
        },
    }
}
