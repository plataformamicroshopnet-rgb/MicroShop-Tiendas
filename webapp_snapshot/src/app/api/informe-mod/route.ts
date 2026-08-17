import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { normalizeRole } from '@/lib/appConfig'
import { canView } from '@/lib/permissions'
import { loadPanelInputs } from '@/lib/panelComisionesTiendasServer'
import { computeMonthMetrics } from '@/lib/modMetrics'
import { calculateTramitacion } from '@/lib/tramitacionEngine'
import { computeModResumen } from '@/lib/modResumen'

// ─────────────────────────────────────────────────────────────────────────────
// INFORME MOD DIARIO (JSON) — solo lectura.
//
// Un único JSON con LOS MISMOS NÚMEROS que enseñan las tres pantallas del
// seguimiento de ventas, para el correo diario del dueño:
//   1) MOD (/seguimiento-ventas/mod)               → computeMonthMetrics (lib)
//   2) Seguimiento de Tramitación (/tramitacion)   → calculateTramitacion (lib)
//   3) Resumen de Métricas MOD (/mod-resumen)      → computeModResumen (lib,
//      extraído de la propia pantalla para que compartan motor)
//
// Los insumos se cargan de Prisma DIRECTAMENTE replicando lo que cada pantalla
// pide por fetch (mismos endpoints, mismos fallbacks), sin pasar por HTTP.
// Las «rarezas» de las pantallas se conservan a propósito — es un correo: si
// el correo y la pantalla discrepan, deja de valer.
//   - MOD y Resumen: días laborables CON festivos de Salamanca.
//   - Tramitación: días laborables L–V SIN festivos (así lo hace su página).
//   - MOD: includeTerritorialTiendas = false (la fila territorial va aparte
//     en el Resumen), y el año anterior puede venir PISADO por el override
//     manual de AppSetting mod_manual_prev_{Y-1}_{M}.
//   - Ambos años usan las reglas territoriales del MES ACTIVO (la página MOD
//     pide /api/territorial solo del periodo activo y lo pasa a los dos).
//
// GET /api/informe-mod  — periodo: el mes ACTIVO (WorkPeriod ACTIVE), igual
// que el PeriodProvider por defecto. Fechas en Europe/Madrid (el servidor va
// en UTC; mismo patrón Intl que el parte diario).
// Auth doble (patrón del parte diario):
//   - cabecera x-prv-secret === PRV_FEED_SECRET (server-to-server), o
//   - sesión del programa con mando (ADMIN / JEFE DE VENTAS / MODULE_JEFE_TIENDAS,
//     el mismo módulo que guarda las pantallas).
// ─────────────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient()
// En producción hay que fijar PRV_FEED_SECRET (mismo valor en el ERP); en
// desarrollo cae al default de la casa (mismo patrón que /api/prv-feed).
const SECRET = process.env.PRV_FEED_SECRET
  || (process.env.NODE_ENV === 'production' ? '' : 'dev-prv-secret')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Fecha (YYYY-MM-DD) del instante dado en hora de Madrid: el servidor puede
// estar en UTC y a las 00:30 de Madrid «hoy» no es el mismo día para los dos.
const isoEnMadrid = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const horaEnMadrid = (d: Date) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(d)

/** «Hoy» de Madrid como Date local (para las funciones de días laborables, que miran getFullYear/getMonth/getDate). */
const hoyMadrid = () => {
  const [y, m, d] = isoEnMadrid(new Date()).split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ── Días laborables del Seguimiento de Tramitación ───────────────────────────
// COPIA de las funciones locales de esa página: L–V SIN festivos. NO usar las
// de modMetrics aquí (esas quitan los festivos de Salamanca y darían otros
// «Proyect» que los de la pantalla).
const getWorkingDaysInMonthLV = (year: number, month: number) => {
  let days = 0;
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    if (date.getDay() !== 0 && date.getDay() !== 6) days++; // Lunes a Viernes
    date.setDate(date.getDate() + 1);
  }
  return days;
};

