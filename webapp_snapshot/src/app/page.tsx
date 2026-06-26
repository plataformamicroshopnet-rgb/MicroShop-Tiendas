'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, BookOpen, Library, Trophy, Flame, Target, Award, Star, Zap, Crown, Wifi, Smartphone, Shield, TrendingUp, Tv, Layers, Repeat } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { usePeriod } from '@/components/PeriodProvider'
import { matchTipoVenta, matchesRule, getValueForRule } from '@/hooks/useComisionesData'
import { isSaleActive } from '@/lib/salesUtils'

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
        fetch(`/api/sales?periodKey=${activePeriodKey}&dashboard=true`).then(res => res.json()).catch(() => ({ success: false, logs: [] })),
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
  const teamSales = allSales.filter(s => !String(s.vendedor || '').toLowerCase().includes('marta') && isSaleActive(s));

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
      if (matchesRule(s, kpiName, productsCuentan)) {
        const val = getValueForRule(s, kpiName);
        if (isPercentage) {
          llevamos += val;
        } else {
          llevamos += 1;
        }
      }
      if (s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet).toLowerCase() !== 'seguro') {
        const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
        if (matchesRule(virtualSeguro, kpiName, productsCuentan)) {
          const val = getValueForRule(virtualSeguro, kpiName);
          if (isPercentage) {
            llevamos += val;
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
  // Swap: conteo directo de ventas con ¿Swap? marcado (sin pasar por el virtualSeguro de
  // getKPIMetrics, que duplicaría una venta Swap que además lleve seguro). Objetivo de la regla 'swap'.
  const kpiSwap = (() => {
    const swapCount = teamSales.filter(s => s.isSwap === true || String(s.isSwap).toLowerCase() === 'true').length;
    const swapRule = tiendaRules.find(r => String(r.nombre || '').toLowerCase().trim() === 'swap');
    const swapTarget = swapRule && swapRule.objPrimerTramo ? Number(swapRule.objPrimerTramo) : 1;
    return {
      llevamos: swapCount,
      target: swapTarget,
      faltan: Math.max(0, swapTarget - swapCount),
      progressPct: swapTarget > 0 ? Math.min(100, (swapCount / swapTarget) * 100) : 0,
    };
  })();

  // ── Cómputo del MVP y Nominados ──
  const getMVPAndNominados = () => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const todayStr = `${d}/${m}/${y}`;

    const activeSales = allSales.filter(s => isSaleActive(s));
    let salesForMvp = activeSales.filter(s => s.fecha === todayStr);
    let isToday = true;

    if (salesForMvp.length === 0) {
      salesForMvp = activeSales;
      isToday = false;
    }

    // 1. Facturación (MVP)
    const billingTotals: Record<string, number> = {};
    const billingPendingSales: Record<string, number> = {};
    // 2. Ventas miMovistar
    const miMovistarTotals: Record<string, number> = {};
    const miMovistarPendingSales: Record<string, number> = {};
    // 3. Dispositivos + Seguros
    const dispSegTotals: Record<string, number> = {};
    const dispSegPendingSales: Record<string, number> = {};

    salesForMvp.forEach(s => {
      const vName = String(s.vendedor || '').trim();
      if (!vName) return;

      const isPending = String(s.pendiente || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === 'si';

      // Facturación total
      let amt = 0;
      if (String(s.categoria || s.detalle || s.sheet).toLowerCase() === 'seguro') {
        amt = Number(s.seguroImporte) || Number(s.cuota) || Number(s.importe) || 0;
      } else {
        amt = (Number(s.cuota || s.importe) || 0) + (s.seguroImporte && Number(s.seguroImporte) > 0 ? Number(s.seguroImporte) : 0);
      }
      billingTotals[vName] = (billingTotals[vName] || 0) + amt;
      if (isPending) {
        billingPendingSales[vName] = (billingPendingSales[vName] || 0) + 1;
      }

      // Ventas miMovistar
      if (matchTipoVenta(s, 'mimovistar')) {
        miMovistarTotals[vName] = (miMovistarTotals[vName] || 0) + 1;
        if (isPending) {
          miMovistarPendingSales[vName] = (miMovistarPendingSales[vName] || 0) + 1;
        }
      }

      // Dispositivos + Seguros
      let isDispSeg = matchTipoVenta(s, 'Dispositivos + Seguros');
      if (isDispSeg) {
        let val = Number(s.cuota) || 0;
        if (String(s.categoria || s.detalle || s.sheet).toLowerCase() === 'seguro') {
          val = Number(s.seguroImporte) || Number(s.cuota) || 0;
        }
        dispSegTotals[vName] = (dispSegTotals[vName] || 0) + val;
        if (isPending) {
          dispSegPendingSales[vName] = (dispSegPendingSales[vName] || 0) + 1;
        }
      }
      if (s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet).toLowerCase() !== 'seguro') {
        const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
        if (matchTipoVenta(virtualSeguro, 'Dispositivos + Seguros')) {
          dispSegTotals[vName] = (dispSegTotals[vName] || 0) + Number(s.seguroImporte);
          if (isPending && !isDispSeg) {
            dispSegPendingSales[vName] = (dispSegPendingSales[vName] || 0) + 1;
          }
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

    // Nominado miMovistar (excluyendo MVP para que no se repitan si es posible)
    let miMovistarLeaderName = 'Nadie';
    let miMovistarLeaderTotal = 0;
    Object.entries(miMovistarTotals).forEach(([name, val]) => {
      if (name !== mvpName || Object.keys(billingTotals).length <= 1) {
        if (val > miMovistarLeaderTotal) {
          miMovistarLeaderTotal = val;
          miMovistarLeaderName = name;
        }
      }
    });
    if (miMovistarLeaderName === 'Nadie') {
      Object.entries(miMovistarTotals).forEach(([name, val]) => {
        if (val > miMovistarLeaderTotal) {
          miMovistarLeaderTotal = val;
          miMovistarLeaderName = name;
        }
      });
    }

    // Nominado Disp + Seguros (excluyendo MVP y miMovistar)
    let dispSegLeaderName = 'Nadie';
    let dispSegLeaderTotal = 0;
    Object.entries(dispSegTotals).forEach(([name, val]) => {
      if ((name !== mvpName && name !== miMovistarLeaderName) || Object.keys(billingTotals).length <= 2) {
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
      mvp: { name: mvpName, total: mvpTotal, pendingCount: billingPendingSales[mvpName] || 0 },
      nominadoMiMovistar: { name: miMovistarLeaderName, total: miMovistarLeaderTotal, pendingCount: miMovistarPendingSales[miMovistarLeaderName] || 0 },
      nominadoDispSeg: { name: dispSegLeaderName, total: dispSegLeaderTotal, pendingCount: dispSegPendingSales[dispSegLeaderName] || 0 },
      isToday
    };
  };

  const mvp = getMVPAndNominados();

  // ── Cuenta Kilómetros ──
  const userRules = String(currentUser?.username || '').toLowerCase().includes('marta') ? o2Rules : tiendaRules;
  const userSales = allSales.filter(s => {
    const v = String(s.vendedor || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const tgt = String(currentUser?.username || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return v === tgt && isSaleActive(s);
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
        if (matchesRule(s, rule.nombre, rule.productosCuentan)) {
          const val = getValueForRule(s, rule.nombre);
          if (isPercentage) {
            llevamos += val;
          } else {
            llevamos += 1;
          }
        }
        if (s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet).toLowerCase() !== 'seguro') {
          const virtualSeguro = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
          if (matchesRule(virtualSeguro, rule.nombre, rule.productosCuentan)) {
            const val = getValueForRule(virtualSeguro, rule.nombre);
            if (isPercentage) {
              llevamos += val;
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

  // ── Ranking por vendedor (Torneos · Cuenta Kilómetros · Medallas) ──
  const ranking = (() => {
    const activos = allSales.filter(s => isSaleActive(s));
    const byV: Record<string, any[]> = {};
    activos.forEach(s => {
      const v = String(s.vendedor || '').trim();
      if (!v || v.toLowerCase() === 'marta') return;
      (byV[v] = byV[v] || []).push(s);
    });
    const names = Object.keys(byV);

    const dispSegVal = (ventas: any[]) => {
      let total = 0;
      ventas.forEach(s => {
        if (matchTipoVenta(s, 'Dispositivos + Seguros')) {
          let val = Number(s.cuota) || 0;
          if (String(s.categoria || s.detalle || s.sheet).toLowerCase() === 'seguro') val = Number(s.seguroImporte) || Number(s.cuota) || 0;
          total += val;
        }
        if (s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet).toLowerCase() !== 'seguro') {
          const vs = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) };
          if (matchTipoVenta(vs, 'Dispositivos + Seguros')) total += Number(s.seguroImporte);
        }
      });
      return total;
    };
    const convCount = (ventas: any[]) => ventas.filter(s => matchTipoVenta(s, 'Alta BAF Convergente')).length;
    const pulpoCount = (ventas: any[]) => {
      const nifs: Record<string, number> = {};
      ventas.forEach(s => { const n = String(s.nif || '').trim().toUpperCase(); if (n) nifs[n] = (nifs[n] || 0) + 1; });
      return Object.values(nifs).filter(c => c > 1).length;
    };
    const firstMin = (ventas: any[]): number | null => {
      let best: number | null = null;
      ventas.forEach(s => {
        const t = s.createdAt ? new Date(s.createdAt) : null;
        if (t && !isNaN(t.getTime())) { const m = t.getHours() * 60 + t.getMinutes(); if (best === null || m < best) best = m; }
      });
      return best;
    };

    const sortDesc = (f: (v: any[]) => number) => names.map(n => ({ name: n, value: f(byV[n]) })).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
    const dispSeg = sortDesc(dispSegVal);
    const conv = sortDesc(convCount);
    // Carrera "Cuenta Kilómetros": TODOS los vendedores, incluido quien lleva 0 (p.ej. Gabriel)
    const convAll = names.map(n => ({ name: n, value: convCount(byV[n]) })).sort((a, b) => (b.value - a.value) || a.name.localeCompare(b.name));
    const pulpo = sortDesc(pulpoCount);
    const madruga = names.map(n => ({ name: n, value: firstMin(byV[n]) })).filter(x => x.value != null).sort((a, b) => (a.value as number) - (b.value as number));
    return { dispSeg, conv, convAll, pulpo, madruga };
  })();
  const fotoSrc = (n: string) => `/${n}.jpg`;
  const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  const eur = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const fotoErr = (e: any, name: string) => {
    const img = e.currentTarget;
    if (!img.dataset.triedJpeg) { img.dataset.triedJpeg = '1'; img.src = `/${name}.jpeg`; return; }
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) parent.innerHTML = `<span style="color:#fff; font-size:13px; font-weight:900">${name.charAt(0).toUpperCase()}</span>`;
  };

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
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(14, 165, 233, 0.14) 100%)',
            borderRadius: 12, padding: '16px', border: '1px solid rgba(14, 165, 233, 0.3)',
            display: 'flex', flexDirection: 'column', height: '100%', gap: '14px', cursor: 'pointer',
            transition: 'all 0.3s ease', boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ backgroundColor: '#0ea5e9', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trophy size={20} color="#fff" />
            </div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0ea5e9' }}>
              Torneos de Ventas <span style={{ color: 'var(--text-main)' }}>· Ranking</span>
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              { titulo: 'Dispositivos + Seguros', data: ranking.dispSeg, fmt: (v: number) => eur(v) },
              { titulo: 'Alta BAF Convergente', data: ranking.conv, fmt: (v: number) => String(v) },
            ].map((col, ci) => (
              <div key={ci}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, textAlign: 'center', borderBottom: '2px solid rgba(14,165,233,0.2)', paddingBottom: 6 }}>{col.titulo}</div>
                {col.data.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 6px', borderRadius: 8, background: i === 0 ? 'rgba(245,158,11,0.12)' : 'transparent', marginBottom: 3 }}>
                    {['🥇', '🥈', '🥉'][i]
                      ? <span style={{ fontSize: 14, width: 18, textAlign: 'center', display: 'inline-block' }}>{['🥇', '🥈', '🥉'][i]}</span>
                      : <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', width: 18, textAlign: 'center', display: 'inline-block' }}>{i + 1}º</span>}
                    <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img src={fotoSrc(r.name)} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => fotoErr(e, r.name)} />
                    </div>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0ea5e9', whiteSpace: 'nowrap' }}>{col.fmt(r.value)}</span>
                  </div>
                ))}
                {col.data.length === 0 && <div style={{ fontSize: 12, color: 'var(--medium-gray)', textAlign: 'center', padding: 8 }}>Sin datos</div>}
              </div>
            ))}
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
                      const img = e.currentTarget;
                      if (img.src.endsWith('.jpg')) {
                        img.src = img.src.replace('.jpg', '.jpeg');
                      } else {
                        img.style.display = 'none';
                        const parent = img.parentElement;
                        if (parent) {
                          parent.innerHTML = `<span style="color:#fff; font-size:16px; font-weight:900">${mvp.mvp.name.charAt(0).toUpperCase()}</span>`;
                        }
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
                      {mvp.mvp.pendingCount > 0 && (
                        <span style={{ fontSize: '11px', color: '#d97706', marginLeft: '6px', fontWeight: 700, backgroundColor: 'rgba(217, 119, 6, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                          ({mvp.mvp.pendingCount} pendientes)
                        </span>
                      )}
                    </>
                  ) : (
                    <span>Esperando ventas...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Nominado 1: Ventas miMovistar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-body)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
              <div style={{ 
                width: 36, height: 36, borderRadius: '50%', 
                boxShadow: '0 2px 6px rgba(14, 165, 233, 0.2)', 
                border: '2px solid #0ea5e9',
                overflow: 'hidden', flexShrink: 0,
                background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {mvp.nominadoMiMovistar.name !== 'Nadie' ? (
                  <img 
                    src={`/${mvp.nominadoMiMovistar.name}.jpg`} 
                    alt={mvp.nominadoMiMovistar.name} 
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src.endsWith('.jpg')) {
                        img.src = img.src.replace('.jpg', '.jpeg');
                      } else {
                        img.style.display = 'none';
                        const parent = img.parentElement;
                        if (parent) {
                          parent.innerHTML = `<span style="color:#fff; font-size:14px; font-weight:900">${mvp.nominadoMiMovistar.name.charAt(0).toUpperCase()}</span>`;
                        }
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
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>{mvp.nominadoMiMovistar.name}</h4>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#0ea5e9', background: 'rgba(14, 165, 233, 0.1)', padding: '2px 6px', borderRadius: '8px' }}>Ventas miMovistar</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--medium-gray)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9' }}></span>
                  {mvp.nominadoMiMovistar.name !== 'Nadie' ? (
                    <>
                      Destacado con <strong style={{ color: 'var(--text-main)' }}>{mvp.nominadoMiMovistar.total} Ventas miMovistar</strong>
                      {mvp.nominadoMiMovistar.pendingCount > 0 && (
                        <span style={{ fontSize: '11px', color: '#d97706', marginLeft: '6px', fontWeight: 700, backgroundColor: 'rgba(217, 119, 6, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                          ({mvp.nominadoMiMovistar.pendingCount} pendientes)
                        </span>
                      )}
                    </>
                  ) : (
                    <span>Esperando ventas...</span>
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
                      const img = e.currentTarget;
                      if (img.src.endsWith('.jpg')) {
                        img.src = img.src.replace('.jpg', '.jpeg');
                      } else {
                        img.style.display = 'none';
                        const parent = img.parentElement;
                        if (parent) {
                          parent.innerHTML = `<span style="color:#fff; font-size:14px; font-weight:900">${mvp.nominadoDispSeg.name.charAt(0).toUpperCase()}</span>`;
                        }
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
                      {mvp.nominadoDispSeg.pendingCount > 0 && (
                        <span style={{ fontSize: '11px', color: '#d97706', marginLeft: '6px', fontWeight: 700, backgroundColor: 'rgba(217, 119, 6, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                          ({mvp.nominadoDispSeg.pendingCount} pendientes)
                        </span>
                      )}
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
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--medium-gray)', fontWeight: 500 }}>Seguimiento en vivo de los 7 KPIs críticos para llegar al objetivo del mes.</p>
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

          {/* 3. Swap */}
          <div style={{ background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Repeat size={18} color="#14b8a6" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Swap</span>
              </div>
              {kpiSwap.faltan > 0 ? (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  Faltan {kpiSwap.faltan}
                </span>
              ) : (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  ¡Logrado!
                </span>
              )}
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${kpiSwap.progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #2dd4bf, #0d9488)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>{kpiSwap.llevamos}</strong></span>
              <span>Objetivo: {kpiSwap.target}</span>
            </div>
          </div>

          {/* Dispositivos + Seguros: la más importante → fila completa arriba (order -1) */}
          <div style={{ background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-light)', gridColumn: '1 / -1', order: -1 }}>
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
                Carrera hacia Alta BAF Convergente
              </p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center', alignContent: 'center', justifyContent: 'center' }}>
            {(ranking.convAll.length === 0 || ranking.convAll[0].value === 0) ? (
              <p style={{ margin: 'auto', fontSize: 14, color: 'var(--medium-gray)', textAlign: 'center' }}>Aún no hay altas convergentes este mes.</p>
            ) : ranking.convAll.map((r, i) => {
              const lider = ranking.convAll[0].value;
              const faltan = lider - r.value;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 78 }}>
                  <div style={{ position: 'relative', width: 50, height: 50, flexShrink: 0 }}>
                    <div style={{ width: 50, height: 50, borderRadius: '50%', overflow: 'hidden', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', border: i === 0 ? '2px solid #f59e0b' : '2px solid transparent' }}>
                      <img src={fotoSrc(r.name)} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => fotoErr(e, r.name)} />
                    </div>
                    {i === 0 && <span style={{ position: 'absolute', top: -7, right: -5, fontSize: 15 }}>🏆</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', maxWidth: 78, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{r.value}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{i === 0 ? 'Líder' : (faltan > 0 ? `faltan ${faltan}` : 'empatado')}</span>
                  <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${lider > 0 ? (r.value / lider) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)', borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
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
            {[
              { titulo: 'Rey de Dispositivos', sub: 'Líder en Dispositivos', holder: ranking.dispSeg[0], second: ranking.dispSeg[1], valor: (v: number) => eur(v), grad: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)', col: '#d97706', ring: 'rgba(245, 158, 11, 0.25)' },
              { titulo: 'El Pulpo', sub: 'Más multi-paquete', holder: ranking.pulpo[0], second: ranking.pulpo[1], valor: (v: number) => `${v} ops`, grad: 'linear-gradient(135deg, #fca5a5 0%, #ef4444 100%)', col: '#b91c1c', ring: 'rgba(239, 68, 68, 0.25)' },
              { titulo: 'Madrugador', sub: '1ª venta más temprana', holder: ranking.madruga[0], second: ranking.madruga[1], valor: (v: number) => hhmm(v), grad: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)', col: '#1d4ed8', ring: 'rgba(59, 130, 246, 0.25)' },
            ].map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: `1px solid ${m.ring}` }}>
                <div style={{ position: 'relative', width: 48, height: 48 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', background: m.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${m.ring}` }}>
                    {m.holder
                      ? <img src={fotoSrc(m.holder.name)} alt={m.holder.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => fotoErr(e, m.holder!.name)} />
                      : <Award size={22} color="#fff" />}
                  </div>
                  {m.holder && <span style={{ position: 'absolute', top: -6, right: -6, fontSize: 14 }}>🥇</span>}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: m.col, marginBottom: 2 }}>{m.titulo}</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>{m.holder ? m.holder.name : '—'}</div>
                  <div style={{ fontSize: '10px', color: 'var(--medium-gray)' }}>{m.holder ? m.valor(m.holder.value as number) : m.sub}</div>
                </div>
                {m.second && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-light)', width: '100%', justifyContent: 'center' }}>
                    <span style={{ fontSize: 11 }}>🥈</span>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', background: m.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img src={fotoSrc(m.second.name)} alt={m.second.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => fotoErr(e, m.second!.name)} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 52 }}>{m.second.name}</span>
                    <span style={{ fontSize: 9.5, color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{m.valor(m.second.value as number)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>



      </div>

    </div>
  )
}
