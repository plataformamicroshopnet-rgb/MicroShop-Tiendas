'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, Flame, Target, Award, Zap, Crown, Wifi, Smartphone, Shield, TrendingUp, Tv, Layers, Repeat, X } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { usePeriod } from '@/components/PeriodProvider'
import { isSaleActive, isSolar360, renderDashboardData } from '@/lib/salesUtils'
import { getSaleCommission } from '@/lib/saleCommission'
import { getEffectiveTiendaComerciales } from '@/lib/comercialRoster'
import { can } from '@/lib/permissions'
import { loadTorneosConfig, DEFAULT_TORNEOS_CONFIG, concursoSaleValue, TorneosConfig } from '@/lib/torneosConfig'
import {
  loadDashboardConfig,
  DEFAULT_DASHBOARD_CONFIG,
  DashboardConfig,
  DashBloqueTipos,
  DashKpi,
  DashMedalla,
  DashMetrica,
  TIPO_AUTO,
  OBJETIVO_FALLBACKS,
  bloqueMatches,
  bloqueSaleValue,
  fmtValor,
} from '@/lib/dashboardConfig'

// Avatar con fallback gestionado por React (jpg → jpeg → inicial). El patrón anterior
// (onError + innerHTML) mutaba el DOM por fuera de React: con el polling de 8 s y un
// ranking que se reordena podía dejar la inicial de otra persona en el hueco equivocado.
// En Tiendas las fotos viven en la RAÍZ de /public como /{Nombre}.jpg o /{Nombre}.jpeg,
// respetando la capitalización del nombre del vendedor.
function FotoAvatar({ name, fontSize = 13 }: { name: string; fontSize?: number }) {
  const [stage, setStage] = useState(0) // 0 = .jpg, 1 = .jpeg, 2 = inicial
  useEffect(() => { setStage(0) }, [name])
  if (stage >= 2) {
    return <span style={{ color: '#fff', fontSize, fontWeight: 900 }}>{String(name || '?').charAt(0).toUpperCase()}</span>
  }
  const ext = stage === 0 ? 'jpg' : 'jpeg'
  return (
    <img
      src={`/${name}.${ext}`}
      alt={name}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      onError={() => setStage(s => s + 1)}
    />
  )
}

// Iconos y colores del Termómetro Diario: rotan por índice de la lista de KPIs del config.
// El orden reproduce la estética histórica (Disp+Seg ámbar, BAF Total azul cielo, BAF
// Convergente violeta, Swap teal, FTTR rosa, ARPU verde, Repo Fútbol azul).
const KPI_ICONS = [Smartphone, Wifi, Layers, Repeat, Zap, TrendingUp, Tv, Shield]
const KPI_COLORS = [
  { color: '#f59e0b', grad: 'linear-gradient(90deg, #fbbf24, #d97706)', faltanCol: '#ef4444', faltanBg: 'rgba(239, 68, 68, 0.1)' },
  { color: '#0ea5e9', grad: 'linear-gradient(90deg, #38bdf8, #0284c7)', faltanCol: '#ef4444', faltanBg: 'rgba(239, 68, 68, 0.1)' },
  { color: '#8b5cf6', grad: 'linear-gradient(90deg, #8b5cf6, #7c3aed)', faltanCol: '#ef4444', faltanBg: 'rgba(239, 68, 68, 0.1)' },
  { color: '#14b8a6', grad: 'linear-gradient(90deg, #2dd4bf, #0d9488)', faltanCol: '#ef4444', faltanBg: 'rgba(239, 68, 68, 0.1)' },
  { color: '#ec4899', grad: 'linear-gradient(90deg, #f472b6, #db2777)', faltanCol: '#ef4444', faltanBg: 'rgba(239, 68, 68, 0.1)' },
  // El 6º hueco (ARPU histórico) conserva su badge "Faltan" en ámbar, como siempre tuvo.
  { color: '#10b981', grad: 'linear-gradient(90deg, #34d399, #059669)', faltanCol: '#f59e0b', faltanBg: 'rgba(245, 158, 11, 0.1)' },
  { color: '#3b82f6', grad: 'linear-gradient(90deg, #60a5fa, #2563eb)', faltanCol: '#ef4444', faltanBg: 'rgba(239, 68, 68, 0.1)' },
  { color: '#ef4444', grad: 'linear-gradient(90deg, #f87171, #dc2626)', faltanCol: '#ef4444', faltanBg: 'rgba(239, 68, 68, 0.1)' },
]

// Estilos oro/rojo/teal de la vitrina (rotan por índice, mismos 3 de siempre)
const MEDAL_STYLES = [
  { grad: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)', col: '#d97706', ring: 'rgba(245, 158, 11, 0.25)' },
  { grad: 'linear-gradient(135deg, #fca5a5 0%, #ef4444 100%)', col: '#b91c1c', ring: 'rgba(239, 68, 68, 0.25)' },
  { grad: 'linear-gradient(135deg, #5eead4 0%, #14b8a6 100%)', col: '#0d9488', ring: 'rgba(20, 184, 166, 0.25)' },
]
// Subtítulos históricos de las 3 medallas por defecto (solo se ven si nadie tiene la medalla)
const MEDAL_SUBS: Record<string, string> = {
  m1: 'Líder en Dispositivos',
  m2: 'Más multi-paquete',
  m3: 'Mejor vendedor de Swap del mes',
}

// Base del motor de comisiones (solo se carga si algún bloque usa la métrica 'comisiones')
type ComisionesBase = {
  periodKey: string
  importesPyme: any[]
  importesPlus: any[]
  objetivos: any
  grupos: any
}

