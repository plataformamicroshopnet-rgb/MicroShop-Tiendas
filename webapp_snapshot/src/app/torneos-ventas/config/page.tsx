'use client'

import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Trophy, Plus, Trash2, Save, Gift } from 'lucide-react'
import ProductTreeSelector from '@/components/ProductTreeSelector'
import { can } from '@/lib/permissions'
import { usePeriod } from '@/components/PeriodProvider'
import {
  TorneosConfig, Concurso, TorneoPremio, MAX_CONCURSOS, TORNEOS_CONFIG_KEY_MES,
  loadTorneosConfigMes, generaNotasConcurso, resolverObjetivosTorneo, reglaDeReferencia } from '@/lib/torneosConfig'

const nuevoConcurso = (): Concurso => ({
  id: 'c' + Date.now(),
  nombre: '',
  tipoVenta: '',
  metrica: 'count',
  premios: [],
  fechaInicio: '',
  fechaFin: '',
  fechaInicio2: '',
  fechaFin2: '',
  ventana: 'mes',
  premioModo: 'podio',
  importePorVenta: 0,
  topeBote: 0,
  objetivo2Grupal: 0,
  importePorVenta2: 0,
  palancaRef: '',
  minGrupalPct: 0,
  objetivo2Pct: 0,
  notas: '',
  tituloColor: '',
  tituloSize: 0,
})

// La configuración que el dueño guardó el 30/06/2026 a las 21:41 y que un
// «Quitar» + «Guardar» borró el 24-ago (la config es GLOBAL y no había red).
// Recuperada de las copias de seguridad; el botón de rescate la carga en el
// editor cuando la lista está vacía — se revisa y se guarda, nada automático.
// SOLO JULIO (decisión del dueño, 24-ago: «solo quería recuperar el de Julio»):
// se restaura con fechas 01/07→31/07 y ventana 'tramo', así el concurso queda
// finalizado y no puntúa nada de agosto en adelante.
const CONFIG_RECUPERADA_20260630: Concurso[] = [
  {
    id: 'c1', nombre: 'Dispositivos + Seguros', tipoVenta: 'Dispositivos + Seguros',
    metrica: 'importe', fechaInicio: '2026-07-01', fechaFin: '2026-07-31', ventana: 'tramo',
    premios: [{ pos: 1, importe: 100, texto: '' }, { pos: 2, importe: 75, texto: '' },
              { pos: 3, importe: 50, texto: '' }],
  },
  {
    id: 'c2', nombre: 'Seguros (Dispositivo, Smartphone y Tablet)', tipoVenta: 'Seguro',
    metrica: 'count', fechaInicio: '2026-07-01', fechaFin: '2026-07-31', ventana: 'tramo',
    premios: [{ pos: 1, importe: 100, texto: '' }, { pos: 2, importe: 75, texto: '' },
              { pos: 3, importe: 50, texto: '' }],
  },
]

