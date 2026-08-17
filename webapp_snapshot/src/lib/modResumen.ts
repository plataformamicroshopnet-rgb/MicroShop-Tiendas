// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN DE MÉTRICAS MOD — el ensamblaje de la pantalla, como función pura.
//
// Este código vivía DENTRO del useMemo de /seguimiento-ventas/mod-resumen
// (page.tsx) y se ha movido aquí TAL CUAL para que la pantalla y el informe
// diario por correo (/api/informe-mod) calculen con EL MISMO motor y no puedan
// discrepar. No se ha «arreglado» nada por el camino, a propósito:
//   - La copia local de los bonos O2 (getSalesDataForStoreAndType +
//     calculateO2Importe) se queda AQUÍ aunque exista computeBonosO2 en
//     territorialConsolidado.ts: es la que la pantalla venía usando y es la
//     que tiene el comentario del descuadre de julio 2026. NO unificar sin
//     cotejar céntimo a céntimo.
//   - Los días laborables de este bloque SÍ descuentan los festivos de
//     Salamanca (a diferencia del Seguimiento de Tramitación, que va L–V).
//
// `hoy` es inyectable porque el servidor corre en UTC: el navegador pasaba su
// «hoy» implícito (hora de Madrid); el endpoint del correo pasa el día de
// Madrid calculado con Intl. Sin argumento se comporta exactamente igual que
// antes (new Date()).
// ─────────────────────────────────────────────────────────────────────────────
import { matchTipoVenta } from '@/lib/ventaMatching'
import { renderDashboardData, sanitizeSale, esCorreccionRepos, esVentaSustituida } from '@/lib/salesUtils'
import { getSaleCommissionBase, getSwapBonus } from '@/lib/saleCommission'
import { computeTerritorialTotal } from '@/lib/territorialConsolidado'
import { getSellersForStore } from '@/lib/comercialRoster'

// Salamanca Holidays and Working Days Logic
const isHoliday = (y: number, m: number, d: number) => {
  if (m === 1 && (d === 1 || d === 6)) return true;
  if (m === 4 && d === 23) return true;
  if (m === 5 && d === 1) return true;
  if (m === 6 && d === 12) return true; // San Juan de Sahagún (Salamanca local)
  if (m === 8 && d === 15) return true;
  if (m === 9 && d === 8) return true;  // Virgen de la Vega (Salamanca local)
  if (m === 10 && d === 12) return true;
  if (m === 11 && d === 1) return true;
  if (y === 2026 && m === 11 && d === 2) return true;
  if (y === 2025 && m === 10 && d === 13) return true;
  if (m === 12 && (d === 6 || d === 8 || d === 25)) return true;
  if (y === 2026 && m === 12 && d === 7) return true;
  if (y === 2025 && m === 4 && (d === 17 || d === 18)) return true;
  if (y === 2026 && m === 4 && (d === 2 || d === 3)) return true;
  return false;
};

const getWorkingDaysInMonth = (y: number, m: number) => {
  let days = 0;
  const date = new Date(y, m - 1, 1);
  while (date.getMonth() === m - 1) {
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(y, m, dayOfMonth)) {
      days++;
    }
    date.setDate(date.getDate() + 1);
  }
  return days;
};

const calcularDiasLaborablesHastaHoy = (y: number, m: number, hoy: Date = new Date()) => {
  const today = hoy;
  const targetIsPast = (today.getFullYear() > y) || (today.getFullYear() === y && today.getMonth() > m - 1);

  let lastDayToCount = new Date(y, m, 0).getDate();
  if (!targetIsPast && today.getFullYear() === y && today.getMonth() === m - 1) {
    lastDayToCount = today.getDate();
  }

  let elapsed = 0;
  for (let d = 1; d <= lastDayToCount; d++) {
    const dt = new Date(y, m - 1, d);
    const dayOfWeek = dt.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(y, m, d)) {
      elapsed++;
    }
  }
  return elapsed;
};

