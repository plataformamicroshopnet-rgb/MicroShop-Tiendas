'use client'

import React, { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { useGuard } from '@/hooks/useGuard'

/**
 * CLASIFICAR LOS REPOS DE PAQUETES DE TV (la lista del dueño, ago-2026).
 *
 * Los repos de paquetes (Netflix, Deportes, Movistar Plus…) se quedaron en la
 * palanca vieja cuando la migración de agosto: esta pantalla los mueve a
 * «Repos (Arpu)» / «Repo Fútbol» según la lista que pasó el dueño, corrige las
 * dos erratas de tecleo, da de alta las dos que faltaban y ELIMINA lo que quede
 * en el histórico de julio/agosto fuera de la lista. Junio y anteriores no se
 * tocan (es lo que coteja el ERP), y las madres corregidas tampoco.
 *
 * Todo se ve ANTES de pulsar, incluida la nómina de julio y agosto calculada
 * con el mismo motor que paga. Doble llave: hay que escribir CLASIFICAR.
 */
const eu = (n: number) =>
  `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

const Caja = ({ titulo, color, children }: { titulo: string; color: string; children: React.ReactNode }) => (
  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderLeft: `5px solid ${color}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, color: 'var(--light-text)' }}>{titulo}</div>
    {children}
  </div>
)

const Tabla = ({ cab, filas }: { cab: string[]; filas: (string | number)[][] }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead><tr>{cab.map((c, i) => (
        <th key={i} style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{c}</th>
      ))}</tr></thead>
      <tbody>{filas.map((f, i) => (
        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
          {f.map((c, j) => <td key={j} style={{ padding: '4px 8px', color: 'var(--light-text)', whiteSpace: 'nowrap' }}>{c}</td>)}
        </tr>
      ))}</tbody>
    </table>
  </div>
)