const getWorkingDaysElapsedLV = (year: number, month: number, today: Date) => {
  // Si estamos en un mes futuro
  if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1)) {
    return 0; // No han pasado días
  }
  // Si estamos en un mes pasado
  if (year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth() + 1)) {
    return getWorkingDaysInMonthLV(year, month);
  }
  // Si estamos en el mes actual
  let days = 0;
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1 && date.getDate() <= today.getDate()) {
    if (date.getDay() !== 0 && date.getDay() !== 6) days++;
    date.setDate(date.getDate() + 1);
  }
  return days;
};

// ── Réplicas servidor de los endpoints que piden las pantallas ───────────────

/** GET /api/objetivos?periodKey=X&strictPeriod=1 (mismos fallbacks). */
async function cargarObjetivos(periodKey: string) {
  const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } })
  let records: any[] = []
  if (wp) {
    records = await prisma.objective.findMany({ where: { periodId: wp.id }, orderBy: { createdAt: 'asc' } })
  }
  if (records.length === 0) {
    const activeWp = await prisma.workPeriod.findFirst({ where: { status: 'ACTIVE' } })
    if (activeWp) {
      records = await prisma.objective.findMany({ where: { periodId: activeWp.id }, orderBy: { createdAt: 'asc' } })
    }
    if (records.length === 0) {
      const allPeriods = await prisma.workPeriod.findMany({ orderBy: { period_key: 'desc' } })
      for (const p of allPeriods) {
        records = await prisma.objective.findMany({ where: { periodId: p.id }, orderBy: { createdAt: 'asc' } })
        if (records.length > 0) break
      }
    }
  }
  const objetivos: Record<string, any> = { 'Pyme': {}, 'Captador': {} }
  const grupos: Record<string, Record<string, string>> = { 'Pyme': {}, 'Captador': {} }
  const targetMonth = periodKey.replace('_', '')
  for (const record of records) {
    const r = record as any
    const recordMonth = targetMonth
    if (!objetivos[r.profile]) objetivos[r.profile] = {}
    if (!objetivos[r.profile][recordMonth]) objetivos[r.profile][recordMonth] = {}
    objetivos[r.profile][recordMonth][r.objKey] = r.value
    if (r.grupo) {
      if (!grupos[r.profile]) grupos[r.profile] = {}
      grupos[r.profile][r.objKey] = r.grupo
    }
  }
  return { success: true, objetivos, grupos }
}

/** GET /api/importes-pyme|importes-plus?periodKey=X&strictPeriod=1 (misma cadena de fallbacks, legado incluido). */
async function cargarImportes(modelo: 'importePyme' | 'importePlus', periodKey: string) {
  const delegate: any = (prisma as any)[modelo]
  let importes: any[] = []
  const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } })
  if (wp) {
    importes = await delegate.findMany({ where: { periodId: wp.id }, orderBy: { createdAt: 'asc' } })
  }
  if (importes.length === 0) {
    const activeWp = await prisma.workPeriod.findFirst({ where: { status: 'ACTIVE' } })
    if (activeWp) {
      importes = await delegate.findMany({ where: { periodId: activeWp.id }, orderBy: { createdAt: 'asc' } })
    }
    if (importes.length === 0) {
      const allPeriods = await prisma.workPeriod.findMany({ orderBy: { period_key: 'desc' } })
      for (const p of allPeriods) {
        importes = await delegate.findMany({ where: { periodId: p.id }, orderBy: { createdAt: 'asc' } })
        if (importes.length > 0) break
      }
    }
    if (importes.length === 0) {
      importes = await delegate.findMany({ where: { periodId: null }, orderBy: { createdAt: 'asc' } })
    }
  }
  return { success: true, data: importes }
}

/** GET /api/extras/assignments?periodKey=X. */
async function cargarExtras(periodKey: string) {
  const assignments = await prisma.extraAssignment.findMany({
    where: { period: { period_key: periodKey } },
    include: { rule: true },
    orderBy: { createdAt: 'desc' },
  })
  return { success: true, assignments }
}

/** Los 4 configs que las páginas piden con fetchConfigs(periodKey): [objetivos, pyme, plus, extras]. */
async function cargarConfigs(periodKey: string): Promise<any[]> {
  return Promise.all([
    cargarObjetivos(periodKey),
    cargarImportes('importePyme', periodKey),
    cargarImportes('importePlus', periodKey),
    cargarExtras(periodKey),
  ])
}

