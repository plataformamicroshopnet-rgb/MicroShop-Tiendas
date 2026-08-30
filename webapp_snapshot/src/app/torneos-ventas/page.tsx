'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { Trophy, Settings } from 'lucide-react'
import { useComisionesData } from '@/hooks/useComisionesData'
import { usePeriod } from '@/components/PeriodProvider'
import { renderDashboardData, isSolar360 } from '@/lib/salesUtils'
import { getSaleCommission } from '@/lib/saleCommission'
import { can } from '@/lib/permissions'
import { loadTorneosConfigMes, concursoSaleValue, estadoConcurso, concursoJuegaEnMes, generaNotasConcurso, premioLabel, repartoPorVenta, resolverObjetivosTorneo, fmtEur, RepartoPorVenta, TorneosConfig } from '@/lib/torneosConfig'

// Nombre de vendedor normalizado (minúsculas, sin acentos) para casar el mapa de
// comisiones con el roster, igual que hace useComisionesData con los vendedores.
const normName = (v: any) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const getMedal = (pos: number) => {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return pos;
}

const getRowClass = (pos: number) => {
  if (pos === 1) return 'row-oro';
  if (pos === 2) return 'row-plata';
  if (pos === 3) return 'row-bronce';
  return 'row-normal';
}

const ChartBars = ({ data, maxValue, barColor }: { data: any[], maxValue: number, barColor: string }) => {
  return (
    <div style={{ backgroundColor: '#f1f5f9', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0, minHeight: 250, border: '1px solid #e2e8f0' }}>
      {data.map((item) => {
        // Handle max 0 case safely
        const percentage = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 5) : 5;
        return (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '60px', color: '#1e293b', fontSize: '11px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
              {item.name}
            </div>
            <div style={{ flex: 1, position: 'relative', height: '22px' }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${percentage}%`,
                backgroundColor: barColor,
                borderRadius: '0 4px 4px 0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: '8px'
              }}>
                <span style={{ color: '#fff', fontSize: '10px', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {item.label}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TorneosVentasPage() {
  const { sellerStats, loading, catalogs, tiendaRules } = useComisionesData();
  const { activePeriodKey, availablePeriods } = usePeriod();
  const [config, setConfig] = useState<TorneosConfig>({ concursos: [] });
  const [user, setUser] = useState<any>(null);

  // ── Métrica 'comisiones': mapa vendedor(normalizado) → total de comisiones (€) del mes ──
  // Misma receta que Liquidación/Rentabilidad por Tiendas: getSaleCommission (fuente única,
  // la que usan MOD, Resumen MOD y Liquidaciones) con los dashboards Pyme/Captador.
  const necesitaComisiones = config.concursos.some(c => c.metrica === 'comisiones');
  const [comisionesMap, setComisionesMap] = useState<Record<string, number>>({});
  const [comisionesListas, setComisionesListas] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d?.user ?? d)).catch(() => {});
  }, []);

  // Config POR MES: cada mes conserva sus torneos (24-ago-2026). Al cambiar el
  // mes del programa se recarga la config de ese mes.
  useEffect(() => {
    if (!activePeriodKey) return;
    let cancelado = false;
    loadTorneosConfigMes(activePeriodKey).then(r => { if (!cancelado) setConfig(r.config); });
    return () => { cancelado = true; };
  }, [activePeriodKey]);

  useEffect(() => {
    // Los fetches extra SOLO se hacen si algún concurso usa la métrica 'comisiones'.
    if (!necesitaComisiones || !activePeriodKey || availablePeriods.length === 0) return;
    let cancelado = false;
    const cargar = async () => {
      setComisionesListas(false);
      try {
        const periodObj = availablePeriods.find(p => p.period_key === activePeriodKey);
        const [salesRes, catRes, pymeRes, plusRes, objRes] = await Promise.all([
          // dashboard=true: ventas de TODO el equipo también para un COMERCIAL
          // (sin ello, /api/sales le devuelve solo las suyas y el ranking de
          // comisiones saldría a 0,00 € para el resto).
          fetch(`/api/sales?periodKey=${activePeriodKey}&dashboard=true`).catch(() => null),
          fetch(`/api/catalogs?_t=${Date.now()}`).catch(() => null),
          fetch(`/api/importes-pyme?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/importes-plus?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/objetivos?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
        ]);

        const salesData = salesRes && salesRes.ok ? await salesRes.json() : { logs: [] };
        const catData = catRes && catRes.ok ? await catRes.json() : {};
        const pymeData = pymeRes && pymeRes.ok ? await pymeRes.json() : {};
        const plusData = plusRes && plusRes.ok ? await plusRes.json() : {};
        const objData = objRes && objRes.ok ? await objRes.json() : {};

        const fetchedSales = salesData.logs || [];
        const cats = catData.catalogs || catData || {};
        const importesPyme = pymeData.importes || pymeData.data || [];
        const importesPlus = plusData.importes || plusData.data || [];
        const objetivosObj = objData.objetivos || { Pyme: {}, Captador: {} };
        const objGruposObj = objData.grupos || { Pyme: {}, Captador: {} };

        const parsedPyme = renderDashboardData('Pyme', importesPyme, objetivosObj.Pyme || {}, fetchedSales, objGruposObj.Pyme || {}, periodObj);
        const parsedCaptador = renderDashboardData('Captador', importesPlus, objetivosObj.Captador || {}, fetchedSales, objGruposObj.Captador || {}, periodObj);

        const now = new Date();
        const viewingPeriod = periodObj
          ? `${periodObj.year}${String(periodObj.month).padStart(2, '0')}`
          : `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

        const mapa: Record<string, number> = {};
        fetchedSales.forEach((sale: any) => {
          // Igual que Rentabilidad por Tiendas: anuladas y Solar360 fuera.
          if (sale.anulado === 'Si' || sale.anulado === 'Sí' || sale.pendiente === 'Anulado') return;
          if (isSolar360(sale)) return;
          // Solo el periodo visualizado (ya vienen strictPeriod; filtro defensivo).
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

          const comision = getSaleCommission(sale, {
            catalogs: cats,
            dashRowsPlus: parsedPyme.rows,
            dashRowsBasico: parsedCaptador.rows,
            viewingPeriod,
          });
          const key = normName(sale.vendedor);
          if (!key) return;
          mapa[key] = (mapa[key] || 0) + comision;
        });

        if (!cancelado) setComisionesMap(mapa);
      } catch (err) {
        console.error('Error cargando comisiones para los torneos:', err);
        if (!cancelado) setComisionesMap({});
      } finally {
        if (!cancelado) setComisionesListas(true);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [necesitaComisiones, activePeriodKey, availablePeriods]);

  if (loading || (necesitaComisiones && !comisionesListas)) {
    return (
      <div className="w-full" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: 40, textAlign: 'center', color: '#3b82f6', fontWeight: 600 }}>
        <Trophy size={48} className="mx-auto animate-pulse" />
        <p className="mt-4">Cargando Torneos y procesando datos en tiempo real...</p>
      </div>
    );
  }

  // Calculate Data — usa las MISMAS reglas que el panel de Comisiones
  // (matchTipoVenta/getValueForRule) para que los torneos cuadren con él.
  const validSellers = sellerStats.filter(s => s.name !== 'Marta');

  // Las anuladas no compiten en el ranking
  const noAnulada = (rs: any) => {
    const anul = String(rs.anulado || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const pend = String(rs.pendiente || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return anul !== 'si' && pend !== 'anulado';
  };

  const fmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const processCol = (arr: any[], isCurrency: boolean) => {
    const sorted = [...arr].sort((a, b) => b.value - a.value);
    return sorted.map((item, idx) => ({
      pos: idx + 1,
      name: item.name,
      value: item.value,
      label: isCurrency ? fmt(item.value) : String(item.value)
    }));
  };

  // El mes que se está MIRANDO (para saber si cada concurso le toca o no)
  const _periodObj = availablePeriods.find(p => p.period_key === activePeriodKey);
  const _mesVisto = _periodObj ? { year: Number(_periodObj.year), month: Number(_periodObj.month) }
                               : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const _nombreMes = (m: number) => ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                                     'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][m] || '';

  // Columnas dinámicas según el Configurador de Torneos (hasta 3)
  const COL_COLORS = ['#3b82f6', '#65a30d', '#f97316'];
  const COL_HEADER = ['header-blue', 'header-green', 'header-orange'];
  type Columna = { concurso: any; isCurrency: boolean; data: any[]; max: number; porVenta?: RepartoPorVenta };
  const columns: Columna[] = config.concursos.map((c): Columna => {
    // Modo EXTRA «X € por venta» (dueño, 24-ago-2026): ranking por nº de ventas
    // con lo GANADO por cada uno; el bote (si hay tope) se reparte por orden de
    // fecha de venta y al agotarse ya no se paga más.
    if ((c.premioModo || 'podio') === 'porVenta') {
      const items: { name: string; sale: any }[] = [];
      validSellers.forEach(s => s.rawSales.filter(noAnulada).forEach((rs: any) => items.push({ name: s.name, sale: rs })));
      // objetivos en % del objetivo de la palanca: resueltos con las reglas del mes
      // resolverObjetivosTorneo RETIRADO (30-ago-2026): los % son los candados del motor.
      const rep = repartoPorVenta(items, c, catalogs, tiendaRules);
      const conFila = new Set(rep.filas.map(f => f.name));
      validSellers.forEach(s => { if (!conFila.has(s.name)) rep.filas.push({ name: s.name, ventas: 0, ganado: 0, enJuego: 0, cumpleMin: !(Number(c.minIndividual) > 0) }); });
      const data = rep.filas.map((f, idx) => ({ pos: idx + 1, name: f.name, value: f.ventas, label: String(f.ventas) }));
      return { concurso: c, isCurrency: false, data, max: Math.max(...data.map(d => d.value), 0), porVenta: rep as RepartoPorVenta };
    }
    // Métrica 'comisiones': el ranking sale del mapa vendedor→€ (total de comisiones
    // del mes, receta de Liquidación/Rentabilidad). Solo compiten los mismos
    // comerciales que el resto de concursos (validSellers, sin Marta).
    if (c.metrica === 'comisiones') {
      const arr = validSellers.map(s => ({ name: s.name, value: comisionesMap[normName(s.name)] || 0 }));
      const data = processCol(arr, true);
      return { concurso: c, isCurrency: true, data, max: Math.max(...data.map(d => d.value), 0) };
    }
    const isCurrency = c.metrica === 'importe';
    const arr = validSellers.map(s => {
      let val = 0;
      s.rawSales.filter(noAnulada).forEach((rs: any) => { val += concursoSaleValue(rs, c, catalogs); });
      return { name: s.name, value: val };
    });
    const data = processCol(arr, isCurrency);
    return { concurso: c, isCurrency, data, max: Math.max(...data.map(d => d.value), 0) };
  });

  const puedeConfig = can(user, 'CARD_CONFIG_TORNEOS');

  return (
    <div className="w-full" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '24px 0 40px' }}>
      <PageHeader
        title={<><Trophy color="#eab308" size={28} /> Torneos de Ventas</>}
        subtitle="Ranking en tiempo real, competición y medallas por objetivos."
        showBack={true}
        headerActions={puedeConfig ? (
          <Link
            href="/torneos-ventas/config"
            title="Configurar torneos"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(14,165,233,0.3)' }}
          >
            <Settings size={18} /> Configurar
          </Link>
        ) : undefined}
      />

      <div style={{ padding: '0px 32px 0' }}>
        <style dangerouslySetInnerHTML={{
          __html: `
          .torneo-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0 2px;
            font-size: 14px;
          }
          .torneo-table th {
            color: #64748b;
            font-weight: 800;
            padding: 8px 8px;
            text-align: center;
            vertical-align: bottom;
            border-bottom: 3px solid #e2e8f0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 12px;
            height: 52px;
          }
          .torneo-table td {
            padding: 2px 8px;
            text-align: center;
            color: #334155;
            border: none;
            background: #ffffff;
            transition: all 0.2s ease;
            height: 28px;
          }
          
          .torneo-row td:first-child { border-top-left-radius: 10px; border-bottom-left-radius: 10px; }
          .torneo-row td:last-child { border-top-right-radius: 10px; border-bottom-right-radius: 10px; }

          .torneo-row {
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          }
          .torneo-row:hover td {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.08);
            z-index: 10;
            position: relative;
          }

          .header-blue th { border-bottom-color: #3b82f6; }
          .header-green th { border-bottom-color: #10b981; }
          .header-orange th { border-bottom-color: #f97316; }

          .grid-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            padding: 16px 20px;
            background: #f8fafc;
            border-radius: 16px;
          }

          @media (max-width: 767px) {
            .grid-container { grid-template-columns: 1fr !important; }
          }

          .row-oro td {
            background: linear-gradient(90deg, rgba(250,204,21,0.06) 0%, rgba(250,204,21,0.18) 100%);
            font-weight: 800;
            color: #854d0e;
          }
          .row-oro td:first-child { border-left: 5px solid #eab308; }

          .row-plata td {
            background: linear-gradient(90deg, rgba(148,163,184,0.05) 0%, rgba(148,163,184,0.15) 100%);
            font-weight: 800;
            color: #334155;
          }
          .row-plata td:first-child { border-left: 5px solid #94a3b8; }

          .row-bronce td {
            background: linear-gradient(90deg, rgba(180,83,9,0.04) 0%, rgba(180,83,9,0.12) 100%);
            font-weight: 800;
            color: #78350f;
          }
          .row-bronce td:first-child { border-left: 5px solid #d97706; }
          
          .row-normal td { 
            border-bottom: 1px solid #f1f5f9; 
            border-top: 1px solid #f1f5f9; 
          }

          .trofeo-input {
            width: 100%;
            height: 24px;
            background: transparent;
            border: 1px solid transparent;
            outline: none;
            text-align: center;
            font-size: 13px;
            font-weight: 600;
            color: inherit;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.2s;
          }
          .trofeo-input:hover {
            background: rgba(255,255,255,0.6);
          }
          .trofeo-input:focus {
            cursor: text;
            background: #fff;
            border: 1px solid #cbd5e1;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            color: #1e293b;
          }
          .trofeo-input::placeholder {
            color: rgba(100, 116, 139, 0.4);
            font-weight: normal;
          }
        `}} />

        <div style={{ backgroundColor: '#fff', overflow: 'hidden' }}>
          {columns.length === 0 ? (
            <div style={{ padding: 50, textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>
              <Trophy size={40} style={{ opacity: 0.4 }} />
              <p style={{ marginTop: 12 }}>No hay ningún torneo configurado.</p>
              {puedeConfig && (
                <Link href="/torneos-ventas/config" style={{ color: '#0ea5e9', fontWeight: 700, textDecoration: 'none' }}>
                  Pulsa aquí para crear uno →
                </Link>
              )}
            </div>
          ) : (
          <>
          {/* TABLAS */}
          <div className="grid-container" style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 3)}, 1fr)` }}>
            {columns.map((col, ci) => (
              <div key={col.concurso.id}>
                {/* Nombre del EXTRA con el estilo elegido en el configurador (el modo
                    podio ya lo enseña en la cabecera de su tabla). */}
                {col.porVenta ? (
                  <div style={{ textAlign: 'center', marginBottom: 6, fontWeight: 800,
                                fontSize: col.concurso.tituloSize || 15,
                                color: col.concurso.tituloColor || '#334155' }}>
                    {col.concurso.nombre}
                  </div>
                ) : null}
                {(() => { const e = estadoConcurso(col.concurso); return e ? (
                  <div style={{ textAlign: 'center', marginBottom: 6 }}>
                    <span style={{ background: e.color, color: '#fff', borderRadius: 999, padding: '2px 12px', fontSize: 12, fontWeight: 700 }}>{e.txt}</span>
                  </div>) : null })()}
                {/* Las notas se escriben SOLAS desde las condiciones del concurso */}
                {(() => { const n = generaNotasConcurso(col.concurso); return n ? (
                  <div style={{ textAlign: 'center', marginBottom: 6, fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{n}</div>
                ) : null })()}
                {col.porVenta && concursoJuegaEnMes(col.concurso, _mesVisto.year, _mesVisto.month) ? (
                  <div style={{ textAlign: 'center', marginBottom: 8, fontSize: 12.5, fontWeight: 700, color: !col.porVenta.grupalCumplido ? '#b45309' : col.porVenta.agotado ? '#b91c1c' : '#0f766e' }}>
                    {!col.porVenta.grupalCumplido ? (
                      <>⚠️ Mínimo de equipo: {col.porVenta.minGrupal} ventas — lleváis {col.porVenta.teamVentas}
                      {col.porVenta.enJuegoTotal > 0 ? <> · <span style={{ color: '#b45309' }}>{fmtEur(col.porVenta.enJuegoTotal)} en juego</span></> : null}</>
                    ) : (
                      <>💶 {fmtEur(col.porVenta.rateActual)} por venta{col.porVenta.objetivo2Cumplido ? ' (🎯 ¡2º objetivo!)' : ''} ·
                      {col.porVenta.tope > 0
                        ? <> bote {fmtEur(col.porVenta.repartido)} de {fmtEur(col.porVenta.tope)}{col.porVenta.agotado ? ' — ⛔ agotado, ya no se paga más' : ''}</>
                        : <> repartido {fmtEur(col.porVenta.repartido)}</>}</>
                    )}
                    {col.porVenta.objetivo2Grupal > 0 && !col.porVenta.objetivo2Cumplido ? (
                      <> · 🎯 a {fmtEur(col.porVenta.importePorVenta2)} por venta si el equipo llega a {col.porVenta.objetivo2Grupal}</>
                    ) : null}
                  </div>
                ) : null}
                {!concursoJuegaEnMes(col.concurso, _mesVisto.year, _mesVisto.month) ? (
                  // El mes que se mira NO pisa las fechas del concurso: mejor decirlo
                  // claro que pintar un ranking a 0,00 € repartiendo medallas.
                  <div style={{ padding: '26px 16px', textAlign: 'center', background: '#f1f5f9', borderRadius: 12, color: '#475569', fontSize: 13.5, lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 800, marginBottom: 4,
                                  fontSize: col.concurso.tituloSize || undefined,
                                  color: col.concurso.tituloColor || undefined }}>{col.concurso.nombre}</div>
                    Este concurso juega
                    {col.concurso.fechaInicio ? ` del ${col.concurso.fechaInicio.slice(8, 10)}/${col.concurso.fechaInicio.slice(5, 7)}` : ''}
                    {col.concurso.fechaFin ? ` al ${col.concurso.fechaFin.slice(8, 10)}/${col.concurso.fechaFin.slice(5, 7)}` : ''}
                    {col.concurso.fechaInicio2 ? ` y del ${col.concurso.fechaInicio2.slice(8, 10)}/${col.concurso.fechaInicio2.slice(5, 7)}` : ''}
                    {col.concurso.fechaFin2 ? ` al ${col.concurso.fechaFin2.slice(8, 10)}/${col.concurso.fechaFin2.slice(5, 7)}` : ''}
                    &nbsp;y ahora estás viendo <strong>{_nombreMes(_mesVisto.month)} {_mesVisto.year}</strong>.
                    <div style={{ marginTop: 6 }}>Cambia el mes del programa (arriba a la derecha) para ver su ranking y sus ganadores.</div>
                  </div>
                ) : col.porVenta ? (
                // Tabla del EXTRA por venta: orden por nº de ventas + lo ganado por cada uno
                <table className="torneo-table">
                  <thead>
                    <tr className={COL_HEADER[ci % COL_HEADER.length]}>
                      <th style={{ width: '15%' }}>Posición</th>
                      <th style={{ width: '25%' }}>Vendedor</th>
                      <th style={{ width: '30%' }}>Ventas</th>
                      <th style={{ width: '30%' }}>Ganado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {col.porVenta.filas.map((f, idx) => {
                      const pos = idx + 1;
                      const compite = f.ventas > 0;
                      return (
                        <tr key={f.name} className={`torneo-row ${compite ? getRowClass(pos) : 'row-normal'}`}>
                          <td style={{ fontSize: compite && pos <= 3 ? '20px' : '14px' }}>{compite ? getMedal(pos) : pos}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(0,0,0,0.05)', display: 'inline-block', verticalAlign: 'middle', margin: 'auto' }} title={f.name}>
                              <img
                                src={`/${f.name}.${['Vanesa', 'Lara', 'Nuria', 'Elena'].includes(f.name) ? 'jpeg' : 'jpg'}`}
                                alt={f.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
                          </td>
                          <td style={{ fontWeight: 800 }}>{f.ventas}</td>
                          {/* Verde = cobrado de verdad; ÁMBAR = en juego (se pierde si el
                              equipo no llega al mínimo — la zanahoria del dueño). */}
                          <td style={{ fontWeight: 800,
                                       color: f.ganado > 0 ? '#0f766e' : f.enJuego > 0 ? '#b45309' : '#cbd5e1',
                                       fontSize: (f.ganado > 0 || f.enJuego > 0) ? undefined : 12 }}>
                            {f.ganado > 0 ? fmtEur(f.ganado)
                              : f.enJuego > 0 ? `${fmtEur(f.enJuego)} en juego`
                              : (f.ventas > 0 && !f.cumpleMin && col.porVenta ? `mín. ${col.porVenta.minIndividual}` : '—')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                ) : (
                <table className="torneo-table">
                  <thead>
                    <tr className={COL_HEADER[ci % COL_HEADER.length]}>
                      <th style={{ width: '15%' }}>Posición</th>
                      <th style={{ width: '30%' }}>Premio</th>
                      <th style={{ width: '25%' }}>Vendedor</th>
                      <th style={{ width: '30%',
                                   color: col.concurso.tituloColor || undefined,
                                   fontSize: col.concurso.tituloSize || undefined,
                                   textTransform: col.concurso.tituloSize ? 'none' : undefined }}>
                        {col.concurso.nombre}{col.isCurrency ? ' €' : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {col.data.map(row => {
                      // Sin puntos no hay podio: a 0 no se dan medallas ni premios
                      // (con todos a cero se repartían los 100/75/50 por orden de
                      // lista — lo que vio el dueño el 24-ago).
                      const compite = row.value > 0;
                      const premio = compite ? col.concurso.premios.find((p: any) => p.pos === row.pos) : undefined;
                      return (
                        <tr key={row.name} className={`torneo-row ${compite ? getRowClass(row.pos) : 'row-normal'}`}>
                          <td style={{ fontSize: compite && row.pos <= 3 ? '20px' : '14px' }}>{compite ? getMedal(row.pos) : row.pos}</td>
                          <td style={{ fontSize: 12.5, fontWeight: 700, color: premio ? '#0f766e' : '#cbd5e1' }}>
                            {premio ? premioLabel(premio) : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(0,0,0,0.05)', display: 'inline-block', verticalAlign: 'middle', margin: 'auto' }} title={row.name}>
                              <img
                                src={`/${row.name}.${['Vanesa', 'Lara', 'Nuria', 'Elena'].includes(row.name) ? 'jpeg' : 'jpg'}`}
                                alt={row.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
                          </td>
                          <td>{row.label}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                )}
              </div>
            ))}
          </div>

          {/* GRÁFICOS (solo de los concursos que juegan en el mes visto) */}
          <div className="grid-container" style={{ marginTop: 2, gridTemplateColumns: `repeat(${Math.min(columns.length, 3)}, 1fr)` }}>
            {columns.map((col, ci) => (
              concursoJuegaEnMes(col.concurso, _mesVisto.year, _mesVisto.month)
                ? <ChartBars key={col.concurso.id} data={col.data} maxValue={col.max} barColor={COL_COLORS[ci % COL_COLORS.length]} />
                : <div key={col.concurso.id} />
            ))}
          </div>
          </>
          )}

        </div>
      </div>
    </div>
  )
}
