// ─────────────────────────────────────────────────────────────────────────────
// CARGA SERVIDOR de los insumos del Panel de Comisiones de TIENDAS.
//
// Es la parte "de base de datos" que antes vivía dentro de
// /api/comisiones-liquidacion: deja listo el `input` EXACTO que espera
// computePanelComisionesTiendas (el mismo motor que usa el navegador con
// useComisionesData). Se extrajo aquí para que varios endpoints de servidor
// (liquidación para el ERP, parte diario…) calculen con LOS MISMOS insumos y no
// haya dos versiones del cargador que se puedan desincronizar: es dinero.
//
// No filtra ni excluye nada: devuelve el universo completo de ventas del mes
// (`ventas`) y el `input` con esas mismas ventas. Quien necesite excluir (bajas
// de cliente en la liquidación) llama al motor con { ...input, sales: filtradas }
// para que los objetivos y tramos se recalculen solos.
// ─────────────────────────────────────────────────────────────────────────────
import type { PrismaClient } from '@prisma/client'
import { findCatalogVigente } from '@/lib/salesUtils'
import type { PanelComisionesTiendasInput } from '@/lib/panelComisionesTiendas'

export interface PanelInputsTiendas {
  /** Insumos listos para computePanelComisionesTiendas (sales = universo completo). */
  input: PanelComisionesTiendasInput
  /** Ventas del mes con el shape de /api/sales (las mismas de input.sales). */
  ventas: any[]
  /** WorkPeriod del mes (null si el mes no existe como periodo). */
  wp: any
  /** Filas del panel "Horarios de Comerciales" del mes (plantilla oficial). */
  tiendaHours: any[]
}

export async function loadPanelInputs(prisma: PrismaClient, mes: string): Promise<PanelInputsTiendas> {
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

  // (3) Reglas del Panel Comisiones del mes (tabla TiendaCommissionRule) +
  //     horarios (plantilla de comerciales del mes).
  const [tiendaRules, tiendaHours] = await Promise.all([
    prisma.tiendaCommissionRule.findMany({ where: { periodKey: mes }, orderBy: { order: 'asc' } }),
    prisma.tiendaComercialHour.findMany({ where: { periodKey: mes }, orderBy: { comercial: 'asc' } }),
  ])

  // (4) Resto de insumos que el hook traía por fetch:
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

  const input: PanelComisionesTiendasInput = {
    periodKey: mes,
    sales: logs,
    tiendaRules,
    tiendaHours,
    o2Rules,
    o2Hours,
    territorialO2Rules,
    extraAssignments,
    kpiRules,
    catalogs,
    fttrDiscount,
  }

  return { input, ventas: logs, wp, tiendaHours }
}
