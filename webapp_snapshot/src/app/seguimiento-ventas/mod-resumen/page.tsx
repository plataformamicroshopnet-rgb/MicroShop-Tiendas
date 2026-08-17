'use client'

// Force build revalidation to apply updated matchTipoVenta logic
import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'
import { PeriodSelector } from '@/components/PeriodSelector'
import { ArrowLeft, BarChart2 } from 'lucide-react'
import { matchTipoVenta, matchesRule, getValueForRule } from '@/hooks/useComisionesData'
import { renderDashboardData, calculateDynamicCommission, sanitizeSale, normalizeString, isVentaWithinDates, esCorreccionRepos, esVentaSustituida } from '@/lib/salesUtils'
import { getSaleCommissionBase, getSwapBonus } from '@/lib/saleCommission'
import { computeTerritorialTotal } from '@/lib/territorialConsolidado'
import { getSellersForStore } from '@/lib/comercialRoster'
import { computeModResumen } from '@/lib/modResumen'

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
  const [tiendaHours, setTiendaHours] = useState<any[]>([])
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
      setTiendaHours(tiendasRes.hours || []);
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

  // Los días laborables (CON festivos de Salamanca), parseSafeFloat y todo el
  // ensamblaje de la tabla viven ahora en lib/modResumen (computeModResumen):
  // el informe diario por correo usa la MISMA función, así pantalla y correo
  // no pueden decir cifras distintas.

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
    rows: { name: string; real: number; projection: number; isSubtotal?: boolean; }[];
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

    // MOTOR ÚNICO: lib/modResumen (extraído de aquí tal cual). Lo comparte el
    // informe diario por correo (/api/informe-mod).
    return computeModResumen({
      sales,
      movilFreeSales,
      movilFreeProducts,
      tiendaHours,
      territorialTiendasRules,
      territorialO2Rules,
      catalogs,
      objetivos,
      objGrupos,
      importesPyme,
      importesPlus,
      activeExtras,
      periodData,
      year,
      month,
    });
  }, [loading, sales, movilFreeSales, movilFreeProducts, tiendaRules, tiendaHours, territorialTiendasRules, territorialO2Rules, catalogs, objetivos, objGrupos, importesPyme, importesPlus, activeExtras, periodData, year, month]);

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
                  borderBottom: row.isSubtotal ? '1px solid var(--border-strong)' : '1px solid var(--border-light)',
                  borderTop: row.isSubtotal ? '1px solid var(--border-strong)' : undefined,
                  backgroundColor: row.isSubtotal ? 'rgba(100, 116, 139, 0.10)' : 'transparent'
                }}
              >
                <td style={{ padding: '12px 16px', fontWeight: row.isSubtotal ? 800 : 700, fontStyle: row.isSubtotal ? 'italic' : 'normal', color: 'var(--text-main)' }}>{row.name}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: row.isSubtotal ? 800 : 700, color: 'var(--text-main)' }}>
                  {formatCurrency(row.real)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: row.isSubtotal ? 800 : 700, color: 'var(--mercedes-cyan)' }}>
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
