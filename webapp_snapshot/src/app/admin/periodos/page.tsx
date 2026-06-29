'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { useGuard } from '@/hooks/useGuard'
import { CalendarDays, Copy, Play, Settings, Save, X } from 'lucide-react'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function AdminPeriodosPage() {
  const { authorized } = useGuard('MODULE_ADMIN')
  const [periods, setPeriods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPeriods = () => {
    setLoading(true)
    fetch('/api/admin/periodos')
      .then(res => res.json())
      .then(data => {
        if (data.success) setPeriods(data.periods)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (authorized) {
      fetchPeriods()
    }
  }, [authorized])

  const handleDuplicate = async (periodId: string) => {
    if (!confirm('Crea/regenera el mes siguiente en Borrador con un CLONADO PROFUNDO de toda la configuración (Condiciones Mensuales, bloques de cobro, multiplicadores, catálogos, objetivos, comisiones, reglas extra y Seguimiento Diario). Las VENTAS no se copian (se quedan en el mes actual). Si ese mes ya existe como borrador, se REGENERA por completo. ¿Continuar?')) return
    
    const res = await fetch('/api/admin/periodos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DUPLICATE', periodId })
    })
    const data = await res.json()
    if (data.success) {
      // Clonar también el Seguimiento Diario (estructura; ventas semanales a 0) para dejar el mes completo
      if (data.period?.month && data.period?.year) {
        try {
          await fetch('/api/tracking/clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month: data.period.month, year: data.period.year })
          })
        } catch (e) { /* si falla, el Seguimiento Diario se puede clonar desde su propia pantalla */ }
      }
      fetchPeriods()
    } else {
      alert(`Error: ${data.error}`)
    }
  }

  const handleActivate = async (id: string, currentStatus: string, key: string) => {
    if (currentStatus === 'ACTIVE') return
    const activeP = periods.find(p => p.status === 'ACTIVE')
    const confirmMsg = activeP 
      ? `⚠️ ALERTA DE SEGURIDAD\n\nEstás a punto de ACTIVAR el mes "${key}".\n\nEsto ARCHIVARÁ el mes actual en curso ("${activeP.period_key}") pasando su estado a HISTÓRICO y cerrando sus modificaciones permanentemente.\n\n¿Estás completamente seguro?`
      : `⚠️ ALERTA DE SEGURIDAD\n\nEstás a punto de ACTIVAR el mes "${key}".\n\nActualmente no hay ningún mes activo.\n\n¿Estás seguro?`

    if (!confirm(confirmMsg)) return
    
    const res = await fetch('/api/admin/periodos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'ACTIVE' })
    })
    const data = await res.json()
    if (data.success) {
      fetchPeriods()
    } else {
      alert('Error activando periodo')
    }
  }

  if (authorized === null) return null

  const activePeriod = periods.find(p => p.status === 'ACTIVE')
  const draftPeriods = periods.filter(p => p.status === 'DRAFT')
  const historicPeriods = periods.filter(p => p.status === 'HISTORIC')

  const PeriodRow = ({ p, showActions }: { p: any, showActions: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [formData, setFormData] = useState({
      pymeMultiplier: p.pymeMultiplier ?? 5,
      tramo1Limit: p.tramo1Limit ?? 50,
      tramo2Limit: p.tramo2Limit ?? 80,
      tramo3Limit: p.tramo3Limit ?? 100,
      visitasM1Contactos: p.visitasM1Contactos ?? 25,
      visitasM1Visitas: p.visitasM1Visitas ?? 10,
      visitasM2Contactos: p.visitasM2Contactos ?? 55,
      visitasM2Visitas: p.visitasM2Visitas ?? 30,
      visitasM3Contactos: p.visitasM3Contactos ?? 90,
      visitasM3Visitas: p.visitasM3Visitas ?? 50
    })

    const handleSaveRules = async () => {
      const res = await fetch('/api/admin/periodos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, ...formData })
      })
      const data = await res.json()
      if (data.success) {
        setIsExpanded(false)
        fetchPeriods()
      } else {
        alert('Error guardando reglas: ' + data.error)
      }
    }

    return (
      <div style={{ borderBottom: '1px solid var(--border-color)', background: p.status === 'ACTIVE' ? 'rgba(52, 199, 89, 0.05)' : 'transparent' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, fontWeight: 700, border: '1px solid var(--border-color)', color: 'var(--light-text)' }}>
              {p.period_key}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--light-text)' }}>{p.name || 'Periodo Sin Nombre'}</div>
              <div style={{ fontSize: 13, color: 'var(--medium-gray)', marginTop: 4 }}>ID: {p.id.split('-')[0]}...</div>
            </div>
          </div>
          
          {showActions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setIsExpanded(!isExpanded)} title="Configurar Reglas del Periodo" style={{ background: isExpanded ? 'rgba(255,255,255,0.1)' : 'transparent', color: 'var(--light-text)', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Settings size={16} /> Reglas Globales
              </button>

              {p.status === 'DRAFT' && (
                <button onClick={() => handleActivate(p.id, p.status, p.period_key)} title="Activar Operación en Vivo" style={{ background: 'rgba(52, 199, 89, 0.1)', color: '#34C759', border: '1px solid rgba(52, 199, 89, 0.2)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  <Play size={16} /> Hacer Activo
                </button>
              )}

              {p.status !== 'HISTORIC' && (() => {
                const m = Number(p.month); const y = Number(p.year)
                const nm = m === 12 ? 1 : m + 1; const ny = m === 12 ? y + 1 : y
                const cloneLabel = `Clonar de ${MESES[m - 1] ?? ('Mes ' + m)} a ${MESES[nm - 1] ?? ('Mes ' + nm)} ${ny}`
                return (
                <button onClick={() => handleDuplicate(p.id)} title="Copia toda la configuración de este mes al siguiente; las ventas no se copian" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--light-text)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  <Copy size={16} /> {cloneLabel}
                </button>
                )
              })()}
            </div>
          )}
        </div>

        {isExpanded && (
          <div style={{ padding: '20px', background: 'rgba(0,0,0,0.1)', borderTop: '1px dashed var(--border-color)' }}>
            
            {/* BLOQUE COMISIONES */}
            <h4 style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--mercedes-cyan)', display: 'flex', alignItems: 'center', gap: 8 }}><Settings size={16}/> Configuración Base Pyme & Tramos</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--medium-gray)', marginBottom: 6 }}>Mult. Autotarget Pyme</label>
                <input type="number" step="0.1" value={formData.pymeMultiplier} onChange={e => setFormData(p => ({...p, pymeMultiplier: parseFloat(e.target.value)}))} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--text-main)', color: 'var(--bg-card)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--medium-gray)', marginBottom: 6 }}>Límite Tramo 1 (%)</label>
                <input type="number" step="1" value={formData.tramo1Limit} onChange={e => setFormData(p => ({...p, tramo1Limit: parseFloat(e.target.value)}))} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--text-main)', color: 'var(--bg-card)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--medium-gray)', marginBottom: 6 }}>Límite Tramo 2 (%)</label>
                <input type="number" step="1" value={formData.tramo2Limit} onChange={e => setFormData(p => ({...p, tramo2Limit: parseFloat(e.target.value)}))} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--text-main)', color: 'var(--bg-card)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--medium-gray)', marginBottom: 6 }}>Límite Tramo 3 (%)</label>
                <input type="number" step="1" value={formData.tramo3Limit} onChange={e => setFormData(p => ({...p, tramo3Limit: parseFloat(e.target.value)}))} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--text-main)', color: 'var(--bg-card)' }} />
              </div>
            </div>

            {/* BLOQUE VISITAS */}
            <h4 style={{ margin: '0 0 16px 0', fontSize: 14, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border-color)', paddingTop: 20 }}><CalendarDays size={16}/> Porcentajes de Cumplimiento de Visitas</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* CONTACTOS */}
              <div style={{ background: 'var(--bg-color)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                <h5 style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--light-text)' }}>1. Contactos (Presencial + Teams + Teléfono + NoCliente)</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--medium-gray)', marginBottom: 6 }}>Mes 1 (%)</label>
                    <input type="number" step="1" value={formData.visitasM1Contactos} onChange={e => setFormData(p => ({...p, visitasM1Contactos: parseFloat(e.target.value)}))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--text-main)', color: 'var(--bg-card)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--medium-gray)', marginBottom: 6 }}>Mes 2 (%)</label>
                    <input type="number" step="1" value={formData.visitasM2Contactos} onChange={e => setFormData(p => ({...p, visitasM2Contactos: parseFloat(e.target.value)}))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--text-main)', color: 'var(--bg-card)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--medium-gray)', marginBottom: 6 }}>Mes 3 (%)</label>
                    <input type="number" step="1" value={formData.visitasM3Contactos} onChange={e => setFormData(p => ({...p, visitasM3Contactos: parseFloat(e.target.value)}))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--text-main)', color: 'var(--bg-card)' }} />
                  </div>
                </div>
              </div>

              {/* VISITAS (PRESENCIAL + TEAMS) */}
              <div style={{ background: 'var(--bg-color)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                <h5 style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--light-text)' }}>2. Presenciales + Teams</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--medium-gray)', marginBottom: 6 }}>Mes 1 (%)</label>
                    <input type="number" step="1" value={formData.visitasM1Visitas} onChange={e => setFormData(p => ({...p, visitasM1Visitas: parseFloat(e.target.value)}))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--text-main)', color: 'var(--bg-card)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--medium-gray)', marginBottom: 6 }}>Mes 2 (%)</label>
                    <input type="number" step="1" value={formData.visitasM2Visitas} onChange={e => setFormData(p => ({...p, visitasM2Visitas: parseFloat(e.target.value)}))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--text-main)', color: 'var(--bg-card)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--medium-gray)', marginBottom: 6 }}>Mes 3 (%)</label>
                    <input type="number" step="1" value={formData.visitasM3Visitas} onChange={e => setFormData(p => ({...p, visitasM3Visitas: parseFloat(e.target.value)}))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--text-main)', color: 'var(--bg-card)' }} />
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button onClick={() => setIsExpanded(false)} style={{ background: 'transparent', color: 'var(--medium-gray)', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <X size={16}/> Cancelar
              </button>
              <button onClick={handleSaveRules} style={{ background: 'var(--mercedes-cyan)', color: '#000', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                <Save size={16}/> Guardar Reglas
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: 20, paddingBottom: 100 }}>
      {/* Usamos PageHeader existente */}
      <PageHeader 
        title={<><CalendarDays className="text-cyan" size={28} /> Dashboard de Periodos Operativos</>}
        subtitle="Centro de control estructural: Define qué mes rige la lógica de ventas viva."
        showBack={true}
        backFallback="/admin"
        helpContent={
          <div>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Guía de Administración de Periodos</h4>
            <p style={{ marginBottom: 12 }}>Esta pantalla gestiona los ciclos mensuales de toda la empresa. Aquí defines qué reglas de comisiones y objetivos están activos.</p>
            <ul style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li><strong>Clonar al mes siguiente (ej. «Clonar de Junio a Julio 2026»):</strong> Toma el mes de esa fila, crea el mes consecutivo y realiza un <strong>clonado profundo</strong> de toda la configuración (condiciones mensuales, objetivos por tienda, comisiones, catálogos, reglas extra y seguimiento diario). <strong>Las ventas NO se copian</strong> (se quedan en el mes actual). Si el mes siguiente ya existe como borrador, se <strong>regenera por completo</strong>, así que puedes pulsarlo las veces que quieras.</li>
              <li><strong>Hacer Activo:</strong> Mueve un mes borrador a "Activo" (producción en vivo). Esto cerrará automáticamente el mes que estuviera activo anteriormente, dejándolo en estado Histórico (solo lectura).</li>
              <li><strong>Reglas Globales:</strong> Despliega un panel para editar los multiplicadores Pyme y umbrales de visitas específicos de ese mes.</li>
            </ul>
          </div>
        }
      />

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, color: 'var(--light-text)', margin: 0 }}>Estado del Panel</h2>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Leyendo estructura temporal...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          {/* PERIODO ACTIVO (ESTADO CRITICO) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#34C759', boxShadow: '0 0 10px rgba(52, 199, 89, 0.5)' }}></div>
              <h3 style={{ margin: 0, color: '#34C759', fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>MES ACTIVO (PRODUCCIÓN EN VIVO)</h3>
            </div>
            <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '2px solid rgba(52, 199, 89, 0.3)', overflow: 'hidden' }}>
              {activePeriod ? (
                <PeriodRow p={activePeriod} showActions={true} />
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--medium-gray)' }}>No hay ningún periodo activo actualmente.</div>
              )}
            </div>
          </div>

          {/* DRAFTS */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF9500' }}></div>
              <h3 style={{ margin: 0, color: '#FF9500', fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>BORRADORES FUTUROS (PREPARACIÓN)</h3>
            </div>
            <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              {draftPeriods.length > 0 ? (
                draftPeriods.map(p => <PeriodRow key={p.id} p={p} showActions={true} />)
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--medium-gray)' }}>No hay meses futuros en preparación.</div>
              )}
            </div>
          </div>

          {/* HISTORIC */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--medium-gray)' }}></div>
              <h3 style={{ margin: 0, color: 'var(--medium-gray)', fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>HISTÓRICOS (CERRADOS Y SELLADOS)</h3>
            </div>
            <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden', opacity: 0.8 }}>
              {historicPeriods.length > 0 ? (
                historicPeriods.map(p => <PeriodRow key={p.id} p={p} showActions={false} />)
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--medium-gray)' }}>El archivo histórico está vacío.</div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
