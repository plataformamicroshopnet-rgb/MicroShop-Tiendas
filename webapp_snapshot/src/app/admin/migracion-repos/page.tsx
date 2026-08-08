'use client'

import React, { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { useGuard } from '@/hooks/useGuard'

/**
 * PASAR LAS VENTAS DEL MES EN CURSO A «REPOS (ARPU)».
 *
 * Hermana de «Corrección de precios de los Repos», para el mes vivo. Aquí la
 * venta se CONVIERTE en el sitio (no se le cuelga una hija), porque en agosto la
 * palanca nueva sí comisiona y colgarle una hija pagaría dos veces.
 *
 * Como esto SÍ mueve la nómina, la pantalla enseña las dos cosas antes de dejar
 * pulsar: lo que cambia en lo que factura la empresa y lo que cambia en lo que
 * cobra cada comercial, calculado con el mismo motor que paga.
 */
const eu = (n: number) =>
  `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export default function MigracionReposPage() {
  const { authorized } = useGuard('MODULE_ADMIN')
  const [mes, setMes] = useState('')
  const [meses, setMeses] = useState<string[]>([])
  const [datos, setDatos] = useState<any>(null)
  const [cargando, setCargando] = useState(false)
  const [confirmar, setConfirmar] = useState('')
  const [resultado, setResultado] = useState<any>(null)

  // El mes por defecto es el ACTIVO: es el único que tiene sentido convertir.
  useEffect(() => {
    if (!authorized) return
    fetch('/api/admin/periodos')
      .then(r => r.json())
      .then(j => {
        const ps = (j.periodos || j.data || j.periods || []) as any[]
        const validos = ps.map(p => p.period_key || p.periodKey).filter(Boolean)
          .filter((k: string) => k >= '2026_08').sort().reverse()
        setMeses(validos)
        const activo = ps.find(p => p.status === 'ACTIVE')
        const m = (activo?.period_key || activo?.periodKey || validos[0] || '')
        if (m) setMes(m)
      })
      .catch(() => {})
  }, [authorized])

  const cargar = async (m: string) => {
    if (!m) return
    setCargando(true); setResultado(null)
    try {
      const r = await fetch(`/api/repos-migracion?mes=${encodeURIComponent(m)}`)
      setDatos(await r.json())
    } catch { setDatos({ success: false, error: 'No se pudo consultar.' }) }
    setCargando(false)
  }
  useEffect(() => { if (authorized && mes) cargar(mes) }, [authorized, mes])

  const ejecutar = async () => {
    setCargando(true)
    try {
      const r = await fetch('/api/repos-migracion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, confirmar })
      })
      const j = await r.json()
      setResultado(j)
      if (j.success) { setConfirmar(''); await cargar(mes) }
    } catch { setResultado({ success: false, error: 'No se pudo ejecutar.' }) }
    setCargando(false)
  }

  if (authorized === null) return <div style={{ padding: 40 }}>Verificando permisos…</div>
  if (!authorized) return <div style={{ padding: 40 }}>Sin permiso.</div>

  const d = datos && datos.success ? datos : null
  const difNomina = d ? Number(d.nominaDespues) - Number(d.nominaAntes) : 0
  const difJefe = d ? Number(d.jefeDespues) - Number(d.jefeAntes) : 0

  const card = (titulo: string, valor: string, tono?: 'verde' | 'rojo') => (
    <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: 10, padding: '12px 16px', minWidth: 170 }}>
      <div style={{ fontSize: 11.5, color: 'var(--medium-gray, #64748b)', marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    color: tono === 'verde' ? '#15803D' : tono === 'rojo' ? '#DC2626' : 'inherit' }}>{valor}</div>
    </div>
  )

  return (
    <div style={{ padding: '24px 32px' }}>
      <PageHeader title="Pasar las ventas del mes a «Repos (Arpu)»" showBack />

      <div style={{ background: 'rgba(0,173,239,0.08)', border: '1px solid var(--mercedes-cyan)',
                    borderRadius: 10, padding: '14px 18px', margin: '18px 0', fontSize: 14 }}>
        Las ventas de este mes que se hayan tecleado <b>a la manera vieja</b> (el repo de fútbol
        a 10 € en «Arpu (Repos)», o una suscripción en «Suscripciones TV») pasan aquí a la
        palanca nueva con su precio de verdad: <b>78 €</b> el repo, y su <b>extra de 10 €</b> al
        lado, exactamente igual que si se hubieran tecleado hoy.
        <br />
        <b>⚠️ Esto SÍ cambia lo que cobran los comerciales.</b> Abajo tienes el antes y el después,
        comercial a comercial, calculado con el mismo motor que paga.
        <br />
        Los cuatro «Repos destino BAF miMovistar/Fusión incremento de ARPU …» <b>no se tocan</b>:
        no existen en la palanca nueva.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
        <label style={{ fontSize: 14 }}>Mes:</label>
        <select value={mes} onChange={e => setMes(e.target.value)} className="form-input" style={{ width: 160 }}>
          {(meses.length ? meses : [mes].filter(Boolean)).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={() => cargar(mes)} disabled={cargando || !mes}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                         background: 'var(--mercedes-cyan)', color: '#fff', fontWeight: 600 }}>
          {cargando ? 'Mirando…' : 'Ver qué pasaría'}
        </button>
      </div>

      {datos && !datos.success && (
        <div style={{ color: '#DC2626', marginBottom: 16 }}>⚠️ {datos.error}</div>
      )}

      {d && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            {card('Ventas a pasar', String(d.aConvertir))}
            {card('Extras de 10 € a crear', String(d.extrasACrear))}
            {card('Se factura hoy', eu(d.cobroAntes))}
            {card('Se facturaría', eu(d.cobroDespues), 'verde')}
            {card('Se cobra de más', `${d.diferencia >= 0 ? '+' : ''}${eu(d.diferencia)}`, d.diferencia >= 0 ? 'verde' : 'rojo')}
          </div>

          <h3 style={{ fontSize: 15, margin: '22px 0 10px' }}>Lo que cambia en la nómina</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            {card('Equipo hoy', eu(d.nominaAntes))}
            {card('Equipo después', eu(d.nominaDespues), difNomina > 0 ? 'rojo' : undefined)}
            {card('Diferencia equipo', `${difNomina >= 0 ? '+' : ''}${eu(difNomina)}`, difNomina > 0 ? 'rojo' : 'verde')}
            {card(`Jefe (${d.jefeNombre || 'Salva'})`, `${eu(d.jefeAntes)} → ${eu(d.jefeDespues)}`, difJefe > 0 ? 'rojo' : undefined)}
          </div>

          <div style={{ overflowX: 'auto', marginBottom: 24 }}>
            <table style={{ width: '100%', maxWidth: 640, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
                  <th style={{ padding: '6px 8px' }}>Comercial</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Cobra hoy</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Cobraría</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {(d.nomina || []).map((n: any) => (
                  <tr key={n.comercial} style={{ borderBottom: '1px solid var(--border-color, #eef2f7)' }}>
                    <td style={{ padding: '6px 8px' }}>{n.comercial}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{eu(n.antes)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{eu(n.despues)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                                 fontWeight: n.dif ? 700 : 400, color: n.dif > 0 ? '#DC2626' : n.dif < 0 ? '#15803D' : 'inherit' }}>
                      {n.dif ? `${n.dif > 0 ? '+' : ''}${eu(n.dif)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {d.intocables > 0 && (
            <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8,
                          padding: '8px 12px', marginBottom: 14, fontSize: 13 }}>
              {d.intocables} venta(s) de «incremento de ARPU» de este mes <b>no se tocan</b>: no existen
              en la palanca nueva y se siguen vendiendo tal cual.
            </div>
          )}
          {Object.keys(d.sinTarifa || {}).length > 0 && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8,
                          padding: '8px 12px', marginBottom: 14, fontSize: 13 }}>
              Sin precio nuevo (se quedan como están): {Object.entries(d.sinTarifa).map(([k, v]) => `${k} (${v})`).join(', ')}
            </div>
          )}

          <h3 style={{ fontSize: 15, margin: '22px 0 10px' }}>Operación por operación</h3>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'rgba(0,0,0,0.03)' }}>
                  <th style={{ padding: '6px 8px' }}>Fecha</th>
                  <th style={{ padding: '6px 8px' }}>Comercial</th>
                  <th style={{ padding: '6px 8px' }}>Cliente</th>
                  <th style={{ padding: '6px 8px' }}>Ahora</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>€</th>
                  <th style={{ padding: '6px 8px' }}>Pasaría a ser</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>€</th>
                </tr>
              </thead>
              <tbody>
                {(d.filas || []).map((f: any) => (
                  <tr key={f.id} style={{ borderTop: '1px solid var(--border-color, #eef2f7)' }}>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{f.fecha}</td>
                    <td style={{ padding: '6px 8px' }}>{f.comercial}</td>
                    <td style={{ padding: '6px 8px' }}>{f.cliente}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--medium-gray, #64748b)' }}>{f.productoActual}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{eu(f.importeActual)}</td>
                    <td style={{ padding: '6px 8px' }}>
                      {f.productoNuevo}
                      {f.creaExtra && <span style={{ color: '#15803D' }}> + extra 10 €</span>}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{eu(f.total)}</td>
                  </tr>
                ))}
                {(d.filas || []).length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: 'var(--medium-gray, #64748b)' }}>
                    No queda nada por pasar en este mes.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {d.aConvertir > 0 && (
            <div style={{ marginTop: 22, padding: 16, border: '1px solid #FCD34D',
                          background: '#FFFBEB', borderRadius: 10 }}>
              <div style={{ fontSize: 14, marginBottom: 10 }}>
                Repasa la tabla. Cuando esté bien, escribe <b>{mes}</b> y pulsa.
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input value={confirmar} onChange={e => setConfirmar(e.target.value.trim())}
                       className="form-input" style={{ width: 140 }} placeholder={mes} />
                <button onClick={ejecutar} disabled={cargando || confirmar !== mes}
                        style={{ padding: '9px 18px', borderRadius: 8, border: 'none',
                                 cursor: confirmar === mes ? 'pointer' : 'not-allowed',
                                 background: confirmar === mes ? '#15803D' : '#94A3B8',
                                 color: '#fff', fontWeight: 700 }}>
                  {cargando ? 'Pasando…' : 'Pasar a «Repos (Arpu)»'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {resultado && (
        <div style={{ marginTop: 18, padding: 14, borderRadius: 10,
                      background: resultado.success ? 'rgba(21,128,61,0.08)' : 'rgba(220,38,38,0.08)',
                      border: `1px solid ${resultado.success ? '#15803D' : '#DC2626'}`, fontSize: 14 }}>
          {resultado.success ? `✓ ${resultado.message}` : `⚠️ ${resultado.error}`}
        </div>
      )}
    </div>
  )
}
