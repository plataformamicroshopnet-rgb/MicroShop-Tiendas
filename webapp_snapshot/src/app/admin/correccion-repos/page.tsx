'use client'

import React, { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { useGuard } from '@/hooks/useGuard'

/**
 * CORRECCIÓN DE PRECIOS DE LOS REPOS.
 *
 * Pantalla de un solo uso por mes: enseña operación por operación lo que se va a
 * crear ANTES de crear nada, y solo entonces deja ejecutarlo.
 *
 * No reescribe ninguna venta: a cada operación mal valorada le cuelga una línea
 * con el precio bueno. Las comisiones del mes NO se mueven.
 */
const eu = (n: number) =>
  `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export default function CorreccionReposPage() {
  const { authorized } = useGuard('MODULE_ADMIN')
  const [mes, setMes] = useState('2026_07')
  const [datos, setDatos] = useState<any>(null)
  const [cargando, setCargando] = useState(false)
  const [confirmar, setConfirmar] = useState('')
  const [resultado, setResultado] = useState<any>(null)

  const cargar = async (m: string) => {
    setCargando(true); setResultado(null)
    try {
      const r = await fetch(`/api/repos-correccion?mes=${encodeURIComponent(m)}`)
      setDatos(await r.json())
    } catch (e) {
      setDatos({ success: false, error: 'No se pudo consultar.' })
    }
    setCargando(false)
  }

  useEffect(() => { if (authorized) cargar(mes) }, [authorized, mes])

  const ejecutar = async () => {
    setCargando(true)
    try {
      const r = await fetch('/api/repos-correccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, confirmar })
      })
      const j = await r.json()
      setResultado(j)
      if (j.success) { setConfirmar(''); await cargar(mes) }
    } catch (e) {
      setResultado({ success: false, error: 'No se pudo ejecutar.' })
    }
    setCargando(false)
  }

  if (authorized === null) return <div style={{ padding: 40 }}>Verificando permisos…</div>
  if (!authorized) return <div style={{ padding: 40 }}>Sin permiso.</div>

  const d = datos && datos.success ? datos : null
  const pendientes = d?.filas?.filter((f: any) => !f.yaHecha) || []

  return (
    <div style={{ padding: '24px 32px' }}>
      <PageHeader title="Corrección de precios de los Repos" showBack />

      <div style={{ background: 'rgba(0,173,239,0.08)', border: '1px solid var(--mercedes-cyan)',
                    borderRadius: 10, padding: '14px 18px', margin: '18px 0', fontSize: 14 }}>
        Los repos de fútbol se registraban a <b>10 €</b>, pero esos 10 € eran un <b>extra</b>:
        el repo de verdad vale <b>78 €</b> y nunca se apuntó. Aquí se corrige sin tocar ninguna
        venta — a cada operación se le cuelga una línea con el precio bueno.
        <br />
        <b>Las comisiones del mes no cambian.</b> Lo que cambia es lo que factura la empresa.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
        <label style={{ fontSize: 14 }}>Mes:</label>
        <select value={mes} onChange={e => setMes(e.target.value)}
                className="form-input" style={{ width: 190 }}>
          {(datos?.meses || [{ mes, estado: '' }]).map((m: any) => (
            <option key={m.mes} value={m.mes}>{m.mes}{m.estado ? ` · ${m.estado === 'HISTORIC' ? 'cerrado' : m.estado}` : ''}</option>
          ))}
        </select>
        <button onClick={() => cargar(mes)} disabled={cargando}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                         background: 'var(--mercedes-cyan)', color: '#fff', fontWeight: 600 }}>
          {cargando ? 'Mirando…' : 'Ver qué se corregiría'}
        </button>
      </div>

      {d && d.saltadasPorFecha > 0 && (
        <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13 }}>
          {d.saltadasPorFecha} venta(s) de este mes llevan fecha de agosto de 2026 o posterior y
          <b> no se tocan</b>: ahí la palanca nueva ya paga comisión y corregirlas pagaría la
          misma operación dos veces.
        </div>
      )}

      {datos && !datos.success && (
        <div style={{ color: '#DC2626', marginBottom: 16 }}>⚠️ {datos.error}</div>
      )}

      {d && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            {[
              ['Operaciones a corregir', String(d.pendientes)],
              ['Líneas que se crearán', String(d.lineasACrear)],
              ['Ya corregidas', String(d.yaHechas)],
              ['Se cobra hoy', eu(d.cobroAntes)],
              ['Se cobrará', eu(d.cobroDespues)],
              ['Diferencia', eu(d.diferencia)],
            ].map(([t, v]) => (
              <div key={t} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                    borderRadius: 10, padding: '12px 16px', minWidth: 150 }}>
                <div style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase' }}>{t}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--light-text)',
                              fontVariantNumeric: 'tabular-nums' }}>{v}</div>
              </div>
            ))}
          </div>

          {d.estadoMes === 'HISTORIC' && (
            <div style={{ fontSize: 13, color: '#B45309', marginBottom: 14 }}>
              ℹ️ El mes está cerrado. No pasa nada: la corrección es precisamente de meses
              ya liquidados y no toca las comisiones.
            </div>
          )}

          {d.sinTarifa && Object.keys(d.sinTarifa).length > 0 && (
            <div style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid #D97706', borderRadius: 8,
                          padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              ⚠️ <b>Productos sin precio nuevo</b> (se quedan como están, dímelo y los añado):{' '}
              {Object.entries(d.sinTarifa).map(([k, v]) => `«${k}» ×${v}`).join(', ')}
            </div>
          )}

          <div style={{ maxHeight: 460, overflowY: 'auto', border: '1px solid var(--border-color)',
                        borderRadius: 10, marginBottom: 18 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                <tr>
                  {['Fecha', 'Comercial', 'Cliente', 'Producto de hoy', 'Cobra hoy',
                    'Se convierte en', 'Cobrará', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left',
                                         color: 'var(--medium-gray)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(d.filas || []).map((f: any) => (
                  <tr key={f.id} style={{ borderTop: '1px solid var(--border-color)',
                                          opacity: f.yaHecha ? 0.45 : 1 }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{f.fecha}</td>
                    <td style={{ padding: '8px 12px' }}>{f.comercial}</td>
                    <td style={{ padding: '8px 12px' }}>{f.cliente}</td>
                    <td style={{ padding: '8px 12px' }}>{f.productoActual}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{eu(f.importeActual)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {f.hijas.map((h: any, i: number) => (
                        <div key={i}>{h.producto} · <b>{eu(h.cuota)}</b></div>
                      ))}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                      {eu(f.importeNuevo)}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#16A34A' }}>
                      {f.yaHecha ? '✓ hecha' : ''}
                    </td>
                  </tr>
                ))}
                {(d.filas || []).length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 24, color: 'var(--medium-gray)' }}>
                    No hay nada que corregir en este mes.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {pendientes.length > 0 && (
            <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid #DC2626',
                          borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 14, marginBottom: 10 }}>
                Repasa la tabla de arriba. Cuando esté bien, escribe <b>{mes}</b> aquí y pulsa
                el botón. Se puede repetir sin miedo: lo que ya esté hecho no se duplica.
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input value={confirmar} onChange={e => setConfirmar(e.target.value)}
                       className="form-input" style={{ width: 150 }} placeholder={mes} />
                <button onClick={ejecutar} disabled={cargando || confirmar !== mes}
                        style={{ padding: '10px 20px', borderRadius: 8, border: 'none',
                                 cursor: confirmar === mes ? 'pointer' : 'not-allowed',
                                 background: confirmar === mes ? '#DC2626' : '#64748B',
                                 color: '#fff', fontWeight: 700 }}>
                  Corregir {pendientes.length} operación(es)
                </button>
              </div>
            </div>
          )}

          {resultado && (
            <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8,
                          background: resultado.success ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                          border: `1px solid ${resultado.success ? '#16A34A' : '#DC2626'}` }}>
              {resultado.success ? '✅ ' : '⚠️ '}{resultado.message || resultado.error}
            </div>
          )}
        </>
      )}
    </div>
  )
}
