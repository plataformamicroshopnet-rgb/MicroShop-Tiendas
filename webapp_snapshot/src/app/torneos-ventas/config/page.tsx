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
})

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
  const removeConcurso = (idx: number) => setConfig(c => ({ concursos: c.concursos.filter((_, i) => i !== idx) }))

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
      // pos secuencial por orden
      const limpio: TorneosConfig = {
        concursos: config.concursos.filter(c => c.nombre.trim() && c.tipoVenta.trim()).map(c => ({
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
        {config.concursos.map((c, ci) => (
          <div key={c.id} className="card" style={{ padding: 18, border: '1px solid var(--border-color,#e2e8f0)', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: 'var(--mercedes-cyan,#0ea5e9)' }}>Concurso {ci + 1}</h3>
              <button onClick={() => removeConcurso(ci)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Trash2 size={16} /> Quitar</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.5fr 1fr', gap: 14, alignItems: 'start' }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Nombre del concurso</label>
                <input style={{ ...ipt, width: '100%', marginTop: 4 }} value={c.nombre} placeholder="Ej: Seguros" onChange={e => updateConcurso(ci, { nombre: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Ventas que cuentan (Tipo de Venta)</label>
                <div style={{ marginTop: 4 }}>
                  <ProductTreeSelector value={c.tipoVenta} onChange={v => updateConcurso(ci, { tipoVenta: v })} placeholder="Elegir ventas…" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--medium-gray,#64748b)', fontWeight: 600 }}>Se mide por</label>
                <select style={{ ...ipt, width: '100%', marginTop: 4 }} value={c.metrica} onChange={e => updateConcurso(ci, { metrica: e.target.value as any })}>
                  <option value="count">Nº de ventas</option>
                  <option value="importe">Importe (€)</option>
                </select>
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
