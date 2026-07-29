'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { usePeriod } from '@/components/PeriodProvider'
import { useGuard } from '@/hooks/useGuard'
import { normalizeRole } from '@/lib/appConfig'
import { norm } from '@/lib/comercialRoster'
import {
  ParteDiarioResponse,
  ParteDiarioComercial,
  dineroPorCubrir,
  estadoDePalanca,
  fraseAnimo,
  piezasQueFaltan,
  traducirFalta,
  unidadDePalanca,
  veredictoDelDia,
} from '@/lib/parteDiario'

// ─────────────────────────────────────────────────────────────────────────────
// PARTE DIARIO — «cómo fue ayer y cómo vas» para un comercial de Tiendas.
//
// La pantalla NO calcula comisiones: consume /api/parte-diario, el mismo JSON
// del que saldrá el correo diario, para que lo que se lee aquí y lo que llega al
// buzón sean la misma verdad. Los textos (traducción a producto y frases de
// ánimo) viven en src/lib/parteDiario y son deterministas por
// (comercial + fecha + palanca): no bailan al refrescar, sí cambian de un día
// para otro.
// ─────────────────────────────────────────────────────────────────────────────

const eur2 = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const eur0 = (v: number) => Math.round(v).toLocaleString('es-ES') + ' €'
const num = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 1 })

const fechaLarga = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const txt = new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

// Emoji por palanca (solo decorativo: si no casa ninguno, va uno neutro).
const ICONOS: { clave: string; icono: string }[] = [
  { clave: 'dispositivo', icono: '📱' },
  { clave: 'convergente', icono: '🔗' },
  { clave: 'baf', icono: '🌐' },
  { clave: 'arpu', icono: '📈' },
  { clave: 'futbol', icono: '⚽' },
  { clave: 'fttr', icono: '🏠' },
  { clave: 'mpa', icono: '🚨' },
  { clave: 'alarma', icono: '🚨' },
  { clave: 'swap', icono: '🔄' },
  { clave: 'seguro', icono: '🛡️' },
  { clave: 'tv', icono: '📺' },
  { clave: 'o2', icono: '🟦' },
]
const iconoDe = (nombre: string) => {
  const n = String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return (ICONOS.find(i => n.includes(i.clave)) || { icono: '🎯' }).icono
}

// Día por defecto del parte: ayer, o el último día del mes que se esté mirando
// si ese mes ya pasó (el parte de un mes cerrado se abre por su último día).
function fechaPorDefecto(periodKey: string): string {
  const hoy = new Date()
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (!periodKey) return iso(ayer)
  const [y, m] = periodKey.split(/[_-]/).map(Number)
  if (!y || !m) return iso(ayer)
  if (ayer.getFullYear() === y && ayer.getMonth() + 1 === m) return iso(ayer)
  const finMes = new Date(y, m, 0)
  if (ayer < finMes) return iso(new Date(y, m - 1, 1))
  return iso(finMes)
}