export default function ClasificacionReposPage() {
  const { authorized } = useGuard('MODULE_ADMIN')
  const [datos, setDatos] = useState<any>(null)
  const [cargando, setCargando] = useState(false)
  const [confirmar, setConfirmar] = useState('')
  const [resultado, setResultado] = useState<any>(null)

  const cargar = async () => {
    setCargando(true); setResultado(null)
    try {
      const r = await fetch('/api/repos-clasificacion')
      setDatos(await r.json())
    } catch { setDatos({ success: false, error: 'No se pudo consultar.' }) }
    setCargando(false)
  }
  useEffect(() => { if (authorized) cargar() }, [authorized])

  const ejecutar = async () => {
    setCargando(true)
    try {
      const r = await fetch('/api/repos-clasificacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmar }),
      })
      const j = await r.json()
      setResultado(j)
      if (j.success) { setConfirmar(''); await cargar() }
    } catch { setResultado({ success: false, error: 'No se pudo ejecutar.' }) }
    setCargando(false)
  }

  if (authorized === null) return <div style={{ padding: 40 }}>Verificando credenciales…</div>
  if (!authorized) return null

  const d = datos
  return (
    <div style={{ padding: '24px 28px', maxWidth: 1150, margin: '0 auto' }}>
      <PageHeader
        title="Clasificación de Repos (lista del dueño)"
        subtitle="Los repos de paquetes de TV que quedaron en la palanca vieja: moverlos, corregir las erratas, dar de alta las que faltan y limpiar julio/agosto del histórico."
        showBack backFallback="/admin"
      />

      {cargando && !d && <p style={{ color: 'var(--medium-gray)' }}>Analizando…</p>}
      {d && !d.success && <p style={{ color: '#ef4444', fontWeight: 700 }}>{d.error}</p>}

      {d?.success && (
        <>
          <Caja titulo={`Se mueven a su palanca nueva · ${d.mover.length} operaciones · tecleado ${eu(d.sumaTecleada)} → se paga ${eu(d.sumaMovida)}`} color="#0ea5e9">
            <Tabla
              cab={['Fecha', 'Cliente', 'Contrató', 'Producto que queda', 'Tecleado', 'Se paga', 'Comercial', 'De', 'A', 'Correcciones']}
              filas={d.mover.map((m: any) => [
                m.fecha, m.cliente, m.contrato,
                String(m.productoNuevo || m.producto || '').slice(0, 38),
                eu(m.cuota), eu(m.cuotaFinal), m.vendedor || '—',
                m.palancaActual, m.destino,
                [m.productoNuevo ? 'tarifa puesta' : '', m.fechaNueva ? `fecha → ${m.fechaNueva}` : '', m.boletinNuevo !== null && m.boletinNuevo !== undefined ? `boletín → ${m.boletinNuevo || '(vacío)'}` : ''].filter(Boolean).join(' · ') || '—',
              ])}
            />
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--medium-gray)' }}>
              Las que estaban a 0 € reciben el producto y el importe de la tarifa de «Repos (Arpu)»;
              las que ya tenían importe tecleado se respetan tal cual.
            </p>
          </Caja>

          {d.altas.length > 0 && (
            <Caja titulo={`Se dan de alta (no estaban tecleadas) · ${d.altas.length}`} color="#22c55e">
              <Tabla cab={['Fecha', 'Cliente', 'Contrató', 'Producto', 'Se paga', 'Boletín']}
                filas={d.altas.map((a: any) => [a.fecha, a.nombre, a.contrato, String(a.producto || '').slice(0, 38), eu(a.cuota), a.boletin || '—'])} />
            </Caja>
          )}

          <Caja titulo={`Se ELIMINAN del histórico de julio/agosto (no están en la lista) · ${d.eliminar.length} · ${eu(d.sumaEliminada)}`} color="#ef4444">
            {d.eliminar.length === 0
              ? <p style={{ margin: 0, fontSize: 13, color: 'var(--medium-gray)' }}>Nada que eliminar: todo lo del histórico de julio/agosto está en la lista.</p>
              : <Tabla cab={['Fecha', 'Cliente', 'Producto', 'Cuota', 'Comercial', 'Boletín']}
                  filas={d.eliminar.map((x: any) => [x.fecha, x.cliente, String(x.producto || '').slice(0, 46), eu(x.cuota), x.vendedor || '—', x.boletin || '—'])} />}
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--medium-gray)' }}>
              Junio y anteriores no se tocan. Las {d.madresRespetadas} operaciones corregidas (madres con hijas) tampoco.
              {d.extrasFutbolAparte > 0 && <> Y los {d.extrasFutbolAparte} «Extra Fútbol» vivos tampoco: esos los convierten «Corrección de precios» (julio) y «Migración de Repos» (agosto).</>}
            </p>
          </Caja>

          {(d.yaEsta.length > 0 || d.yaCorregida.length > 0) && (
            <Caja titulo={`Ya estaban hechas · ${d.yaEsta.length + d.yaCorregida.length}`} color="#94a3b8">
              <Tabla cab={['Fecha', 'Cliente', 'Contrató', 'Situación']}
                filas={[
                  ...d.yaEsta.map((x: any) => [x.fecha, x.cliente, x.contrato, `Ya vive en «${x.palancaActual}»`]),
                  ...d.yaCorregida.map((x: any) => [x.fecha, x.cliente, x.contrato, 'Corregida en julio: sus hijas ya están en las palancas nuevas']),
                ]} />
            </Caja>
          )}

          {d.dudosas.length > 0 && (
            <Caja titulo={`⚠ Para revisar a mano · ${d.dudosas.length}`} color="#f59e0b">
              <Tabla cab={['Fecha', 'Cliente', 'Contrató', 'Motivo']}
                filas={d.dudosas.map((x: any) => [x.fecha, x.cliente || x.nombre, x.contrato, x.motivo])} />
            </Caja>
          )}

          {d.nominas.map((n: any) => (
            <Caja key={n.mes} titulo={`Nómina de ${n.mes.replace('_', '-')} · antes ${eu(n.totalAntes)} → después ${eu(n.totalDespues)}`} color="#8b5cf6">
              <Tabla cab={['Comercial', 'Antes', 'Después', 'Diferencia']}
                filas={[
                  ...n.detalle.map((x: any) => [x.comercial, eu(x.antes), eu(x.despues), (x.dif >= 0 ? '+' : '') + eu(x.dif)]),
                  ['Jefe de Ventas', eu(n.jefeAntes), eu(n.jefeDespues), (n.jefeDespues - n.jefeAntes >= 0 ? '+' : '') + eu(n.jefeDespues - n.jefeAntes)],
                ]} />
            </Caja>
          ))}

          <Caja titulo="Ejecutar" color="#dc2626">
            <p style={{ fontSize: 13, color: 'var(--light-text)', marginTop: 0 }}>
              Revisa las cajas de arriba. Para ejecutar, escribe <b>CLASIFICAR</b> y pulsa el botón.
              Se puede volver a entrar sin miedo: lo ya hecho sale como «ya estaba» y no se repite.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="Escribe CLASIFICAR"
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--app-bg)', color: 'var(--light-text)' }} />
              <button onClick={ejecutar} disabled={cargando || confirmar.trim().toUpperCase() !== 'CLASIFICAR'}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', fontWeight: 800, cursor: 'pointer',
                         background: confirmar.trim().toUpperCase() === 'CLASIFICAR' ? '#dc2626' : '#475569', color: '#fff' }}>
                {cargando ? 'Ejecutando…' : 'Clasificar, dar de alta y limpiar'}
              </button>
            </div>
            {resultado && (
              <p style={{ marginTop: 10, fontWeight: 700, color: resultado.success ? '#22c55e' : '#ef4444' }}>
                {resultado.success ? `✅ ${resultado.message}` : `❌ ${resultado.error}`}
              </p>
            )}
          </Caja>
        </>
      )}
    </div>
  )
}
