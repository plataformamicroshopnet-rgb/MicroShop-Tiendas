'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { useGuard } from '@/hooks/useGuard'

/**
 * CAMBIO DE MES — TIENDAS (hermano del de FFVV).
 *
 * Los pasos del mes en un vistazo: verde = en orden · ámbar = mira esto ·
 * rojo = falta una pieza. Cada paso dice POR QUÉ está así y QUÉ lo pone en
 * verde, con un botón para ir a su pantalla (o pre-crear el mes que viene).
 * Todo lo calcula el servidor en /api/salud-mes; aquí solo se pinta.
 */

const COLOR: Record<string, { punto: string; fondo: string }> = {
  verde: { punto: '#16a34a', fondo: 'rgba(22,163,74,.12)' },
  ambar: { punto: '#d97706', fondo: 'rgba(217,119,6,.12)' },
  rojo: { punto: '#dc2626', fondo: 'rgba(220,38,38,.12)' },
  apagado: { punto: '#94a3b8', fondo: 'rgba(148,163,184,.12)' },
}

export default function CambioDeMesTiendasPage() {
  const { authorized } = useGuard('MODULE_ADMIN')
  const router = useRouter()
  const [datos, setDatos] = useState<any>(null)
  const [cargando, setCargando] = useState(false)
  const [clonando, setClonando] = useState(false)
  // Tabla abierta a tamaño de lectura (pulsar una miniatura la amplía).
  const [ampliada, setAmpliada] = useState<any>(null)

  const cargar = async () => {
    setCargando(true)
    try {
      // tablas=1: el servidor manda además las tablas en miniatura de cada paso.
      const r = await fetch('/api/salud-mes?tablas=1', { cache: 'no-store' })
      setDatos(await r.json())
    } catch { setDatos({ success: false, error: 'No se pudo consultar.' }) }
    setCargando(false)
  }
  useEffect(() => { if (authorized) cargar() }, [authorized])

  // Esc cierra la tabla ampliada.
  useEffect(() => {
    if (!ampliada) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setAmpliada(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [ampliada])

  const marcarRevisado = async (paso: string) => {
    if (!confirm('¿Dar este paso por revisado? Se guarda con tu nombre y la fecha; el aviso vuelve solo si el contenido cambia.')) return
    try {
      const r = await fetch('/api/salud-mes/revisado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey: datos?.periodKey, paso }),
      })
      const j = await r.json()
      if (!j.success) alert('No se pudo sellar: ' + (j.error || ''))
      await cargar()
    } catch { alert('No se pudo sellar.') }
  }

  const clonar = async (sourcePeriodId: string) => {
    if (!confirm('¿Pre-crear el mes siguiente clonando el actual? Nace como BORRADOR; no activa nada.')) return
    setClonando(true)
    try {
      const r = await fetch('/api/admin/periodos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DUPLICATE', periodId: sourcePeriodId }),
      })
      const j = await r.json()
      if (!j.success) alert('No se pudo clonar: ' + (j.error || ''))
      await cargar()
    } catch { alert('No se pudo clonar.') }
    setClonando(false)
  }

  if (authorized === null) return <div style={{ padding: 40 }}>Verificando credenciales…</div>
  if (!authorized) return null

  const d = datos
  const res = d?.resumen

  return (
    <div style={{ padding: '24px 28px 60px', maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader
        title="🗓️ Cambio de Mes — Tiendas"
        subtitle="Los pasos del mes en un vistazo. Verde = en orden · Ámbar = mira esto · Rojo = falta una pieza."
        showBack backFallback="/direccion-tiendas"
      />

      {cargando && !d && <p style={{ color: 'var(--medium-gray)' }}>Analizando el mes…</p>}
      {d && !d.success && <p style={{ color: '#ef4444', fontWeight: 700 }}>{d.error}</p>}

      {d?.success && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '4px 0 20px', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{String(d.periodKey || '').replace('_', '-')}</span>
            <Chip n={res?.verde || 0} color="#16a34a" txt="en orden" />
            <Chip n={res?.ambar || 0} color="#d97706" txt="para revisar" />
            <Chip n={res?.rojo || 0} color="#dc2626" txt="falta pieza" />
            <button onClick={cargar} disabled={cargando}
              style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--app-bg)', color: 'var(--light-text)', cursor: 'pointer' }}>
              {cargando ? 'Actualizando…' : '↻ Actualizar'}
            </button>
          </div>

          {d.pasos.map((p: any, i: number) => {
            const c = COLOR[p.estado] || COLOR.apagado
            return (
              <div key={p.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '14px 18px', marginBottom: 12, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 12, color: 'var(--medium-gray)', fontWeight: 700, minWidth: 20, paddingTop: 3 }}>{i + 1}</div>
                <div style={{ width: 16, height: 16, borderRadius: '50%', marginTop: 3, flexShrink: 0, background: c.punto, boxShadow: `0 0 0 4px ${c.fondo}` }} />
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 3, color: 'var(--light-text)' }}>{p.titulo}</h3>
                  {p.detalles?.map((l: string, j: number) => (
                    <div key={j} style={{ fontSize: 13, color: 'var(--light-text)', lineHeight: 1.55 }}>{l}</div>
                  ))}
                  {p.subChecks?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6 }}>
                      {p.subChecks.map((s: any, j: number) => (
                        <span key={j} style={{ fontSize: 11.5, color: s.ok ? '#16a34a' : '#d97706' }}>{s.ok ? '✔' : '✗'} {s.etiqueta}</span>
                      ))}
                    </div>
                  )}
                  {p.ayuda && (
                    <div style={{ fontSize: 12, color: 'var(--medium-gray)', marginTop: 6, lineHeight: 1.5 }}>
                      <b style={{ color: '#d97706' }}>Qué lo pone en verde: </b>{p.ayuda}
                    </div>
                  )}
                  {p.accion && (
                    <div style={{ marginTop: 9 }}>
                      {p.accion.tipo === 'clonar' ? (
                        <button onClick={() => clonar(p.accion.sourcePeriodId)} disabled={clonando}
                          style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#0ea5e9', color: '#fff', cursor: 'pointer' }}>
                          {clonando ? 'Clonando…' : p.accion.etiqueta}
                        </button>
                      ) : (
                        <button onClick={() => router.push(p.accion.href)}
                          style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--app-bg)', color: 'var(--mercedes-cyan, #0275d8)', cursor: 'pointer' }}>
                          {p.accion.etiqueta} →
                        </button>
                      )}
                      {p.accionSecundaria?.tipo === 'revisado' && (
                        <button onClick={() => marcarRevisado(p.id)}
                          style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: '1px solid #16a34a', background: 'rgba(22,163,74,.08)', color: '#16a34a', cursor: 'pointer' }}>
                          ✔ {p.accionSecundaria.etiqueta}
                        </button>
                      )}
                    </div>
                  )}
                  {/* Las tablas del paso, en miniatura: pulsar una la amplía. */}
                  {p.tablas?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
                      {p.tablas.map((t: any, j: number) => (
                        <MiniTabla key={j} t={t} onAmpliar={() => setAmpliada(t)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* Tabla ampliada: misma tabla, a tamaño de lectura. */}
      {ampliada && (
        <div onClick={() => setAmpliada(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '18px 22px', maxWidth: '92vw', maxHeight: '86vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--light-text)' }}>{ampliada.titulo}</h3>
              <button onClick={() => setAmpliada(null)}
                style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--app-bg)', color: 'var(--light-text)', cursor: 'pointer' }}>
                ✕ Cerrar (Esc)
              </button>
            </div>
            {ampliada.subtitulo && <div style={{ fontSize: 12, color: 'var(--medium-gray)', marginBottom: 10 }}>{ampliada.subtitulo}</div>}
            <Rejilla t={ampliada} />
            {ampliada.nota && <div style={{ fontSize: 12, color: 'var(--medium-gray)', marginTop: 10 }}>{ampliada.nota}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

/** La tabla del paso en pequeño; al pulsar se abre a tamaño de lectura. */
function MiniTabla({ t, onAmpliar }: { t: any; onAmpliar: () => void }) {
  const MAX = 7
  const filas = (t.filas || []).slice(0, MAX)
  const sobran = (t.filas || []).length - filas.length
  return (
    <div onClick={onAmpliar} title="Pulsar para ampliar"
      style={{ cursor: 'zoom-in', border: '1px solid var(--border-color)', borderRadius: 10, padding: '8px 10px', background: 'var(--app-bg)', minWidth: 220, maxWidth: 360, flex: '1 1 260px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--light-text)', marginBottom: 4 }}>
        {t.titulo} <span style={{ fontWeight: 600, color: 'var(--medium-gray)' }}>· ampliar 🔍</span>
      </div>
      <Rejilla t={{ ...t, filas }} mini />
      {sobran > 0 && <div style={{ fontSize: 10.5, color: 'var(--medium-gray)', marginTop: 3 }}>… y {sobran} filas más (pulsa para verlas).</div>}
    </div>
  )
}

/** La rejilla en sí (mini o grande): columnas `numericas` alineadas a la derecha. */
function Rejilla({ t, mini }: { t: any; mini?: boolean }) {
  const num = new Set<number>(t.numericas || [])
  const fz = mini ? 10.5 : 13
  const pad = mini ? '2px 6px' : '6px 10px'
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {(t.columnas || []).map((c: string, i: number) => (
              <th key={i} style={{ fontSize: fz - 1.5, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--medium-gray)', fontWeight: 700, padding: pad, borderBottom: '1px solid var(--border-color)', textAlign: num.has(i) ? 'right' : 'left', whiteSpace: 'nowrap' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(t.filas || []).map((f: string[], i: number) => (
            <tr key={i}>
              {f.map((v, j) => (
                <td key={j} style={{ fontSize: fz, color: 'var(--light-text)', padding: pad, borderBottom: '1px solid var(--border-color)', textAlign: num.has(j) ? 'right' : 'left', whiteSpace: mini ? 'nowrap' : undefined, fontVariantNumeric: 'tabular-nums' }}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Chip({ n, color, txt }: { n: number; color: string; txt: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 99, padding: '5px 12px' }}>
      <b style={{ color, fontSize: 15 }}>{n}</b> {txt}
    </span>
  )
}
