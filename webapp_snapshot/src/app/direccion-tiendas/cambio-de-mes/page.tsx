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

  const cargar = async () => {
    setCargando(true)
    try {
      const r = await fetch('/api/salud-mes', { cache: 'no-store' })
      setDatos(await r.json())
    } catch { setDatos({ success: false, error: 'No se pudo consultar.' }) }
    setCargando(false)
  }
  useEffect(() => { if (authorized) cargar() }, [authorized])

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
                </div>
              </div>
            )
          })}
        </>
      )}
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
