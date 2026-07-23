import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { computePanelComisionesTiendas } from '@/lib/panelComisionesTiendas'
import { findCatalogVigente } from '@/lib/salesUtils'
import { tiendaDeComercial, norm } from '@/lib/comercialRoster'

// ─────────────────────────────────────────────────────────────────────────────
// COMISIÓN POR OPERACIÓN de cada comercial para un mes (liquidación) — TIENDAS.
// Server-to-server para el ERP (mi-nuevo-erp): mismo patrón de auth que
// /api/ventas-export (cabecera x-prv-secret === PRV_FEED_SECRET; sin variable
// en producción -> cerrado) y mismo shape de respuesta que el
// /api/comisiones-liquidacion del programa FFVV (el ERP los consume con el
// mismo código; aquí 'perfil' = tienda del comercial).
//
// Usa EL MISMO motor que el Panel Comisiones (src/lib/panelComisionesTiendas.ts,
// consumido también por useComisionesData): al excluir ventas (bajas de
// cliente) los objetivos — incluidos los tramos de EQUIPO
// (REQUIRE_TEAM_OBJ2/OBJ3/OBJ23) y el descuento FTTR de Dispositivos + Seguros —
// se recalculan solos, porque el motor recibe el universo de ventas ya filtrado.
//
// POST body: { "mes": "2026_06", "excluirIds": ["<Sale.id>", ...] }  (excluirIds opcional)
// Respuesta: { mes, porComercial: [{ comercial, perfil, lineas, extras,
//              objetivos, totalLineas, totalExtras, total }], excluidas }
//
// Nota exclusiones: los saleId de las líneas son Sale.id reales (los mismos que
// manda /api/ventas-export). El espejo `${id}-swap` del Swap ANTIGUO solo existe
// en ventas-export (comisión de EMPRESA): aquí no hay línea espejo que excluir,
// y un id desconocido simplemente no excluye nada.
// ─────────────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient()
const SECRET = process.env.PRV_FEED_SECRET || ''

export const dynamic = 'force-dynamic'

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// El `detalle` de la venta ya es el nombre de palanca que entiende el ERP
// (resolver_tab), salvo 'Ti' que allí se llama 'Contratos Móvil' — misma
// traducción que /api/ventas-export.
const GRUPO_ERP: Record<string, string> = { 'Ti': 'Contratos Móvil' }

