'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'
import { PeriodSelector } from '@/components/PeriodSelector'
import { ArrowLeft, BarChart2 } from 'lucide-react'
import { matchTipoVenta, matchesRule, getValueForRule } from '@/hooks/useComisionesData'
import { renderDashboardData, calculateDynamicCommission, sanitizeSale, normalizeString, isVentaWithinDates } from '@/lib/salesUtils'
import { TIENDAS_COMERCIALES } from '@/lib/constants'

// Definición estática de las 6 palancas para el tramo territorial de tiendas
const STATIC_PALANCAS = [
  {
    key: 'altas_baf',
    matches: ['Alta BAF Total', 'Altas BAF', 'baf total']
  },
  {
    key: 'altas_baf_conv',
    matches: ['Alta BAF Convergente', 'Altas BAF Movistar Convergente', 'baf convergente']
  },
  {
    key: 'baf_conv_ms_disp',
    matches: ['BAF Convergente MS / Dispositivos', 'baf convergente ms / dispositivos']
  },
  {
    key: 'fibra_fttr',
    matches: ['FTTR', 'Fibra FTTR por Tienda', 'fttr por tienda']
  },
  {
    key: 'rent_disp_seguros',
    matches: ['Dispositivos + Seguros', 'Rent/Dispositivos + Seguros', 'Dispositivos + Seguro']
  },
  {
    key: 'altas_futbol_tv',
    matches: ['Repo Fútbol', 'Altas Fútbol/ Desarrollo TV por Tienda', 'Repo Futbol', 'futbol por tienda']
  }
];