function ParteDiarioContent() {
  const searchParams = useSearchParams()
  const { activePeriodKey } = usePeriod()
  const { authorized, user } = useGuard('MODULE_COMISIONES')

  const [data, setData] = React.useState<ParteDiarioResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [fecha, setFecha] = React.useState<string>('')
  const [sellerSel, setSellerSel] = React.useState<string>(searchParams.get('seller') || '')

  const esJefe = normalizeRole(user?.role) === 'ADMIN' || normalizeRole(user?.role) === 'JEFE DE VENTAS'

  React.useEffect(() => {
    if (!activePeriodKey) return
    setFecha(f => f || fechaPorDefecto(activePeriodKey))
  }, [activePeriodKey])

  React.useEffect(() => {
    if (!activePeriodKey || !fecha || !authorized) return
    setLoading(true)
    setError(null)
    fetch(`/api/parte-diario?periodKey=${activePeriodKey}&fecha=${fecha}`)
      .then(r => r.json())
      .then((j: ParteDiarioResponse) => {
        if (!j.success) { setError(j.error || 'No se pudo cargar el parte'); setData(null) }
        else setData(j)
      })
      .catch(e => setError(String(e?.message || e)))
      .finally(() => setLoading(false))
  }, [activePeriodKey, fecha, authorized])

  // Comercial mostrado: el del enlace / selector, el propio si es comercial, o el primero.
  const comercial: ParteDiarioComercial | null = React.useMemo(() => {
    if (!data || !data.comerciales.length) return null
    const buscado = norm(sellerSel || user?.username || '')
    return data.comerciales.find(c => norm(c.nombre) === buscado) || data.comerciales[0]
  }, [data, sellerSel, user])

  if (authorized === null) {
    return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>
  }

  return (
    <div style={{ padding: '0 20px 40px 20px' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS_PARTE }} />

      <PageHeader
        title={<><ClipboardList size={26} color="var(--mercedes-cyan)" /> Mi parte diario</>}
        showBack={true}
        helpContent={
          <div>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Parte diario</h4>
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              Cómo fue el día para cada comercial y cómo va el mes en cada palanca. Las cifras salen del mismo
              motor que el Panel de Comisiones, así que cuadran con lo que se le liquida.
            </p>
          </div>
        }
      />

      {/* Controles: día del parte y (para jefatura) de quién es */}
      <div className="pd-controles no-print">
        <label>
          <span>Día del parte</span>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </label>
        {esJefe && data && data.comerciales.length > 1 && (
          <label>
            <span>Comercial</span>
            <select value={comercial?.nombre || ''} onChange={e => setSellerSel(e.target.value)}>
              {data.comerciales.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      {loading && <div style={{ padding: 40, color: 'var(--medium-gray)', fontWeight: 600 }}>Preparando tu parte…</div>}
      {!loading && error && <div style={{ padding: 24, color: '#ef4444', fontWeight: 600 }}>{error}</div>}
      {!loading && !error && !comercial && (
        <div style={{ padding: 24, color: 'var(--medium-gray)', fontWeight: 600 }}>
          No hay parte para este día: no encontramos tu ficha de comercial en la plantilla del mes.
        </div>
      )}

      {!loading && !error && comercial && data && <Parte data={data} c={comercial} />}
    </div>
  )
}

function Parte({ data, c }: { data: ParteDiarioResponse; c: ParteDiarioComercial }) {
  const { fecha, equipo } = data
  const veredicto = veredictoDelDia(c.nombre, fecha, c.ayer.ops, c.ayer.importe, equipo.media)
  // La posición viaja dentro del parte: un comercial no recibe el ranking con
  // las cifras de sus compañeros (solo jefatura y el ERP).
  const posicion = c.posicionDia
  const medalla = posicion === 1 ? '🥇' : posicion === 2 ? '🥈' : posicion === 3 ? '🥉' : '📊'
  const pctSobreMedia = equipo.media > 0 ? (c.ayer.importe / equipo.media - 1) * 100 : 0

  const principal = c.ritmo.palanca ? c.palancas.find(p => p.nombre === c.ritmo.palanca) || null : null

  // Ordenadas para el detalle: primero lo que está a medias, luego lo cubierto,
  // al final lo que ni se ha estrenado (que es donde hay más dinero suelto).
  const orden: Record<string, number> = { medias: 0, cubierto: 1, cero: 2 }
  const palancasOrdenadas = [...c.palancas].sort((a, b) => orden[estadoDePalanca(a)] - orden[estadoDePalanca(b)] || b.comision - a.comision)

  const mejorJugada = [...c.ayer.porPalanca].sort((a, b) => b.importe - a.importe || b.uds - a.uds)[0] || null
  const sinEstrenar = c.palancas.filter(p => p.llevamos <= 0 && p.objetivo > 0)

  // El reto del mes: las palancas por cubrir que más dinero dejan encima de la mesa.
  const porCubrir = c.palancas
    .filter(p => p.falta > 0 && p.tarifaActual > 0)
    .map(p => ({ p, dinero: dineroPorCubrir(p, p.falta), piezas: piezasQueFaltan(p) }))
    .filter(x => !!x.piezas)
    .sort((a, b) => b.dinero - a.dinero)
    .slice(0, 3)
  const retoTexto = porCubrir.map(x => `${x.piezas!.cantidad} ${x.piezas!.cosa}`).join(' + ')
  const retoDinero = c.mes.comisionTotal + porCubrir.reduce((acc, x) => acc + x.dinero, 0)

  // Las tres cosas de hoy: estrenar lo que está a cero, saltar de tramo y rematar la principal.
  const tresCosas: React.ReactNode[] = []
  const cero = sinEstrenar.filter(p => p.tarifaActual > 0).sort((a, b) => b.tarifaActual - a.tarifaActual)[0]
  if (cero) {
    tresCosas.push(<>Ofrece <strong>{cero.nombre}</strong>: {cero.esImporte ? `${num(cero.tarifaActual)} %` : eur0(cero.tarifaActual)} {cero.esImporte ? 'de comisión' : 'la unidad'} y llevas 0.</>)
  }
  const saltoTramo = c.palancas
    .filter(p => !p.esImporte && p.tarifaSiguienteTramo && p.objetivoSiguienteTramo && p.objetivoSiguienteTramo - p.llevamos > 0 && p.objetivoSiguienteTramo - p.llevamos <= 2)
    .sort((a, b) => (a.objetivoSiguienteTramo! - a.llevamos) - (b.objetivoSiguienteTramo! - b.llevamos))[0]
  if (saltoTramo) {
    const faltan = Math.ceil(saltoTramo.objetivoSiguienteTramo! - saltoTramo.llevamos)
    tresCosas.push(<>Cierra <strong>{faltan} {unidadDePalanca(saltoTramo.nombre, faltan)}</strong> más de {saltoTramo.nombre} y todas suben de {eur0(saltoTramo.tarifaActual)} a {eur0(saltoTramo.tarifaSiguienteTramo!)}.</>)
  }
  if (principal && principal.falta > 0) {
    const piezas = piezasQueFaltan(principal)
    if (piezas) tresCosas.push(<>Empuja <strong>{principal.nombre}</strong>: {piezas.cantidad} {piezas.cosa} más y cubres el objetivo del mes.</>)
  }
  for (const x of porCubrir) {
    if (tresCosas.length >= 3) break
    if (cero && x.p.nombre === cero.nombre) continue
    if (principal && x.p.nombre === principal.nombre) continue
    tresCosas.push(<>Suma en <strong>{x.p.nombre}</strong>: {x.piezas!.cantidad} {x.piezas!.cosa} son {eur2(x.dinero)}.</>)
  }

  return (
    <div className="pd-wrap">

      {/* ══ RESUMEN EXPRÉS ══ */}
      <div className="pd-expres">
        <div className="pd-franja" />
        <div className="pd-cuerpo">
          <div className="pd-fecha">{fechaLarga(fecha)} · Resumen exprés</div>
          <h1 className="pd-titular">
            Hola {c.nombre}, fue{' '}
            <span className={veredicto.tono === 'bueno' ? 'pd-verde' : (veredicto.tono === 'cero' ? 'pd-ambar' : '')}>{veredicto.calificacion}</span>
            {veredicto.tono === 'bueno' ? ' 👏' : (veredicto.tono === 'cero' ? ' 💤' : '')}
          </h1>
          <p className="pd-subtitular">
            {c.ayer.ops > 0 && posicion > 0 ? `${posicion}.º del equipo` : 'Sin operaciones ese día'}
            {c.ayer.ops > 0 && equipo.media > 0
              ? `, un ${num(Math.abs(pctSobreMedia))} % ${pctSobreMedia >= 0 ? 'por encima' : 'por debajo'} de la media. `
              : '. '}
            {veredicto.cierre}
          </p>

          <div className="pd-tres">
            <div className="pd-gran">
              <div className="pd-n">{c.ayer.ops}</div>
              <div className="pd-t">Ventas del día</div>
              <div className="pd-c">el equipo, {equipo.ops}</div>
            </div>
            <div className="pd-gran">
              <div className="pd-n">{eur0(c.ayer.importe)}</div>
              <div className="pd-t">Valor del día</div>
              <div className="pd-c">media: {eur0(equipo.media)}</div>
            </div>
            <div className="pd-gran">
              <div className="pd-n" style={{ color: 'var(--pd-ok)' }}>{eur0(c.mes.comisionTotal)}</div>
              <div className="pd-t">Tu comisión del mes</div>
              <div className="pd-c">+{eur2(c.ayer.comision)} ese día</div>
            </div>
          </div>
          <div className="pd-tres" style={{ marginTop: 10 }}>
            <div className="pd-gran">
              <div className="pd-n">{c.mes.ops}</div>
              <div className="pd-t">Ventas del mes</div>
              <div className="pd-c">{c.mes.pendiente > 0 ? `${eur0(c.mes.pendiente)} por consolidar` : 'todo consolidado'}</div>
            </div>
            <div className="pd-gran">
              <div className="pd-n">{principal ? (principal.esImporte ? eur0(principal.llevamos) : num(principal.llevamos)) : '—'}</div>
              <div className="pd-t">{principal ? principal.nombre : 'Sin palanca principal'}</div>
              <div className="pd-c">{principal && principal.objetivo > 0 ? `objetivo: ${principal.esImporte ? eur0(principal.objetivo) : num(principal.objetivo)}` : 'sin objetivo'}</div>
            </div>
            <div className="pd-gran">
              <div className="pd-n" style={{ color: principal && principal.pct >= 100 ? 'var(--pd-ok)' : 'var(--pd-falta)' }}>
                {principal ? `${Math.round(principal.pct)} %` : '—'}
              </div>
              <div className="pd-t">Del objetivo del mes</div>
              <div className="pd-c">{principal && principal.falta > 0 ? `faltan ${principal.esImporte ? eur0(principal.falta) : num(principal.falta)}` : '¡cubierto!'}</div>
            </div>
          </div>

          <div className="pd-duo">
            <div className="pd-destello pd-d-bien">
              ⭐ <b>Tu mejor jugada:</b>{' '}
              {mejorJugada
                ? `${mejorJugada.uds} en ${mejorJugada.palanca}${mejorJugada.importe > 0 ? ` por ${eur0(mejorJugada.importe)}` : ''}. Ahí eres una máquina.`
                : 'ese día no cerraste nada. Hoy se arregla.'}
            </div>
            <div className="pd-destello pd-d-ojo">
              👀 <b>Se te resiste:</b>{' '}
              {sinEstrenar.length > 0
                ? `${sinEstrenar.slice(0, 2).map(p => p.nombre).join(' y ')}, otro mes sin estrenar${sinEstrenar.length > 2 ? ` (y ${sinEstrenar.length - 2} más)` : ''}.`
                : 'nada, todas las palancas están en marcha.'}
            </div>
          </div>

          <div className="pd-semaforo">
            {c.palancas.map(p => {
              const est = estadoDePalanca(p)
              return (
                <span key={p.nombre} className={`pd-sem ${est === 'cubierto' ? 'pd-sem-ok' : est === 'cero' ? 'pd-sem-cero' : 'pd-sem-medio'}`}>
                  {est === 'cubierto' ? '✅ ' : iconoDe(p.nombre) + ' '}
                  {p.nombre} {est === 'cero' ? '0' : `${Math.round(p.pct)} %`}
                </span>
              )
            })}
          </div>

          <div className="pd-bloque">
            <div className="pd-tit">El mes por dentro</div>
            <div className="pd-ritmo">
              <div className="pd-celda"><div className="pd-k">{c.ritmo.diasLaborablesRestantes} días</div><div className="pd-d">laborables quedan</div></div>
              <div className="pd-celda"><div className="pd-k">{principal?.esImporte ? eur0(c.ritmo.ritmoDiarioActual) : num(c.ritmo.ritmoDiarioActual)}</div><div className="pd-d">es tu ritmo diario</div></div>
              <div className="pd-celda"><div className="pd-k" style={{ color: 'var(--pd-falta)' }}>{principal?.esImporte ? eur0(c.ritmo.ritmoNecesario) : num(c.ritmo.ritmoNecesario)}</div><div className="pd-d">te haría falta al día</div></div>
              <div className="pd-celda"><div className="pd-k" style={{ color: 'var(--pd-ok)' }}>{eur0(retoDinero)}</div><div className="pd-d">comisión si aprietas</div></div>
            </div>
            {principal && (
              <p className="pd-nota-ritmo">
                A tu ritmo actual acabas en <strong>{principal.esImporte ? eur0(c.ritmo.proyeccionMes) : num(c.ritmo.proyeccionMes)}</strong>
                {principal.objetivo > 0 ? ` (${Math.round(c.ritmo.pctProyeccion)} % del objetivo de ${principal.nombre})` : ''}.
              </p>
            )}
          </div>

          {porCubrir.length > 0 && (
            <div className="pd-reto">
              🎯 Para redondear el mes: <strong>{retoTexto}</strong> y te pones en <strong>{eur0(retoDinero)}</strong>.
              <small>Es lo que te separa de tu mejor mes.</small>
            </div>
          )}

          {tresCosas.length > 0 && (
            <div className="pd-hoy">
              <div className="pd-tit">Si hoy solo haces tres cosas</div>
              {tresCosas.slice(0, 3).map((t, i) => (
                <div className="pd-item" key={i}><span className="pd-cuadro" /><span>{t}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pd-separador"><span>Y si quieres el detalle, aquí lo tienes</span></div>

      {/* ══ PARTE DETALLADO ══ */}
      <div className="pd-hero">
        <div className="pd-fila">
          <div className="pd-avatar">👋</div>
          <div>
            <div className="pd-fecha">{fechaLarga(fecha)} · Tu parte del día</div>
            <div className="pd-saludo">Hola {c.nombre}</div>
          </div>
        </div>
        <p className="pd-veredicto">
          Fue <strong>{veredicto.calificacion}</strong>: cerraste <strong>{c.ayer.ops} {c.ayer.ops === 1 ? 'operación' : 'operaciones'}</strong>
          {c.ayer.importe > 0 ? <> por <strong>{eur0(c.ayer.importe)}</strong></> : null}. {veredicto.cierre}
        </p>
        <div className="pd-chips">
          {c.ayer.ops > 0 && posicion > 0 && <span className="pd-chip">{medalla} {posicion}.º del equipo ese día</span>}
          {equipo.media > 0 && c.ayer.ops > 0 && (
            <span className="pd-chip">📈 Un {num(Math.abs(pctSobreMedia))} % {pctSobreMedia >= 0 ? 'por encima' : 'por debajo'} de la media</span>
          )}
          <span className="pd-chip">💶 {eur2(c.mes.comisionTotal)} de comisión este mes</span>
        </div>
      </div>

      <div className="pd-ayer">
        <div className="pd-mini">
          <div className="pd-et">Ese día vendiste</div>
          <div className="pd-vl">{c.ayer.ops} <span className="pd-vl-sub">{c.ayer.ops === 1 ? 'operación' : 'operaciones'}</span></div>
          <div className="pd-sub">El equipo hizo {equipo.ops}</div>
        </div>
        <div className="pd-mini">
          <div className="pd-et">Valor del día</div>
          <div className="pd-vl">{eur0(c.ayer.importe)}</div>
          <div className="pd-sub">Media del equipo: {eur0(equipo.media)}</div>
        </div>
        <div className="pd-mini">
          <div className="pd-et">Comisión ganada ese día</div>
          <div className="pd-vl" style={{ color: 'var(--pd-ok)' }}>{eur2(c.ayer.comision)}</div>
          <div className="pd-sub">Llevas {eur2(c.mes.comisionTotal)} este mes</div>
        </div>
      </div>

      <h2 className="pd-h2">Cómo vas en cada palanca</h2>
      <div className="pd-palancas">
        {palancasOrdenadas.map(p => {
          const est = estadoDePalanca(p)
          const delDia = c.ayer.porPalanca.find(x => x.palanca === p.nombre)
          const pctBarra = Math.min(100, Math.max(0, p.pct))
          return (
            <div key={p.nombre} className={`pd-pal${principal && p.nombre === principal.nombre ? ' pd-destaca' : ''}`}>
              <div className="pd-pal-top">
                <span className="pd-pal-nom">{iconoDe(p.nombre)} {p.nombre}</span>
                <span className={`pd-estado ${est === 'cubierto' ? 'pd-e-ok' : est === 'cero' ? 'pd-e-cero' : 'pd-e-falta'}`}>
                  {est === 'cubierto' ? '¡Objetivo cubierto!' : est === 'cero' ? 'Sin estrenar' : `${Math.round(p.pct)} % del objetivo`}
                </span>
              </div>
              <p className="pd-linea">
                {delDia && delDia.uds > 0
                  ? <>Ese día sumaste <strong>{delDia.uds} {p.esImporte ? `(${eur0(delDia.importe)})` : unidadDePalanca(p.nombre, delDia.uds)}</strong>. </>
                  : <>Ese día, <strong>ninguna</strong>. </>}
                Llevas <strong>{p.esImporte ? eur2(p.llevamos) : num(p.llevamos)}</strong>
                {p.objetivo > 0 ? <> de {p.esImporte ? eur0(p.objetivo) : num(p.objetivo)}</> : null}
                {p.pendientes > 0 ? <> ({p.esImporte ? eur0(p.ventas) : num(p.ventas)} cerradas + {p.esImporte ? eur0(p.pendientes) : num(p.pendientes)} pendientes)</> : null}.
              </p>
              <div className="pd-barra"><div className={est === 'cubierto' ? 'pd-verde' : ''} style={{ width: `${pctBarra}%` }} /></div>
              <div className={`pd-traduce${est === 'cubierto' ? ' pd-ok' : ''}`}>
                {traducirFalta(p, c.ritmo.diasLaborablesRestantes)}
                {p.tarifaSiguienteTramo && p.objetivoSiguienteTramo && p.objetivoSiguienteTramo > p.llevamos ? (
                  <> Con {Math.ceil(p.objetivoSiguienteTramo - p.llevamos)} más saltas de tramo: {p.esImporte ? `${num(p.tarifaSiguienteTramo)} %` : eur0(p.tarifaSiguienteTramo)}.</>
                ) : null}
              </div>
              <p className="pd-animo">{fraseAnimo(est, c.nombre, fecha, p.nombre)}</p>
              <div className="pd-cifras">
                <span>Comisión: <b>{eur2(p.comision)}</b></span>
                <span>Tramo: <b>{p.hito > 0 ? p.hito : '—'}</b></span>
                <span>Tarifa: <b>{p.esImporte ? `${num(p.tarifaActual)} %` : eur0(p.tarifaActual)}</b></span>
              </div>
            </div>
          )
        })}
      </div>

      {/* CIERRE */}
      <div className="pd-cierre">
        <div className="pd-tot">
          <div>
            <div className="pd-et">Tu comisión ahora mismo</div>
            <div className="pd-big">{eur2(c.mes.comisionTotal)}</div>
          </div>
          <div className="pd-desglose">
            <div>Consolidado: <b style={{ color: 'var(--pd-ok)' }}>{eur2(c.mes.consolidada)}</b></div>
            <div>Por consolidar: <b style={{ color: 'var(--pd-falta)' }}>{eur2(c.mes.pendiente)}</b></div>
          </div>
        </div>
        {porCubrir.length > 0 && (
          <p className="pd-frase">Si cierras <strong>{retoTexto}</strong>, te vas por encima de <strong>{eur0(retoDinero)}</strong> este mes. Está en tu mano. 🚀</p>
        )}
      </div>

      {/* RANKING DEL DÍA — solo para quien recibe el ranking (jefatura): un
          comercial ve su puesto arriba, no las cifras de sus compañeros. */}
      {equipo.ranking && equipo.ranking.length > 0 && (
        <div className="pd-bloque pd-rank-bloque">
          <div className="pd-tit">Cómo fue el día en el equipo</div>
          {equipo.ranking.map((r, i) => {
            const max = equipo.ranking?.[0]?.importe || 1
            const yo = norm(r.nombre) === norm(c.nombre)
            return (
              <div className={`pd-rank${yo ? ' pd-yo' : ''}`} key={r.nombre}>
                <div className="pd-pos">{i + 1}</div>
                <div className="pd-nom">{r.nombre}</div>
                <div className="pd-tr"><div style={{ width: `${max > 0 ? Math.max(2, (r.importe / max) * 100) : 2}%` }} /></div>
                <div className="pd-val">{r.ops} op · {eur0(r.importe)}</div>
              </div>
            )
          })}
        </div>
      )}

      <div className="pd-pie">
        Las cifras del mes salen del mismo motor que el Panel de Comisiones (objetivos prorrateados por horas,
        tramos y pendientes incluidos). Las del día son las ventas con esa fecha y la parte de la comisión del mes
        que les corresponde.
      </div>
    </div>
  )
}

export default function ParteDiarioPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--mercedes-cyan)' }}>Cargando…</div>}>
      <ParteDiarioContent />
    </Suspense>
  )
}

// ── Estilos (variables del programa: el modo claro/oscuro lo manda el tema) ───
const CSS_PARTE = `
.pd-wrap {
  --pd-grad: linear-gradient(135deg, #0078D4 0%, #005A9E 100%);
  --pd-ok: #34D399; --pd-ok-bg: rgba(52,211,153,.12);
  --pd-falta: #FBBF24; --pd-falta-bg: rgba(251,191,36,.12);
  --pd-cero: #94A3B8; --pd-cero-bg: rgba(148,163,184,.12);
  --pd-sombra: 0 4px 14px rgba(0,0,0,.25);
  max-width: 900px; margin: 0 auto; color: var(--text-main);
}
[data-theme='light'] .pd-wrap {
  --pd-ok: #0E9F6E; --pd-ok-bg: #E7F7F0;
  --pd-falta: #C2620A; --pd-falta-bg: #FDF3E3;
  --pd-cero: #64748B; --pd-cero-bg: #F1F5F9;
  --pd-sombra: 0 2px 10px rgba(16,36,63,.08);
}
.pd-wrap .pd-n, .pd-wrap .pd-k, .pd-wrap .pd-vl, .pd-wrap .pd-big { font-variant-numeric: tabular-nums; }

.pd-controles { display:flex; gap:14px; flex-wrap:wrap; align-items:flex-end; margin: 4px 0 18px; }
.pd-controles label { display:flex; flex-direction:column; gap:4px; }
.pd-controles span { font-size:10.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--medium-gray); }
.pd-controles input, .pd-controles select {
  background: var(--bg-input); border:1px solid var(--border-color); color: var(--text-main);
  border-radius:8px; padding:7px 10px; font-size:13px; font-weight:600;
}

.pd-expres { background:var(--bg-card); border:1px solid var(--border-color); border-radius:18px;
  padding:0 0 20px; box-shadow:var(--pd-sombra); overflow:hidden; margin-bottom:16px; }
.pd-franja { height:6px; background:var(--pd-grad); }
.pd-cuerpo { padding:20px 24px 0; }
.pd-fecha { font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--medium-gray); }
.pd-titular { font-size:28px; font-weight:800; letter-spacing:-.025em; line-height:1.2; margin:6px 0 0; }
.pd-titular .pd-verde { color:var(--pd-ok); }
.pd-titular .pd-ambar { color:var(--pd-falta); }
.pd-subtitular { font-size:15px; color:var(--medium-gray); font-weight:600; margin-top:6px; }

.pd-tres { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:18px; }
.pd-gran { text-align:center; padding:12px 8px; border-radius:14px; background:var(--bg-app); }
.pd-gran .pd-n { font-size:30px; font-weight:800; letter-spacing:-.03em; line-height:1.05; }
.pd-gran .pd-t { font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--medium-gray); margin-top:4px; }
.pd-gran .pd-c { font-size:12px; font-weight:700; color:var(--medium-gray); margin-top:2px; opacity:.85; }

.pd-duo { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; }
.pd-destello { border-radius:12px; padding:11px 14px; font-size:14px; line-height:1.45; }
.pd-d-bien { background:var(--pd-ok-bg); color:var(--pd-ok); }
.pd-d-ojo { background:var(--pd-falta-bg); color:var(--pd-falta); }

.pd-semaforo { display:flex; flex-wrap:wrap; gap:7px; margin-top:18px; }
.pd-sem { font-size:12.5px; font-weight:700; padding:5px 11px; border-radius:999px; white-space:nowrap; }
.pd-sem-ok { color:var(--pd-ok); background:var(--pd-ok-bg); }
.pd-sem-medio { color:var(--pd-falta); background:var(--pd-falta-bg); }
.pd-sem-cero { color:var(--pd-cero); background:var(--pd-cero-bg); }

.pd-bloque { margin-top:18px; background:var(--bg-app); border-radius:14px; padding:14px 16px; }
.pd-bloque .pd-tit { font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--medium-gray); margin-bottom:10px; }
.pd-ritmo { display:flex; gap:14px; flex-wrap:wrap; }
.pd-celda { flex:1; min-width:120px; }
.pd-celda .pd-k { font-size:18px; font-weight:800; }
.pd-celda .pd-d { font-size:12px; color:var(--medium-gray); font-weight:600; }
.pd-nota-ritmo { font-size:13.5px; color:var(--medium-gray); font-weight:600; margin-top:10px; }
.pd-nota-ritmo strong { color:var(--text-main); }

.pd-reto { margin-top:18px; background:var(--pd-grad); color:#fff; border-radius:14px;
  padding:14px 18px; font-size:15px; font-weight:700; line-height:1.45; }
.pd-reto small { display:block; font-weight:600; opacity:.85; font-size:12.5px; margin-top:3px; }

.pd-hoy { margin-top:18px; }
.pd-hoy .pd-tit { font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--medium-gray); margin-bottom:9px; }
.pd-item { display:flex; gap:9px; align-items:flex-start; font-size:14px; margin-bottom:6px; }
.pd-cuadro { width:17px; height:17px; border:2px solid var(--border-color); border-radius:5px; flex-shrink:0; margin-top:2px; }

.pd-separador { display:flex; align-items:center; gap:12px; margin:26px 0 4px; }
.pd-separador span { font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--medium-gray); white-space:nowrap; }
.pd-separador::before, .pd-separador::after { content:''; flex:1; height:1px; background:var(--border-color); }

.pd-hero { background:var(--pd-grad); border-radius:18px; padding:22px 24px; color:#fff;
  box-shadow:0 10px 24px -12px rgba(0,90,158,.6); margin:14px 0; }
.pd-fila { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.pd-avatar { width:52px; height:52px; border-radius:16px; background:rgba(255,255,255,.18);
  display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0; }
.pd-hero .pd-fecha { color:rgba(255,255,255,.75); }
.pd-saludo { font-size:25px; font-weight:800; letter-spacing:-.02em; }
.pd-veredicto { font-size:16px; font-weight:600; margin-top:12px; }
.pd-chips { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
.pd-chip { background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.25);
  border-radius:999px; padding:5px 13px; font-size:13px; font-weight:700; }

.pd-ayer { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px; }
.pd-mini { background:var(--bg-card); border:1px solid var(--border-color); border-radius:14px; padding:12px 14px; box-shadow:var(--pd-sombra); }
.pd-et { font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--medium-gray); }
.pd-vl { font-size:22px; font-weight:800; margin-top:2px; }
.pd-vl-sub { font-size:14px; font-weight:700; color:var(--medium-gray); }
.pd-mini .pd-sub { font-size:12px; color:var(--medium-gray); font-weight:600; }

.pd-h2 { font-size:12px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--medium-gray); margin:22px 0 10px; }
.pd-palancas { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.pd-pal { background:var(--bg-card); border:1px solid var(--border-color); border-radius:14px;
  padding:14px 16px; box-shadow:var(--pd-sombra); display:flex; flex-direction:column; gap:9px; }
.pd-pal.pd-destaca { grid-column:1 / -1; }
.pd-pal-top { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.pd-pal-nom { font-weight:800; font-size:15px; }
.pd-estado { font-size:11.5px; font-weight:800; padding:3px 10px; border-radius:999px; white-space:nowrap; }
.pd-e-ok { color:var(--pd-ok); background:var(--pd-ok-bg); }
.pd-e-falta { color:var(--pd-falta); background:var(--pd-falta-bg); }
.pd-e-cero { color:var(--pd-cero); background:var(--pd-cero-bg); }
.pd-linea { font-size:14px; }
.pd-barra { height:7px; background:var(--pd-cero-bg); border-radius:4px; overflow:hidden; }
.pd-barra > div { height:100%; border-radius:4px; background:var(--pd-grad); }
.pd-barra > div.pd-verde { background:linear-gradient(135deg,#34D399,#059669); }
.pd-traduce { font-size:13.5px; font-weight:700; color:var(--pd-falta); background:var(--pd-falta-bg); border-radius:10px; padding:8px 12px; }
.pd-traduce.pd-ok { color:var(--pd-ok); background:var(--pd-ok-bg); }
.pd-animo { font-size:13.5px; color:var(--medium-gray); font-style:italic; }
.pd-cifras { display:flex; gap:16px; font-size:12.5px; color:var(--medium-gray); font-weight:600; flex-wrap:wrap; }
.pd-cifras b { color:var(--text-main); font-weight:800; }

.pd-cierre { margin-top:18px; background:var(--bg-card); border:1px solid var(--border-color);
  border-radius:16px; padding:18px 20px; box-shadow:var(--pd-sombra); }
.pd-tot { display:flex; gap:22px; flex-wrap:wrap; align-items:baseline; justify-content:space-between; }
.pd-big { font-size:32px; font-weight:800; color:#0078D4; }
[data-theme='light'] .pd-big { color:#005A9E; }
.pd-desglose { font-size:13px; color:var(--medium-gray); font-weight:600; }
.pd-frase { margin-top:10px; font-size:14.5px; font-weight:600; }

.pd-rank-bloque { margin-top:18px; }
.pd-rank { display:flex; align-items:center; gap:9px; margin-bottom:7px; font-size:13.5px; }
.pd-rank .pd-pos { width:20px; font-weight:800; color:var(--medium-gray); text-align:center; flex-shrink:0; }
.pd-rank .pd-nom { width:96px; font-weight:700; flex-shrink:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pd-rank .pd-tr { flex:1; height:9px; background:var(--pd-cero-bg); border-radius:5px; overflow:hidden; }
.pd-rank .pd-tr > div { height:100%; border-radius:5px; background:var(--pd-cero); }
.pd-rank.pd-yo .pd-tr > div { background:var(--pd-grad); }
.pd-rank.pd-yo .pd-nom, .pd-rank.pd-yo .pd-val { color:#0078D4; font-weight:800; }
.pd-rank .pd-val { width:118px; text-align:right; font-weight:700; font-size:12.5px; color:var(--medium-gray); flex-shrink:0; }

.pd-pie { margin-top:22px; border-radius:14px; padding:14px 18px; font-size:12.5px; line-height:1.55;
  background:var(--bg-card); border:1px dashed var(--border-color); color:var(--medium-gray); }

@media (max-width: 760px) {
  .pd-tres { grid-template-columns:1fr 1fr; }
  .pd-duo, .pd-ayer, .pd-palancas { grid-template-columns:1fr; }
  .pd-titular { font-size:23px; }
  .pd-cuerpo { padding:16px 16px 0; }
  .pd-rank .pd-nom { width:74px; }
  .pd-rank .pd-val { width:96px; }
}
`