export async function POST(request: Request) {
  if (!SECRET || request.headers.get('x-prv-secret') !== SECRET) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const mes = String(body?.mes || '').trim()
    if (!/^\d{4}_\d{2}$/.test(mes)) {
      return NextResponse.json({ success: false, error: 'Falta "mes" con formato YYYY_MM (ej. 2026_06)' }, { status: 400 })
    }
    const excluirIds: string[] = Array.isArray(body?.excluirIds) ? body.excluirIds.map((x: any) => String(x)) : []

    // (1) WorkPeriod del mes + (2) MISMO filtro híbrido que /api/sales
    // (periodId relacional O match de string /MM/YYYY para histórico).
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: mes } })
    let temporalWhere: any
    if (wp) {
      const targetMonthStr = String(wp.month).padStart(2, '0')
      const targetYearStr = String(wp.year)
      temporalWhere = {
        OR: [
          { periodId: wp.id },
          { fecha: { contains: `/${targetMonthStr}/${targetYearStr}` } }
        ]
      }
    } else {
      const [targetYearStr, targetMonthStr] = mes.split('_')
      temporalWhere = { fecha: { contains: `/${targetMonthStr}/${targetYearStr}` } }
    }

    let salesDb = await prisma.sale.findMany({
      where: temporalWhere,
      orderBy: { createdAt: 'desc' },
    })

    // (2b) MISMO enriquecimiento de Seguros que /api/sales: ventas de Seguro sin
    // seguroImporte toman la prima (anual) del catálogo del MES por vigencias.
    const seguroSales = salesDb.filter(s =>
      (String(s.detalle || '').toLowerCase() === 'seguro' || String(s.sheet || '').toLowerCase() === 'seguro') &&
      (!(s as any).seguroImporte || (s as any).seguroImporte === 0)
    )
    if (seguroSales.length > 0 && wp) {
      const seguroCatalog = await prisma.productCatalog.findMany({
        where: { periodId: wp.id, categoria: 'Seguro' }
      })
      salesDb = salesDb.map(s => {
        if ((String(s.detalle || '').toLowerCase() === 'seguro' || String(s.sheet || '').toLowerCase() === 'seguro') && (!(s as any).seguroImporte || (s as any).seguroImporte === 0)) {
          const found = findCatalogVigente(seguroCatalog, String(s.producto || ''), s.fecha)
          const cuotaFromCatalog = found && found.anual ? (parseFloat(String(found.anual).replace(',', '.')) || 0) : 0
          if (cuotaFromCatalog && cuotaFromCatalog > 0) {
            return { ...s, seguroImporte: cuotaFromCatalog } as any
          }
        }
        return s
      })
    }

    // MISMO map de salida que /api/sales (shape que espera el motor), incluido
    // periodId (los bonos KPI/Territorial virtuales leen monthSales[0].periodId).
    const logs = salesDb.map(sale => {
      let timestamp = sale.createdAt.getTime()
      if (sale.fecha) {
        const parts = sale.fecha.split('/')
        if (parts.length === 3) {
          timestamp = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime()
        }
      }
      return {
        id: sale.id,
        periodId: sale.periodId,
        sheet: sale.sheet,
        timestamp,
        email: '',
        vendedor: sale.vendedor,
        fecha: sale.fecha,
        codigo: sale.codigo || '',
        producto: sale.producto || '',
        nombreCliente: sale.nombreCliente || '',
        nif: sale.nif || '',
        potencial: sale.potencial || '',
        telf: sale.telf || '',
        activado: '',
        pendiente: sale.pendiente || '',
        anulado: sale.anulado || '',
        anotaciones: sale.anotaciones || '',
        grupo: sale.grupo || '',
        arpu: '',
        importe: sale.cuota !== null ? sale.cuota.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
        cuota: sale.cuota ?? 0,
        detalle: sale.detalle || '',
        rentConCoste: sale.rentConCoste || 'No',
        seguro: sale.seguro || '',
        seguroImporte: (sale as any).seguroImporte ?? null,
        boletin: sale.boletin || '',
        telefonoFijo: sale.telefonoFijo || '',
        telefonoMovil: sale.telefonoMovil || '',
        imei: sale.imei || '',
        numeroPedido: (sale as any).numeroPedido || '',
        origenStock: (sale as any).origenStock || '',
        isSwap: (sale as any).isSwap === true,
        isLibre: (sale as any).isLibre === true,
        motivoModificacion: ''
      }
    })
    logs.sort((a, b) => b.timestamp - a.timestamp)

    // (3) Excluir ventas (bajas de cliente) ANTES de computar: así los tramos —
    // incluidos los de EQUIPO y el descuento FTTR — se recalculan solos.
    const excl = new Set(excluirIds)
    const ventas = logs.filter(l => !excl.has(String(l.id)))
    const excluidas = logs.length - ventas.length

    // (4) Reglas del Panel Comisiones del mes (tabla TiendaCommissionRule).
    // Una liquidación no debe calcular con reglas vacías -> 422 explícito.
    const [tiendaRules, tiendaHours] = await Promise.all([
      prisma.tiendaCommissionRule.findMany({ where: { periodKey: mes }, orderBy: { order: 'asc' } }),
      prisma.tiendaComercialHour.findMany({ where: { periodKey: mes }, orderBy: { comercial: 'asc' } }),
    ])
    if (!tiendaRules.length) {
      return NextResponse.json({
        success: false,
        error: `No existen reglas de comisiones del mes (TiendaCommissionRule para ${mes}). Una liquidación no debe calcularse con reglas vacías: configura/clona el Panel de Comisiones de ${mes} y reintenta.`,
      }, { status: 422 })
    }

    // (5) Resto de insumos que el hook traía por fetch:
    //     o2_rules_v2_{mes} (reglas + horas O2/Marta), territorial_o2_{mes},
    //     extras (asignaciones + reglas KPI crudas), catálogos y fttr_discount_{mes}.
    const [o2Setting, territorialO2Setting, extraAssignments, kpiRules, fttrSetting, activePeriod] = await Promise.all([
      prisma.appSetting.findUnique({ where: { key: `o2_rules_v2_${mes}` } }),
      prisma.appSetting.findUnique({ where: { key: `territorial_o2_${mes}` } }),
      prisma.extraAssignment.findMany({
        where: { period: { period_key: mes } },
        include: { rule: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.extraRule.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.appSetting.findUnique({ where: { key: `fttr_discount_${mes}` } }),
      prisma.workPeriod.findFirst({ where: { status: 'ACTIVE' } }),
    ])

    let o2Rules: any[] = []
    let o2Hours: any[] = []
    if (o2Setting?.value) {
      try {
        const parsed = JSON.parse(o2Setting.value)
        o2Rules = parsed.rules || []
        o2Hours = parsed.hours || []
      } catch {}
    }
    let territorialO2Rules: any[] = []
    if (territorialO2Setting?.value) {
      try { territorialO2Rules = JSON.parse(territorialO2Setting.value) || [] } catch {}
    }

    // Catálogos: MISMA semántica que /api/catalogs sin parámetros (lo que pide el
    // Panel en el navegador): catálogo del mes ACTIVO; si está vacío, el legado
    // (periodId null). Solo se usa para la prima vigente de los Seguros.
    let catRecords: any[] = []
    if (activePeriod) {
      catRecords = await prisma.productCatalog.findMany({
        where: { periodId: activePeriod.id },
        orderBy: { createdAt: 'asc' }
      })
    }
    if (catRecords.length === 0) {
      catRecords = await prisma.productCatalog.findMany({
        where: { periodId: null },
        orderBy: { createdAt: 'asc' }
      })
    }
    const catalogs: Record<string, any[]> = { "Ti": [], "Rent": [], "O2": [], "Seguro": [], "miMovistar": [], "Traslado miMovistar": [], "Suscripciones TV": [], "Varios": [], "Repos": [], "Resto BAF": [] }
    for (const r of catRecords) {
      if (!catalogs[r.categoria]) catalogs[r.categoria] = []
      catalogs[r.categoria].push({
        producto: r.producto,
        mensual: r.mensual,
        anual: r.anual,
        subcategoria: r.subcategoria,
        fabricante: r.fabricante,
        gama: r.gama,
        validFrom: r.validFrom,
        validTo: r.validTo,
        comision: r.comision,
        comisionConCoste: r.comisionConCoste,
        id: r.id
      })
    }

    let fttrDiscount = 910
    if (fttrSetting && fttrSetting.value !== null) {
      const parsedVal = parseFloat(fttrSetting.value)
      if (!isNaN(parsedVal)) fttrDiscount = parsedVal
    }

    // (6) EL MISMO motor que el Panel Comisiones (aplica él mismo los filtros
    // Solar360 / reglas 'solar' / KPI [KPI] que hacía el hook).
    const result = computePanelComisionesTiendas({
      periodKey: mes,
      sales: ventas,
      tiendaRules,
      tiendaHours,
      o2Rules,
      o2Hours,
      territorialO2Rules,
      extraAssignments,
      kpiRules,
      catalogs,
      fttrDiscount,
    })

    // Tienda de cada comercial (para 'perfil'): panel de horarios del mes, con
    // fallback al mapa fijo heredado; Marta/O2 -> 'O2'.
    const tiendaByComercial = new Map<string, string>()
    for (const h of tiendaHours) {
      const key = norm(h.comercial)
      if (key && !tiendaByComercial.has(key)) tiendaByComercial.set(key, String(h.tienda || '').trim())
    }
    const tiendaDe = (name: string) => {
      if (norm(name).includes('marta')) return 'O2'
      return tiendaByComercial.get(norm(name)) || tiendaDeComercial(name) || ''
    }

    // Respuesta: líneas con los campos de la venta original (mismos nombres que
    // el comisiones-liquidacion de FFVV: fecha/nif/telf/codPedido/producto/cuota)
    // para que el ERP cruce con el mismo código. codPedido = Sale.numeroPedido.
    const bySaleId = new Map(ventas.map(v => [String(v.id), v]))
    const porComercial = result.sellerStats.map(st => {
      const lineas = st.lineasDetalle.map(l => {
        const v: any = bySaleId.get(String(l.saleId)) || {}
        return {
          saleId: l.saleId,
          fecha: v.fecha || '',
          // `grupo` = palanca de la VENTA como la entiende el ERP: su `detalle`
          // con la misma traducción que usa /api/ventas-export ('Ti' → Contratos
          // Móvil); la línea de seguro adosado va a Seguros. El nombre de la
          // regla de comisión viaja aparte en `regla`.
          grupo: l.esSeguroVirtual ? 'Seguros'
            : (GRUPO_ERP[String(v.detalle || '')] || v.detalle || v.grupo || l.grupo),
          regla: l.grupo,
          producto: l.producto || v.producto || '',
          nif: v.nif || '',
          telf: v.telf || v.telefonoMovil || '',
          codPedido: v.numeroPedido || '',
          cuota: v.cuota ?? 0,
          comision: l.comision,
          ...(l.esSeguroVirtual ? { esSeguroVirtual: true } : {}),
        }
      })
      const totalLineas = r2(lineas.reduce((acc, l) => acc + l.comision, 0))
      const totalExtras = r2(st.extrasConceptos.reduce((acc, e) => acc + e.importe, 0))
      return {
        comercial: st.name,
        perfil: tiendaDe(st.name),
        lineas,
        extras: st.extrasConceptos.map(e => ({ ...e, importe: r2(e.importe) })),
        objetivos: st.objetivosResumen,
        totalLineas,
        totalExtras,
        total: r2(totalLineas + totalExtras),
      }
    })

    return NextResponse.json({ success: true, mes, porComercial, excluidas })
  } catch (e: any) {
    console.error('[POST comisiones-liquidacion]', e)
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
