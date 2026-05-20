'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, BookOpen, Library, Trophy, Flame, Target, Award, Star, Zap, Clock, ShieldCheck, Crown, Wifi, Smartphone, Shield, TrendingUp, Tv, Layers } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { usePeriod } from '@/components/PeriodProvider'
import { matchTipoVenta } from '@/hooks/useComisionesData'

export default function DashboardPage() {
  const { activePeriodKey } = usePeriod()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [allSales, setAllSales] = useState<any[]>([])
  const [tiendaRules, setTiendaRules] = useState<any[]>([])
  const [o2Rules, setO2Rules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fmt = (num: number) => {
    return num.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  };

  const fetchData = async (isInitial: boolean) => {
    if (!activePeriodKey) return;
    if (isInitial) setLoading(true);
    
    try {
      const [userRes, salesRes, tiendasRes, o2Res] = await Promise.all([
        fetch('/api/auth/me').then(res => res.json()).catch(() => null),
        fetch(`/api/sales?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({ success: false, logs: [] })),
        fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({ success: false, rules: [] })),
        fetch(`/api/settings?key=o2_rules_v2_${activePeriodKey}`).then(res => res.json()).catch(() => ({ value: null }))
      ]);

      if (userRes) {
        setCurrentUser(userRes);
      }
      if (salesRes && salesRes.success && salesRes.logs) {
        setAllSales(salesRes.logs);
      }
      if (tiendasRes && tiendasRes.success) {
        setTiendaRules(tiendasRes.rules || []);
      }
      if (o2Res && o2Res.value) {
        try {
          const parsed = JSON.parse(o2Res.value);
          setO2Rules(parsed.rules || []);
        } catch (e) {
          setO2Rules([]);
        }
      } else {
        setO2Rules([]);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);

    const interval = setInterval(() => {
      fetchData(false);
    }, 8000); // Polling every 8 seconds

    const handleFocus = () => {
      fetchData(false);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [activePeriodKey]);

  // ── Cómputo del Termómetro Diario (6 KPIs) ──
  const teamSales = allSales.filter(s => !String(s.vendedor || '').toLowerCase().includes('marta') && s.anulado !== 'Si' && s.pendiente !== 'Anulado');

  const getKPIMetrics = (kpiName: string, fallbackTarget: number, isPercentage: boolean) => {
    const rule = tiendaRules.find(r => r.nombre.toLowerCase().trim() === kpiName.toLowerCase().trim());
    let target = fallbackTarget;
    if (rule && rule.objPrimerTramo) {
      target = Number(rule.objPrimerTramo) || fallbackTarget;
    }

    let productsCuentan = kpiName;
    if (rule && rule.productosCuentan) {
      productsCuentan = rule.productosCuentan;
    }

    let llevamos = 0;
    teamSales.forEach(s => {
      if (matchTipoVenta(s, productsCuentan)) {
        if (isPercentage) {
          llevamos += Number(s.cuota) || 0;
        } else {
          llevamos += 1;
        }
      }
      if (s.seguroImporte && Number(s.seguroImporte) > 0) {
        const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
        if (matchTipoVenta(virtualSeguro, productsCuentan)) {
          if (isPercentage) {
            llevamos += Number(s.seguroImporte);
          } else {
            llevamos += 1;
          }
        }
      }
    });

    const faltan = Math.max(0, target - llevamos);
    const progressPct = target > 0 ? Math.min(100, (llevamos / target) * 100) : 0;

    return {
      llevamos,
      target,
      faltan,
      progressPct
    };
  };

  const kpiBafTotal = getKPIMetrics('Alta BAF Total', 87, false);
  const kpiBafConv = getKPIMetrics('Alta BAF Convergente', 53, false);
  const kpiDispSeg = getKPIMetrics('Dispositivos + Seguros', 96542, true);
  const kpiFttr = getKPIMetrics('FTTR', 8, false);
  const kpiArpu = getKPIMetrics('ARPU', 50000, true);
  const kpiRepoFutbol = getKPIMetrics('Repo Fútbol', 34, false);

  // ── Cómputo del MVP y Nominados ──
  const getMVPAndNominados = () => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const todayStr = `${d}/${m}/${y}`;

    const activeSales = allSales.filter(s => s.anulado !== 'Si' && s.pendiente !== 'Anulado');
    let salesForMvp = activeSales.filter(s => s.fecha === todayStr);
    let isToday = true;

    if (salesForMvp.length === 0) {
      salesForMvp = activeSales;
      isToday = false;
    }

    // 1. Facturación (MVP)
    const billingTotals: Record<string, number> = {};
    // 2. Conectividad (BAF)
    const bafTotals: Record<string, number> = {};
    // 3. Dispositivos + Seguros
    const dispSegTotals: Record<string, number> = {};

    salesForMvp.forEach(s => {
      const vName = String(s.vendedor || '').trim();
      if (!vName) return;

      // Facturación total
      let amt = Number(s.cuota) || 0;
      if (s.seguroImporte && Number(s.seguroImporte) > 0) {
        amt += Number(s.seguroImporte);
      }
      billingTotals[vName] = (billingTotals[vName] || 0) + amt;

      // Conectividad (Alta BAF Total / Alta BAF Convergente)
      if (matchTipoVenta(s, 'Alta BAF Total') || matchTipoVenta(s, 'Alta BAF Convergente')) {
        bafTotals[vName] = (bafTotals[vName] || 0) + 1;
      }

      // Dispositivos + Seguros
      let isDispSeg = matchTipoVenta(s, 'Dispositivos + Seguros');
      if (isDispSeg) {
        dispSegTotals[vName] = (dispSegTotals[vName] || 0) + (Number(s.cuota) || 0);
      }
      if (s.seguroImporte && Number(s.seguroImporte) > 0) {
        const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
        if (matchTipoVenta(virtualSeguro, 'Dispositivos + Seguros')) {
          dispSegTotals[vName] = (dispSegTotals[vName] || 0) + Number(s.seguroImporte);
        }
      }
    });

    // MVP
    let mvpName = 'Nadie';
    let mvpTotal = 0;
    Object.entries(billingTotals).forEach(([name, val]) => {
      if (val > mvpTotal) {
        mvpTotal = val;
        mvpName = name;
      }
    });

    // Nominado BAF (excluyendo MVP para que no se repitan si es posible)
    let bafLeaderName = 'Nadie';
    let bafLeaderTotal = 0;
    Object.entries(bafTotals).forEach(([name, val]) => {
      if (name !== mvpName || Object.keys(billingTotals).length <= 1) {
        if (val > bafLeaderTotal) {
          bafLeaderTotal = val;
          bafLeaderName = name;
        }
      }
    });
    if (bafLeaderName === 'Nadie') {
      Object.entries(bafTotals).forEach(([name, val]) => {
        if (val > bafLeaderTotal) {
          bafLeaderTotal = val;
          bafLeaderName = name;
        }
      });
    }

    // Nominado Disp + Seguros (excluyendo MVP y BAF)
    let dispSegLeaderName = 'Nadie';
    let dispSegLeaderTotal = 0;
    Object.entries(dispSegTotals).forEach(([name, val]) => {
      if ((name !== mvpName && name !== bafLeaderName) || Object.keys(billingTotals).length <= 2) {
        if (val > dispSegLeaderTotal) {
          dispSegLeaderTotal = val;
          dispSegLeaderName = name;
        }
      }
    });
    if (dispSegLeaderName === 'Nadie') {
      Object.entries(dispSegTotals).forEach(([name, val]) => {
        if (val > dispSegLeaderTotal) {
          dispSegLeaderTotal = val;
          dispSegLeaderName = name;
        }
      });
    }

    return {
      mvp: { name: mvpName, total: mvpTotal },
      nominadoBaf: { name: bafLeaderName, total: bafLeaderTotal },
      nominadoDispSeg: { name: dispSegLeaderName, total: dispSegLeaderTotal },
      isToday
    };
  };

  const mvp = getMVPAndNominados();

  // ── Cuenta Kilómetros ──
  const userRules = String(currentUser?.username || '').toLowerCase().includes('marta') ? o2Rules : tiendaRules;
  const userSales = allSales.filter(s => {
    const v = String(s.vendedor || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const tgt = String(currentUser?.username || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return v === tgt && s.anulado !== 'Si' && s.pendiente !== 'Anulado';
  });

  const getCuentaKilometros = () => {
    if (!currentUser || userRules.length === 0) {
      return {
        vendedor: 'Equipo',
        reglaNombre: 'Objetivo de Tienda',
        llevamos: kpiBafTotal.llevamos,
        target: kpiBafTotal.target,
        faltan: kpiBafTotal.faltan,
        progressPct: kpiBafTotal.progressPct,
        isPercentage: false
      };
    }

    const progressList = userRules.map(rule => {
      const isPercentage = String(rule.importePrimerTramo || '').includes('%');
      let target = Number(rule.objPrimerTramo) || 0;
      
      let llevamos = 0;
      userSales.forEach(s => {
        if (matchTipoVenta(s, rule.productosCuentan)) {
          if (isPercentage) {
            llevamos += Number(s.cuota) || 0;
          } else {
            llevamos += 1;
          }
        }
        if (s.seguroImporte && Number(s.seguroImporte) > 0) {
          const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
          if (matchTipoVenta(virtualSeguro, rule.productosCuentan)) {
            if (isPercentage) {
              llevamos += Number(s.seguroImporte);
            } else {
              llevamos += 1;
            }
          }
        }
      });

      const progressPct = target > 0 ? (llevamos / target) * 100 : 0;
      const faltan = Math.max(0, target - llevamos);

      return {
        vendedor: currentUser.username,
        reglaNombre: rule.nombre,
        llevamos,
        target,
        faltan,
        progressPct,
        isPercentage
      };
    });

    const incomplete = progressList.filter(p => p.progressPct < 100);
    if (incomplete.length > 0) {
      return incomplete.reduce((max, curr) => curr.progressPct > max.progressPct ? curr : max, incomplete[0]);
    }
    return progressList.reduce((max, curr) => curr.progressPct > max.progressPct ? curr : max, progressList[0]);
  };

  const cuentaKms = getCuentaKilometros();

  if (loading && allSales.length === 0) return <div style={{ padding: 20 }}>Cargando datos del Dashboard...</div>

  return (
    <div style={{ padding: 20 }}>
      <PageHeader 
        title={<>Dashboard <span className="text-cyan">Tiempo Real</span></>}
        subtitle="Sincronizado directamente con las celdas del Excel central."
        showTheme={true}
        showBack={false}
      />

      
      {/* FILA 1: TORNEOS Y MVP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <Link href="/torneos-ventas" style={{ textDecoration: 'none', display: 'block', marginBottom: '0', outline: 'none' }}>
        <div 
          style={{
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(14, 165, 233, 0.15) 100%)',
            borderRadius: 12,
            padding: '16px',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            height: '100%',
            gap: '12px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 24px -10px rgba(14, 165, 233, 0.25)'
            e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.6)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 4px 14px -5px rgba(0,0,0,0.05)'
            e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.3)'
          }}
        >
          <div style={{ backgroundColor: '#0ea5e9', padding: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trophy size={28} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#0ea5e9' }}>Torneos de Ventas</h3>
            <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '14px', fontWeight: 500 }}>Ranking en tiempo real, competición y medallas por objetivos.</p>
          </div>
        </div>
      </Link>
        {/* EL MVP ROTATIVO */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          padding: '16px',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle background glow */}
          <div style={{ position: 'absolute', bottom: -50, right: -50, width: 150, height: 150, background: 'radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0) 70%)', borderRadius: '50%' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ backgroundColor: 'rgba(236, 72, 153, 0.1)', padding: '10px', borderRadius: '12px' }}>
              <Crown size={24} color="#ec4899" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Destacados y Nominados MVP</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--medium-gray)', fontWeight: 500 }}>
                {mvp.isToday ? 'Rendimiento y Liderazgo Hoy' : 'Rendimiento y Liderazgo del Mes'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'center' }}>
            {/* MVP Principal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-body)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
              <div style={{ 
                width: 40, height: 40, borderRadius: '50%', 
                boxShadow: '0 4px 10px rgba(219, 39, 119, 0.3)', 
                border: '2px solid #ec4899',
                overflow: 'hidden', flexShrink: 0,
                background: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {mvp.mvp.name !== 'Nadie' ? (
                  <img 
                    src={`/${mvp.mvp.name}.jpg`} 
                    alt={mvp.mvp.name} 
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = `<span style="color:#fff; font-size:16px; font-weight:900">${mvp.mvp.name.charAt(0).toUpperCase()}</span>`;
                      }
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <Crown size={20} color="#fff" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>{mvp.mvp.name}</h4>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#ec4899', background: 'rgba(236, 72, 153, 0.1)', padding: '2px 8px', borderRadius: '10px' }}>Facturación (MVP)</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--medium-gray)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
                  {mvp.mvp.name !== 'Nadie' ? (
                    <>
                      Liderando con <strong style={{ color: 'var(--text-main)' }}>{fmt(mvp.mvp.total)}</strong>
                    </>
                  ) : (
                    <span>Esperando ventas...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Nominado 1: Conectividad BAF */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-body)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
              <div style={{ 
                width: 36, height: 36, borderRadius: '50%', 
                boxShadow: '0 2px 6px rgba(14, 165, 233, 0.2)', 
                border: '2px solid #0ea5e9',
                overflow: 'hidden', flexShrink: 0,
                background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {mvp.nominadoBaf.name !== 'Nadie' ? (
                  <img 
                    src={`/${mvp.nominadoBaf.name}.jpg`} 
                    alt={mvp.nominadoBaf.name} 
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = `<span style="color:#fff; font-size:14px; font-weight:900">${mvp.nominadoBaf.name.charAt(0).toUpperCase()}</span>`;
                      }
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <Wifi size={16} color="#fff" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>{mvp.nominadoBaf.name}</h4>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#0ea5e9', background: 'rgba(14, 165, 233, 0.1)', padding: '2px 6px', borderRadius: '8px' }}>Líder Conectividad</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--medium-gray)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9' }}></span>
                  {mvp.nominadoBaf.name !== 'Nadie' ? (
                    <>
                      Destacado con <strong style={{ color: 'var(--text-main)' }}>{mvp.nominadoBaf.total} Altas BAF</strong>
                    </>
                  ) : (
                    <span>Esperando altas...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Nominado 2: Dispositivos + Seguros */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-body)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ 
                width: 36, height: 36, borderRadius: '50%', 
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.2)', 
                border: '2px solid #f59e0b',
                overflow: 'hidden', flexShrink: 0,
                background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {mvp.nominadoDispSeg.name !== 'Nadie' ? (
                  <img 
                    src={`/${mvp.nominadoDispSeg.name}.jpg`} 
                    alt={mvp.nominadoDispSeg.name} 
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = `<span style="color:#fff; font-size:14px; font-weight:900">${mvp.nominadoDispSeg.name.charAt(0).toUpperCase()}</span>`;
                      }
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <Smartphone size={16} color="#fff" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>{mvp.nominadoDispSeg.name}</h4>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '8px' }}>Héroe Disp. + Seguros</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--medium-gray)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }}></span>
                  {mvp.nominadoDispSeg.name !== 'Nadie' ? (
                    <>
                      Destacado con <strong style={{ color: 'var(--text-main)' }}>{fmt(mvp.nominadoDispSeg.total)}</strong>
                    </>
                  ) : (
                    <span>Esperando ventas...</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* TERMÓMETRO DIARIO DE LA EMPRESA */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        padding: '12px',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '12px' }}>
            <Flame size={24} color="#ef4444" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>Termómetro Diario de la Empresa</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--medium-gray)', fontWeight: 500 }}>Seguimiento en vivo de los 6 KPIs críticos para llegar al objetivo del mes.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          
          {/* 1. Altas BAF Total */}
          <div style={{ background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wifi size={18} color="#0ea5e9" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Altas BAF Total</span>
              </div>
              {kpiBafTotal.faltan > 0 ? (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  Faltan {kpiBafTotal.faltan}
                </span>
              ) : (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  ¡Logrado!
                </span>
              )}
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${kpiBafTotal.progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #0284c7)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>{kpiBafTotal.llevamos}</strong></span>
              <span>Objetivo: {kpiBafTotal.target}</span>
            </div>
          </div>

          {/* 2. Alta BAF Convergente */}
          <div style={{ background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} color="#8b5cf6" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>BAF Convergente</span>
              </div>
              {kpiBafConv.faltan > 0 ? (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  Faltan {kpiBafConv.faltan}
                </span>
              ) : (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  ¡Logrado!
                </span>
              )}
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${kpiBafConv.progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #7c3aed)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>{kpiBafConv.llevamos}</strong></span>
              <span>Objetivo: {kpiBafConv.target}</span>
            </div>
          </div>

          {/* 3. Dispositivos + Seguros */}
          <div style={{ background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Smartphone size={18} color="#f59e0b" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Dispositivos + Seguros</span>
              </div>
              {kpiDispSeg.faltan > 0 ? (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  Faltan {fmt(kpiDispSeg.faltan)}
                </span>
              ) : (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  ¡Logrado!
                </span>
              )}
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${kpiDispSeg.progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #fbbf24, #d97706)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>{fmt(kpiDispSeg.llevamos)}</strong></span>
              <span>Objetivo: {fmt(kpiDispSeg.target)}</span>
            </div>
          </div>

          {/* 4. FTTR */}
          <div style={{ background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color="#ec4899" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>FTTR</span>
              </div>
              {kpiFttr.faltan > 0 ? (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  Faltan {kpiFttr.faltan}
                </span>
              ) : (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  ¡Logrado!
                </span>
              )}
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${kpiFttr.progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #f472b6, #db2777)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>{kpiFttr.llevamos}</strong></span>
              <span>Objetivo: {kpiFttr.target}</span>
            </div>
          </div>

          {/* 5. ARPU */}
          <div style={{ background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} color="#10b981" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>ARPU Acumulado</span>
              </div>
              {kpiArpu.faltan > 0 ? (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  Faltan {fmt(kpiArpu.faltan)}
                </span>
              ) : (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  ¡Logrado!
                </span>
              )}
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${kpiArpu.progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #34d399, #059669)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>{fmt(kpiArpu.llevamos)}</strong></span>
              <span>Objetivo: {fmt(kpiArpu.target)}</span>
            </div>
          </div>

          {/* 6. Repo Fútbol */}
          <div style={{ background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tv size={18} color="#3b82f6" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Repo Fútbol</span>
              </div>
              {kpiRepoFutbol.faltan > 0 ? (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  Faltan {kpiRepoFutbol.faltan}
                </span>
              ) : (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  ¡Logrado!
                </span>
              )}
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${kpiRepoFutbol.progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #60a5fa, #2563eb)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>{kpiRepoFutbol.llevamos}</strong></span>
              <span>Objetivo: {kpiRepoFutbol.target}</span>
            </div>
          </div>

        </div>
      </div>

      {/* FILA 3: CUENTA KMS Y MEDALLAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {/* CUENTA KILÓMETROS DEL SALTO DE TRAMO */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          padding: '16px',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle background glow */}
          <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0) 70%)', borderRadius: '50%' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '12px' }}>
              <Target size={24} color="#10b981" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Cuenta Kilómetros</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--medium-gray)', fontWeight: 500 }}>
                Objetivo: {cuentaKms.reglaNombre}
              </p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-main)', lineHeight: 1.4 }}>
              {cuentaKms.faltan > 0 ? (
                <>
                  <strong style={{ color: 'var(--mercedes-cyan)' }}>{cuentaKms.vendedor}</strong>, estás a solo{' '}
                  <strong style={{ color: '#10b981', fontSize: '18px' }}>
                    {cuentaKms.isPercentage ? fmt(cuentaKms.faltan) : `${cuentaKms.faltan} uds`}
                  </strong>{' '}
                  de <strong style={{ color: 'var(--text-main)' }}>{cuentaKms.reglaNombre}</strong> para alcanzar tu tramo objetivo.
                </>
              ) : (
                <>
                  ¡Felicidades <strong style={{ color: 'var(--mercedes-cyan)' }}>{cuentaKms.vendedor}</strong>! Has superado el tramo objetivo de{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{cuentaKms.reglaNombre}</strong>.
                </>
              )}
            </p>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '14px', background: 'var(--bg-input)', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: `${Math.min(100, cuentaKms.progressPct)}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)', borderRadius: '7px', boxShadow: '0 0 10px rgba(16,185,129,0.5)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--medium-gray)' }}>
              <span>{cuentaKms.isPercentage ? fmt(cuentaKms.llevamos) : `${cuentaKms.llevamos} uds`}</span>
              <span style={{ color: '#10b981' }}>Meta: {cuentaKms.isPercentage ? fmt(cuentaKms.target) : `${cuentaKms.target} uds`}</span>
            </div>
          </div>
        </div>


        
        
        
        
        {/* VITRINA DE LOGROS (Estilo PlayStation) */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          padding: '16px',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '10px', borderRadius: '12px' }}>
              <Award size={24} color="#8b5cf6" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Tus Medallas y Logros</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--medium-gray)', fontWeight: 500 }}>Desbloqueos recientes esta semana</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', flex: 1 }}>
            
            {/* Medalla 1: Oro */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)' }}>
                <ShieldCheck size={24} color="#fff" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#d97706', marginBottom: 2 }}>Rey del O2</div>
                <div style={{ fontSize: '10px', color: 'var(--medium-gray)' }}>Liderando O2</div>
              </div>
            </div>

            {/* Medalla 2: Plata */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.3)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(148, 163, 184, 0.4)' }}>
                <Clock size={24} color="#fff" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: 2 }}>Madrugador</div>
                <div style={{ fontSize: '10px', color: 'var(--medium-gray)' }}>1ª venta &lt; 10h</div>
              </div>
            </div>

            {/* Medalla 3: Bronce/Cobre */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(217, 119, 6, 0.2)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #fca5a5 0%, #ef4444 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)' }}>
                <Zap size={24} color="#fff" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#b91c1c', marginBottom: 2 }}>El Pulpo</div>
                <div style={{ fontSize: '10px', color: 'var(--medium-gray)' }}>Multi-paquete</div>
              </div>
            </div>

          </div>
        </div>



      </div>

    </div>
  )
}