export default function ModResumenPage() {
  const router = useRouter()
  const { authorized } = useGuard('MODULE_JEFE_TIENDAS')
  const { activePeriodKey } = usePeriod()

  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<any[]>([])
  const [movilFreeSales, setMovilFreeSales] = useState<any[]>([])
  const [movilFreeProducts, setMovilFreeProducts] = useState<any[]>([])
  const [tiendaRules, setTiendaRules] = useState<any[]>([])
  const [territorialTiendasRules, setTerritorialTiendasRules] = useState<any[]>([])
  const [territorialO2Rules, setTerritorialO2Rules] = useState<any[]>([])
  const [catalogs, setCatalogs] = useState<Record<string, any[]>>({})
  const [objetivos, setObjetivos] = useState<any>(null)
  const [objGrupos, setObjGrupos] = useState<any>(null)
  const [importesPyme, setImportesPyme] = useState<any[]>([])
  const [importesPlus, setImportesPlus] = useState<any[]>([])
  const [activeExtras, setActiveExtras] = useState<any[]>([])
  const [periodData, setPeriodData] = useState<any>(null)

  // Nombres de los meses en español
  const monthNames = useMemo(() => [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ], []);

  const [year, month] = useMemo(() => {
    if (!activePeriodKey) return [2026, 6];
    const [yStr, mStr] = activePeriodKey.split('_');
    return [parseInt(yStr, 10), parseInt(mStr, 10)];
  }, [activePeriodKey]);

  const monthName = monthNames[month - 1];

  useEffect(() => {
    if (!activePeriodKey) return;
    setLoading(true);

    const fetchConfigs = (periodKey: string) => {
      return Promise.all([
        fetch(`/api/objetivos?periodKey=${periodKey}&strictPeriod=1`).then(r => r.json()).catch(() => ({ success: true, objetivos: { Pyme: {}, Captador: {} } })),
        fetch(`/api/importes-pyme?periodKey=${periodKey}&strictPeriod=1`).then(r => r.json()).catch(() => ({})),
        fetch(`/api/importes-plus?periodKey=${periodKey}&strictPeriod=1`).then(r => r.json()).catch(() => ({})),
        fetch(`/api/extras/assignments?periodKey=${periodKey}`).then(r => r.json()).catch(() => ({}))
      ]);
    };

    Promise.all([
      fetch(`/api/sales?periodKey=${activePeriodKey}&dashboard=true`).then(r => r.json()).catch(() => ({ logs: [] })),
      fetch(`/api/territorial?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({ success: true, tiendas: [], o2: [] })),
      fetch('/api/catalogs').then(r => r.json()).catch(() => ({ success: true, catalogs: {} })),
      fetchConfigs(activePeriodKey),
      fetch(`/api/period`).then(r => r.json()).catch(() => ({ periods: [] })),
      fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({ success: true, rules: [] })),
      fetch(`/api/movilfree/sales`).then(r => r.json()).catch(() => []),
      fetch(`/api/movilfree/products`).then(r => r.json()).catch(() => [])
    ])
    .then(([salesRes, territorialRes, catalogsRes, configsRes, periodsRes, tiendasRes, mfSalesRes, mfProductsRes]) => {
      setSales(salesRes.logs || []);
      setTerritorialTiendasRules(territorialRes.tiendas || []);
      setTerritorialO2Rules(territorialRes.o2 || []);
      setCatalogs(catalogsRes.catalogs || {});
      setTiendaRules(tiendasRes.rules || []);
      setMovilFreeSales(mfSalesRes || []);
      setMovilFreeProducts(mfProductsRes || []);

      const [objData, pymeData, plusData, extrasData] = configsRes;
      setObjetivos(objData.objetivos || { Pyme: {}, Captador: {} });
      setObjGrupos(objData.grupos || { Pyme: {}, Captador: {} });
      setImportesPyme(pymeData.importes || pymeData.data || []);
      setImportesPlus(plusData.importes || plusData.data || []);
      setActiveExtras((extrasData.assignments || []).filter((ea: any) => ea.status !== 'CANCELLED'));

      let pData = (periodsRes.periods || []).find((p: any) => p.period_key === activePeriodKey);
      if (!pData) {
        pData = (periodsRes.periods || []).find((p: any) => p.status === 'ACTIVE') || periodsRes.periods?.[0];
      }
      setPeriodData(pData);

      setLoading(false);
    })
    .catch(err => {
      console.error('Error loading data for resumen MOD:', err);
      setLoading(false);
    });
  }, [activePeriodKey]);

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

  const calcularDiasLaborablesHastaHoy = (y: number, m: number) => {
    const today = new Date();
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

  const parseNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).replace(/[^0-9.,\-]/g, '').trim();
    s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  };

  const findRuleInList = (palancaMatches: string[], rules: any[]) => {
    const clean = (str: string) => String(str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
    const cleanMatches = palancaMatches.map(m => clean(m));

    return rules.find(r => {
      const rName = clean(r.nombre);
      return cleanMatches.some(m => rName === m || rName.includes(m) || m.includes(rName));
    });
  };

  const getSalesCountForRule = (ruleName: string, ruleProductosCuentan: string, salesList: any[]) => {
    let completed = 0;
    const isPercentage = String(ruleName).toLowerCase().includes('dispositivos') || String(ruleName).toLowerCase().includes('seguro');

    salesList.forEach(s => {
      if (String(s.vendedor || '').toLowerCase().includes('marta')) return;
      if (s.anulado === 'Si' || s.anulado === 'Sí' || s.pendiente === 'Anulado') return;

      if (matchesRule(s, ruleName, ruleProductosCuentan)) {
        const val = isPercentage ? getValueForRule(s, ruleName, catalogs) : 1;
        completed += val;
      }

      if (s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet || '').toLowerCase() !== 'seguro') {
        const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
        if (matchesRule(virtualSeguro, ruleName, ruleProductosCuentan)) {
          const val = isPercentage ? getValueForRule(virtualSeguro, ruleName, catalogs) : 1;
          completed += val;
        }
      }
    });

    return completed;
  };

  const tableData = useMemo<{
    rows: { name: string; real: number; projection: number; }[];
    totalReal: number;
    totalProjection: number;
    workingDaysElapsed: number;
    totalWorkingDays: number;
  }>(() => {
    if (loading) {
      return {
        rows: [],
        totalReal: 0,
        totalProjection: 0,
        workingDaysElapsed: 0,
        totalWorkingDays: 0
      };
    }

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
      const isProductMatch = (sale: any) => matchTipoVenta(sale, tipoVenta);

      let storeSellers: string[] = [];
      if (storeName === 'O2') {
        storeSellers = TIENDAS_COMERCIALES['O2'] || ['Marta'];
      } else {
        const key = Object.keys(TIENDAS_COMERCIALES).find(k => k.toLowerCase().replace('é','e') === storeName.toLowerCase().replace('é','e'));
        if (key) storeSellers = TIENDAS_COMERCIALES[key];
      }

      const filtered = salesList.filter(s => {
        if (s.anulado === 'Si' || s.anulado === 'Sí' || s.pendiente === 'Anulado') return false;
        if (!storeSellers.some(seller => (s.vendedor || '').toLowerCase() === seller.toLowerCase())) return false;
        return isProductMatch(s);
      });

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
          const prodCost = item.coste !== undefined ? item.coste : (movilFreeProducts.find(p => p.id === item.id)?.coste || 0);
          return cAcc + (prodCost * item.cantidad);
        }, 0);
        return acc + ((s.importeTotal / 1.21) - cost);
      } catch (e) {
        return acc;
      }
    }, 0);

    // --- 4. TIENDAS MOVISTAR ---
    const getCommission = (sale: any) => {
      if (sale.anulado === 'Si' || sale.anulado === 'Sí' || sale.pendiente === 'Anulado') return 0;

      let sMonth = ''
      if (sale.fecha) {
        const parts = sale.fecha.split('/')
        if (parts.length === 3) sMonth = `${parts[2]}${parts[1]}`
        else if (sale.fecha.includes('-')) {
          const p = sale.fecha.split('-')
          if (p.length >= 2) sMonth = `${p[0]}${p[1]}`
        }
      }

      const getFallbackValue = () => {
        let val = sale.importe || sale.cuota || 0;
        const det = (sale.detalle || '').toLowerCase();
        if (!val && (det === 'ti' || det === 'tma' || det === 'rent' || det === 'micro')) {
          let catalogKey = '';
          if (det === 'ti') catalogKey = 'Ti';
          if (det === 'tma' || det === 'rent') catalogKey = 'Rent';
          if (det === 'micro') catalogKey = 'Micro';

          const list = catalogs[catalogKey] || [];
          const found = list.find((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
          if (found) {
            val = parseSafeFloat(found.anual);
          }
        }
        return parseSafeFloat(val);
      }

      if (!sMonth) return getFallbackValue();
      if (sMonth !== saleMonth) return getFallbackValue();

      const det = (sale.detalle || '').toLowerCase();
      const isTV = det === 'suscripciones tv' || det === 'suscripcion tv';

      if (det === 'o2' || det === 'seguro' || det === 'mimovistar' || det === 'repos' || det === 'varios' || isTV || det === 'prepago' || det === 'resto baf' || det === 'traslado mimovistar') {
        if (det === 'seguro') {
          const list = catalogs['Seguro'] || [];
          const found = list.find((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
          if (found && found.comision) {
            return parseSafeFloat(found.comision);
          }
        }
        return parseSafeFloat(sale.importe || sale.cuota || 0);
      }

      let overrideBaseValue: number | undefined = undefined;
      if (det === 'ti' || det === 'tma' || det === 'rent' || det === 'micro') {
        let catalogKey = '';
        if (det === 'ti') catalogKey = 'Ti';
        if (det === 'tma' || det === 'rent') catalogKey = 'Rent';
        if (det === 'micro') catalogKey = 'Micro';

        const list = catalogs[catalogKey] || [];
        const matchingProducts = list.filter((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));

        let found = matchingProducts[0];
        if (matchingProducts.length > 1) {
          const correctlyDated = matchingProducts.find((c: any) => isVentaWithinDates(sale.fecha, c.validFrom, c.validTo));
          if (correctlyDated) found = correctlyDated;
        }

        if (found) {
          overrideBaseValue = Number(String(found.anual || 0).replace(',','.'));

          if (det === 'ti') {
            return overrideBaseValue;
          }

          if (det === 'tma' || det === 'rent') {
            const isConCoste = sale.rentConCoste && (sale.rentConCoste.toLowerCase() === 'sí' || sale.rentConCoste.toLowerCase() === 'si');
            if (isConCoste) {
              return Number(String(found.comisionConCoste || 0).replace(',','.'));
            } else {
              return Number(String(found.comision || 0).replace(',','.'));
            }
          }
        }
      }

      const pymeMonthObj = objetivos.Pyme?.[saleMonth] || {};
      const captadorMonthObj = objetivos.Captador?.[saleMonth] || {};
      const pymeData = renderDashboardData('Pyme', importesPyme, pymeMonthObj, salesList, objGrupos, periodData);
      const captadorData = renderDashboardData('Captador', importesPlus, captadorMonthObj, salesList, objGrupos, periodData);

      const plusCodesExact = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7'];
      const isPlus = plusCodesExact.some(c => String(sale.codigo || '').toLowerCase().includes(c));
      const dashboardRows = isPlus ? pymeData.rows : captadorData.rows;
      return calculateDynamicCommission(sale, dashboardRows, overrideBaseValue);
    };

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
    const telecomExtras = activeExtras.reduce((acc: number, ex: any) => acc + Number(ex.telecomRewardAmount || 0), 0);
    const tiendasMovistarReal = salesCommissions + telecomExtras;

    // --- 5. PRV TERRITORIAL TIENDAS ---
    const calculateTiendaImporte = (rule: any, storeName: string, salesCount: number, salesTot: number) => {
      let earned = 0;
      let target1 = 0;
      let isReached1 = false;
      if (rule.obj1Type === 'per_store') {
        target1 = parseNumber(rule.obj1Stores?.[storeName] || '0');
        isReached1 = target1 > 0 && salesCount >= target1;
      } else {
        target1 = parseNumber(rule.obj1Global);
        isReached1 = target1 > 0 && salesTot >= target1;
      }

      let target2 = 0;
      let isReached2 = false;
      if (rule.obj2Type === 'per_store') {
        target2 = parseNumber(rule.obj2Stores?.[storeName] || '0');
        isReached2 = target2 > 0 && salesCount >= target2;
      } else {
        target2 = parseNumber(rule.obj2Global);
        isReached2 = target2 > 0 && salesTot >= target2;
      }

      const import1Num = parseNumber(rule.importe1);
      const import2Num = parseNumber(rule.importe2);

      const isPct1 = String(rule.importe1).includes('%');
      const isPct2 = String(rule.importe2).includes('%');

      if (isReached2) {
        if (isPct2) earned = salesCount * (import2Num / 100);
        else earned = import2Num;
      } else if (isReached1) {
        if (isPct1) earned = salesCount * (import1Num / 100);
        else earned = import1Num;
      }

      return earned;
    };

    const prvTerritorialTiendasReal = territorialTiendasRules.reduce((acc, rule) => {
      const dataAux = getSalesDataForStoreAndType('Auxiliadora 45', rule.tipoVenta);
      const dataCor = getSalesDataForStoreAndType('Correhuela', rule.tipoVenta);
      const dataVil = getSalesDataForStoreAndType('Villamayor', rule.tipoVenta);
      const dataBej = getSalesDataForStoreAndType('Béjar', rule.tipoVenta);
      const salesTot = dataAux.value + dataCor.value + dataVil.value + dataBej.value;

      const impAux = calculateTiendaImporte(rule, 'Auxiliadora 45', dataAux.value, salesTot);
      const impCor = calculateTiendaImporte(rule, 'Correhuela', dataCor.value, salesTot);
      const impVil = calculateTiendaImporte(rule, 'Villamayor', dataVil.value, salesTot);
      const impBej = calculateTiendaImporte(rule, 'Béjar', dataBej.value, salesTot);

      return acc + impAux + impCor + impVil + impBej;
    }, 0);

    // --- 6. VARIOS ---
    const variosReal = 0;

    // Working days calculations
    const elapsed = calcularDiasLaborablesHastaHoy(year, month) || 1;
    const totalWorking = getWorkingDaysInMonth(year, month);

    const getProjection = (real: number) => {
      return (real / elapsed) * totalWorking;
    };

    const rows = [
      { name: 'O2', real: o2Real, projection: getProjection(o2Real) },
      { name: 'Bonos O2', real: bonosO2Real, projection: getProjection(bonosO2Real) },
      { name: 'MovilFree', real: movilFreeReal, projection: getProjection(movilFreeReal) },
      { name: 'Tiendas Movistar', real: tiendasMovistarReal, projection: getProjection(tiendasMovistarReal) },
      { name: 'PRV Territorial Tiendas', real: prvTerritorialTiendasReal, projection: getProjection(prvTerritorialTiendasReal) },
      { name: 'Varios', real: variosReal, projection: getProjection(variosReal) }
    ];

    const totalReal = rows.reduce((acc, r) => acc + r.real, 0);
    const totalProjection = rows.reduce((acc, r) => acc + r.projection, 0);

    return {
      rows,
      totalReal,
      totalProjection,
      workingDaysElapsed: elapsed,
      totalWorkingDays: totalWorking
    };
  }, [loading, sales, movilFreeSales, movilFreeProducts, tiendaRules, territorialTiendasRules, territorialO2Rules, catalogs, objetivos, objGrupos, importesPyme, importesPlus, activeExtras, periodData, year, month]);

  if (authorized === null) {
    return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>;
  }

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-main)', fontWeight: 600 }}>Calculando resumen MOD...</div>;
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  };

  return (
    <div style={{ padding: '24px 32px', backgroundColor: 'var(--bg-app)', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: 'var(--text-main)' }}>
      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => router.push('/seguimiento-ventas/mod')} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: 40, 
              height: 40, 
              borderRadius: '50%', 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-strong)', 
              color: 'var(--text-muted)', 
              cursor: 'pointer', 
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)', 
              transition: 'all 0.2s' 
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={24} color="var(--mercedes-cyan)" /> Resumen de Métricas MOD
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Visualización mensual consolidada de importes reales y proyecciones ({monthName} {year}).
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', background: 'var(--bg-card)', padding: '6px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '11px', fontWeight: 'bold' }}>
            <div>Días Laborables: <span style={{ color: 'var(--mercedes-cyan)' }}>{tableData.workingDaysElapsed} / {tableData.totalWorkingDays}</span></div>
          </div>
          <PeriodSelector />
        </div>
      </div>

      {/* TABLA PRINCIPAL DE RESUMEN */}
      <div style={{ 
        backgroundColor: 'var(--bg-card)', 
        borderRadius: '12px', 
        border: '1px solid var(--border-light)', 
        overflow: 'hidden', 
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)', 
        backdropFilter: 'blur(10px)' 
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ 
              background: 'linear-gradient(90deg, #0ea5e9, #0284c7)', 
              color: 'white',
              borderBottom: '1px solid var(--border-strong)'
            }}>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Grupo</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Importe Real</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Importe Proyección</th>
            </tr>
          </thead>
          <tbody>
            <style dangerouslySetInnerHTML={{
              __html: `
                .row-hover {
                  transition: background-color 0.15s ease;
                }
                .row-hover:hover {
                  background-color: rgba(255,255,255,0.02) !important;
                }
              `
            }} />
            {tableData.rows.map((row) => (
              <tr 
                key={row.name} 
                className="row-hover"
                style={{ 
                  borderBottom: '1px solid var(--border-light)', 
                  backgroundColor: 'transparent'
                }}
              >
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-main)' }}>{row.name}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                  {formatCurrency(row.real)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--mercedes-cyan)' }}>
                  {formatCurrency(row.projection)}
                </td>
              </tr>
            ))}

            {/* FILA DE TOTALES */}
            <tr style={{ 
              backgroundColor: 'rgba(14, 165, 233, 0.1)',
              borderTop: '2px solid var(--border-strong)',
              fontWeight: 800
            }}>
              <td style={{ padding: '16px 16px', fontSize: '14px', color: 'var(--text-main)' }}>TOTAL</td>
              <td style={{ padding: '16px 16px', textAlign: 'right', fontSize: '14px', color: '#34c759', fontWeight: 900 }}>
                {formatCurrency(tableData.totalReal)}
              </td>
              <td style={{ padding: '16px 16px', textAlign: 'right', fontSize: '14px', color: 'var(--mercedes-cyan)', fontWeight: 900 }}>
                {formatCurrency(tableData.totalProjection)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