export default function DashboardPage() {
  const { activePeriodKey, availablePeriods } = usePeriod()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [allSales, setAllSales] = useState<any[]>([])
  const [tiendaRules, setTiendaRules] = useState<any[]>([])
  const [tiendaHours, setTiendaHours] = useState<any[]>([])
  const [torneosConfig, setTorneosConfig] = useState<TorneosConfig>(DEFAULT_TORNEOS_CONFIG)
  const [cfg, setCfg] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG)
  const [catalogs, setCatalogs] = useState<Record<string, any[]>>({})
  const [comisionesBase, setComisionesBase] = useState<ComisionesBase | null>(null)
  // Detalle de un KPI del Termómetro: las operaciones que suman en él,
  // SIN ninguna columna de comisión de empresa.
  const [kpiModal, setKpiModal] = useState<{ kpi: DashKpi; ops: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fmt = (num: number) => {
    return num.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  };

  const fetchData = async (isInitial: boolean) => {
    if (!activePeriodKey) return;
    if (isInitial) setLoading(true);

    try {
      const [userRes, salesRes, tiendasRes, catalogsRes, torneosCfg, dashCfg] = await Promise.all([
        fetch('/api/auth/me').then(res => res.json()).catch(() => null),
        fetch(`/api/sales?periodKey=${activePeriodKey}&dashboard=true`).then(res => res.json()).catch(() => ({ success: false, logs: [] })),
        fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({ success: false, rules: [] })),
        fetch('/api/catalogs').then(res => res.json()).catch(() => ({ success: false, catalogs: {} })),
        loadTorneosConfig().catch(() => DEFAULT_TORNEOS_CONFIG),
        loadDashboardConfig().catch(() => DEFAULT_DASHBOARD_CONFIG)
      ]);

      if (userRes) {
        setCurrentUser(userRes.user ? userRes.user : userRes);
      }
      if (catalogsRes && catalogsRes.success) {
        setCatalogs(catalogsRes.catalogs || {});
      }
      if (torneosCfg) {
        setTorneosConfig(torneosCfg);
      }
      if (dashCfg) {
        setCfg(dashCfg);
      }
      if (salesRes && salesRes.success && salesRes.logs) {
        setAllSales(salesRes.logs);
      }
      if (tiendasRes && tiendasRes.success) {
        setTiendaRules(tiendasRes.rules || []);
        setTiendaHours(tiendasRes.hours || []);
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

  // ── Permisos: mismo criterio que el botón Configurar de Torneos ──
  const canConfig = can(currentUser, 'CARD_CONFIG_TORNEOS');

  // ── ¿Algún bloque o concurso usa la métrica 'comisiones'? Solo entonces se carga la base ──
  const usaComisiones =
    [cfg.mvpPrincipal, cfg.mvpNominado1, cfg.mvpNominado2, ...cfg.kpis, cfg.carrera, ...cfg.medallas]
      .some(b => b.metrica === 'comisiones')
    || torneosConfig.concursos.some(c => c.metrica === 'comisiones');

  // Base de comisiones: una vez por periodo (NO en cada poll de 8 s); el mapa se
  // recalcula en local cuando cambian las ventas, que es barato.
  useEffect(() => {
    if (!usaComisiones || !activePeriodKey) return;
    let cancelado = false;
    (async () => {
      try {
        const [pymeRes, plusRes, objRes] = await Promise.all([
          fetch(`/api/importes-pyme?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/importes-plus?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/objetivos?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
        ]);
        const pymeData = pymeRes && pymeRes.ok ? await pymeRes.json() : {};
        const plusData = plusRes && plusRes.ok ? await plusRes.json() : {};
        const objData = objRes && objRes.ok ? await objRes.json() : {};
        if (cancelado) return;
        setComisionesBase({
          periodKey: activePeriodKey,
          importesPyme: pymeData.importes || pymeData.data || [],
          importesPlus: plusData.importes || plusData.data || [],
          objetivos: objData.objetivos || { Pyme: {}, Captador: {} },
          grupos: objData.grupos || { Pyme: {}, Captador: {} },
        });
      } catch (err) {
        console.error('Error cargando la base de comisiones del dashboard:', err);
      }
    })();
    return () => { cancelado = true };
  }, [usaComisiones, activePeriodKey]);

  const activePeriodObj = availablePeriods.find(p => p.period_key === activePeriodKey);

  // ── Mapa vendedor → € de comisión del periodo (receta EXACTA de Rentabilidad por Tienda:
  //    renderDashboardData de ambos perfiles + getSaleCommission por venta activa no-Solar360
  //    del periodo visualizado). Marta queda fuera, como en el resto del dashboard. ──
  const comisionesMap = useMemo<Record<string, number> | null>(() => {
    if (!usaComisiones || !comisionesBase || comisionesBase.periodKey !== activePeriodKey) return null;

    const getCurrentMonthString = () => {
      const now = new Date();
      return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    };
    const viewingPeriod = activePeriodObj
      ? `${activePeriodObj.year}${String(activePeriodObj.month).padStart(2, '0')}`
      : getCurrentMonthString();

    const objetivosObj = comisionesBase.objetivos || { Pyme: {}, Captador: {} };
    const objGruposObj = comisionesBase.grupos || { Pyme: {}, Captador: {} };
    const pymeRows = renderDashboardData('Pyme', comisionesBase.importesPyme, objetivosObj.Pyme || {}, allSales, objGruposObj.Pyme || {}, activePeriodObj).rows;
    const captadorRows = renderDashboardData('Captador', comisionesBase.importesPlus, objetivosObj.Captador || {}, allSales, objGruposObj.Captador || {}, activePeriodObj).rows;

    const map: Record<string, number> = {};
    allSales.forEach(sale => {
      // Anuladas fuera (no comisionan), igual que la MOD y Rentabilidad por Tienda.
      if (sale.anulado === 'Si' || sale.anulado === 'Sí' || sale.pendiente === 'Anulado') return;
      // Solar360 fuera por completo (ni cuenta como operación ni paga).
      if (isSolar360(sale)) return;
      // Solo el periodo visualizado (filtro defensivo, como en Rentabilidad).
      let saleMonth = '';
      if (sale.fecha) {
        const parts = String(sale.fecha).split('/');
        if (parts.length === 3) saleMonth = `${parts[2]}${parts[1]}`;
        else if (String(sale.fecha).includes('-')) {
          const p = String(sale.fecha).split('-');
          if (p.length >= 2) saleMonth = `${p[0]}${p[1]}`;
        }
      }
      if (saleMonth && saleMonth !== viewingPeriod) return;

      const v = String(sale.vendedor || '').trim();
      if (!v || v.toLowerCase().includes('marta')) return;

      const comisionReal = getSaleCommission(sale, {
        catalogs,
        dashRowsPlus: pymeRows,
        dashRowsBasico: captadorRows,
        viewingPeriod
      });
      map[v] = (map[v] || 0) + comisionReal;
    });
    return map;
  }, [usaComisiones, comisionesBase, allSales, catalogs, activePeriodKey, activePeriodObj]);

  // ── Mecánica de bloques (la de siempre, ahora parametrizada por el config) ──

  // Ventas del equipo (sin Marta) y ventas activas: mismos filtros que el dashboard histórico.
  const teamSales = allSales.filter(s => !String(s.vendedor || '').toLowerCase().includes('marta') && isSaleActive(s));
  const ventasActivas = allSales.filter(s => isSaleActive(s));

  const vendedorDe = (s: any) => String(s?.vendedor || '').trim();
  const isPendiente = (s: any) =>
    String(s?.pendiente || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === 'si';

  // Venta virtual del seguro embebido: EXACTAMENTE la de siempre (una venta con
  // seguroImporte > 0 que no es de la hoja Seguro genera una "venta" extra de seguro).
  const esVirtualizable = (s: any) =>
    s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet).toLowerCase() !== 'seguro';
  const ventaVirtualSeguro = (s: any) => ({ ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) });

  // Bloque con tipoVenta 'Swap' exacto: cuenta por la casilla ¿Swap? y SIN venta virtual
  // (una venta Swap que además lleve seguro se duplicaría), como el kpiSwap de siempre.
  const esBloqueSwap = (b: DashBloqueTipos) => String(b.tipoVenta || '').trim().toLowerCase() === 'swap';

  // El KPI histórico de ARPU se calculaba con el nombre de regla 'ARPU', que en matchesRule/
  // getValueForRule activa su ruta especial (suma Suscripciones TV y Extra Repo Fútbol).
  // El config lo muestra como 'ARPU Acumulado': para no perder ese cálculo, cuando el
  // tipoVenta es exactamente 'ARPU' el cálculo usa 'ARPU' como nombre de regla.
  const bloqueCalc = (b0: DashBloqueTipos): DashBloqueTipos => {
    let b = b0;
    // AUTOMÁTICO: el bloque sigue a la regla del mes homónima — sus tipos de venta
    // (productosCuentan) mandan, como hacía la home de siempre. Sin regla ese mes,
    // el token de respaldo es el nombre del KPI ('ARPU' para el ARPU, que activa
    // su ruta especial).
    if (String(b.tipoVenta || '').trim() === TIPO_AUTO) {
      const rule = ruleFor(b.nombre);
      const esArpu = String(b.nombre || '').trim().toLowerCase().startsWith('arpu');
      const respaldo = esArpu ? 'ARPU' : b.nombre;
      b = { ...b, tipoVenta: (rule && rule.productosCuentan) ? String(rule.productosCuentan) : respaldo };
    }
    return String(b.tipoVenta || '').trim().toLowerCase() === 'arpu' && String(b.nombre || '').trim().toLowerCase() !== 'arpu'
      ? { ...b, nombre: 'ARPU' }
      : b;
  };

  /** Aportación de UNA venta a un bloque: matching bloqueMatches + valor bloqueSaleValue,
   *  con la venta virtual del seguro embebido (salvo en bloques Swap). */
  const valorVentaBloque = (s: any, b0: DashBloqueTipos): number => {
    if (b0.metrica === 'comisiones' || b0.metrica === 'clientesMulti') return 0;
    const b = bloqueCalc(b0);
    let total = bloqueSaleValue(s, b);
    if (!esBloqueSwap(b) && esVirtualizable(s)) {
      total += bloqueSaleValue(ventaVirtualSeguro(s), b);
    }
    return total;
  };

  /** ¿La venta (real o su seguro virtual) casa con el bloque? Para el badge de pendientes. */
  const matchBloqueConVirtual = (s: any, b0: DashBloqueTipos): boolean => {
    const b = bloqueCalc(b0);
    if (bloqueMatches(s, b)) return true;
    if (esBloqueSwap(b)) return false;
    return esVirtualizable(s) && bloqueMatches(ventaVirtualSeguro(s), b);
  };

  /** Métrica 'clientesMulti': nº de NIFs no vacíos con ≥2 ventas activas que casen con el
   *  bloque (El Pulpo de siempre; con tipoVenta vacío cuentan todas las ventas). */
  const clientesMultiNifs = (lista: any[], b0: DashBloqueTipos): number => {
    const b = bloqueCalc(b0);
    const nifs: Record<string, number> = {};
    lista.forEach(s => {
      if (!bloqueMatches(s, b)) return;
      const n = String(s.nif || '').trim().toUpperCase();
      if (n) nifs[n] = (nifs[n] || 0) + 1;
    });
    return Object.values(nifs).filter(c => c >= 2).length;
  };

  /** Total de un bloque sobre una lista de ventas (cualquier métrica). */
  const totalBloque = (lista: any[], b: DashBloqueTipos): number => {
    if (b.metrica === 'comisiones') return Object.values(comisionesMap || {}).reduce((a, v) => a + v, 0);
    if (b.metrica === 'clientesMulti') return clientesMultiNifs(lista, b);
    return lista.reduce((acc, s) => acc + valorVentaBloque(s, b), 0);
  };

  /** Totales por vendedor para un bloque (Marta fuera, como en todo el dashboard). */
  const totalesPorVendedor = (lista: any[], b: DashBloqueTipos): Record<string, number> => {
    // Comisiones: el total del periodo de cada comercial según el motor de comisiones.
    if (b.metrica === 'comisiones') return { ...(comisionesMap || {}) };
    const byV: Record<string, any[]> = {};
    lista.forEach(s => {
      const v = vendedorDe(s);
      if (!v || v.toLowerCase().includes('marta')) return;
      (byV[v] = byV[v] || []).push(s);
    });
    const out: Record<string, number> = {};
    Object.entries(byV).forEach(([v, ops]) => {
      out[v] = b.metrica === 'clientesMulti' ? clientesMultiNifs(ops, b) : ops.reduce((acc, s) => acc + valorVentaBloque(s, b), 0);
    });
    return out;
  };

  /** Tooltip humano de qué ventas cuentan en un bloque. */
  const descBloque = (b: DashBloqueTipos): string => {
    if (b.metrica === 'comisiones') return 'Comisiones del comercial (total del periodo, mismo cálculo que Rentabilidad por Tienda)';
    if (String(b.tipoVenta || '').trim() === TIPO_AUTO) {
      const rule = ruleFor(b.nombre);
      return rule && rule.productosCuentan
        ? `Automático (regla del mes): ${String(rule.productosCuentan)}`
        : 'Automático (regla del mes)';
    }
    const tipos = String(b.tipoVenta || '').split(',').map(t => t.trim()).filter(Boolean);
    return tipos.length > 0 ? tipos.join(' · ') : 'Todas las ventas activas';
  };

  // ── Cómputo del Termómetro Diario (KPIs del config) ──
  const ruleFor = (nombre: string) =>
    tiendaRules.find(r => String(r.nombre || '').toLowerCase().trim() === String(nombre || '').toLowerCase().trim());

  const kpiData = cfg.kpis.map(k => {
    const llevamos = totalBloque(teamSales, k);
    // Objetivo del config; 0 = automático → objPrimerTramo de la regla del mes con
    // este nombre y, si el mes no tiene regla, el respaldo histórico del KPI (los
    // números que la home traía a fuego) — nunca un 1 espurio.
    const rule = ruleFor(k.nombre);
    const target = k.objetivo > 0
      ? k.objetivo
      : ((rule && rule.objPrimerTramo ? Number(rule.objPrimerTramo) : 0) || OBJETIVO_FALLBACKS[k.nombre] || 1);
    const faltan = Math.max(0, target - llevamos);
    const progressPct = target > 0 ? Math.min(100, (llevamos / target) * 100) : 0;
    return { kpi: k, llevamos, target, faltan, progressPct };
  });

  // Detalle al pulsar una tarjeta del Termómetro: las operaciones que suman en
  // ese KPI (fecha, comercial, producto, cliente…), SIN comisiones de empresa.
  const pFechaNum = (f: any) => {
    const p = String(f || '').split('/');
    return p.length === 3 ? Number(p[2]) * 10000 + Number(p[1]) * 100 + Number(p[0]) : 0;
  };
  const abrirKpi = (k: DashKpi) => {
    if (k.metrica === 'comisiones') return; // esa métrica ES la comisión: sin detalle
    const esSwap = esBloqueSwap(bloqueCalc(k));
    const filtro: DashBloqueTipos = k.metrica === 'clientesMulti' ? { ...k, metrica: 'count' } : k;
    const ops = teamSales
      .filter(s => esSwap ? s.isSwap === true : matchBloqueConVirtual(s, filtro))
      .sort((a, b) => pFechaNum(b.fecha) - pFechaNum(a.fecha));
    setKpiModal({ kpi: k, ops });
  };

  const kpiFmt = (v: number, metrica: DashMetrica) =>
    (metrica === 'importe' || metrica === 'comisiones') ? fmt(v) : String(Math.round(v));

  // ── Cómputo del MVP y Nominados (parametrizado; ámbito MES u HOY con relevo por apartado) ──
  const mvpInfo = (() => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const todayStr = `${d}/${m}/${y}`;

    const deHoy = ventasActivas.filter(s => String(s.fecha || '').trim() === todayStr);

    const intento = (lista: any[], b: DashBloqueTipos, excluidos: string[]) => {
      const totals = totalesPorVendedor(lista, b);
      const nombres = Object.keys(totals).filter(n => totals[n] > 0);
      // Evita repetir a los ya destacados SOLO si hay alternativa con puntos (como siempre)
      const hayAlternativa = nombres.some(n => !excluidos.includes(n));
      let name = 'Nadie';
      let total = 0;
      nombres.forEach(n => {
        if (hayAlternativa && excluidos.includes(n)) return;
        if (totals[n] > total) {
          total = totals[n];
          name = n;
        }
      });
      const pendingCount = name === 'Nadie'
        ? 0
        : lista.filter(s => vendedorDe(s) === name && matchBloqueConVirtual(s, b) && isPendiente(s)).length;
      return { name, total, pendingCount };
    };

    const calc = (b: DashBloqueTipos, excluidos: string[]) => {
      // Ámbito MES (por defecto): líderes del mes completo, coherente con la etiqueta.
      // Ámbito HOY: líderes del día con relevo al mes POR APARTADO (si hoy nadie puntúa
      // en un apartado, ese apartado enseña al líder del mes en vez de quedarse vacío).
      if (cfg.mvpAmbito === 'HOY') {
        const hoy = intento(deHoy, b, excluidos);
        if (hoy.name !== 'Nadie') return { ...hoy, esHoy: true };
      }
      return { ...intento(ventasActivas, b, excluidos), esHoy: false };
    };

    const principal = calc(cfg.mvpPrincipal, []);
    const nom1 = calc(cfg.mvpNominado1, principal.name !== 'Nadie' ? [principal.name] : []);
    const nom2 = calc(cfg.mvpNominado2, [principal.name, nom1.name].filter(n => n !== 'Nadie'));
    const todosHoy = [principal, nom1, nom2].every(r => r.name === 'Nadie' || r.esHoy);
    const ningunoHoy = [principal, nom1, nom2].every(r => r.name === 'Nadie' || !r.esHoy);
    return { principal, nom1, nom2, todosHoy, ningunoHoy };
  })();

  // Texto del valor en el bloque MVP: € como siempre; nº como "3 Ventas miMovistar".
  const valorMvp = (v: number, b: DashBloqueTipos): string => {
    if (b.metrica === 'importe' || b.metrica === 'comisiones') return fmt(v);
    if (b.metrica === 'clientesMulti') return `${Math.round(v)} clientes`;
    return `${Math.round(v)} ${b.nombre}`;
  };

  const mvpRows = [
    { b: cfg.mvpPrincipal, res: mvpInfo.principal, principal: true, color: '#ec4899', border: 'rgba(236, 72, 153, 0.3)', grad: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)', Icon: Crown, label: `${cfg.mvpPrincipal.nombre} (MVP)`, dot: '#10b981', lead: 'Liderando con' },
    { b: cfg.mvpNominado1, res: mvpInfo.nom1, principal: false, color: '#0ea5e9', border: 'rgba(14, 165, 233, 0.2)', grad: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)', Icon: Wifi, label: cfg.mvpNominado1.nombre, dot: '#0ea5e9', lead: 'Destacado con' },
    { b: cfg.mvpNominado2, res: mvpInfo.nom2, principal: false, color: '#f59e0b', border: 'rgba(245, 158, 11, 0.2)', grad: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)', Icon: Smartphone, label: cfg.mvpNominado2.nombre, dot: '#f59e0b', lead: 'Destacado con' },
  ];

  // ── Cuenta Kilómetros (bloque carrera del config): mismo roster de siempre, es decir,
  //    TODOS los vendedores con alguna venta activa este mes, incluido quien lleva 0. ──
  const carreraData = (() => {
    const totals = totalesPorVendedor(ventasActivas, cfg.carrera);
    // Con métrica 'comisiones' el mapa solo trae a quien comisiona: se completa el roster.
    ventasActivas.forEach(s => {
      const v = vendedorDe(s);
      if (!v || v.toLowerCase().includes('marta')) return;
      if (!(v in totals)) totals[v] = 0;
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => (b.value - a.value) || a.name.localeCompare(b.name));
  })();

  // ── Vitrina de Medallas (config): oro y plata como siempre ──
  const medallasData = cfg.medallas.map(m => {
    const totals = totalesPorVendedor(ventasActivas, m);
    const sorted = Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .filter(x => x.value > 0)
      .sort((a, b) => b.value - a.value);
    return { medalla: m, oro: sorted[0] || null, plata: sorted[1] || null };
  });

  const valorMedalla = (v: number, m: DashMedalla): string => {
    if (m.metrica === 'importe' || m.metrica === 'comisiones') return eur(v);
    if (m.metrica === 'clientesMulti') return `${Math.round(v)} ops`;
    return esBloqueSwap(m) ? `${Math.round(v)} swaps` : String(Math.round(v));
  };

  // ── Torneos config-driven (mismo motor que la pantalla de Torneos + métrica 'comisiones') ──
  const eurFmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const torneoColumns = (() => {
    return torneosConfig.concursos.map(c => {
      const isCurrency = c.metrica === 'importe' || c.metrica === 'comisiones';
      let entries: { name: string, value: number }[];
      if (c.metrica === 'comisiones') {
        // Totales por comercial del mapa de comisiones (mismo cálculo que Rentabilidad).
        entries = Object.entries(comisionesMap || {}).map(([name, value]) => ({ name, value }));
      } else {
        const byV: Record<string, number> = {};
        ventasActivas.forEach(s => {
          const v = String(s.vendedor || '').trim();
          if (!v || v.toLowerCase() === 'marta') return;
          byV[v] = (byV[v] || 0) + concursoSaleValue(s, c, catalogs);
        });
        entries = Object.entries(byV).map(([name, value]) => ({ name, value }));
      }
      const data = entries
        .filter(x => x.value > 0)
        .sort((a, b) => b.value - a.value);
      return { concurso: c, isCurrency, data, fmt: (v: number) => isCurrency ? eurFmt(v) : String(v) };
    });
  })();

  const eur = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  // ── Reto motivador del PRIMER KPI: lo que falta repartido entre comerciales y días laborables ──
  const nComercialesTiendas = Object.entries(getEffectiveTiendaComerciales(tiendaHours))
    .filter(([k]) => k !== 'O2')
    .reduce((acc, [, v]) => acc + (v as string[]).length, 0);
  const diasLaborablesRestantes = (() => {
    if (!activePeriodKey) return 0;
    const [yStr, mStr] = String(activePeriodKey).split(/[_-]/);
    const y = Number(yStr), m = Number(mStr); // m = 1..12
    if (!y || !m) return 0;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const finMes = new Date(y, m, 0);          // último día del mes
    const inicioMes = new Date(y, m - 1, 1);
    const cursor = new Date(Math.max(hoy.getTime(), inicioMes.getTime())); cursor.setHours(0, 0, 0, 0);
    if (cursor > finMes) return 0;             // mes ya cerrado: no hay reto diario que repartir
    let count = 0;
    for (const d = new Date(cursor); d <= finMes; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay();                   // 0=dom, 6=sáb
      if (wd !== 0 && wd !== 6) count++;
    }
    return count;
  })();
  const kpiPrincipal = kpiData[0];
  const retoDiarioEquipo = (kpiPrincipal && diasLaborablesRestantes > 0) ? kpiPrincipal.faltan / diasLaborablesRestantes : 0;
  const retoDiarioComercial = (diasLaborablesRestantes > 0 && nComercialesTiendas > 0) ? retoDiarioEquipo / nComercialesTiendas : 0;
  // El reto con métrica de nº necesita 1 decimal: redondear a entero mostraría "0/día"
  // en cuanto el ritmo baje de una venta diaria por persona.
  const fmtReto = (v: number, metrica: DashMetrica) =>
    (metrica === 'importe' || metrica === 'comisiones')
      ? fmt(v)
      : v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

  if (loading && allSales.length === 0) return <div style={{ padding: 20 }}>Cargando datos del Dashboard...</div>

  return (
    <div style={{ padding: 20 }}>
      <PageHeader
        title={<>Dashboard <span className="text-cyan">Tiempo Real</span></>}
        subtitle="Sincronizado directamente con las celdas del Excel central."
        showTheme={true}
        showBack={false}
        headerActions={canConfig ? (
          <button
            type="button"
            onClick={() => router.push('/config-dashboard')}
            title="Configurar los bloques del Dashboard"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--medium-gray)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--mercedes-cyan)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--medium-gray)'; e.currentTarget.style.borderColor = 'var(--border-color)' }}
          >
            ⚙ Configurar Dashboard
          </button>
        ) : undefined}
      />


      {/* FILA 1: TORNEOS Y VITRINA DE MEDALLAS */}
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

          {torneoColumns.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--medium-gray)', textAlign: 'center', padding: '20px 8px' }}>
              No hay torneos configurados.
            </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${torneoColumns.length}, 1fr)`, gap: '14px' }}>
            {torneoColumns.map((col) => (
              <div key={col.concurso.id}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, textAlign: 'center', borderBottom: '2px solid rgba(14,165,233,0.2)', paddingBottom: 6 }}>{col.concurso.nombre}</div>
                {col.data.slice(0, 5).map((r, i) => (
                  <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 6px', borderRadius: 8, background: i === 0 ? 'rgba(245,158,11,0.12)' : 'transparent', marginBottom: 3 }}>
                    {['🥇', '🥈', '🥉'][i]
                      ? <span style={{ fontSize: 14, width: 18, textAlign: 'center', display: 'inline-block' }}>{['🥇', '🥈', '🥉'][i]}</span>
                      : <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', width: 18, textAlign: 'center', display: 'inline-block' }}>{i + 1}º</span>}
                    <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FotoAvatar name={r.name} fontSize={13} />
                    </div>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0ea5e9', whiteSpace: 'nowrap' }}>{col.fmt(r.value)}</span>
                  </div>
                ))}
                {col.data.length === 0 && <div style={{ fontSize: 12, color: 'var(--medium-gray)', textAlign: 'center', padding: 8 }}>Sin datos</div>}
              </div>
            ))}
          </div>
          )}
        </div>
      </Link>
        {/* VITRINA DE LOGROS (Estilo PlayStation) */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          padding: '12px',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '10px', borderRadius: '12px' }}>
              <Award size={24} color="#8b5cf6" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>Tus Medallas y Logros</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--medium-gray)', fontWeight: 500 }}>Desbloqueos recientes esta semana</p>
            </div>
          </div>

          {medallasData.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--medium-gray)' }}>
              No hay medallas configuradas.
            </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${medallasData.length}, 1fr)`, gap: '12px', flex: 1 }}>
            {medallasData.map((m, i) => {
              const st = MEDAL_STYLES[i % MEDAL_STYLES.length];
              const sub = MEDAL_SUBS[m.medalla.id] || 'Sin datos aún';
              return (
                <div key={m.medalla.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: `1px solid ${st.ring}` }}>
                  <div style={{ position: 'relative', width: 48, height: 48 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', background: st.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${st.ring}` }}>
                      {m.oro
                        ? <FotoAvatar name={m.oro.name} fontSize={13} />
                        : <Award size={22} color="#fff" />}
                    </div>
                    {m.oro && <span style={{ position: 'absolute', top: -6, right: -6, fontSize: 14 }}>{m.medalla.emoji}</span>}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div title={descBloque(m.medalla)} style={{ fontSize: '12px', fontWeight: 800, color: st.col, marginBottom: 2 }}>{m.medalla.nombre}</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>{m.oro ? m.oro.name : '—'}</div>
                    <div style={{ fontSize: '10px', color: 'var(--medium-gray)' }}>{m.oro ? valorMedalla(m.oro.value, m.medalla) : sub}</div>
                  </div>
                  {m.plata && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-light)', width: '100%', justifyContent: 'center' }}>
                      <span style={{ fontSize: 11 }}>🥈</span>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', background: st.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FotoAvatar name={m.plata.name} fontSize={13} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 52 }}>{m.plata.name}</span>
                      <span style={{ fontSize: 9.5, color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{valorMedalla(m.plata.value, m.medalla)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
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
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--medium-gray)', fontWeight: 500 }}>Seguimiento en vivo de los {kpiData.length} KPIs críticos para llegar al objetivo del mes.</p>
          </div>
        </div>

        {kpiData.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--medium-gray)', textAlign: 'center', padding: '20px 8px' }}>
            No hay KPIs configurados.
          </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {kpiData.map((k, i) => {
            const Icono = KPI_ICONS[i % KPI_ICONS.length];
            const pal = KPI_COLORS[i % KPI_COLORS.length];
            const esPrincipal = i === 0; // el primer KPI del config ocupa la fila completa arriba
            return (
              <div
                key={k.kpi.id}
                onClick={() => abrirKpi(k.kpi)}
                title={k.kpi.metrica === 'comisiones' ? undefined : 'Ver las operaciones que cuentan en este KPI'}
                style={{ background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-light)', cursor: k.kpi.metrica === 'comisiones' ? 'default' : 'pointer', ...(esPrincipal ? { gridColumn: '1 / -1' as const, order: -1 } : {}) }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icono size={18} color={pal.color} />
                    <span title={descBloque(k.kpi)} style={{ fontWeight: 700, color: 'var(--text-main)' }}>{k.kpi.nombre}</span>
                  </div>
                  {k.faltan > 0 ? (
                    esPrincipal ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: pal.faltanCol, background: pal.faltanBg, padding: '2px 8px', borderRadius: '12px' }}>
                          Faltan {kpiFmt(k.faltan, k.kpi.metrica)}
                        </span>
                        {diasLaborablesRestantes > 0 && (
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#d97706' }}>
                            💪 ≈ {fmtReto(retoDiarioComercial, k.kpi.metrica)}/día por comercial · {fmtReto(retoDiarioEquipo, k.kpi.metrica)}/día entre todos
                            <span style={{ color: 'var(--medium-gray)', fontWeight: 500 }}> ({diasLaborablesRestantes} días lab. · {nComercialesTiendas} comerciales)</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: pal.faltanCol, background: pal.faltanBg, padding: '2px 8px', borderRadius: '12px' }}>
                        Faltan {kpiFmt(k.faltan, k.kpi.metrica)}
                      </span>
                    )
                  ) : (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                      ¡Logrado!
                    </span>
                  )}
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${k.progressPct}%`, height: '100%', background: pal.grad, borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
                  <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>{kpiFmt(k.llevamos, k.kpi.metrica)}</strong></span>
                  <span>Objetivo: {kpiFmt(k.target, k.kpi.metrica)}</span>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* FILA 3: CUENTA KMS Y MVP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {/* CUENTA KILÓMETROS DEL SALTO DE TRAMO */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          padding: '12px',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle background glow */}
          <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0) 70%)', borderRadius: '50%' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '12px' }}>
              <Target size={24} color="#10b981" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>Cuenta Kilómetros</h3>
              <p title={descBloque(cfg.carrera)} style={{ margin: 0, fontSize: '13px', color: 'var(--medium-gray)', fontWeight: 500 }}>
                Carrera hacia {cfg.carrera.nombre}
              </p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center', alignContent: 'center', justifyContent: 'center' }}>
            {(carreraData.length === 0 || carreraData[0].value === 0) ? (
              <p style={{ margin: 'auto', fontSize: 14, color: 'var(--medium-gray)', textAlign: 'center' }}>Aún no hay ventas de {cfg.carrera.nombre} este mes.</p>
            ) : carreraData.slice(0, 6).map((r, i) => {
              const lider = carreraData[0].value;
              const faltan = lider - r.value;
              const esImporte = cfg.carrera.metrica === 'importe' || cfg.carrera.metrica === 'comisiones';
              return (
                <div key={r.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: esImporte ? 92 : 78 }}>
                  <div style={{ position: 'relative', width: 50, height: 50, flexShrink: 0 }}>
                    <div style={{ width: 50, height: 50, borderRadius: '50%', overflow: 'hidden', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', border: i === 0 ? '2px solid #f59e0b' : '2px solid transparent' }}>
                      <FotoAvatar name={r.name} fontSize={13} />
                    </div>
                    {i === 0 && <span style={{ position: 'absolute', top: -7, right: -5, fontSize: 15 }}>🏆</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', maxWidth: esImporte ? 92 : 78, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                  <span style={{ fontSize: esImporte ? 13 : 20, fontWeight: 900, color: '#10b981', lineHeight: esImporte ? 1.2 : 1, whiteSpace: 'nowrap' }}>{fmtValor(r.value, cfg.carrera.metrica)}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{i === 0 ? 'Líder' : (faltan > 0 ? `faltan ${fmtValor(faltan, cfg.carrera.metrica)}` : 'empatado')}</span>
                  <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${lider > 0 ? (r.value / lider) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)', borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>






        {/* EL MVP ROTATIVO */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          padding: '12px',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle background glow */}
          <div style={{ position: 'absolute', bottom: -50, right: -50, width: 150, height: 150, background: 'radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0) 70%)', borderRadius: '50%' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ backgroundColor: 'rgba(236, 72, 153, 0.1)', padding: '10px', borderRadius: '12px' }}>
              <Crown size={24} color="#ec4899" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>Destacados y Nominados MVP</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--medium-gray)', fontWeight: 500 }}>
                {cfg.mvpAmbito !== 'HOY'
                  ? 'Rendimiento y Liderazgo del Mes'
                  : mvpInfo.todosHoy
                    ? 'Rendimiento y Liderazgo Hoy'
                    : mvpInfo.ningunoHoy
                      ? 'Rendimiento y Liderazgo del Mes'
                      : 'Rendimiento Hoy · sin ventas hoy, manda el Mes'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'center' }}>
            {mvpRows.map((row, ri) => {
              const size = row.principal ? 40 : 36;
              return (
                <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-body)', padding: '10px 12px', borderRadius: '12px', border: `1px solid ${row.border}` }}>
                  <div style={{
                    width: size, height: size, borderRadius: '50%',
                    boxShadow: row.principal ? '0 4px 10px rgba(219, 39, 119, 0.3)' : `0 2px 6px ${row.border}`,
                    border: `2px solid ${row.color}`,
                    overflow: 'hidden', flexShrink: 0,
                    background: row.grad,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {row.res.name !== 'Nadie' ? (
                      <FotoAvatar name={row.res.name} fontSize={row.principal ? 16 : 14} />
                    ) : (
                      <row.Icon size={row.principal ? 20 : 16} color="#fff" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: row.principal ? '15px' : '14px', fontWeight: 800, color: 'var(--text-main)' }}>{row.res.name}</h4>
                      <span title={descBloque(row.b)} style={{ fontSize: row.principal ? '11px' : '10px', fontWeight: 700, color: row.color, background: `${row.color}1a`, padding: row.principal ? '2px 8px' : '2px 6px', borderRadius: row.principal ? '10px' : '8px' }}>{row.label}</span>
                    </div>
                    <div style={{ fontSize: row.principal ? '12px' : '11px', color: 'var(--medium-gray)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: row.dot }}></span>
                      {row.res.name !== 'Nadie' ? (
                        <>
                          {row.lead} <strong style={{ color: 'var(--text-main)' }}>{valorMvp(row.res.total, row.b)}</strong>
                          {cfg.mvpAmbito === 'HOY' && (
                            <span style={{ fontSize: '10.5px', color: 'var(--medium-gray)', fontWeight: 600 }}>
                              · {row.res.esHoy ? 'hoy' : 'mes'}
                            </span>
                          )}
                          {row.res.pendingCount > 0 && (
                            <span style={{ fontSize: '11px', color: '#d97706', marginLeft: '6px', fontWeight: 700, backgroundColor: 'rgba(217, 119, 6, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                              ({row.res.pendingCount} pendientes)
                            </span>
                          )}
                        </>
                      ) : (
                        <span>Esperando ventas...</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* DETALLE DE UN KPI DEL TERMÓMETRO: operaciones que cuentan, SIN comisiones */}
      {kpiModal && (
        <div
          onClick={() => setKpiModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-strong)', width: 'min(920px, 96vw)', maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border-strong)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-main)' }}>
                  {kpiModal.kpi.nombre} <span style={{ color: 'var(--medium-gray)', fontWeight: 600, fontSize: 13 }}>· {kpiModal.ops.length} operaciones</span>
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--medium-gray)' }}>
                  Operaciones que cuentan en este KPI ({descBloque(kpiModal.kpi)}). Sin comisiones de empresa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKpiModal(null)}
                style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--medium-gray)', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '6px 12px 14px 12px' }}>
              {kpiModal.ops.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--medium-gray)' }}>Aún no hay operaciones en este KPI.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      {['Fecha', 'Comercial', 'Producto', 'Cliente', 'Teléfono', ...(kpiModal.kpi.metrica === 'importe' ? ['Importe'] : []), 'Estado'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Importe' ? 'right' : 'left', padding: '8px 6px', color: 'var(--medium-gray)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid var(--border-strong)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kpiModal.ops.map((s: any, i: number) => (
                      <tr key={s.id || i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '7px 6px', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>{s.fecha}</td>
                        <td style={{ padding: '7px 6px', fontWeight: 700, color: 'var(--text-main)' }}>{s.vendedor}</td>
                        <td style={{ padding: '7px 6px', color: 'var(--text-main)' }}>{s.producto}</td>
                        <td style={{ padding: '7px 6px', color: 'var(--medium-gray)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nombreCliente || '—'}</td>
                        <td style={{ padding: '7px 6px', whiteSpace: 'nowrap', color: 'var(--medium-gray)' }}>{s.telf || s.telefonoMovil || s.telefonoFijo || '—'}</td>
                        {kpiModal.kpi.metrica === 'importe' && (
                          <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                            {kpiFmt(valorVentaBloque(s, kpiModal.kpi), 'importe')}
                          </td>
                        )}
                        <td style={{ padding: '7px 6px', whiteSpace: 'nowrap' }}>
                          {isPendiente(s)
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: 'rgba(217, 119, 6, 0.12)', padding: '2px 8px', borderRadius: 8 }}>Pendiente</span>
                            : <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: 8 }}>Confirmada</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