/** GET /api/catalogs SIN parámetros (lo que piden MOD y mod-resumen): catálogo del mes ACTIVO, fallback legado. */
async function cargarCatalogs() {
  let records: any[] = []
  const activePeriod = await prisma.workPeriod.findFirst({ where: { status: 'ACTIVE' } })
  if (activePeriod) {
    records = await prisma.productCatalog.findMany({ where: { periodId: activePeriod.id }, orderBy: { createdAt: 'asc' } })
  }
  if (records.length === 0) {
    records = await prisma.productCatalog.findMany({ where: { periodId: null }, orderBy: { createdAt: 'asc' } })
  }
  const catalogs: Record<string, any[]> = { 'Ti': [], 'Rent': [], 'O2': [], 'Seguro': [], 'miMovistar': [], 'Traslado miMovistar': [], 'Suscripciones TV': [], 'Varios': [], 'Repos': [], 'Repos UP': [], 'Resto BAF': [] }
  for (const r of records) {
    if (!catalogs[r.categoria]) catalogs[r.categoria] = []
    catalogs[r.categoria].push({
      producto: r.producto, mensual: r.mensual, anual: r.anual,
      subcategoria: r.subcategoria, fabricante: r.fabricante, gama: r.gama,
      validFrom: r.validFrom, validTo: r.validTo,
      comision: r.comision, comisionConCoste: r.comisionConCoste, id: r.id,
    })
  }
  return catalogs
}

