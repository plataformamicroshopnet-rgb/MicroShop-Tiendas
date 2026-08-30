'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, RefreshCw, Copy, ArrowRight, Check, X, Maximize2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'
import type { EstadoPaso, PasoSaludMes, SaludMesTiendasResponse, TablaPaso } from '@/lib/saludMesTiendas'

// ─────────────────────────────────────────────────────────────────────────────
// CAMBIO DE MES — TIENDAS, con el MISMO formato que el hub de FFVV (petición
// del dueño: ancho completo, los pasos de un vistazo, tarjetas y lupas
// idénticas, para moverse entre los dos programas sin cambiar de idioma).
//
// La pantalla NO calcula nada: pinta el JSON de GET /api/salud-mes (el mes
// ACTIVO). Escrituras permitidas: «Clonar mes» (POST /api/admin/periodos
// DUPLICATE) y «Ya lo he revisado» (POST /api/salud-mes/revisado).
// ─────────────────────────────────────────────────────────────────────────────

const ESTADOS: Record<EstadoPaso, { emoji: string; etiqueta: string; color: string; bg: string }> = {
  verde: { emoji: '🟢', etiqueta: 'En orden', color: '#16a34a', bg: 'rgba(34, 197, 94, 0.08)' },
  ambar: { emoji: '🟡', etiqueta: 'Revisar', color: '#d97706', bg: 'rgba(245, 158, 11, 0.10)' },
  rojo: { emoji: '🔴', etiqueta: 'Te toca actuar', color: '#dc2626', bg: 'rgba(239, 68, 68, 0.08)' },
  apagado: { emoji: '⚪', etiqueta: 'Próximamente', color: '#94a3b8', bg: 'transparent' },
}

/** La tabla del paso, en el formato llano del hub (todas las de Tiendas lo
 *  usan). `mini` recorta a las primeras filas para la vista pequeña. */
