'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Settings2, Star, Thermometer, Gauge, Medal, Trophy,
  Plus, Trash2, Save, RotateCcw,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import ProductTreeSelector from '@/components/ProductTreeSelector'
import { can } from '@/lib/permissions'
import {
  DashboardConfig, DashKpi, DashMedalla, DashBloqueTipos, DashMetrica,
  DASHBOARD_CONFIG_KEY, MAX_KPIS, MAX_MEDALLAS, TIPO_AUTO,
  DEFAULT_DASHBOARD_CONFIG, loadDashboardConfig, parseDashboardConfig,
} from '@/lib/dashboardConfig'

// ─── Estilos compartidos (variables del tema de Tiendas) ────────────────────

const ipt: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)',
  background: 'var(--bg-input)', color: 'var(--light-text)', fontSize: 13, outline: 'none', width: '100%',
}
const lbl: React.CSSProperties = {
  fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600, display: 'block', marginBottom: 4,
}
const subCard: React.CSSProperties = {
  border: '1px solid var(--border-color)', borderRadius: 10, padding: 14,
}
const addBtn: React.CSSProperties = {
  alignSelf: 'flex-start', background: 'transparent', color: 'var(--mercedes-cyan)',
  border: '1px dashed var(--mercedes-cyan)', borderRadius: 8, padding: '8px 14px',
  fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
}
const delBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, padding: 0,
}

const uid = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

const nuevoKpi = (): DashKpi => ({ id: uid('k'), nombre: '', tipoVenta: '', metrica: 'count', objetivo: 0 })
const nuevaMedalla = (): DashMedalla => ({ id: uid('m'), emoji: '🏅', nombre: '', tipoVenta: '', metrica: 'count' })

// ─── Editor de un bloque (nombre + tipo de venta + métrica) ─────────────────

function BloqueEditor({ bloque, onChange, allowClientesMulti = false, allowComisiones = false, allowAuto = false, placeholder }: {
  bloque: DashBloqueTipos
  onChange: (patch: Partial<DashBloqueTipos>) => void
  allowClientesMulti?: boolean
  allowComisiones?: boolean
  /** KPIs y Carrera: modo AUTOMÁTICO = seguir a la regla del mes homónima. */
  allowAuto?: boolean
  placeholder?: string
}) {
  // Solo la Vitrina de Medallas ofrece 'clientesMulti' y solo Carrera/Medallas
  // ofrecen 'comisiones'; si una config antigua trae esas métricas en otro
  // bloque, se muestran igualmente para no descuadrar el select.
  const showMulti = allowClientesMulti || bloque.metrica === 'clientesMulti'
  const showComisiones = allowComisiones || bloque.metrica === 'comisiones'
  const esComisiones = bloque.metrica === 'comisiones'
  const esAuto = String(bloque.tipoVenta || '').trim() === TIPO_AUTO
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'start' }}>
        <div>
          <label style={lbl}>Nombre del bloque</label>
          <input
            style={ipt}
            value={bloque.nombre}
            placeholder={placeholder || 'Ej: Alta BAF Total'}
            onChange={e => onChange({ nombre: e.target.value })}
          />
        </div>
        {!esComisiones && (
          <div>
            <label style={lbl}>Tipos de venta que cuentan</label>
            {esAuto ? (
              <button
                type="button"
                onClick={() => onChange({ tipoVenta: '' })}
                title="Ahora sigue a la regla del mes; pulsa para elegir los tipos a mano"
                style={{ ...ipt, textAlign: 'left', cursor: 'pointer', color: 'var(--mercedes-cyan)', fontWeight: 700 }}
              >
                ⚙ Automático (regla del mes) — cambiar
              </button>
            ) : (
              <>
                <ProductTreeSelector
                  value={bloque.tipoVenta}
                  onChange={v => onChange({ tipoVenta: v })}
                  placeholder="Todas las ventas"
                />
                {allowAuto && (
                  <button
                    type="button"
                    onClick={() => onChange({ tipoVenta: TIPO_AUTO })}
                    style={{ background: 'none', border: 'none', color: 'var(--mercedes-cyan)', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, padding: '4px 0 0 0' }}
                  >
                    ↩ Volver a automático (regla del mes)
                  </button>
                )}
              </>
            )}
          </div>
        )}
        <div>
          <label style={lbl}>Se mide por</label>
          <select style={ipt} value={bloque.metrica} onChange={e => onChange({ metrica: e.target.value as DashMetrica })}>
            <option value="count">Nº de ventas</option>
            <option value="importe">Importe (€)</option>
            {showMulti && <option value="clientesMulti">Clientes con &gt;1 operación</option>}
            {showComisiones && <option value="comisiones">Comisiones del comercial (€)</option>}
          </select>
        </div>
      </div>
      {esComisiones ? (
        <div style={{ fontSize: 11.5, color: 'var(--medium-gray)', padding: '8px 10px', background: 'rgba(0, 173, 239, 0.06)', border: '1px dashed var(--border-color)', borderRadius: 8 }}>
          💶 Ranking por el <strong>total de comisiones del mes</strong> de cada comercial (misma fuente que
          Liquidación/MOD). El tipo de venta no aplica.
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: 'var(--medium-gray)' }}>
          {esAuto
            ? 'AUTOMÁTICO: cuenta los tipos de venta de la regla del mes que se llame igual que este bloque (columna «Tipo de Venta» de Reglas Globales) — se actualiza solo cada mes.'
            : !bloque.tipoVenta.trim()
              ? 'Sin nada marcado cuentan TODAS las ventas activas (p. ej. Facturación). Marca una carpeta para el grupo entero, o despliégala y elige productos sueltos.'
              : bloque.metrica === 'clientesMulti'
                ? 'Lo marcado filtra qué ventas cuentan para el recuento de operaciones por cliente.'
                : `Cuentan: ${bloque.tipoVenta}.`}
        </div>
      )}
    </div>
  )
}

