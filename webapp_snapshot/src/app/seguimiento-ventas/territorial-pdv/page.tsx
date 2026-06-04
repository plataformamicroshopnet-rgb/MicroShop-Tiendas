'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'
import { PageHeader } from '@/components/PageHeader'
import { PeriodSelector } from '@/components/PeriodSelector'
import { Globe, ArrowLeft, Info, Percent, AlertCircle } from 'lucide-react'
import { matchesRule, getValueForRule, matchTipoVenta } from '@/hooks/useComisionesData'
import { renderDashboardData, calculateDynamicCommission, sanitizeSale, normalizeString, isVentaWithinDates } from '@/lib/salesUtils'

// Definición estática de las 6 palancas solicitadas y sus tramos según el mockup
const STATIC_PALANCAS = [
  {
    key: 'altas_baf',
    negocio: 'Fijo',
    palanca: 'Altas BAF',
    tramos: { tramo1: '20%', tramo2: '30%', tramo3: '-', bonif: '-' },
    matches: ['Alta BAF Total', 'Altas BAF', 'baf total']
  },
  {
    key: 'altas_baf_conv',
    negocio: 'Fijo',
    palanca: 'Altas BAF Movistar Convergente',
    tramos: { tramo1: '40%', tramo2: '50%', tramo3: '-', bonif: '-' },
    matches: ['Alta BAF Convergente', 'Altas BAF Movistar Convergente', 'baf convergente']
  },
  {
    key: 'baf_conv_ms_disp',
    negocio: 'Fijo',
    palanca: 'BAF Convergente MS / Dispositivos',
    tramos: { tramo1: '-', tramo2: '-', tramo3: '-', bonif: '20%' },
    matches: ['BAF Convergente MS / Dispositivos', 'baf convergente ms / dispositivos']
  },
  {
    key: 'fibra_fttr',
    negocio: 'Fijo',
    palanca: 'Fibra FTTR por Tienda',
    tramos: { tramo1: '200 €', tramo2: '-', tramo3: '-', bonif: '-' },
    matches: ['FTTR', 'Fibra FTTR por Tienda', 'fttr por tienda']
  },
  {
    key: 'rent_disp_seguros',
    negocio: 'Móvil',
    palanca: 'Rent/Dispositivos + Seguros',
    tramos: { tramo1: '3,5%', tramo2: '4,5%', tramo3: '6,0%', bonif: '-' },
    matches: ['Dispositivos + Seguros', 'Rent/Dispositivos + Seguros', 'Dispositivos + Seguro']
  },
  {
    key: 'altas_futbol_tv',
    negocio: 'Fijo',
    palanca: 'Altas Fútbol/ Desarrollo TV por Tienda',
    tramos: { tramo1: '300 €', tramo2: '500 €', tramo3: '-', bonif: '-' },
    matches: ['Repo Fútbol', 'Altas Fútbol/ Desarrollo TV por Tienda', 'Repo Futbol', 'futbol por tienda']
  }
];