export async function GET(request: Request) {
  try {
    // ── Auth: secreto del ERP o sesión con mando ─────────────────────────────
    const secretOk = !!SECRET && request.headers.get('x-prv-secret') === SECRET
    if (!secretOk) {
      const session = await getSession().catch(() => null)
      const user = session?.user
      if (!user || !user.username) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
      }
      const rol = normalizeRole(user.role)
      const puedeVer = rol === 'ADMIN' || rol === 'JEFE DE VENTAS' || canView(user, 'MODULE_JEFE_TIENDAS')
      if (!puedeVer) {
        return NextResponse.json({ success: false, error: 'Sin permiso para el informe MOD' }, { status: 403 })
      }
    }

    // ── Periodo: el mes ACTIVO (igual que el PeriodProvider por defecto) ────
    const wpActivo = await prisma.workPeriod.findFirst({ where: { status: 'ACTIVE' } })
    if (!wpActivo) {
      return NextResponse.json({ success: false, error: 'No hay periodo ACTIVO' }, { status: 404 })
    }
    const periodKey = wpActivo.period_key
    const [yearStr, monthStr] = periodKey.split('_')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    const prevYearKey = `${year - 1}_${monthStr}`

    const ahora = new Date()
    const hoy = hoyMadrid()

    // ── Insumos (mismas fuentes que las pantallas, directamente de Prisma) ──
    const [
      panelCurr,            // ventas del mes + reglas/horarios/o2 (shape /api/sales exacto)
      panelPrev,            // ventas del mismo mes del año anterior
      catalogs,             // /api/catalogs sin parámetros
      configsCurr,          // [objetivos, pyme, plus, extras] strictPeriod del mes
      configsPrev,          //   … y del año anterior
      periods,              // /api/period (el feed ve todos)
      mfSales,              // /api/movilfree/sales
      mfProductsRaw,        // /api/movilfree/products (solo lectura: sin la migración de stock)
      msProductsRaw,
      territorialTiendasSetting,
      territorialO2Setting,
      storeObjectives,      // /api/tramitacion-objetivos
      manualSetting,        // override manual del año anterior (pantalla MOD)
    ] = await Promise.all([
      loadPanelInputs(prisma, periodKey),
      loadPanelInputs(prisma, prevYearKey),
      cargarCatalogs(),
      cargarConfigs(periodKey),
      cargarConfigs(prevYearKey),
      prisma.workPeriod.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.movilFreeSale.findMany({ orderBy: { createdAt: 'desc' } }),
      // De los productos solo se consume id + coste (para el margen MovilFree);
      // se seleccionan solo esas columnas (misma tabla, misma cifra, menos peso).
      prisma.movilFreeProduct.findMany({ select: { id: true, coste: true }, orderBy: { createdAt: 'desc' } }),
      prisma.microShopProduct.findMany({ select: { id: true, coste: true }, orderBy: { createdAt: 'desc' } }),
      prisma.appSetting.findUnique({ where: { key: `territorial_tiendas_${periodKey}` } }),
      prisma.appSetting.findUnique({ where: { key: `territorial_o2_${periodKey}` } }),
      prisma.tiendaStoreObjective.findMany({ where: { periodKey } }),
      prisma.appSetting.findUnique({ where: { key: `mod_manual_prev_${year - 1}_${monthStr}` } }),
    ])

    const ventasCurr = panelCurr.ventas
    const ventasPrev = panelPrev.ventas
    // Mismo «combined» que /api/movilfree/products (solo se usa .id y .coste).
    const mfProducts = [
      ...mfProductsRaw.map((item: any) => ({ ...item, isMovilFree: true })),
      ...msProductsRaw.map((item: any) => ({ ...item, isMovilFree: false })),
    ]
    let territorialTiendas: any[] = []
    try { territorialTiendas = territorialTiendasSetting?.value ? JSON.parse(territorialTiendasSetting.value) : [] } catch {}
    let territorialO2: any[] = []
    try { territorialO2 = territorialO2Setting?.value ? JSON.parse(territorialO2Setting.value) : [] } catch {}

    // ════════════════════════════════════════════════════════════════════════
    // BLOQUE 1 · MOD — mismos insumos y mismo motor que la página
    // ════════════════════════════════════════════════════════════════════════
    const processMetrics = (salesListRaw: any[], configs: any[], y: number, m: number, periodKeyForConfig: string) =>
      computeMonthMetrics({
        salesRaw: salesListRaw,
        configs,
        catalogs,
        periods,
        mfSales,
        mfProducts,
        year: y,
        month: m,
        periodKeyForConfig,
        o2Rules: territorialO2,
        tiendasRules: territorialTiendas,
        includeTerritorialTiendas: false, // como la pantalla MOD
        hoy,
      })

    const currMetrics = processMetrics(ventasCurr, configsCurr, year, month, periodKey)
    const prevMetrics = processMetrics(ventasPrev, configsPrev, year - 1, month, prevYearKey)

    // Override manual del año anterior (AppSetting): si existe, PISA lo calculado
    // — misma aritmética que la pantalla (manual '' = usar lo calculado).
    let manual: { importe: string; ops: string; days: string } | null = null
    try { manual = manualSetting?.value ? JSON.parse(manualSetting.value) : null } catch {}
    const manualImportePrev = manual?.importe || ''
    const manualOpsPrev = manual?.ops || ''
    const manualDaysPrev = manual?.days || ''

    const overriddenPrevOps = manualOpsPrev !== '' ? parseInt(manualOpsPrev, 10) : prevMetrics.totalOps
    const overriddenPrevDays = manualDaysPrev !== '' ? parseInt(manualDaysPrev, 10) : prevMetrics.workingDaysElapsed
    const overriddenPrevImporte = manualImportePrev !== '' ? parseFloat(manualImportePrev) : prevMetrics.totalImporte

    const overriddenPrevMediaOpsDiaria = overriddenPrevDays > 0 ? overriddenPrevOps / overriddenPrevDays : 0
    const overriddenPrevMediaPorOp = overriddenPrevOps > 0 ? overriddenPrevImporte / overriddenPrevOps : 0
    const overriddenPrevMediaImporteDiario = overriddenPrevDays > 0 ? overriddenPrevImporte / overriddenPrevDays : 0

    const overriddenPctOps = overriddenPrevOps > 0
      ? ((currMetrics.estOps - overriddenPrevOps) / overriddenPrevOps) * 100
      : 0
    const overriddenPctImporte = overriddenPrevImporte > 0
      ? ((currMetrics.estRentabilidad - overriddenPrevImporte) / overriddenPrevImporte) * 100
      : 0

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    const monthName = monthNames[month - 1]

    const mod = {
      monthName,
      year,
      anioAnterior: {
        etiqueta: `${monthName} ${year - 1}`,
        ops: overriddenPrevOps,
        dias: overriddenPrevDays,
        mediaOpsDiaria: overriddenPrevMediaOpsDiaria,
        mediaPorOp: overriddenPrevMediaPorOp,
        importe: overriddenPrevImporte,
        mediaImporteDiario: overriddenPrevMediaImporteDiario,
        manualOverride: manual,
      },
      mesActual: {
        etiqueta: `${monthName} ${year}`,
        ops: currMetrics.totalOps,
        dias: currMetrics.workingDaysElapsed,
        mediaOpsDiaria: currMetrics.mediaOpsDiaria,
        mediaPorOp: currMetrics.mediaPorOp,
        importe: currMetrics.totalImporte,
        mediaImporteDiario: currMetrics.mediaImporteDiario,
        breakdown: currMetrics.breakdown,
      },
      estimacion: {
        estOps: currMetrics.estOps,
        pctOps: overriddenPctOps,
        estRentabilidad: currMetrics.estRentabilidad,
        pctImporte: overriddenPctImporte,
      },
    }

    // ════════════════════════════════════════════════════════════════════════
    // BLOQUE 2 · SEGUIMIENTO DE TRAMITACIÓN — motor calculateTramitacion +
    // la aritmética inline de la página (totales, déficit, %, media).
    // OJO: días laborables L–V SIN festivos (rareza de ESTA pantalla).
    // ════════════════════════════════════════════════════════════════════════
    const workingDaysInMonth = getWorkingDaysInMonthLV(year, month)
    const workingDaysElapsed = getWorkingDaysElapsedLV(year, month, hoy)

    const dataRows: any[] = calculateTramitacion(
      ventasCurr,
      panelCurr.input.tiendaRules || [],
      panelCurr.input.tiendaHours || [],
      storeObjectives,
      workingDaysElapsed,
      workingDaysInMonth,
      panelCurr.input.o2Rules || [],
      panelCurr.input.o2Hours || [],
    ) as any[]

    const movistarRows = dataRows.filter(r => r.store !== 'O2')
    const o2Rows = dataRows.filter(r => r.store === 'O2')

    const CAMPOS_SUMA = [
      'pers', 'altasTotales',
      'bafNoTrasl_obj', 'bafNoTrasl_vent', 'bafNoTrasl_tram', 'bafNoTrasl_proj',
      'bafConvMS_obj', 'bafConvMS_vent', 'bafConvMS_tram', 'bafConvMS_proj',
      'tvFutbol_obj', 'tvFutbol_vent', 'tvFutbol_proj',
      'alarmas_obj', 'alarmas_vent', 'alarmas_proj',
      'dispSegEuros_obj', 'dispSegEuros_vent', 'dispSegEuros_proj',
      'dispUnidades_obj', 'dispUnidades_vent', 'dispUnidades_proj',
      'seguros_obj', 'seguros_vent', 'seguros_proj',
      'movil_obj', 'movil_vent', 'movil_proj',
      'repos_obj', 'repos_vent', 'repos_proj',
      'fttr_obj', 'fttr_vent', 'fttr_proj',
    ]
    const sumar = (rows: any[], nombre: string) => {
      const t: any = { store: nombre }
      for (const c of CAMPOS_SUMA) t[c] = rows.reduce((acc, r) => acc + (Number(r[c]) || 0), 0)
      return t
    }
    const totals = sumar(movistarRows, 'Operaciones')
    const o2Totals = sumar(o2Rows, 'Operaciones O2')

    // Fórmulas de las filas resumen, copiadas de la página:
    //   Déficit  = (obj/díasMes)·díasTranscurridos − (vent + tram)
    //   %        = proy / obj
    //   Media    = proy (la proyección ya ES (vent+tram)/días·díasMes)
    const deficit = (obj: number, vent = 0, tram = 0) => {
      const dailyTarget = workingDaysInMonth > 0 ? obj / workingDaysInMonth : 0
      const expectedToday = dailyTarget * workingDaysElapsed
      return expectedToday - (vent + tram)
    }
    const pct = (obj: number, proj: number) => (obj > 0 ? proj / obj : 0)

    const resumenDe = (t: any) => ({
      bafNoTrasl: { deficit: deficit(t.bafNoTrasl_obj, t.bafNoTrasl_vent, t.bafNoTrasl_tram), pct: pct(t.bafNoTrasl_obj, t.bafNoTrasl_proj), media: t.bafNoTrasl_proj },
      bafConvMS: { deficit: deficit(t.bafConvMS_obj, t.bafConvMS_vent, t.bafConvMS_tram), pct: pct(t.bafConvMS_obj, t.bafConvMS_proj), media: t.bafConvMS_proj },
      tvFutbol: { deficit: deficit(t.tvFutbol_obj, t.tvFutbol_vent), pct: pct(t.tvFutbol_obj, t.tvFutbol_proj), media: t.tvFutbol_proj },
      dispSegEuros: { deficit: deficit(t.dispSegEuros_obj, t.dispSegEuros_vent), pct: pct(t.dispSegEuros_obj, t.dispSegEuros_proj), media: t.dispSegEuros_proj, esEuro: true },
      repos: { deficit: deficit(t.repos_obj, t.repos_vent), pct: pct(t.repos_obj, t.repos_proj), media: t.repos_proj },
      fttr: { deficit: deficit(t.fttr_obj, t.fttr_vent), pct: pct(t.fttr_obj, t.fttr_proj), media: t.fttr_proj },
      alarmas: { deficit: deficit(t.alarmas_obj, t.alarmas_vent), pct: pct(t.alarmas_obj, t.alarmas_proj), media: t.alarmas_proj },
    })

    const isoHoy = isoEnMadrid(ahora)
    const tramitacion = {
      // La cabecera de la pantalla pinta el DÍA de hoy con el mes/año del
      // periodo seleccionado (rareza conservada tal cual).
      fechaCabecera: `${isoHoy.slice(8, 10)}/${monthStr.padStart(2, '0')}/${year}`,
      workingDaysInMonth,
      workingDaysElapsed,
      rows: movistarRows,
      totals,
      resumen: resumenDe(totals),
      o2Rows,
      o2Totals,
      o2Resumen: {
        bafNoTrasl: { deficit: deficit(o2Totals.bafNoTrasl_obj, o2Totals.bafNoTrasl_vent, o2Totals.bafNoTrasl_tram), pct: pct(o2Totals.bafNoTrasl_obj, o2Totals.bafNoTrasl_proj), media: o2Totals.bafNoTrasl_proj },
        bafConvMS: { deficit: deficit(o2Totals.bafConvMS_obj, o2Totals.bafConvMS_vent, o2Totals.bafConvMS_tram), pct: pct(o2Totals.bafConvMS_obj, o2Totals.bafConvMS_proj), media: o2Totals.bafConvMS_proj },
      },
    }

    // ════════════════════════════════════════════════════════════════════════
    // BLOQUE 3 · RESUMEN DE MÉTRICAS MOD — el MISMO computeModResumen que
    // ahora usa la pantalla (extraído de ella).
    // ════════════════════════════════════════════════════════════════════════
    let periodData = periods.find((p: any) => p.period_key === periodKey)
    if (!periodData) {
      periodData = periods.find((p: any) => p.status === 'ACTIVE') || periods[0]
    }
    const [objDataCurr] = configsCurr
    const resumen = computeModResumen({
      sales: ventasCurr,
      movilFreeSales: mfSales,
      movilFreeProducts: mfProducts,
      tiendaHours: panelCurr.input.tiendaHours || [],
      territorialTiendasRules: territorialTiendas,
      territorialO2Rules: territorialO2,
      catalogs,
      objetivos: objDataCurr.objetivos || { Pyme: {}, Captador: {} },
      objGrupos: objDataCurr.grupos || { Pyme: {}, Captador: {} },
      importesPyme: configsCurr[1].data || [],
      importesPlus: configsCurr[2].data || [],
      activeExtras: (configsCurr[3].assignments || []).filter((ea: any) => ea.status !== 'CANCELLED'),
      periodData,
      year,
      month,
      hoy,
    })

    return NextResponse.json({
      success: true,
      periodKey,
      monthName,
      year,
      month,
      generado: { fecha: isoHoy, hora: horaEnMadrid(ahora), zona: 'Europe/Madrid' },
      mod,
      tramitacion,
      resumen,
    })
  } catch (e: any) {
    console.error('[GET informe-mod]', e)
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  }
  // Sin $disconnect: cliente Prisma de módulo, mismo criterio que el parte diario.
}