function SectionCard({ icon, title, description, children }: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon}
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--light-text)' }}>{title}</h2>
      </div>
      <p style={{ margin: '6px 0 14px 0', fontSize: 12.5, color: 'var(--medium-gray)' }}>{description}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

const MVP_BLOQUES: { key: 'mvpPrincipal' | 'mvpNominado1' | 'mvpNominado2'; label: string }[] = [
  { key: 'mvpPrincipal', label: 'Principal' },
  { key: 'mvpNominado1', label: 'Nominado 1' },
  { key: 'mvpNominado2', label: 'Nominado 2' },
]

export default function ConfigDashboardPage() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [userChecked, setUserChecked] = useState(false)
  const [config, setConfig] = useState<DashboardConfig>(() => JSON.parse(JSON.stringify(DEFAULT_DASHBOARD_CONFIG)))
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setUser(d?.user ?? d))
      .catch(() => setUser(null))
      .finally(() => setUserChecked(true))
    loadDashboardConfig().then(c => { setConfig(c); setLoaded(true) })
  }, [])

  // Mismo permiso que el configurador de Torneos (se asigna en Gestión de Usuarios).
  const autorizado = user && can(user, 'CARD_CONFIG_TORNEOS')
  // El POST /api/settings solo acepta ADMIN / JEFE DE VENTAS: sin ese rol, modo
  // solo-lectura (evita editar media hora y perderlo todo con un 401 al guardar).
  const rol = String(user?.role || '').toUpperCase()
  const puedeGuardar = rol === 'ADMIN' || rol === 'JEFE DE VENTAS'

  // ── MVP ──
  const updateMvp = (key: 'mvpPrincipal' | 'mvpNominado1' | 'mvpNominado2', patch: Partial<DashBloqueTipos>) =>
    setConfig(c => ({ ...c, [key]: { ...c[key], ...patch } } as DashboardConfig))

  // ── KPIs ──
  const updateKpi = (idx: number, patch: Partial<DashKpi>) =>
    setConfig(c => ({ ...c, kpis: c.kpis.map((x, i) => i === idx ? { ...x, ...patch } : x) }))
  const addKpi = () =>
    setConfig(c => c.kpis.length >= MAX_KPIS ? c : { ...c, kpis: [...c.kpis, nuevoKpi()] })
  const removeKpi = (idx: number) =>
    setConfig(c => c.kpis.length <= 1 ? c : { ...c, kpis: c.kpis.filter((_, i) => i !== idx) })

  // ── Carrera ──
  const updateCarrera = (patch: Partial<DashBloqueTipos>) =>
    setConfig(c => ({ ...c, carrera: { ...c.carrera, ...patch } }))

  // ── Medallas ──
  const updateMedalla = (idx: number, patch: Partial<DashMedalla>) =>
    setConfig(c => ({ ...c, medallas: c.medallas.map((x, i) => i === idx ? { ...x, ...patch } : x) }))
  const addMedalla = () =>
    setConfig(c => c.medallas.length >= MAX_MEDALLAS ? c : { ...c, medallas: [...c.medallas, nuevaMedalla()] })
  const removeMedalla = (idx: number) =>
    setConfig(c => ({ ...c, medallas: c.medallas.filter((_, i) => i !== idx) }))

  // ── Guardar / Restaurar ──
  const guardar = async () => {
    if (!puedeGuardar) {
      alert('Solo un ADMIN o el Jefe de Ventas pueden guardar esta configuración.')
      return
    }
    setSaving(true)
    try {
      // Limpieza previa: fuera KPIs y medallas sin nombre.
      const limpio: DashboardConfig = {
        ...config,
        kpis: config.kpis.filter(k => k.nombre.trim()),
        medallas: config.medallas.filter(m => m.nombre.trim()),
      }
      const saneada = parseDashboardConfig(limpio)
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: DASHBOARD_CONFIG_KEY, value: JSON.stringify(saneada) }),
      })
      const data = await res.json()
      if (data?.success) {
        setConfig(saneada)
        alert('✅ Configuración guardada. El Dashboard Tiempo Real la aplicará al recargar.')
      } else {
        alert('❌ No se pudo guardar: ' + (data?.error || 'error desconocido'))
      }
    } catch {
      alert('❌ Error de conexión al guardar.')
    } finally {
      setSaving(false)
    }
  }

  const restaurar = () => {
    if (!confirm('¿Restaurar la configuración por defecto?\n\nSe repondrán los valores iniciales en pantalla. NO se guarda nada hasta que pulses «Guardar configuración».')) return
    setConfig(JSON.parse(JSON.stringify(DEFAULT_DASHBOARD_CONFIG)))
  }

  if (!userChecked || !loaded) {
    return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Cargando configuración del Dashboard…</div>
  }
  if (!autorizado) {
    return (
      <div style={{ padding: 40 }}>
        <PageHeader title={<>Configurar Dashboard</>} subtitle="" showBack onBack={() => router.push('/')} showPeriodSelector={false} />
        <div style={{ marginTop: 20, padding: 20, background: '#FEE2E2', color: '#991B1B', borderRadius: 10, fontWeight: 600 }}>
          🔒 No tienes permiso para configurar el Dashboard. (Se asigna en Gestión de Usuarios → «Configurar Torneos de Ventas».)
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <PageHeader
          title={<><Settings2 color="var(--mercedes-cyan)" size={26} /> Configurar Dashboard</>}
          subtitle="Elige qué tipos de venta cuentan en cada bloque del Dashboard Tiempo Real. Los Torneos se configuran en su propia pantalla."
          showBack
          onBack={() => router.push('/')}
          showPeriodSelector={false}
          headerActions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={restaurar}
                title="Repone los valores por defecto en pantalla (sin guardar)"
                style={{
                  background: 'transparent', color: 'var(--medium-gray)', border: '1px solid var(--border-color)',
                  borderRadius: 8, padding: '10px 14px', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap',
                }}
              >
                <RotateCcw size={16} /> Restaurar por defecto
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={saving || !puedeGuardar}
                title={puedeGuardar ? undefined : 'Solo ADMIN o Jefe de Ventas pueden guardar'}
                style={{
                  background: 'var(--mercedes-cyan)', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '10px 16px', fontWeight: 800, cursor: puedeGuardar ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap',
                  opacity: saving || !puedeGuardar ? 0.5 : 1,
                }}
              >
                <Save size={16} /> {saving ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </div>
          }
        />

        {!puedeGuardar && (
          <div style={{
            margin: '0 0 14px 0', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#B45309',
          }}>
            👀 Modo consulta: puedes revisar la configuración, pero solo un ADMIN o el Jefe de Ventas pueden guardarla.
          </div>
        )}

        {/* Nota: los Torneos tienen su propio configurador */}
        <div style={{
          margin: '0 0 18px 0', padding: '10px 14px', borderRadius: 10, fontSize: 12.5,
          border: '1px dashed var(--border-color)', color: 'var(--medium-gray)',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <Trophy size={15} color="#eab308" />
          <span>El bloque de <strong>Torneos de Ventas</strong> no se configura aquí:</span>
          <Link href="/torneos-ventas/config" style={{ color: 'var(--mercedes-cyan)', fontWeight: 700, textDecoration: 'none' }}>
            abrir el Configurador de Torneos →
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* 1 ── Destacados y Nominados MVP */}
          <SectionCard
            icon={<Star size={20} color="var(--mercedes-cyan)" />}
            title="Destacados y Nominados MVP"
            description="Tres bloques fijos: el destacado principal y los dos nominados. Cada uno decide qué ventas cuentan y cómo se miden."
          >
            <div style={{ ...subCard, background: 'rgba(0, 173, 239, 0.04)' }}>
              <label style={lbl}>Ámbito del bloque</label>
              <select
                style={{ ...ipt, maxWidth: 420 }}
                value={config.mvpAmbito}
                onChange={e => setConfig(c => ({ ...c, mvpAmbito: e.target.value === 'HOY' ? 'HOY' : 'MES' }))}
              >
                <option value="MES">Mes completo (líderes del mes)</option>
                <option value="HOY">Hoy (líderes del día; si un apartado no tiene ventas hoy, enseña al del mes)</option>
              </select>
            </div>
            {MVP_BLOQUES.map(({ key, label }) => (
              <div key={key} style={subCard}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800, color: 'var(--mercedes-cyan)' }}>{label}</h3>
                <BloqueEditor bloque={config[key]} onChange={patch => updateMvp(key, patch)} placeholder="Ej: Facturación" />
              </div>
            ))}
          </SectionCard>

          {/* 2 ── Termómetro Diario */}
          <SectionCard
            icon={<Thermometer size={20} color="#ef4444" />}
            title="Termómetro Diario"
            description={`De 1 a ${MAX_KPIS} KPIs con objetivo mensual. El termómetro compara el avance del mes contra cada objetivo; el primero de la lista ocupa la fila completa con el reto diario.`}
          >
            {config.kpis.map((k, ki) => (
              <div key={k.id} style={subCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--mercedes-cyan)' }}>KPI {ki + 1}</h3>
                  <button
                    type="button"
                    onClick={() => removeKpi(ki)}
                    disabled={config.kpis.length <= 1}
                    title={config.kpis.length <= 1 ? 'El termómetro necesita al menos 1 KPI' : 'Quitar KPI'}
                    style={{ ...delBtn, opacity: config.kpis.length <= 1 ? 0.35 : 1, cursor: config.kpis.length <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <Trash2 size={15} /> Quitar
                  </button>
                </div>
                <BloqueEditor bloque={k} onChange={patch => updateKpi(ki, patch)} allowAuto placeholder="Ej: Alta BAF Total" />
                <div style={{ marginTop: 10, maxWidth: 280 }}>
                  <label style={lbl}>{k.metrica === 'importe' ? 'Objetivo mensual (€)' : 'Objetivo mensual (nº de ventas)'}</label>
                  <input
                    type="number"
                    min={0}
                    step={k.metrica === 'importe' ? '0.01' : '1'}
                    style={ipt}
                    value={k.objetivo || ''}
                    placeholder="0"
                    onChange={e => updateKpi(ki, { objetivo: Number(e.target.value) || 0 })}
                  />
                  <div style={{ fontSize: 11.5, color: 'var(--medium-gray)', marginTop: 4 }}>
                    0 = automático: usa el objetivo de la regla del mes con este mismo nombre
                    (y si ese mes no hay regla, el objetivo histórico del KPI).
                  </div>
                </div>
              </div>
            ))}
            {config.kpis.length < MAX_KPIS && (
              <button type="button" onClick={addKpi} style={addBtn}>
                <Plus size={16} /> Añadir KPI ({config.kpis.length}/{MAX_KPIS})
              </button>
            )}
          </SectionCard>

          {/* 3 ── Cuenta Kilómetros */}
          <SectionCard
            icon={<Gauge size={20} color="#22c55e" />}
            title="Cuenta Kilómetros"
            description="La carrera de la home. Un único bloque: qué ventas hacen avanzar a cada comercial."
          >
            <div style={subCard}>
              <BloqueEditor bloque={config.carrera} onChange={updateCarrera} allowComisiones allowAuto placeholder="Ej: Alta BAF Convergente" />
            </div>
          </SectionCard>

          {/* 4 ── Vitrina de Medallas */}
          <SectionCard
            icon={<Medal size={20} color="#f59e0b" />}
            title="Vitrina de Medallas"
            description={`Hasta ${MAX_MEDALLAS} medallas. Aquí la métrica admite además «Clientes con >1 operación» y «Comisiones del comercial (€)».`}
          >
            {config.medallas.map((m, mi) => (
              <div key={m.id} style={subCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--mercedes-cyan)' }}>Medalla {mi + 1}</h3>
                  <button type="button" onClick={() => removeMedalla(mi)} style={delBtn}><Trash2 size={15} /> Quitar</button>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 72, flexShrink: 0 }}>
                    <label style={lbl}>Emoji</label>
                    <input
                      style={{ ...ipt, textAlign: 'center', fontSize: 18 }}
                      value={m.emoji}
                      maxLength={4}
                      onChange={e => updateMedalla(mi, { emoji: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <BloqueEditor
                      bloque={m}
                      onChange={patch => updateMedalla(mi, patch)}
                      allowClientesMulti
                      allowComisiones
                      placeholder="Ej: Rey del Swap"
                    />
                  </div>
                </div>
              </div>
            ))}
            {config.medallas.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--medium-gray)' }}>
                Sin medallas: la vitrina quedará vacía en el Dashboard.
              </div>
            )}
            {config.medallas.length < MAX_MEDALLAS && (
              <button type="button" onClick={addMedalla} style={addBtn}>
                <Plus size={16} /> Añadir medalla ({config.medallas.length}/{MAX_MEDALLAS})
              </button>
            )}
          </SectionCard>

        </div>
      </div>
    </div>
  )
}