export default function TerritorialPdvPage() {
  const router = useRouter()
  const { authorized } = useGuard('MODULE_JEFE_TIENDAS')
  const { activePeriodKey } = usePeriod()

  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<any[]>([])
  const [tiendaRules, setTiendaRules] = useState<any[]>([])
  const [territorialRules, setTerritorialRules] = useState<any[]>([])
  const [catalogs, setCatalogs] = useState<Record<string, any[]>>({})
  const [modImporte, setModImporte] = useState<number>(0)
  const [manualImportePrevYear, setManualImportePrevYear] = useState<string>('')

  // Nombres de los meses en español para las etiquetas de año anterior y mes actual
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
  const prevYearLabel = `${monthName} ${year - 1}`;
  const currYearLabel = `${monthName} ${year}`;

  useEffect(() => {
    if (!activePeriodKey) return;
    const saved = localStorage.getItem(`territorial_pdv_manual_prev_year_importe_${activePeriodKey}`);
    setManualImportePrevYear(saved || '');
  }, [activePeriodKey]);

  const handleManualImportePrevYearChange = (val: string) => {
    setManualImportePrevYear(val);
    if (val.trim() === '') {
      localStorage.removeItem(`territorial_pdv_manual_prev_year_importe_${activePeriodKey}`);
    } else {
      localStorage.setItem(`territorial_pdv_manual_prev_year_importe_${activePeriodKey}`, val);
    }
  };

  useEffect(() => {
    if (!activePeriodKey) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/sales?periodKey=${activePeriodKey}&dashboard=true`).then(r => r.json()).catch(() => ({ success: true, logs: [] })),
      fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({ success: true, rules: [] })),
      fetch(`/api/territorial?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({ success: true, tiendas: [] })),
      fetch('/api/catalogs').then(r => r.json()).catch(() => ({ success: true, catalogs: {} })),
      // Fetches adicionales para el cálculo exacto del MOD
      fetch(`/api/objetivos?periodKey=${activePeriodKey}&strictPeriod=1`).then(r => r.json()).catch(() => ({ success: true, objetivos: { Pyme: {}, Captador: {} } })),
      fetch(`/api/importes-pyme?periodKey=${activePeriodKey}&strictPeriod=1`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/importes-plus?periodKey=${activePeriodKey}&strictPeriod=1`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/extras/assignments?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/period`).then(r => r.json()).catch(() => ({ periods: [] }))
    ])
    .then(([salesRes, tiendasRes, territorialRes, catalogsRes, objetivosRes, pymeRes, plusRes, extrasRes, periodsRes]) => {
      setSales(salesRes.logs || []);
      setTiendaRules(tiendasRes.rules || []);
      setTerritorialRules(territorialRes.tiendas || []);
      setCatalogs(catalogsRes.catalogs || {});

      // Calcular el importe del MOD de la misma forma que en mod/page.tsx
      const rawSales = salesRes.logs || [];
      const catalogs = catalogsRes.catalogs || {};
      const objetivos = objetivosRes.objetivos || { Pyme: {}, Captador: {} };
      const objGrupos = objetivosRes.grupos || { Pyme: {}, Captador: {} };
      const importesPyme = pymeRes.importes || pymeRes.data || [];
      const importesPlus = plusRes.importes || plusRes.data || [];
      const activeExtras = (extrasRes.assignments || []).filter((ea: any) => ea.status !== 'CANCELLED');

      const salesList = rawSales.map(sanitizeSale);
      let periodData = (periodsRes.periods || []).find((p: any) => p.period_key === activePeriodKey);
      if (!periodData) {
        periodData = (periodsRes.periods || []).find((p: any) => p.status === 'ACTIVE') || periodsRes.periods?.[0];
      }

      let globalImporte = 0;
      const [yearStr, monthStr] = activePeriodKey.split('_');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const saleMonth = `${y}${m.toString().padStart(2, '0')}`;

      if (y === 2026 && m === 6) {
        // --- TUBERÍA DE COMISIONES REALES PARA JUNIO 2026 ---
        const parseSafeFloat = (val: any): number => {
          if (val === null || val === undefined) return 0;
          if (typeof val === 'number') return isNaN(val) ? 0 : val;
          const clean = String(val).replace('€', '').replace(/\s/g, '').replace(',', '.').trim();
          const num = parseFloat(clean);
          return isNaN(num) ? 0 : num;
        };

        const pymeMonthObj = objetivos.Pyme?.[saleMonth] || {};
        const captadorMonthObj = objetivos.Captador?.[saleMonth] || {};
        const pymeData = renderDashboardData('Pyme', importesPyme, pymeMonthObj, salesList, objGrupos, periodData);
        const captadorData = renderDashboardData('Captador', importesPlus, captadorMonthObj, salesList, objGrupos, periodData);

        const getCommission = (sale: any) => {
          if (sale.anulado === 'Si' || sale.pendiente === 'Anulado') return 0;

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

          const plusCodesExact = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7'];
          const isPlus = plusCodesExact.some(c => String(sale.codigo || '').toLowerCase().includes(c));
          const dashboardRows = isPlus ? pymeData.rows : captadorData.rows;
          return calculateDynamicCommission(sale, dashboardRows, overrideBaseValue);
        };

        const salesForTable = salesList.filter((s: any) => {
          const p = String(s.producto || '').toLowerCase()
          const c = String(s.categoria || '').toLowerCase()
          const d = String(s.detalle || '').toLowerCase()
          return !p.includes('solar360') && !p.includes('solar 360') && 
                 !c.includes('solar360') && !c.includes('solar 360') && 
                 !d.includes('solar360') && !d.includes('solar 360')
        });

        const salesCommissions = salesForTable.reduce((acc: number, s: any) => acc + getCommission(s), 0);
        const telecomExtras = activeExtras.reduce((acc: number, ex: any) => acc + Number(ex.telecomRewardAmount || 0), 0);
        globalImporte = salesCommissions + telecomExtras;
      } else {
        // --- CÁLCULO ESTÁNDAR ORIGINAL ---
        if (importesPyme.length > 0) {
          const dashPyme = renderDashboardData('Pyme', importesPyme, objetivos.Pyme?.[saleMonth] || {}, salesList, objGrupos, periodData);
          globalImporte += dashPyme.totalImporte;
        }
        if (importesPlus.length > 0) {
          const dashCaptador = renderDashboardData('Captador', importesPlus, objetivos.Captador?.[saleMonth] || {}, salesList, objGrupos, periodData);
          globalImporte += dashCaptador.totalImporte;
        }

        // Añadir extras al total global
        activeExtras.forEach((ex: any) => {
          const amount = Number(ex.amount || ex.telecomRewardAmount) || 0;
          globalImporte += amount;
        });
      }

      setModImporte(globalImporte);
      setLoading(false);
    })
    .catch(err => {
      console.error('Error fetching data for territorial pdv:', err);
      setLoading(false);
    });
  }, [activePeriodKey, monthNames]);

  // Auxiliar para parsear números con formato español
  const parseNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).replace(/[^0-9.,\-]/g, '').trim();
    s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  };

  // Buscar regla en la lista (tiendaRules o territorialRules)
  const findRuleInList = (palancaMatches: string[], rules: any[]) => {
    const clean = (str: string) => String(str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
    const cleanMatches = palancaMatches.map(m => clean(m));

    return rules.find(r => {
      const rName = clean(r.nombre);
      return cleanMatches.some(m => rName === m || rName.includes(m) || m.includes(rName));
    });
  };

  // Contar ventas reales de la tienda Salamanca (excluyendo a Marta de O2)
  const getSalesCountForRule = (ruleName: string, ruleProductosCuentan: string) => {
    let completed = 0;
    const isPercentage = String(ruleName).toLowerCase().includes('dispositivos') || String(ruleName).toLowerCase().includes('seguro');

    sales.forEach(s => {
      // Excluir a Marta (O2)
      if (String(s.vendedor || '').toLowerCase().includes('marta')) return;
      // Excluir anuladas
      if (s.anulado === 'Si' || s.anulado === 'Sí' || s.pendiente === 'Anulado') return;

      if (matchesRule(s, ruleName, ruleProductosCuentan)) {
        const val = isPercentage ? getValueForRule(s, ruleName, catalogs) : 1;
        completed += val;
      }

      // Seguro virtual
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

  // Calcular las filas con los importes territoriales
  const calculatedRows = useMemo(() => {
    if (loading) return [];

    return STATIC_PALANCAS.map(p => {
      // 1. Encontrar regla base de "Comisiones para Tiendas" para sacar el Objetivo
      const baseRule = findRuleInList(p.matches, tiendaRules);
      const objetivo = baseRule ? (baseRule.objPrimerTramo || 0) : 0;

      // 2. Encontrar regla de "Territorial" para sacar tramos e importes
      const terrRule = findRuleInList(p.matches, territorialRules);
      
      // Obtener tramos/importes de la regla territorial de la BD si existe, o usar los estáticos por defecto
      const t1Raw = terrRule ? terrRule.importe1 : p.tramos.tramo1;
      const t2Raw = terrRule ? terrRule.importe2 : p.tramos.tramo2;
      const t3Raw = p.tramos.tramo3; // Tramo 3 estático de Rent/Dispositivos + Seguros
      const bonifRaw = p.tramos.bonif; // Bonificación de BAF Conv + Disp

      // 3. Calcular las ventas totales de la tienda (Salamanca) para esta palanca
      let ventas = 0;
      if (baseRule) {
        ventas = getSalesCountForRule(baseRule.nombre, baseRule.productosCuentan);
      } else {
        // Fallbacks para ventas de palancas si no hay regla explícita configurada
        if (p.key === 'altas_baf') {
          ventas = getSalesCountForRule('Alta BAF Total', 'Alta BAF Total, Alta BAF Convergente');
        } else if (p.key === 'altas_baf_conv') {
          ventas = getSalesCountForRule('Alta BAF Convergente', 'Alta BAF Convergente');
        } else if (p.key === 'baf_conv_ms_disp') {
          // BAF Convergente MS + Dispositivos (Rent)
          ventas = sales.filter(s => {
            if (String(s.vendedor || '').toLowerCase().includes('marta')) return false;
            if (s.anulado === 'Si' || s.anulado === 'Sí' || s.pendiente === 'Anulado') return false;
            return String(s.categoria || s.detalle || s.sheet || '').toLowerCase() === 'rent';
          }).length;
        } else if (p.key === 'fibra_fttr') {
          ventas = getSalesCountForRule('FTTR', 'Solución FTTR');
        } else if (p.key === 'rent_disp_seguros') {
          ventas = getSalesCountForRule('Dispositivos + Seguros', 'Dispositivos, Seguro');
        } else if (p.key === 'altas_futbol_tv') {
          ventas = getSalesCountForRule('Repo Fútbol', 'Extra Repos up destino Fútbol');
        }
      }

      // 4. Calcular el porcentaje de cumplimiento
      // Para BAF Convergente MS / Dispositivos, no tiene objetivo directo, se asocia al cumplimiento de BAF Convergente
      let pct = 0;
      if (p.key === 'baf_conv_ms_disp') {
        const bafConvRow = findRuleInList(['Alta BAF Convergente'], tiendaRules);
        const bafConvObj = bafConvRow ? (bafConvRow.objPrimerTramo || 0) : 0;
        const bafConvSales = getSalesCountForRule('Alta BAF Convergente', 'Alta BAF Convergente');
        pct = bafConvObj > 0 ? (bafConvSales / bafConvObj) * 100 : 0;
      } else {
        pct = objetivo > 0 ? (ventas / objetivo) * 100 : 0;
      }

      // 5. Determinar tramo aplicable e importe generado
      let importe = 0;
      let tramoAplicado = '';

      const isPct = (str: string) => String(str).includes('%');
      
      if (p.key === 'baf_conv_ms_disp') {
        // Bonificación >=100%: 20%
        if (pct >= 100) {
          tramoAplicado = 'Bonif (20%)';
          importe = ventas * 0.20; // 20% de las ventas de dispositivos
        }
      } else if (p.key === 'rent_disp_seguros') {
        // Rent/Dispositivos + Seguros tiene 3 tramos
        if (pct >= 130) {
          tramoAplicado = 'Tramo 3 (6%)';
          importe = ventas * 0.06;
        } else if (pct >= 115) {
          tramoAplicado = 'Tramo 2 (4,5%)';
          importe = ventas * 0.045;
        } else if (pct >= 100) {
          tramoAplicado = 'Tramo 1 (3,5%)';
          importe = ventas * 0.035;
        }
      } else {
        // Palancas con Tramo 1 y Tramo 2 estándar
        const obj1Val = objetivo;
        // El objetivo de tramo 2 territorial es el objSegundoTramo de la regla de la tienda si existe
        const obj2Val = baseRule ? (baseRule.objSegundoTramo || 0) : 0;

        const val1 = parseNumber(t1Raw);
        const val2 = parseNumber(t2Raw);

        if (obj2Val > 0 && ventas >= obj2Val) {
          tramoAplicado = `Tramo 2 (${t2Raw})`;
          importe = isPct(t2Raw) ? (ventas * (val2 / 100)) : val2;
        } else if (obj1Val > 0 && ventas >= obj1Val) {
          tramoAplicado = `Tramo 1 (${t1Raw})`;
          importe = isPct(t1Raw) ? (ventas * (val1 / 100)) : val1;
        }
      }

      return {
        ...p,
        objetivo,
        ventas,
        pct,
        t1Raw,
        t2Raw,
        t3Raw,
        bonifRaw,
        tramoAplicado,
        importe
      };
    });
  }, [loading, sales, tiendaRules, territorialRules, catalogs]);

  // Suma total de los importes territoriales generados
  const totalImporteTerritorial = useMemo(() => {
    return calculatedRows.reduce((acc, row) => acc + row.importe, 0);
  }, [calculatedRows]);

  if (authorized === null) {
    return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>;
  }

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-main)', fontWeight: 600 }}>Calculando tabla territorial...</div>;
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  };

  const formatPercent = (val: number) => {
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val) + '%';
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
              <Globe size={24} color="var(--mercedes-cyan)" /> TERRITORIAL PDV
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Cálculo y auditoría del tramo territorial consolidado para los puntos de venta.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <PeriodSelector />
        </div>
      </div>

      {/* CONTENEDOR DE TABLA PREMIUM (GLASSMORPHISM DARK COMPRESSED) */}
      <div style={{ 
        backgroundColor: 'var(--bg-card)', 
        borderRadius: '12px', 
        border: '1px solid var(--border-light)', 
        overflow: 'hidden', 
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)', 
        backdropFilter: 'blur(10px)' 
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
          <thead>
            <tr style={{ 
              background: 'linear-gradient(90deg, #0ea5e9, #0284c7)', 
              color: 'white',
              borderBottom: '1px solid var(--border-strong)'
            }}>
              <th style={{ padding: '8px 12px', fontWeight: 700 }}>Negocio</th>
              <th style={{ padding: '8px 12px', fontWeight: 700 }}>Palanca</th>
              <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'center' }}>Objetivos</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center', fontSize: '10px', whiteSpace: 'normal', lineHeight: 1.1 }}>Tramo 1<br/>(&gt;=100% y &lt;115%)</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center', fontSize: '10px', whiteSpace: 'normal', lineHeight: 1.1 }}>Tramo 2<br/>(&gt;=115% y &lt;130%)</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center', fontSize: '10px', whiteSpace: 'normal', lineHeight: 1.1 }}>Tramo 3<br/>(&gt;=130%)</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center', fontSize: '10px', whiteSpace: 'normal', lineHeight: 1.1 }}>Bonificación<br/>(&gt;=100%)</th>
              <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'center' }}>Ventas</th>
              <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'center' }}>Porcentaje Ventas</th>
              <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right' }}>Importe</th>
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
            {calculatedRows.map((row) => {
              const isValueObjective = row.key === 'rent_disp_seguros';
              const isBafConvMsDisp = row.key === 'baf_conv_ms_disp';

              // Formateo de objetivo y ventas
              const displayObj = isBafConvMsDisp
                ? '-' 
                : (isValueObjective ? formatCurrency(row.objetivo) : row.objetivo);
              
              const displaySales = isValueObjective
                ? formatCurrency(row.ventas)
                : row.ventas;

              const displayPct = isBafConvMsDisp || row.objetivo > 0
                ? formatPercent(row.pct)
                : '-';

              const hasEarned = row.importe > 0;

              return (
                <tr 
                  key={row.key} 
                  className="row-hover"
                  style={{ 
                    borderBottom: '1px solid var(--border-light)', 
                    backgroundColor: 'transparent'
                  }}
                >
                  <td style={{ padding: '6px 12px', fontWeight: 600, color: 'var(--text-muted)' }}>{row.negocio}</td>
                  <td style={{ padding: '6px 12px', fontWeight: 700, color: 'var(--text-main)' }}>{row.palanca}</td>
                  
                  <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-main)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    {displayObj}
                  </td>
                  
                  {/* Tramos */}
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: row.tramoAplicado.includes('Tramo 1') ? '#34c759' : 'var(--text-muted)', fontWeight: row.tramoAplicado.includes('Tramo 1') ? 700 : 400 }}>
                    {row.t1Raw}
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: row.tramoAplicado.includes('Tramo 2') ? '#34c759' : 'var(--text-muted)', fontWeight: row.tramoAplicado.includes('Tramo 2') ? 700 : 400 }}>
                    {row.t2Raw}
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: row.tramoAplicado.includes('Tramo 3') ? '#34c759' : 'var(--text-muted)', fontWeight: row.tramoAplicado.includes('Tramo 3') ? 700 : 400 }}>
                    {row.t3Raw}
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: row.tramoAplicado.includes('Bonif') ? '#34c759' : 'var(--text-muted)', fontWeight: row.tramoAplicado.includes('Bonif') ? 700 : 400 }}>
                    {row.bonifRaw}
                  </td>

                  {/* Resultados */}
                  <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--mercedes-cyan)' }}>
                    {displaySales}
                  </td>
                  
                  <td style={{ 
                    padding: '6px 12px', 
                    textAlign: 'center', 
                    fontWeight: 800, 
                    color: row.pct >= 100 ? '#34c759' : (row.pct > 0 ? '#ff9500' : 'var(--text-muted)')
                  }}>
                    {displayPct}
                  </td>
                  
                  <td style={{ 
                    padding: '6px 12px', 
                    textAlign: 'right', 
                    fontWeight: 900, 
                    color: hasEarned ? '#34c759' : 'var(--text-muted)',
                    fontSize: '13px',
                    backgroundColor: hasEarned ? 'rgba(52, 199, 89, 0.05)' : 'transparent'
                  }}>
                    {formatCurrency(row.importe)}
                  </td>
                </tr>
              )
            })}

            {/* FILA DE TOTALES */}
            <tr style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderTop: '2px solid var(--border-strong)',
              fontWeight: 800
            }}>
              <td colSpan={2} style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-main)' }}>Total Consolidado Tiendas</td>
              <td colSpan={7}></td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '14px', color: '#34c759', fontWeight: 900 }}>
                {formatCurrency(totalImporteTerritorial)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SECCIÓN COMPARATIVA Y DATOS ADICIONALES (AÑO ANTERIOR Y MOD ACTUAL - COMPRESSED) */}
      <div style={{ 
        backgroundColor: 'var(--bg-card)', 
        borderRadius: '12px', 
        border: '1px solid var(--border-light)', 
        padding: '14px 18px', 
        marginTop: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)', 
        backdropFilter: 'blur(10px)'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Percent size={16} color="var(--mercedes-cyan)" /> Datos Comparativos de Rentabilidad
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Fila Año Anterior - Editable */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '10px 14px', 
            backgroundColor: 'rgba(255, 255, 255, 0.01)', 
            borderRadius: '8px', 
            border: '1px solid var(--border-light)' 
          }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '12px' }}>
                Importe Año Anterior ({prevYearLabel})
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Valor de referencia editable manualmente para el mismo mes del año anterior.
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                value={manualImportePrevYear}
                placeholder="0,00"
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.,]/g, '');
                  const parsedVal = val.replace(',', '.');
                  handleManualImportePrevYearChange(parsedVal);
                }}
                style={{
                  width: '120px',
                  textAlign: 'right',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '5px',
                  padding: '5px 8px',
                  fontWeight: 800,
                  fontSize: '13px',
                  color: 'var(--text-main)',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  outline: 'none',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
                }}
              />
              <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '13px' }}>€</span>
            </div>
          </div>

          {/* Fila Importe Mensual MOD */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '10px 14px', 
            backgroundColor: 'rgba(255, 255, 255, 0.01)', 
            borderRadius: '8px', 
            border: '1px solid var(--border-light)' 
          }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '12px' }}>
                Importe Mensual MOD ({currYearLabel})
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Importe mensual calculado para el mes en vigor según la pantalla MOD.
              </div>
            </div>
            
            <div style={{ 
              fontWeight: 900, 
              color: '#34c759', 
              fontSize: '16px', 
              paddingRight: '18px'
            }}>
              {formatCurrency(modImporte)}
            </div>
          </div>
        </div>
      </div>
      
      {/* MENSAJE EN CASO DE TABLA VACÍA */}
      {calculatedRows.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-light)', borderRadius: 12, marginTop: 16 }}>
          No hay palancas configuradas para el periodo activo.
        </div>
      )}
    </div>
  )
}