const parseSafeFloat = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).replace('€', '').replace(/\s/g, '').replace(',', '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

export interface ModResumenInput {
  /** Ventas del mes con el shape RAW de /api/sales (SIN sanitizeSale: los bonos O2 y el territorial lo necesitan crudo). */
  sales: any[]
  movilFreeSales: any[]
  movilFreeProducts: any[]
  /** Filas de TiendaComercialHour del mes (plantilla de comerciales). */
  tiendaHours: any[]
  territorialTiendasRules: any[]
  territorialO2Rules: any[]
  catalogs: Record<string, any[]>
  objetivos: any
  objGrupos: any
  importesPyme: any[]
  importesPlus: any[]
  /** ExtraAssignments YA filtrados (status !== 'CANCELLED'), como hacía la pantalla. */
  activeExtras: any[]
  periodData: any
  year: number
  month: number
  /** «Hoy» para los días laborables. Omitido = new Date() (comportamiento original del navegador). */
  hoy?: Date
}

export interface ModResumenResult {
  rows: { name: string; real: number; projection: number; isSubtotal?: boolean }[]
  totalReal: number
  totalProjection: number
  workingDaysElapsed: number
  totalWorkingDays: number
}

export function computeModResumen(input: ModResumenInput): ModResumenResult {
  const {
    sales, movilFreeSales, movilFreeProducts, tiendaHours,
    territorialTiendasRules, territorialO2Rules, catalogs,
    objetivos, objGrupos, importesPyme, importesPlus, activeExtras,
    periodData, year, month, hoy,
  } = input

  const saleMonth = `${year}${month.toString().padStart(2, '0')}`;
  const salesList = sales.map(sanitizeSale);

  // --- 1. O2 IMPORTES REALES ---
  const o2Sales = salesList.filter(s => {
    if (s.anulado === 'Si' || s.anulado === 'Sí' || s.pendiente === 'Anulado') return false;
    return String(s.detalle || '').toLowerCase() === 'o2';
  });
  const o2Real = o2Sales.reduce((acc, s) => acc + parseSafeFloat(s.importe || s.cuota || 0), 0);

  // --- 2. BONOS O2 ---
  const getSalesDataForStoreAndType = (storeName: string, tipoVenta: string) => {
    if (!tipoVenta) return { value: 0 };

    let filtered: any[];

    if (storeName === 'O2') {
      // La lista «Tipo de Venta» de la regla MANDA — la que el dueño teclea en
      // Entrada de Datos → PRV Territorial Movistar y O2 → TERRITORIAL O2 MOVILFREE.
      //
      // AQUÍ ESTABA EL DESCUADRE DE 1.100 € DE JULIO 2026: esta pantalla tenía su
      // propio filtro por prefijo («fibra*» o «interna*») que se saltaba esa lista y
      // arrastraba las «Fibra Adicional …» y las «Interna Linea Movil …», que O2
      // comunicó en julio que NO cuentan para los bonos. Contaba 44 altas donde la
      // Entrada de Datos, la Hoja de Cobro y el feed del ERP contaban 20, y de ahí
      // salían 3.255 € frente a 2.155 €. Ahora usa el MISMO criterio que todos:
      // matchTipoVenta (el token «O2» de la lista = comodín SOLO fibras).
      // IMPORTANTE: usar 'sales' raw (sin sanitizeSale) para respetar el 'detalle' original
      filtered = sales.filter(s => {
        if (s.anulado === 'Si' || s.anulado === 'Sí' || s.pendiente === 'Anulado') return false;
        const det = String(s.detalle || s.categoria || '').toLowerCase().trim();
        if (det !== 'o2') return false;
        return matchTipoVenta(s, tipoVenta);
      });
    } else {
      const isProductMatch = (sale: any) => matchTipoVenta(sale, tipoVenta);
      const storeSellers: string[] = getSellersForStore(storeName, tiendaHours);

      filtered = sales.filter(s => {
        if (s.anulado === 'Si' || s.anulado === 'Sí' || s.pendiente === 'Anulado') return false;
        // Correccion de los Repos: la madre y sus dos hijas llevan las tres la
        // palabra «Futbol» en el producto y se contaban como tres altas.
        if (esCorreccionRepos(s) || esVentaSustituida(s)) return false;
        if (!storeSellers.some(seller => (s.vendedor || '').toLowerCase() === seller.toLowerCase())) return false;
        return isProductMatch(s);
      });
    }

    const isMoneyType = tipoVenta.toLowerCase().includes('dispositivos') || tipoVenta.toLowerCase().includes('importe');

    if (isMoneyType) {
      return { value: filtered.reduce((acc, s) => acc + parseSafeFloat(s.importe || s.cuota || 0), 0) };
    }

    return { value: filtered.length };
  };


  const calculateO2Importe = (rule: any, totalSales: number) => {
    const TRAMOS_MES = [
      { key: '4_10', min: 4, max: 10 },
      { key: '11_14', min: 11, max: 14 },
      { key: '15_20', min: 15, max: 20 },
      { key: '21_30', min: 21, max: 30 },
      { key: '31_40', min: 31, max: 40 },
      { key: '41_plus', min: 41, max: 99999 }
    ];

    const TRAMOS_TRIM = [
      { key: '5_9', min: 5, max: 9 },
      { key: '10_plus', min: 10, max: 99999 }
    ];

    let bonus = 0;
    for (const tramo of [...TRAMOS_MES].reverse()) {
      if (totalSales >= tramo.min) {
        bonus += parseSafeFloat(rule.tramosMes?.[tramo.key] || '0');
        break;
      }
    }
    for (const tramo of [...TRAMOS_TRIM].reverse()) {
      if (totalSales >= tramo.min) {
        bonus += parseSafeFloat(rule.tramosTrim?.[tramo.key] || '0');
        break;
      }
    }
    if (totalSales > 0) {
      bonus += parseSafeFloat(rule.conectividad || '0');
    }
    return bonus;
  };

  // bonosO2Real: idéntico al "TOTAL O2" de la pantalla Territorial (Entrada de Datos)
  const bonosO2Real = territorialO2Rules.reduce((acc, rule) => {
    const dataO2 = getSalesDataForStoreAndType('O2', rule.tipoVenta);
    return acc + calculateO2Importe(rule, dataO2.value);
  }, 0);

  // --- 3. MOVILFREE GANANCIAS ---
  const mfSales = movilFreeSales.filter(s => {
    const d = new Date(s.fechaVenta);
    return s.estado === 'COMPLETADA' && d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  const movilFreeReal = mfSales.reduce((acc, s) => {
    try {
      const list = JSON.parse(s.listaProductos);
      const cost = list.reduce((cAcc: number, item: any) => {
        const prodCost = item.coste !== undefined ? item.coste : (movilFreeProducts.find((p: any) => p.id === item.id)?.coste || 0);
        return cAcc + (prodCost * item.cantidad);
      }, 0);
      return acc + ((s.importeTotal / 1.21) - cost);
    } catch (e) {
      return acc;
    }
  }, 0);

  // --- 4. TIENDAS MOVISTAR ---
  const getCommissionBase = (sale: any) => {
    // Delegado en la fuente unica lib/saleCommission. Los dashboards del mes
    // se calculan aqui (igual que antes) para pasarselos a la funcion comun.
    const pymeMonthObj = objetivos.Pyme?.[saleMonth] || {};
    const captadorMonthObj = objetivos.Captador?.[saleMonth] || {};
    const pymeData = renderDashboardData('Pyme', importesPyme, pymeMonthObj, salesList, objGrupos, periodData);
    const captadorData = renderDashboardData('Captador', importesPlus, captadorMonthObj, salesList, objGrupos, periodData);
    return getSaleCommissionBase(sale, {
      catalogs,
      dashRowsPlus: pymeData.rows,
      dashRowsBasico: captadorData.rows,
      viewingPeriod: saleMonth,
    });
  };

  // La empresa cobra 15€ extra por cada Swap (venta con ¿Swap? marcado)
  const getCommission = (sale: any) => getCommissionBase(sale) + getSwapBonus(sale);

  // Filter non-O2 sales
  const nonO2Sales = salesList.filter(s => {
    if (s.anulado === 'Si' || s.anulado === 'Sí' || s.pendiente === 'Anulado') return false;
    return String(s.detalle || '').toLowerCase() !== 'o2';
  });

  const salesForTable = nonO2Sales.filter((s: any) => {
    const p = String(s.producto || '').toLowerCase()
    const c = String(s.categoria || '').toLowerCase()
    const d = String(s.detalle || '').toLowerCase()
    return !p.includes('solar360') && !p.includes('solar 360') &&
           !c.includes('solar360') && !c.includes('solar 360') &&
           !d.includes('solar360') && !d.includes('solar 360')
  });

  const salesCommissions = salesForTable.reduce((acc: number, s: any) => acc + getCommission(s), 0);
  // Excluir extras TERRITORIAL (Bonos O2): ya se calculan en tiempo real en bonosO2Real
  const nonTerritorialExtras = activeExtras.filter((ex: any) =>
    String(ex.customerNif || '').toUpperCase() !== 'TERRITORIAL' &&
    !String(ex.rule?.name || '').toUpperCase().includes('TERRITORIAL O2')
  );
  const telecomExtras = nonTerritorialExtras.reduce((acc: number, ex: any) => acc + Number(ex.telecomRewardAmount || 0), 0);
  const tiendasMovistarReal = salesCommissions + telecomExtras;

  // --- 5. PRV TERRITORIAL TIENDAS (motor único, idéntico a la Entrada de Datos) ---
  // Antes había una réplica local que quedó desfasada (no aplicaba el condicionante
  // "% sobre comisiones" ni excluía O2). Ahora delega en computeTerritorialTotal.
  // OJO: 'sales' RAW (sin sanitizeSale). sanitizeSale altera 'detalle' y rompe
  // matchTipoVenta/comisionBase -> dejaba solo el Fútbol (2.000) en vez de los ~9.053.
  const prvTerritorialTiendasReal = computeTerritorialTotal({
    sales,
    territorialRules: territorialTiendasRules,
    catalogs,
    viewingPeriod: saleMonth
  } as any);

  // --- 6. VARIOS ---
  const variosReal = 0;

  // Working days calculations
  const elapsed = calcularDiasLaborablesHastaHoy(year, month, hoy) || 1;
  const totalWorking = getWorkingDaysInMonth(year, month);

  const getProjection = (real: number) => {
    return (real / elapsed) * totalWorking;
  };

  // MovilFree (margen de la tienda MovilFree) y O2 (comisión O2 directa) en filas separadas.
  // Los 4 grupos operativos (= Importe Mensual de la MOD); el PRV Territorial Tiendas va aparte.
  const operationalRows = [
    { name: 'Tiendas Movistar', real: tiendasMovistarReal, projection: getProjection(tiendasMovistarReal) },
    { name: 'MovilFree', real: movilFreeReal, projection: getProjection(movilFreeReal) },
    { name: 'O2', real: o2Real, projection: getProjection(o2Real) },
    { name: 'PRV Territorial O2', real: bonosO2Real, projection: getProjection(bonosO2Real) },
  ];
  const subtotalReal = operationalRows.reduce((acc, r) => acc + r.real, 0);
  const subtotalProjection = operationalRows.reduce((acc, r) => acc + r.projection, 0);

  const rows = [
    ...operationalRows,
    { name: 'Subtotal Operativo', real: subtotalReal, projection: subtotalProjection, isSubtotal: true },
    { name: 'PRV Territorial Tiendas', real: prvTerritorialTiendasReal, projection: getProjection(prvTerritorialTiendasReal) },
    { name: 'Varios', real: variosReal, projection: getProjection(variosReal) }
  ];

  // El TOTAL excluye la fila de subtotal para no duplicar.
  const totalReal = rows.filter(r => !(r as any).isSubtotal).reduce((acc, r) => acc + r.real, 0);
  const totalProjection = rows.filter(r => !(r as any).isSubtotal).reduce((acc, r) => acc + r.projection, 0);

  return {
    rows,
    totalReal,
    totalProjection,
    workingDaysElapsed: elapsed,
    totalWorkingDays: totalWorking
  };
}