export default function ConfiguradorTorneosPage() {
  const { activePeriodKey } = usePeriod()
  const [user, setUser] = useState<any>(null)
  const [loaded, setLoaded] = useState(false)
  const [config, setConfig] = useState<TorneosConfig>({ concursos: [] })
  const [origen, setOrigen] = useState<'mes' | 'global' | 'vacio'>('vacio')
  const [saving, setSaving] = useState(false)
  // Reglas de comisiones del mes: para los objetivos en % («llegar al 100%»)
  const [reglasMes, setReglasMes] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d?.user ?? d)).catch(() => setUser(null))
  }, [])

  // Cada MES guarda sus torneos (24-ago-2026): se carga el del mes activo del
  // programa; si aún no tiene y es el mes en curso, la config antigua global
  // aparece de semilla — al guardar queda fijada en ESTE mes para siempre.
  useEffect(() => {
    if (!activePeriodKey) return
    // El periodo llega en DOS pasos (primero el mes de calendario, luego el
    // activo del programa): si la respuesta del periodo viejo aterriza la
    // última, PISA a la buena y el editor sale vacío. Candado de efecto vivo.
    let vivo = true
    // Reglas del mes para los objetivos en % — AQUÍ y no en el montaje: al
    // montar, activePeriodKey aún está vacío (mismo gotcha que el PeriodProvider).
    fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`).then(r => r.json())
      .then(d => { if (vivo) setReglasMes((d?.rules || []).filter((r: any) => !String(r.nombre || '').toLowerCase().includes('solar'))) })
      .catch(() => { if (vivo) setReglasMes([]) })
    setLoaded(false)
    loadTorneosConfigMes(activePeriodKey).then(r => {
      if (!vivo) return
      setConfig(r.config); setOrigen(r.origen); setLoaded(true)
    })
    return () => { vivo = false }
  }, [activePeriodKey])

  const mesLabel = (() => {
    const p = String(activePeriodKey || '').split('_')
    const M = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
               'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return p.length === 2 ? `${M[Number(p[1])] || p[1]} ${p[0]}` : String(activePeriodKey || '')
  })()

  const autorizado = user && can(user, 'CARD_CONFIG_TORNEOS')

  const updateConcurso = (idx: number, patch: Partial<Concurso>) => {
    setConfig(c => ({ concursos: c.concursos.map((x, i) => i === idx ? { ...x, ...patch } : x) }))
  }
  const addConcurso = () => setConfig(c => c.concursos.length >= MAX_CONCURSOS ? c : ({ concursos: [...c.concursos, nuevoConcurso()] }))
  // CANDADO (24-ago-2026): confirmación antes de quitar — con dinero por medio
  // un clic alegre duele. Desde la config POR MES, quitar solo afecta al mes
  // que se está configurando.
  const removeConcurso = (idx: number) => {
    const c = config.concursos[idx]
    const tiene = c?.premios?.some(p => p.importe > 0) || Number(c?.importePorVenta) > 0
    const msg = `¿Quitar el concurso «${c?.nombre || 'sin nombre'}» de ${mesLabel}?` +
      (tiene ? '\n\nOJO: este concurso tiene DINERO configurado.' : '') +
      '\n\n(Solo se quita de este mes; los demás meses conservan los suyos. ' +
      'Recuerda pulsar «Guardar configuración» para que el cambio quede.)'
    if (window.confirm(msg)) setConfig(cfg => ({ concursos: cfg.concursos.filter((_, i) => i !== idx) }))
  }

  const addPremio = (ci: number) => updateConcurso(ci, {
    premios: [...config.concursos[ci].premios, { pos: config.concursos[ci].premios.length + 1, importe: 0, texto: '' }]
  })
  const updatePremio = (ci: number, pi: number, patch: Partial<TorneoPremio>) => {
    const premios = config.concursos[ci].premios.map((p, i) => i === pi ? { ...p, ...patch } : p)
    updateConcurso(ci, { premios })
  }
  const removePremio = (ci: number, pi: number) => {
    const premios = config.concursos[ci].premios.filter((_, i) => i !== pi).map((p, i) => ({ ...p, pos: i + 1 }))
    updateConcurso(ci, { premios })
  }

  const guardar = async () => {
    setSaving(true); setMsg('')
    try {
      // pos secuencial por orden. La métrica 'comisiones' no usa Tipo de Venta,
      // así que no se le exige tipoVenta para guardarse.
      const limpio: TorneosConfig = {
        concursos: config.concursos.filter(c => c.nombre.trim() && (c.metrica === 'comisiones' || c.tipoVenta.trim())).map(c => ({
          // los % se fijan también en unidades al guardar (red de seguridad si
          // en algún sitio no llegan las reglas del mes)
          ...resolverObjetivosTorneo(c, reglasMes),
          premios: c.premios.map((p, i) => ({ ...p, pos: i + 1, importe: Number(p.importe) || 0 }))
        }))
      }
      const res = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: TORNEOS_CONFIG_KEY_MES(activePeriodKey), value: JSON.stringify(limpio) })
      })
      const data = await res.json()
      if (data.success) { setOrigen('mes'); setConfig(limpio) }  // el editor con las unidades ya fijadas
      setMsg(data.success ? `✅ Guardado para ${mesLabel}. Recarga el Dashboard para verlo.` : ('❌ ' + (data.error || 'Error')))
    } catch {
      setMsg('❌ Error de conexión')
    } finally { setSaving(false) }
  }

  if (!loaded) return <div style={{ padding: 40, textAlign: 'center', color: '#0ea5e9' }}><Trophy className="animate-pulse" /><p>Cargando…</p></div>
  if (!autorizado) return <div style={{ padding: 40 }}><PageHeader title={<>Configurador de Torneos</>} subtitle="" showBack /><div style={{ marginTop: 20, padding: 20, background: '#FEE2E2', color: '#991B1B', borderRadius: 10, fontWeight: 600 }}>🔒 No tienes permiso para configurar los torneos. (Se asigna en Gestión de Usuarios → «Configurar Torneos de Ventas».)</div></div>

  const ipt: React.CSSProperties = { padding: 8, borderRadius: 6, border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--app-bg, #fff)', color: 'var(--light-text, #0f172a)' }

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader
        title={<><Trophy color="#eab308" size={26} /> Configurador de Torneos</>}
        subtitle="Decide qué concursos (hasta 3), qué ventas cuentan, cómo se miden y los premios."
        showBack
      />

      <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.4)', borderRadius: 10, fontSize: 13, color: 'var(--light-text,#0f172a)' }}>
        📅 Estás configurando los torneos de <strong>{mesLabel}</strong> — cada mes guarda
        los suyos: lo que pongas el mes que viene NO borra los de este. Para verlos o
        editarlos, cambia el mes del programa arriba a la derecha.
      </div>
      {origen === 'global' && (
        <div style={{ marginTop: 8, padding: '8px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 10, fontSize: 12.5, color: 'var(--light-text,#0f172a)' }}>
          ⚠️ Esto viene de la configuración <strong>antigua</strong> (la global que valía para
          todos los meses). Pulsa <strong>«Guardar configuración»</strong> y quedará fijada en
          {' '}{mesLabel} para siempre.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
        {config.concursos.map((c, ci) => (
          <div key={c.id} className="card" style={{ padding: 18, border: '1px solid var(--border-color,#e2e8f0)', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: 'var(--mercedes-cyan,#0ea5e9)' }}>Concurso {ci + 1}</h3>
              <button onClick={() => removeConcurso(ci)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Trash2 size={16} /> Quitar</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, alignItems: 'start' }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Nombre del concurso</label>
                <input style={{ ...ipt, width: '100%', marginTop: 4,
                                color: c.tituloColor || undefined,
                                fontSize: c.tituloSize ? Math.min(c.tituloSize, 22) : undefined,
                                fontWeight: 700 }}
                       value={c.nombre} placeholder="Ej: EXTRA del mes Altas BAF"
                       onChange={e => updateConcurso(ci, { nombre: e.target.value })} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                  <label style={{ fontSize: 11, color: 'var(--medium-gray,#64748b)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                    Color
                    <input type="color" value={c.tituloColor || '#64748b'}
                           style={{ width: 30, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                           onChange={e => updateConcurso(ci, { tituloColor: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11, color: 'var(--medium-gray,#64748b)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                    Tamaño
                    <select style={{ ...ipt, padding: '2px 6px', fontSize: 11 }} value={c.tituloSize || 0}
                            onChange={e => updateConcurso(ci, { tituloSize: Number(e.target.value) })}>
                      <option value={0}>Normal</option>
                      <option value={15}>Grande</option>
                      <option value={19}>Muy grande</option>
                      <option value={24}>Enorme</option>
                    </select>
                  </label>
                  {(c.tituloColor || c.tituloSize) ? (
                    <button onClick={() => updateConcurso(ci, { tituloColor: '', tituloSize: 0 })}
                            style={{ background: 'none', border: 'none', color: 'var(--medium-gray,#94a3b8)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
                      quitar estilo
                    </button>
                  ) : null}
                </div>
              </div>
              <div>
                {c.metrica === 'comisiones' ? (
                  <div style={{ marginTop: 22, fontSize: 12, color: 'var(--medium-gray,#64748b)', padding: '8px 10px', background: 'rgba(14,165,233,0.06)', border: '1px dashed var(--border-color,#cbd5e1)', borderRadius: 8 }}>
                    Ranking por el <strong>total de comisiones del mes</strong> de cada comercial (misma fuente que Liquidación/MOD). El tipo de venta no aplica.
                  </div>
                ) : (
                  <>
                    <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Ventas que cuentan (Tipo de Venta)</label>
                    <div style={{ marginTop: 4 }}>
                      <ProductTreeSelector value={c.tipoVenta} onChange={v => updateConcurso(ci, { tipoVenta: v })} placeholder="Elegir ventas…" />
                    </div>
                  </>
                )}
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Se mide por</label>
                <select style={{ ...ipt, width: '100%', marginTop: 4 }} value={c.metrica} onChange={e => updateConcurso(ci, { metrica: e.target.value as any })}>
                  <option value="count">Nº de ventas</option>
                  <option value="importe">Importe (€)</option>
                  <option value="comisiones">Comisiones del comercial (€)</option>
                </select>
              </div>
            </div>

            {/* Fechas y ventana de ventas (petición del dueño, 24-ago-2026) */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border-color,#e2e8f0)' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>📅 ¿Cuándo juega este concurso?</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, alignItems: 'start' }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Empieza</label>
                  <input type="date" style={{ ...ipt, width: '100%', marginTop: 4 }} value={c.fechaInicio || ''}
                         onChange={e => updateConcurso(ci, { fechaInicio: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Termina</label>
                  <input type="date" style={{ ...ipt, width: '100%', marginTop: 4 }} value={c.fechaFin || ''}
                         onChange={e => updateConcurso(ci, { fechaFin: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Ventas que puntúan</label>
                  <select style={{ ...ipt, width: '100%', marginTop: 4 }} value={c.ventana || 'mes'}
                          disabled={c.metrica === 'comisiones'}
                          onChange={e => updateConcurso(ci, { ventana: e.target.value as any })}>
                    <option value="mes">Todas las del mes (retroactivo)</option>
                    <option value="tramo">Solo las del tramo de fechas</option>
                  </select>
                </div>
              </div>
              {/* 2º TRAMO (opcional, dueño 25-ago-2026): el concurso descansa y
                  vuelve a jugar — MISMO ranking y MISMO bote, sin crear otro. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, alignItems: 'end', marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>2º tramo — vuelve a jugar (opcional)</label>
                  <input type="date" style={{ ...ipt, width: '100%', marginTop: 4 }} value={c.fechaInicio2 || ''}
                         onChange={e => updateConcurso(ci, { fechaInicio2: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>2º tramo — termina</label>
                  <input type="date" style={{ ...ipt, width: '100%', marginTop: 4 }} value={c.fechaFin2 || ''}
                         onChange={e => updateConcurso(ci, { fechaFin2: e.target.value })} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', lineHeight: 1.5, paddingBottom: 6 }}>
                  {(c.fechaInicio2 || c.fechaFin2)
                    ? 'El concurso descansa entre los dos tramos y vuelve con el MISMO ranking y el mismo bote.'
                    : 'Déjalo vacío si el concurso juega de un tirón.'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', marginTop: 8, lineHeight: 1.5 }}>
                {(!c.fechaInicio && !c.fechaFin)
                  ? 'Sin fechas: el concurso es permanente y cuenta todas las ventas del mes que se esté viendo (como hasta ahora).'
                  : (c.metrica === 'comisiones'
                     ? 'Con métrica de comisiones las fechas dicen cuándo juega el concurso, pero el ranking usa siempre el total de comisiones del MES (los objetivos y tramos son mensuales).'
                     : (c.ventana === 'tramo'
                        ? 'Ejemplo: del 24/08 al 31/08 con «solo las del tramo» → únicamente puntúan las ventas hechas en esos días.'
                        : 'Ejemplo: del 24/08 al 31/08 con «todas las del mes» → el concurso juega esos días, pero puntúa todo lo vendido desde el día 1 (retroactivo).'))}
              </div>
            </div>

            {/* Cómo se premia: podio de siempre, o EXTRA por venta con tope */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border-color,#e2e8f0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Gift size={16} color="#eab308" />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Cómo se premia</span>
                <select style={{ ...ipt, marginLeft: 8 }} value={c.premioModo || 'podio'}
                        onChange={e => updateConcurso(ci, { premioModo: e.target.value as any })}>
                  <option value="podio">🏆 Podio por posición (1º, 2º, 3º…)</option>
                  <option value="porVenta">💶 X € por cada venta (extra del mes, con tope)</option>
                </select>
                {(c.premioModo || 'podio') === 'podio' && (
                  <button onClick={() => addPremio(ci)} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #0ea5e9', color: '#0ea5e9', borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={14} /> Añadir premio</button>
                )}
              </div>

              {(c.premioModo || 'podio') === 'podio' ? (
                <>
                  {c.premios.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--medium-gray,#94a3b8)' }}>Sin premios. Pulsa «Añadir premio» para premiar al 1º, 2º…</div>}
                  {c.premios.map((p, pi) => (
                    <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, width: 30 }}>{pi + 1}º</span>
                      <input type="number" step="0.01" style={{ ...ipt, width: 110 }} value={p.importe || ''} placeholder="€" onChange={e => updatePremio(ci, pi, { importe: Number(e.target.value) })} />
                      <input style={{ ...ipt, flex: 1 }} value={p.texto} placeholder="Texto del premio (ej. Cena, día libre…)" onChange={e => updatePremio(ci, pi, { texto: e.target.value })} />
                      <button onClick={() => removePremio(ci, pi)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={15} /></button>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>€ por cada venta</label>
                    <input type="number" step="0.01" style={{ ...ipt, width: '100%', marginTop: 4 }}
                           value={c.importePorVenta || ''} placeholder="ej. 5"
                           onChange={e => updateConcurso(ci, { importePorVenta: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Tope del bote (€, entre todos)</label>
                    <input type="number" step="0.01" style={{ ...ipt, width: '100%', marginTop: 4 }}
                           value={c.topeBote || ''} placeholder="vacío = sin tope"
                           onChange={e => updateConcurso(ci, { topeBote: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Mínimo individual (ventas)</label>
                    <input type="number" step="1" style={{ ...ipt, width: '100%', marginTop: 4 }}
                           value={c.minIndividual || ''} placeholder="vacío = sin mínimo"
                           onChange={e => updateConcurso(ci, { minIndividual: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Mínimo de equipo (ventas entre todos)</label>
                    <input type="number" step="1" style={{ ...ipt, width: '100%', marginTop: 4 }}
                           value={c.minGrupal || ''} placeholder="vacío = sin mínimo"
                           onChange={e => updateConcurso(ci, { minGrupal: Number(e.target.value) })} />
                  </div>
                  {/* 2º OBJETIVO del premio (dueño, 25-ago-2026): al llegar el equipo,
                      TODAS las ventas pasan al 2º importe — como los tramos de las palancas. */}
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>🎯 2º objetivo del equipo (ventas)</label>
                    <input type="number" step="1" style={{ ...ipt, width: '100%', marginTop: 4 }}
                           value={c.objetivo2Grupal || ''} placeholder="vacío = sin 2º objetivo"
                           onChange={e => updateConcurso(ci, { objetivo2Grupal: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>€ por venta en el 2º objetivo</label>
                    <input type="number" step="0.01" style={{ ...ipt, width: '100%', marginTop: 4 }}
                           value={c.importePorVenta2 || ''} placeholder="ej. 10 (doblar los 5)"
                           onChange={e => updateConcurso(ci, { importePorVenta2: Number(e.target.value) })} />
                  </div>
                  {/* OBJETIVOS EN % (dueño, 26-ago-2026): «llegar al 100%» = el 1º objetivo
                      de la palanca del mes. Se guardan también resueltos en unidades. */}
                  <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, background: 'rgba(14,165,233,0.06)', border: '1px dashed rgba(14,165,233,0.4)', borderRadius: 10, padding: '10px 12px' }}>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>🧭 En % del objetivo de la palanca (opcional)</label>
                      <select style={{ ...ipt, width: '100%', marginTop: 4 }} value={c.palancaRef || ''}
                              onChange={e => updateConcurso(ci, { palancaRef: e.target.value })}>
                        <option value="">— la que casa con el Tipo de Venta —</option>
                        {reglasMes.map((r: any) => (
                          <option key={r.id || r.nombre} value={r.nombre}>{r.nombre} (obj. {r.objPrimerTramo})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Mínimo de equipo en %</label>
                      <input type="number" step="1" style={{ ...ipt, width: '100%', marginTop: 4 }}
                             value={c.minGrupalPct || ''} placeholder="ej. 100"
                             onChange={e => updateConcurso(ci, { minGrupalPct: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>2º objetivo en %</label>
                      <input type="number" step="1" style={{ ...ipt, width: '100%', marginTop: 4 }}
                             value={c.objetivo2Pct || ''} placeholder="ej. 115"
                             onChange={e => updateConcurso(ci, { objetivo2Pct: Number(e.target.value) })} />
                    </div>
                    {(Number(c.minGrupalPct) > 0 || Number(c.objetivo2Pct) > 0) && (() => {
                      const regla = reglaDeReferencia(c, reglasMes)
                      if (!regla) return <div style={{ gridColumn: '1 / -1', fontSize: 12.5, color: '#b45309', fontWeight: 600 }}>⚠️ No encuentro la palanca de referencia en las reglas de {mesLabel}: elígela en el desplegable.</div>
                      const res = resolverObjetivosTorneo(c, reglasMes)
                      const cambioMin = Number(c.minGrupalPct) > 0 && Number(c.minGrupal) > 0 && res.minGrupal !== c.minGrupal
                      const cambioObj = Number(c.objetivo2Pct) > 0 && Number(c.objetivo2Grupal) > 0 && res.objetivo2Grupal !== c.objetivo2Grupal
                      return (
                        <div style={{ gridColumn: '1 / -1', fontSize: 12.5, lineHeight: 1.5 }}>
                          <span style={{ color: '#0f766e', fontWeight: 700 }}>
                            Con «{regla.nombre}» (objetivo {regla.objPrimerTramo}):
                            {Number(c.minGrupalPct) > 0 ? ` mínimo = ${res.minGrupal} ventas` : ''}
                            {Number(c.objetivo2Pct) > 0 ? ` · 2º objetivo = ${res.objetivo2Grupal} ventas` : ''}.
                          </span>
                          {(cambioMin || cambioObj) && (
                            <span style={{ color: '#b45309', fontWeight: 700 }}> ⚠️ El objetivo de la palanca ha cambiado desde el último guardado — pulsa Guardar para fijar los números nuevos.</span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                  <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--medium-gray,#64748b)', lineHeight: 1.5 }}>
                    Sin llegar al <strong>mínimo de equipo</strong> no cobra nadie; sin llegar al
                    <strong> mínimo individual</strong>, ese comercial no cobra (sus ventas cuentan en
                    el ranking pero no gastan bote). El bote se reparte por orden de fecha de venta.
                    {(Number(c.objetivo2Grupal) > 0 || Number(c.importePorVenta2) > 0) && (
                      <> Con el <strong>🎯 2º objetivo</strong>: al llegar el equipo a esas ventas,
                      TODAS las que puntúan pasan a pagarse al importe nuevo — también las ya hechas
                      (ej.: de 5 € a 10 €).</>
                    )}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Nota extra a mano (opcional — las condiciones salen solas)</label>
                <input style={{ ...ipt, width: '100%', marginTop: 4 }} value={c.notas || ''}
                       placeholder="Ej.: ¡Ánimo, que este mes lo bordamos!"
                       onChange={e => updateConcurso(ci, { notas: e.target.value })} />
                {/* Vista previa del texto AUTOMÁTICO que saldrá bajo el título del
                    ranking — escrito desde las condiciones, como el «OJO» de las
                    palancas: lo que se lee es exactamente lo que se paga. */}
                {(() => { const n = generaNotasConcurso(c); return n ? (
                  <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 8, fontSize: 12,
                                background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.35)',
                                color: '#92400E', lineHeight: 1.45 }}>
                    <strong>Así saldrá bajo el título:</strong> {n}
                  </div>
                ) : null })()}
              </div>
            </div>
          </div>
        ))}

        {config.concursos.length < MAX_CONCURSOS && (
          <button onClick={addConcurso} style={{ alignSelf: 'flex-start', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={18} /> Añadir concurso ({config.concursos.length}/{MAX_CONCURSOS})
          </button>
        )}
        {config.concursos.length === 0 && (
          <div style={{ padding: 16, background: 'var(--active-bg,#f1f5f9)', borderRadius: 10, color: 'var(--medium-gray,#64748b)' }}>
            No hay ningún concurso. Añade uno, o guarda así para no mostrar torneos.
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => setConfig({ concursos: CONFIG_RECUPERADA_20260630.map(c => ({ ...c, premios: c.premios.map(p => ({ ...p })) })) })}
                style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, cursor: 'pointer' }}>
                🛟 Recuperar el torneo de JULIO (config del 30/06/2026)
              </button>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Carga en el editor los 2 concursos que había, con sus premios (100/75/50 €) y las
                fechas 01/07 → 31/07 ya puestas. OJO: como ahora cada mes guarda los suyos,
                <strong> pon primero el programa en JULIO</strong> (arriba a la derecha), pulsa este
                botón y luego «Guardar configuración» — así queda guardado en julio, que es donde
                se ven sus ganadores.
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
          <button onClick={guardar} disabled={saving} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 22px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.6 : 1 }}>
            <Save size={18} /> {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
          {msg && <span style={{ fontWeight: 600 }}>{msg}</span>}
        </div>
      </div>
    </div>
  )
}
