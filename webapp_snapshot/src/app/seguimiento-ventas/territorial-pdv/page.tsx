'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'
import { PageHeader } from '@/components/PageHeader'
import { PeriodSelector } from '@/components/PeriodSelector'
import { Globe, ArrowLeft, Info, Percent, AlertCircle } from 'lucide-react'
import { matchesRule, getValueForRule, matchTipoVenta } from '@/hooks/useComisionesData'

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

  useEffect(() => {
    if (!activePeriodKey) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/sales?periodKey=${activePeriodKey}&dashboard=true`).then(r => r.json()).catch(() => ({ success: true, logs: [] })),
      fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({ success: true, rules: [] })),
      fetch(`/api/territorial?periodKey=${activePeriodKey}`).then(r => r.json()).catch(() => ({ success: true, tiendas: [] })),
      fetch('/api/catalogs').then(r => r.json()).catch(() => ({ success: true, catalogs: {} }))
    ])
    .then(([salesRes, tiendasRes, territorialRes, catalogsRes]) => {
      setSales(salesRes.logs || []);
      setTiendaRules(tiendasRes.rules || []);
      setTerritorialRules(territorialRes.tiendas || []);
      setCatalogs(catalogsRes.catalogs || {});
      setLoading(false);
    })
    .catch(err => {
      console.error('Error fetching data for territorial pdv:', err);
      setLoading(false);
    });
  }, [activePeriodKey]);

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

      {/* MANUAL/INFORMACIÓN SUTIL */}
      <div style={{ 
        backgroundColor: 'rgba(0, 173, 239, 0.05)', 
        border: '1px solid rgba(0, 173, 239, 0.2)', 
        borderRadius: '12px', 
        padding: '16px 20px', 
        marginBottom: '24px', 
        display: 'flex', 
        gap: '12px', 
        alignItems: 'flex-start' 
      }}>
        <Info size={20} color="var(--mercedes-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-main)' }}>Funcionamiento de la tabla:</strong> Los <strong style={{ color: 'var(--text-main)' }}>Objetivos</strong> proceden de la configuración activa en <em>Entrada de Datos {'>'} Comisiones para Tiendas</em>. Las <strong style={{ color: 'var(--text-main)' }}>Ventas</strong> suman las operaciones de todas las tiendas físicas consolidadas. El <strong style={{ color: 'var(--text-main)' }}>Porcentaje</strong> y el <strong style={{ color: 'var(--text-main)' }}>Importe</strong> se calculan de acuerdo a los tramos de cumplimiento territorial homologados.
        </div>
      </div>

      {/* CONTENEDOR DE TABLA PREMIUM (GLASSMORPHISM DARK) */}
      <div style={{ 
        backgroundColor: 'var(--bg-card)', 
        borderRadius: '16px', 
        border: '1px solid var(--border-light)', 
        overflow: 'hidden', 
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)', 
        backdropFilter: 'blur(10px)' 
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ 
              background: 'linear-gradient(90deg, #0ea5e9, #0284c7)', 
              color: 'white',
              borderBottom: '1px solid var(--border-strong)'
            }}>
              <th style={{ padding: '16px 20px', fontWeight: 700 }}>Negocio</th>
              <th style={{ padding: '16px 20px', fontWeight: 700 }}>Palanca</th>
              <th style={{ padding: '16px 20px', fontWeight: 700, textAlign: 'center' }}>Objetivos</th>
              <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'center', fontSize: '11px', whiteSpace: 'normal', lineHeight: 1.2 }}>Tramo 1<br/>(&gt;=100% y &lt;115%)</th>
              <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'center', fontSize: '11px', whiteSpace: 'normal', lineHeight: 1.2 }}>Tramo 2<br/>(&gt;=115% y &lt;130%)</th>
              <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'center', fontSize: '11px', whiteSpace: 'normal', lineHeight: 1.2 }}>Tramo 3<br/>(&gt;=130%)</th>
              <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'center', fontSize: '11px', whiteSpace: 'normal', lineHeight: 1.2 }}>Bonificación<br/>(&gt;=100%)</th>
              <th style={{ padding: '16px 20px', fontWeight: 700, textAlign: 'center' }}>Ventas</th>
              <th style={{ padding: '16px 20px', fontWeight: 700, textAlign: 'center' }}>Porcentaje Ventas</th>
              <th style={{ padding: '16px 20px', fontWeight: 700, textAlign: 'right' }}>Importe</th>
            </tr>
          </thead>
          <tbody>
            <style dangerouslySetInnerHTML={{
              __html: `
                .row-hover {
                  transition: background-color 0.2s ease, transform 0.2s ease;
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
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-muted)' }}>{row.negocio}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--text-main)' }}>{row.palanca}</td>
                  
                  <td style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 600, color: 'var(--text-main)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    {displayObj}
                  </td>
                  
                  {/* Tramos */}
                  <td style={{ padding: '14px 20px', textAlign: 'center', color: row.tramoAplicado.includes('Tramo 1') ? '#34c759' : 'var(--text-muted)', fontWeight: row.tramoAplicado.includes('Tramo 1') ? 700 : 400 }}>
                    {row.t1Raw}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'center', color: row.tramoAplicado.includes('Tramo 2') ? '#34c759' : 'var(--text-muted)', fontWeight: row.tramoAplicado.includes('Tramo 2') ? 700 : 400 }}>
                    {row.t2Raw}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'center', color: row.tramoAplicado.includes('Tramo 3') ? '#34c759' : 'var(--text-muted)', fontWeight: row.tramoAplicado.includes('Tramo 3') ? 700 : 400 }}>
                    {row.t3Raw}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'center', color: row.tramoAplicado.includes('Bonif') ? '#34c759' : 'var(--text-muted)', fontWeight: row.tramoAplicado.includes('Bonif') ? 700 : 400 }}>
                    {row.bonifRaw}
                  </td>

                  {/* Resultados */}
                  <td style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--mercedes-cyan)' }}>
                    {displaySales}
                  </td>
                  
                  <td style={{ 
                    padding: '14px 20px', 
                    textAlign: 'center', 
                    fontWeight: 800, 
                    color: row.pct >= 100 ? '#34c759' : (row.pct > 0 ? '#ff9500' : 'var(--text-muted)')
                  }}>
                    {displayPct}
                  </td>
                  
                  <td style={{ 
                    padding: '14px 20px', 
                    textAlign: 'right', 
                    fontWeight: 900, 
                    color: hasEarned ? '#34c759' : 'var(--text-muted)',
                    fontSize: '14px',
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
              <td colSpan={2} style={{ padding: '18px 20px', fontSize: '14px', color: 'var(--text-main)' }}>Total Consolidado Tiendas</td>
              <td colSpan={7}></td>
              <td style={{ padding: '18px 20px', textAlign: 'right', fontSize: '16px', color: '#34c759', fontWeight: 900 }}>
                {formatCurrency(totalImporteTerritorial)}
              </td>
            </tr>
          </tbody>
        </table>
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