function Rejilla({ t, mini }: { t: TablaPaso; mini?: boolean }) {
  const filas = mini ? t.filas.slice(0, 14) : t.filas
  const num = new Set<number>(t.numericas || [])
  return (
    <table className="t-plano">
      <thead>
        <tr>{t.columnas.map((c, k) => (
          <th key={k} className={num.has(k) ? 'num' : undefined}>{c}</th>
        ))}</tr>
      </thead>
      <tbody>
        {filas.map((fila, k) => (
          <tr key={k}>
            {fila.map((celda, l) => (
              <td key={l} className={num.has(l) ? 'num' : undefined}>{celda}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function CambioDeMesTiendasPage() {
  const { authorized } = useGuard('MODULE_ADMIN')
  const router = useRouter()

  const [data, setData] = React.useState<SaludMesTiendasResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [clonando, setClonando] = React.useState(false)
  // Qué paso está guardando su «Ya lo he revisado» (para desactivar su botón).
  const [revisando, setRevisando] = React.useState<string | null>(null)
  // Tabla abierta a tamaño grande (repasar cada pantalla desde aquí).
  const [ampliada, setAmpliada] = React.useState<TablaPaso | null>(null)

  // El hub OBEDECE al selector de mes del calendario (30-ago-2026): antes
  // llamaba al chequeo sin decirle el mes y siempre pintaba el activo — con
  // septiembre pre-creado, era imposible ver sus avisos ámbar de «objetivos
  // y territorial prestados de agosto» desde la pantalla.
  const { activePeriodKey } = usePeriod()
  const cargar = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // tablas=1: además de los semáforos, el servidor manda las tablas de cada
      // pantalla para repasarlas aquí mismo (el correo del ritual no las pide).
      const clave = activePeriodKey ? `&periodKey=${encodeURIComponent(activePeriodKey)}` : ''
      const r = await fetch(`/api/salud-mes?tablas=1${clave}`, { cache: 'no-store' })
      const j: SaludMesTiendasResponse = await r.json()
      if (!j.success) {
        setError(j.error || 'No se pudo cargar la salud del mes')
        setData(null)
      } else {
        setData(j)
      }
    } catch (e: any) {
      setError(String(e?.message || e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [activePeriodKey])

  React.useEffect(() => {
    if (!authorized) return
    cargar()
  }, [authorized, cargar])

  // Esc cierra la tabla ampliada.
  React.useEffect(() => {
    if (!ampliada) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAmpliada(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ampliada])

  const clonarMes = async (sourcePeriodId: string) => {
    if (!confirm('¿Pre-crear el mes siguiente clonando el actual? Nace como BORRADOR; no activa nada.')) return
    setClonando(true)
    setError(null)
    try {
      const r = await fetch('/api/admin/periodos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DUPLICATE', periodId: sourcePeriodId }),
      })
      const j = await r.json()
      if (!j.success) setError(j.error || 'No se pudo clonar el mes')
      await cargar()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setClonando(false)
    }
  }

  /** «Ya lo he revisado»: da por buenas las cifras de ese paso TAL Y COMO ESTÁN
   *  hoy. El servidor guarda quién, cuándo y una huella, así que si algo cambia
   *  después el aviso vuelve solo. */
  const marcarRevisado = async (pasoId: string) => {
    if (!confirm('¿Dar este paso por revisado? Se guarda con tu nombre y la fecha; el aviso vuelve solo si el contenido cambia.')) return
    setRevisando(pasoId)
    setError(null)
    try {
      const r = await fetch('/api/salud-mes/revisado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey: data?.periodKey, paso: pasoId }),
      })
      const j = await r.json()
      if (!j.success) setError(j.error || 'No se pudo guardar el visto bueno')
      await cargar()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setRevisando(null)
    }
  }

  if (authorized === null) {
    return <div style={{ padding: 40, color: 'var(--mercedes-cyan, #0275d8)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>
  }
  if (!authorized) return null

  const pasos: PasoSaludMes[] = data?.pasos || []

  return (
    <div className="w-full" style={{ padding: '24px 32px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cdm-leyenda {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 20px;
        }
        .cdm-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 999px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            font-size: 13px;
            color: #334155;
            font-weight: 600;
        }
        /* ── Índice: todos los pasos de un vistazo (para no perderse) ───── */
        .cdm-indice {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 14px 18px;
            margin-bottom: 20px;
        }
        .cdm-indice h2 {
            margin: 0 0 10px;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #64748b;
        }
        .cdm-indice ol {
            margin: 0;
            padding-left: 22px;
            columns: 2;
            column-gap: 32px;
        }
        .cdm-indice li {
            font-size: 13px;
            line-height: 1.9;
            break-inside: avoid;
        }
        .cdm-indice a {
            color: #334155;
            text-decoration: none;
        }
        .cdm-indice a:hover { color: #0369a1; text-decoration: underline; }
        @media (max-width: 720px) { .cdm-indice ol { columns: 1; } }

        .cdm-paso {
            background-color: #f8fafc;
            border: 1px solid #f1f5f9;
            border-radius: 16px;
            padding: 20px 24px;
            margin-bottom: 16px;
            display: flex;
            gap: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
        }
        .cdm-paso-titulo {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            letter-spacing: -0.3px;
        }
        .cdm-paso-resumen {
            font-size: 13px;
            color: #64748b;
            margin: 2px 0 0 0;
            line-height: 1.4;
        }
        .cdm-detalle {
            font-size: 13.5px;
            color: #334155;
            margin: 4px 0 0 0;
            line-height: 1.5;
        }
        .cdm-subcheck {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #334155;
            margin-top: 6px;
        }
        .cdm-ayuda {
            margin-top: 10px;
            padding: 10px 14px;
            border-radius: 10px;
            font-size: 13px;
            line-height: 1.5;
            font-weight: 600;
        }
        /* «Por qué está así» y «Qué lo pone en verde», con su rótulo en pequeño. */
        .cdm-ayuda-rotulo {
            display: block;
            font-size: 10.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: .6px;
            opacity: .72;
            margin-bottom: 2px;
        }
        .cdm-boton {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 12px;
            margin-right: 10px;
            padding: 0 18px;
            height: 40px;
            border-radius: 20px;
            border: none;
            font-weight: 700;
            font-size: 13.5px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .cdm-boton:hover { transform: translateY(-1px); }
        .cdm-boton:disabled { opacity: 0.6; cursor: wait; transform: none; }

        /* ── Tablas de cada paso: miniatura + ampliada ──────────────────── */
        .cdm-minis {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 12px;
        }
        .cdm-mini {
            flex: 1 1 320px;
            min-width: 0;
            max-width: 100%;
            position: relative;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 10px 12px 14px;
            cursor: zoom-in;
            overflow: hidden;
            transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
            text-align: left;
        }
        .cdm-mini:hover, .cdm-mini:focus-visible {
            border-color: #0ea5e9;
            box-shadow: 0 6px 16px rgba(14, 165, 233, 0.14);
            transform: translateY(-1px);
            outline: none;
        }
        .cdm-mini-cab {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 6px;
        }
        .cdm-mini-titulo {
            font-size: 12px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cdm-mini-lupa {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
            font-size: 10.5px;
            font-weight: 700;
            color: #0369a1;
            background: #e0f2fe;
            border: 1px solid #7dd3fc;
            border-radius: 999px;
            padding: 2px 8px;
        }
        .cdm-mini-lienzo {
            max-height: 132px;
            overflow: hidden;
            position: relative;
        }
        .cdm-mini table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
            line-height: 1.25;
            table-layout: fixed;
        }
        .cdm-mini th, .cdm-mini td {
            padding: 1.5px 4px;
            text-align: left;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            border-bottom: 1px solid #f1f5f9;
        }
        .cdm-mini th {
            color: #64748b;
            font-weight: 800;
            border-bottom: 1px solid #cbd5e1;
        }
        .cdm-mini td { color: #334155; }
        .cdm-mini .num { text-align: right; font-variant-numeric: tabular-nums; }
        /* Desvanecido inferior: se ve que hay más tabla debajo */
        .cdm-mini-velo {
            position: absolute;
            left: 0; right: 0; bottom: 0;
            height: 34px;
            background: linear-gradient(to bottom, rgba(255,255,255,0) 0%, #ffffff 82%);
            pointer-events: none;
        }
        .cdm-mini-pie {
            position: absolute;
            right: 12px; bottom: 6px;
            font-size: 10px;
            font-weight: 700;
            color: #94a3b8;
        }

        .cdm-lupa-fondo {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.55);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 2000;
        }
        .cdm-lupa-caja {
            background: #ffffff;
            border-radius: 16px;
            width: min(1180px, 96vw);
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
        }
        .cdm-lupa-cab {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            padding: 18px 22px 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        .cdm-lupa-cuerpo { overflow: auto; padding: 8px 22px 20px; }
        .cdm-lupa-cuerpo table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        .cdm-lupa-cuerpo th {
            position: sticky;
            top: 0;
            background: #f8fafc;
            color: #475569;
            font-size: 11.5px;
            font-weight: 800;
            text-align: left;
            padding: 10px 10px;
            border-bottom: 2px solid #e2e8f0;
            white-space: nowrap;
            z-index: 1;
        }
        .cdm-lupa-cuerpo td {
            padding: 8px 10px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
            vertical-align: top;
            white-space: pre-wrap;
            max-width: 420px;
        }
        .cdm-lupa-cuerpo .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .cdm-lupa-cuerpo tr:hover td { background: #f8fafc; }

        @media (max-width: 640px) {
            .cdm-mini { flex-basis: 100%; }
            .cdm-lupa-cuerpo table { font-size: 12px; }
        }
      `}} />

      <PageHeader
        title={<><CalendarCheck color="#f59e0b" size={28} /> Cambio de Mes — Tiendas</>}
        subtitle="Todos los pasos del ciclo mensual, con semáforo: qué va solo y qué te toca a ti."
        showBack={true}
        backFallback="/direccion-tiendas"
        headerActions={
          <button
            type="button"
            onClick={cargar}
            title="Volver a comprobar"
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--medium-gray)', cursor: loading ? 'wait' : 'pointer' }}
          >
            <RefreshCw size={18} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
        }
      />

      {/* Leyenda de los 3 estados */}
      <div className="cdm-leyenda">
        <span className="cdm-chip">🟢 Automatizado y en orden — solo mirar</span>
        <span className="cdm-chip">🟡 Automatizado, pero conviene revisar</span>
        <span className="cdm-chip">🔴 Te toca actuar</span>
        {data?.periodKey && (
          <span className="cdm-chip" style={{ marginLeft: 'auto', fontWeight: 800 }}>
            {String(data.periodKey).replace('_', '-')}
          </span>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#dc2626', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13.5, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ padding: 30, color: '#64748b', fontSize: 14, fontWeight: 600 }}>Comprobando el mes...</div>
      )}

      {/* Índice: los pasos de un vistazo, con su semáforo. Cada uno salta a su
          tarjeta (la pantalla es larga y así no hay que ir buscando). */}
      {pasos.length > 0 && (
        <nav className="cdm-indice">
          <h2>Los {pasos.length} pasos de un vistazo</h2>
          <ol>
            {pasos.map(p => (
              <li key={p.id}>
                <a href={`#paso-${p.id}`}>
                  {(ESTADOS[p.estado] || ESTADOS.apagado).emoji} {p.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {pasos.map((p, i) => {
        const cfg = ESTADOS[p.estado] || ESTADOS.apagado
        const apagado = p.estado === 'apagado'
        return (
          <div
            key={p.id}
            id={`paso-${p.id}`}
            className="cdm-paso"
            style={{ borderLeft: `6px solid ${cfg.color}`, opacity: apagado ? 0.55 : 1, scrollMarginTop: 16 }}
          >
            {/* Semáforo + número de orden */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, width: 44 }}>
              <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">{cfg.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>{apagado ? '·' : `Paso ${i + 1}`}</span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h3 className="cdm-paso-titulo">{p.titulo}</h3>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 999, border: `1px solid ${cfg.color}33` }}>
                  {cfg.etiqueta}
                </span>
              </div>
              <p className="cdm-paso-resumen">{p.resumen}</p>

              {p.detalles.map((d, j) => (
                <p key={j} className="cdm-detalle">{d}</p>
              ))}

              {p.subChecks && p.subChecks.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {p.subChecks.map((s, j) => (
                    <div key={j} className="cdm-subcheck">
                      {s.ok
                        ? <Check size={16} color="#16a34a" strokeWidth={3} style={{ flexShrink: 0 }} />
                        : <X size={16} color="#dc2626" strokeWidth={3} style={{ flexShrink: 0 }} />}
                      <span style={{ fontWeight: 600 }}>{s.etiqueta}</span>
                      {s.detalle && <span style={{ color: '#94a3b8' }}>— {s.detalle}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Cuando no está en verde: POR QUÉ está así y QUÉ lo pone en
                  verde, en dos líneas rotuladas — sin tener que deducirlo. */}
              {p.estado !== 'verde' && p.estado !== 'apagado' && (p.ayuda || p.detalles.length > 0) && (
                <div
                  className="cdm-ayuda"
                  style={p.estado === 'rojo'
                    ? { background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#b91c1c' }
                    : { background: 'rgba(245, 158, 11, 0.10)', border: '1px solid rgba(245, 158, 11, 0.30)', color: '#92400e' }}
                >
                  {p.detalles.length > 0 && (
                    <p style={{ margin: '0 0 8px' }}>
                      <span className="cdm-ayuda-rotulo">Por qué está así</span>
                      {p.detalles[0]}
                    </p>
                  )}
                  {p.ayuda && (
                    <p style={{ margin: 0 }}>
                      <span className="cdm-ayuda-rotulo">Qué lo pone en verde</span>
                      {p.ayuda}
                    </p>
                  )}
                </div>
              )}
              {/* En verde, la ayuda (si la hay) es solo un apunte, sin alarma. */}
              {p.estado === 'verde' && p.ayuda && (
                <div className="cdm-ayuda" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
                  {p.ayuda}
                </div>
              )}

              {/* Las tablas de la pantalla de ese paso, en pequeño. Al pulsar,
                  se abren a tamaño grande sin salir de aquí. */}
              {p.tablas && p.tablas.length > 0 && (
                <div className="cdm-minis">
                  {p.tablas.map((t, j) => (
                    <button
                      key={j}
                      type="button"
                      className="cdm-mini"
                      onClick={() => setAmpliada(t)}
                      title="Pulsa para ver la tabla completa"
                    >
                      <div className="cdm-mini-cab">
                        <span className="cdm-mini-titulo">{t.titulo}</span>
                        <span className="cdm-mini-lupa"><Maximize2 size={11} /> Ampliar</span>
                      </div>
                      <div className="cdm-mini-lienzo">
                        <Rejilla t={t} mini />
                      </div>
                      <span className="cdm-mini-velo" />
                      <span className="cdm-mini-pie">
                        {t.filas.length} {t.filas.length === 1 ? 'fila' : 'filas'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {p.accion?.tipo === 'clonar' && p.accion.sourcePeriodId && (
                <button
                  type="button"
                  className="cdm-boton"
                  disabled={clonando}
                  onClick={() => clonarMes(p.accion!.sourcePeriodId!)}
                  style={{ background: '#dc2626', color: '#fff', boxShadow: '0 4px 10px rgba(220, 38, 38, 0.3)' }}
                >
                  <Copy size={16} /> {clonando ? 'Clonando...' : p.accion.etiqueta}
                </button>
              )}

              {p.accion?.tipo === 'enlace' && p.accion.href && (
                <button
                  type="button"
                  className="cdm-boton"
                  onClick={() => router.push(p.accion!.href!)}
                  style={{ background: '#0ea5e9', color: '#fff', boxShadow: '0 4px 10px rgba(14, 165, 233, 0.3)' }}
                >
                  {p.accion.etiqueta} <ArrowRight size={16} />
                </button>
              )}

              {/* «YA LO HE REVISADO»: sella lo que hay AHORA; si cambia, el
                  aviso vuelve solo. */}
              {p.accionSecundaria?.tipo === 'revisado' && (
                <button
                  type="button"
                  className="cdm-boton"
                  disabled={revisando === p.id}
                  onClick={() => marcarRevisado(p.id)}
                  style={{ background: '#16a34a', color: '#fff', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.3)' }}
                  title="Da por buenas las cifras tal y como están hoy. Si alguna cambia, el aviso vuelve solo."
                >
                  <Check size={16} /> {revisando === p.id ? 'Guardando…' : p.accionSecundaria.etiqueta}
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* Tabla ampliada: misma tabla, a tamaño de lectura. */}
      {ampliada && (
        <div
          className="cdm-lupa-fondo"
          onClick={() => setAmpliada(null)}
          role="dialog"
          aria-modal="true"
          aria-label={ampliada.titulo}
        >
          <div className="cdm-lupa-caja" onClick={e => e.stopPropagation()}>
            <div className="cdm-lupa-cab">
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                  {ampliada.titulo}
                </h3>
                {ampliada.subtitulo && (
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>{ampliada.subtitulo}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAmpliada(null)}
                title="Cerrar (Esc)"
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="cdm-lupa-cuerpo">
              <Rejilla t={ampliada} />
              {ampliada.nota && (
                <p style={{ margin: '12px 0 0', fontSize: 12.5, color: '#64748b', fontStyle: 'italic' }}>{ampliada.nota}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
