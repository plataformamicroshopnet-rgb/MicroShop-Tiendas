'use client'

import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Trophy, Plus, Trash2, Save, Gift } from 'lucide-react'
import ProductTreeSelector from '@/components/ProductTreeSelector'
import { can } from '@/lib/permissions'
import {
  TorneosConfig, Concurso, TorneoPremio, MAX_CONCURSOS, TORNEOS_CONFIG_KEY,
  DEFAULT_TORNEOS_CONFIG, loadTorneosConfig,
} from '@/lib/torneosConfig'

const nuevoConcurso = (): Concurso => ({
  id: 'c' + Date.now(),
  nombre: '',
  tipoVenta: '',
  metrica: 'count',
  premios: [],
  fechaInicio: '',
  fechaFin: '',
  ventana: 'mes',
})

// La configuración que el dueño guardó el 30/06/2026 a las 21:41 y que un
// «Quitar» + «Guardar» borró el 24-ago (la config es GLOBAL y no había red).
// Recuperada de las copias de seguridad; el botón de rescate la carga en el
// editor cuando la lista está vacía — se revisa y se guarda, nada automático.
const CONFIG_RECUPERADA_20260630: Concurso[] = [
  {
    id: 'c1', nombre: 'Dispositivos + Seguros', tipoVenta: 'Dispositivos + Seguros',
    metrica: 'importe', fechaInicio: '', fechaFin: '', ventana: 'mes',
    premios: [{ pos: 1, importe: 100, texto: '' }, { pos: 2, importe: 75, texto: '' },
              { pos: 3, importe: 50, texto: '' }],
  },
  {
    id: 'c2', nombre: 'Seguros (Dispositivo, Smartphone y Tablet)', tipoVenta: 'Seguro',
    metrica: 'count', fechaInicio: '', fechaFin: '', ventana: 'mes',
    premios: [{ pos: 1, importe: 100, texto: '' }, { pos: 2, importe: 75, texto: '' },
              { pos: 3, importe: 50, texto: '' }],
  },
]

export default function ConfiguradorTorneosPage() {
  const [user, setUser] = useState<any>(null)
  const [loaded, setLoaded] = useState(false)
  const [config, setConfig] = useState<TorneosConfig>(DEFAULT_TORNEOS_CONFIG)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d?.user ?? d)).catch(() => setUser(null))
    loadTorneosConfig().then(c => { setConfig(c); setLoaded(true) })
  }, [])

  const autorizado = user && can(user, 'CARD_CONFIG_TORNEOS')

  const updateConcurso = (idx: number, patch: Partial<Concurso>) => {
    setConfig(c => ({ concursos: c.concursos.map((x, i) => i === idx ? { ...x, ...patch } : x) }))
  }
  const addConcurso = () => setConfig(c => c.concursos.length >= MAX_CONCURSOS ? c : ({ concursos: [...c.concursos, nuevoConcurso()] }))
  // CANDADO (24-ago-2026): el dueño quitó «el torneo de agosto» sin saber que la
  // config es GLOBAL y se quedó sin ninguno en ningún mes. Ahora se avisa claro.
  const removeConcurso = (idx: number) => {
    const c = config.concursos[idx]
    const tiene = c?.premios?.some(p => p.importe > 0)
    const msg = `¿Quitar el concurso «${c?.nombre || 'sin nombre'}»?\n\n` +
      'OJO: la configuración es GLOBAL — quitarlo lo quita de TODOS los meses ' +
      '(no solo del que estás viendo).' +
      (tiene ? '\n\nEste concurso tiene PREMIOS EN EUROS configurados.' : '') +
      '\n\nSi solo quieres pararlo un tiempo, ponle fecha de fin en vez de quitarlo.'
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
          ...c, premios: c.premios.map((p, i) => ({ ...p, pos: i + 1, importe: Number(p.importe) || 0 }))
        }))
      }
      const res = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: TORNEOS_CONFIG_KEY, value: JSON.stringify(limpio) })
      })
      const data = await res.json()
      setMsg(data.success ? '✅ Guardado. Recarga el Dashboard para verlo.' : ('❌ ' + (data.error || 'Error')))
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

      <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 10, fontSize: 13, color: 'var(--light-text,#0f172a)' }}>
        ⚠️ Esta configuración es <strong>global</strong>: vale para todos los meses a la vez.
        Para un concurso de un periodo concreto, ponle <strong>fechas</strong> — quitar un
        concurso lo quita de todas partes.
      </div>

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
                <input style={{ ...ipt, width: '100%', marginTop: 4 }} value={c.nombre} placeholder="Ej: Seguros" onChange={e => updateConcurso(ci, { nombre: e.target.value })} />
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

            {/* Premios */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border-color,#e2e8f0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Gift size={16} color="#eab308" />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Premios por posición</span>
                <button onClick={() => addPremio(ci)} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #0ea5e9', color: '#0ea5e9', borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={14} /> Añadir premio</button>
              </div>
              {c.premios.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--medium-gray,#94a3b8)' }}>Sin premios. Pulsa «Añadir premio» para premiar al 1º, 2º…</div>}
              {c.premios.map((p, pi) => (
                <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, width: 30 }}>{pi + 1}º</span>
                  <input type="number" step="0.01" style={{ ...ipt, width: 110 }} value={p.importe || ''} placeholder="€" onChange={e => updatePremio(ci, pi, { importe: Number(e.target.value) })} />
                  <input style={{ ...ipt, flex: 1 }} value={p.texto} placeholder="Texto del premio (ej. Cena, día libre…)" onChange={e => updatePremio(ci, pi, { texto: e.target.value })} />
                  <button onClick={() => removePremio(ci, pi)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={15} /></button>
                </div>
              ))}
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
                🛟 Recuperar los concursos borrados (config del 30/06/2026)
              </button>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Carga en el editor los 2 concursos que había desde el 30/06/2026 con sus premios
                (100/75/50 €). Revísalos y pulsa «Guardar configuración» para dejarlos activos.
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
