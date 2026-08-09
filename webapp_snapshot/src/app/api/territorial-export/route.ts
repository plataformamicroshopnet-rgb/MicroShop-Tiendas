import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { computeTerritorialRows, computeBonosO2Breakdown } from '@/lib/territorialConsolidado'
import { isSaleActive, isSolar360 } from '@/lib/salesUtils'

// Export de los AGREGADOS territoriales de Tiendas para el ERP (mi-nuevo-erp).
// El ERP tira de aquí para poner en su consolidado de Liquidaciones, POR MES:
//   - PRV Territorial Tiendas  (= computeTerritorialTotal, el GRAN TOTAL de la
//     pestaña "PRV Territorial Tiendas" de Operaciones por Grupo Cliente)
//   - Bono O2 (PRV Territorial O2) desglosado en sus 3 importes:
//     Tramo Mes + Tramo Trimestre + Conectividad.
// Autenticado server-to-server con x-prv-secret = PRV_FEED_SECRET.
const prisma = new PrismaClient()
const SECRET = process.env.PRV_FEED_SECRET || ''

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!SECRET || request.headers.get('x-prv-secret') !== SECRET) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde') || '2026-06' // solo junio en adelante (automatizado)
  const debug = searchParams.get('debug') === '1'
  try {
    // Catálogos por categoría (para getSaleCommission dentro del territorial),
    // ELEGIDOS POR PERIODO — mismo arreglo que en ventas-export: mezclar los de
    // todos los meses hacía que una venta de agosto pudiera cobrar con la fila
    // vieja de junio (vigencias abiertas). Como este export ya itera por
    // WorkPeriod, cada mes usa su propio catálogo; si un mes no tiene, cae al
    // global y, de última, a la mezcla (histórico intacto).
    const catRows = await prisma.productCatalog.findMany({
      select: { categoria: true, producto: true, anual: true, comision: true,
        comisionConCoste: true, validFrom: true, validTo: true, subcategoria: true, gama: true,
        periodId: true },
    })
    const catalogsMezclados: Record<string, any[]> = {}
    const catalogsPorPeriodo = new Map<string, Record<string, any[]>>()
    for (const c of catRows) {
      (catalogsMezclados[c.categoria] ||= []).push(c)
      const clave = c.periodId || '(global)'
      if (!catalogsPorPeriodo.has(clave)) catalogsPorPeriodo.set(clave, {})
      const g = catalogsPorPeriodo.get(clave)!
      ;(g[c.categoria] ||= []).push(c)
    }
    const catalogosDelPeriodo = (periodId: string): Record<string, any[]> =>
      catalogsPorPeriodo.get(periodId)
      || catalogsPorPeriodo.get('(global)')
      || catalogsMezclados

    // Iteramos por PERIODO (WorkPeriod), igual que la pantalla, para cargar las ventas
    // exactamente como /api/sales?periodKey= (OR periodId / fecha) y aplicar los MISMOS
    // filtros e forma que Operaciones por Grupo Cliente. Así el total cuadra por construcción
    // con la fila "Total Consolidado Tiendas" de PRV Territorial Tiendas.
    const periods = await prisma.workPeriod.findMany({ orderBy: [{ year: 'asc' }, { month: 'asc' }] })

    const meses: Record<string, any> = {}
    const dbg: Record<string, any> = {}
    for (const wp of periods) {
      const MM = String(wp.month).padStart(2, '0')
      const YYYY = String(wp.year)
      const ym = `${YYYY}-${MM}`
      if (ym < desde) continue
      const periodKey = wp.period_key || `${YYYY}_${MM}`   // p.ej. 2026_06

      const [stT, stO2, hoursRows, rawSales] = await Promise.all([
        prisma.appSetting.findUnique({ where: { key: `territorial_tiendas_${periodKey}` } }),
        prisma.appSetting.findUnique({ where: { key: `territorial_o2_${periodKey}` } }),
        // Plantilla del mes (panel "Horarios de Comerciales") -> tienda de cada comercial.
        // Sin esto, el territorial cae en la lista fija y las ventas de comerciales nuevos
        // no se cuentan por tienda -> no alcanzan tramos -> importe 0.
        prisma.tiendaComercialHour.findMany({
          where: { periodKey }, select: { comercial: true, tienda: true, horario: true },
        }),
        // Ventas del periodo EXACTAMENTE como /api/sales?periodKey= (mismo OR).
        prisma.sale.findMany({
          where: { OR: [{ periodId: wp.id }, { fecha: { contains: `/${MM}/${YYYY}` } }] },
          select: {
            fecha: true, detalle: true, codigo: true, producto: true, cuota: true,
            anulado: true, pendiente: true, seguro: true, seguroImporte: true,
            rentConCoste: true, isSwap: true, nif: true,
            // Correccion de los Repos: sin estas dos, la madre sustituida
            // seguia sumando en el territorial.
            sustituida: true, sustituyeA: true,
            vendedor: true, sheet: true, grupo: true,
          },
        }),
      ])
      const tiendasRules = stT?.value ? JSON.parse(stT.value) : []
      const o2Rules = stO2?.value ? JSON.parse(stO2.value) : []

      // Misma forma que /api/sales (logs): importe formateado es-ES, cuota numérica.
      // Y mismo filtro que la pantalla: activa (no anulada) y sin Solar 360.
      const ventasMes = rawSales
        .map((s: any) => ({
          ...s,
          importe: s.cuota !== null && s.cuota !== undefined
            ? Number(s.cuota).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '',
          cuota: s.cuota ?? 0,
        }))
        .filter((s: any) => isSaleActive(s) && !isSolar360(s))

      let rows: any[] = []
      try {
        rows = computeTerritorialRows({
          sales: ventasMes, territorialRules: tiendasRules, catalogs: catalogosDelPeriodo(wp.id),
          tiendaHours: hoursRows,
          dashRowsPlus: [], dashRowsBasico: [], viewingPeriod: periodKey.replace('_', ''),
        } as any)
      } catch { rows = [] }
      const prvTerritorial = rows.reduce((acc, r) => acc + (r.importe || 0), 0)

      let bono = { bonoMes: 0, bonoTrim: 0, conectividad: 0, total: 0 }
      try { bono = computeBonosO2Breakdown(ventasMes, o2Rules) } catch { /* 0 */ }

      const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
      meses[ym] = {
        prvTerritorial: r2(prvTerritorial),
        bonoO2Mes: r2(bono.bonoMes),
        bonoO2Trim: r2(bono.bonoTrim),
        bonoO2Conectividad: r2(bono.conectividad),
        bonoO2Total: r2(bono.total),
      }
      if (debug) {
        dbg[ym] = {
          nVentas: ventasMes.length,
          palancas: rows.map((r: any) => ({
            palanca: r.palanca, ventas: r.ventas, comisionBase: r2(r.comisionBase || 0),
            tramo: r.tramoAplicado, importe: r2(r.importe || 0),
          })),
        }
      }
    }
    return NextResponse.json(debug ? { success: true, desde, meses, debug: dbg } : { success: true, desde, meses })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
