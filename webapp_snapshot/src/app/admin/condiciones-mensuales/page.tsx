'use client'

import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Target, PlusCircle, Trash2, Edit2, ListFilter, Award, AlertCircle, Info, Save, X, ArrowUp, ArrowDown, Copy } from 'lucide-react'
import { useGuard } from '@/hooks/useGuard'
import { PeriodSelector } from '@/components/PeriodSelector'
import { usePeriod } from '@/components/PeriodProvider'
import { ConditionType } from '@/components/MonthlyConditionsDisplay'

export interface IMonthlyCondition {
  id: string
  periodKey: string
  type: ConditionType
  title?: string | null
  color?: string | null
  text: string
  amount?: string | null
  order: number
}

const TYPE_OPTIONS: { value: ConditionType; label: string; icon: any; color: string; rgb: string }[] = [
  { value: 'CONDICION', label: 'Condición', icon: ListFilter, color: '#64748b', rgb: '100, 116, 139' },
  { value: 'COMISION_EXTRA', label: 'Comisión Extra', icon: Award, color: '#3b82f6', rgb: '59, 130, 246' },
  { value: 'PENALIZACION', label: 'Penalización', icon: AlertCircle, color: '#ef4444', rgb: '239, 68, 68' },
  { value: 'NOTA', label: 'Nota', icon: Info, color: '#f59e0b', rgb: '245, 158, 11' }
]

export default function AdminMonthlyConditionsPage() {
  const { authorized } = useGuard('MODULE_ADMIN')
  const { activePeriodKey, availablePeriods } = usePeriod()

  // Periodo inmediatamente anterior cronológicamente
  const sortedPeriods = [...availablePeriods].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  )
  const currentIndex = sortedPeriods.findIndex(p => p.period_key === activePeriodKey)
  const previousPeriod = currentIndex > 0 ? sortedPeriods[currentIndex - 1] : null
  
  const [conditions, setConditions] = useState<IMonthlyCondition[]>([])
  const [loading, setLoading] = useState(true)
  
  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<IMonthlyCondition>>({})

  useEffect(() => {
    if (activePeriodKey && authorized) {
      loadConditions()
    }
  }, [activePeriodKey, authorized])

  const loadConditions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/monthly-conditions?periodKey=${activePeriodKey}`)
      const json = await res.json()
      if (json.success) {
        setConditions(json.data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/admin/monthly-conditions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodKey: activePeriodKey,
          type: 'CONDICION',
          text: 'Nueva condición...',
          order: conditions.length
        })
      })
      const json = await res.json()
      if (json.success) {
        setConditions([...conditions, json.data])
        setEditingId(json.data.id)
        setEditForm(json.data)
      }
    } catch (e) {
      alert('Error al crear')
    }
  }

  const handleSave = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/monthly-conditions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      const json = await res.json()
      if (json.success) {
        setConditions(conditions.map(c => c.id === id ? json.data : c))
        setEditingId(null)
      } else {
        alert('Error del servidor: ' + json.error)
      }
    } catch (e: any) {
      alert('Error de conexión al guardar: ' + e.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar el registro definitivamente?')) return
    try {
      const res = await fetch(`/api/admin/monthly-conditions/${id}`, {
        method: 'DELETE'
      })
      const json = await res.json()
      if (json.success) {
        setConditions(conditions.filter(c => c.id !== id))
      } else {
        alert('Error del servidor: ' + json.error)
      }
    } catch (e: any) {
      alert('Error de conexión al borrar: ' + e.message)
    }
  }

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === conditions.length - 1) return

    const newConditions = [...conditions]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    
    // Intercambiar en copia local
    const temp = newConditions[index]
    newConditions[index] = newConditions[swapIndex]
    newConditions[swapIndex] = temp

    // Recalcular el campo "order" para todos y asegurar consistencia
    const updates = newConditions.map((c, i) => ({ id: c.id, order: i }))
    
    // Actualización optimista en UI instantánea
    setConditions(newConditions.map((c, i) => ({ ...c, order: i })))

    try {
      const res = await fetch('/api/admin/monthly-conditions/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
      const json = await res.json()
      if (!json.success) {
        alert('Error al reordenar en la BD: ' + json.error)
        loadConditions() // Revert local state to match DB
      }
    } catch (e: any) {
      alert('Error de red al reordenar: ' + e.message)
      loadConditions()
    }
  }

  const handleCloneFromPrevious = async () => {
    if (!previousPeriod) return
    if (!confirm(`¿Seguro que quieres clonar todas las condiciones del mes ${previousPeriod.period_key} al mes actual (${activePeriodKey})? Se añadirán a las existentes sin borrar nada.`)) return

    try {
      // 1. Obtener condiciones del mes anterior
      const res = await fetch(`/api/admin/monthly-conditions?periodKey=${previousPeriod.period_key}`)
      const json = await res.json()
      if (!json.success || !json.data.length) {
        alert('El mes anterior no tiene condiciones para clonar.')
        return
      }

      // 2. Insertar cada una en el mes actual
      const baseOrder = conditions.length
      const inserts = json.data as IMonthlyCondition[]
      for (let i = 0; i < inserts.length; i++) {
        const item = inserts[i]
        await fetch('/api/admin/monthly-conditions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            periodKey: activePeriodKey,
            type: item.type,
            text: item.text,
            amount: item.amount || null,
            order: baseOrder + i
          })
        })
      }

      await loadConditions()
      alert(`✅ ${inserts.length} condiciones clonadas desde ${previousPeriod.period_key}.`)
    } catch (e: any) {
      alert('Error al clonar: ' + e.message)
    }
  }

  if (authorized === null) return null

  return (
    <div className="w-full" style={{ padding: '24px 32px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
      <PageHeader 
        title={<><Target color="#3b82f6" size={28} /> Condiciones, Comisiones Extras del mes y Penalizaciones</>}
        subtitle="Administrador de comisiones extra por periodo."
        showBack={true}
        helpContent={
          <div>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Condiciones Mensuales</h4>
            <p style={{ margin: 0, lineHeight: 1.5 }}>Gestor de notificaciones directas. Cualquier texto, incentivo puntual, bono de campaña o penalización global que redactes en esta sección, se inyectará de forma inmediata en las pantallas comerciales de toda la plantilla para el mes en curso.</p>
          </div>
        }
      />

      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button 
            onClick={handleAdd}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              backgroundColor: '#3b82f6', color: '#fff',
              padding: '12px 20px', borderRadius: '12px',
              fontWeight: 600, border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
          >
            <PlusCircle size={18} />
            Añadir Línea al Mes Seleccionado
          </button>

          {previousPeriod && (
            <button
              onClick={handleCloneFromPrevious}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: 'transparent', color: 'var(--mercedes-cyan)',
                padding: '12px 20px', borderRadius: '12px',
                fontWeight: 600, border: '1px solid var(--mercedes-cyan)',
                cursor: 'pointer'
              }}
            >
              <Copy size={18} />
              Clonar desde {previousPeriod.period_key}
            </button>
          )}
        </div>
      </div>

      <div style={{ 
        marginTop: '32px', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', 
        gap: '20px' 
      }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Cargando...</div>
        ) : conditions.length === 0 ? (
          <div style={{ 
            padding: '40px', textAlign: 'center', 
            background: 'var(--bg-card)', borderRadius: '16px',
            color: 'var(--text-muted)'
          }}>
            No hay contenido cargado para este mes.
            <br />Selecciona "Añadir Línea" para comenzar.
          </div>
        ) : (
          conditions.map((c, i) => {
            const isEditing = editingId === c.id
            const displayData = isEditing ? editForm : c
            const conf = TYPE_OPTIONS.find(o => o.value === c.type) || TYPE_OPTIONS[0]
            
            
            return (
              <div key={c.id} style={{
                position: 'relative',
                background: 'var(--bg-card)',
                padding: '18px',
                borderRadius: '14px',
                borderTop: isEditing ? '2px solid #3b82f6' : '1px solid var(--border-strong)',
                borderRight: isEditing ? '2px solid #3b82f6' : '1px solid var(--border-strong)',
                borderBottom: isEditing ? '2px solid #3b82f6' : '1px solid var(--border-strong)',
                borderLeft: isEditing ? '4px solid #3b82f6' : `4px solid ${c.color || conf.color}`,
                boxShadow: isEditing ? '0 0 0 4px rgba(59,130,246,0.1)' : '0 2px 6px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease-in-out',
                height: '100%'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  {isEditing ? (
                    <>
                      <select 
                        value={displayData.type}
                        onChange={e => setEditForm({ ...editForm, type: e.target.value as ConditionType })}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--bg-input)', color: 'var(--text-main)', width: '250px' }}
                      >
                        {TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input 
                          type="text"
                          placeholder="Título Personalizado (opcional)"
                          value={displayData.title || ''}
                          onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--bg-input)', color: 'var(--text-main)', flex: 1 }}
                        />
                        <input 
                          type="color"
                          value={displayData.color || conf.color}
                          onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                          style={{ width: '38px', height: '38px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                          title="Color de la tarjeta"
                        />
                      </div>
                      <input 
                        type="text"
                        placeholder="Importe impactante (Ej: +200€ o Gratis)"
                        value={displayData.amount || ''}
                        onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--bg-input)', color: 'var(--text-main)', width: '250px' }}
                      />
                      <textarea 
                        value={displayData.text || ''}
                        onChange={e => setEditForm({ ...editForm, text: e.target.value })}
                        rows={3}
                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--bg-input)', color: 'var(--text-main)', width: '100%', resize: 'vertical' }}
                      />
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ 
                          width: '38px', height: '38px', borderRadius: '10px', 
                          backgroundColor: c.color ? c.color + '1A' : `rgba(${conf.rgb}, 0.1)`, 
                          color: c.color || conf.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <conf.icon size={20} strokeWidth={2.5} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: c.color || conf.color, letterSpacing: '-0.3px' }}>
                          {c.title || conf.label}
                        </h4>
                        <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 400, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {c.text}
                        </div>
                      </div>

                      {c.amount && (() => {
                        const amt = c.amount.trim();
                        const match = amt.match(/^([+\-]?\s*\d+(?:[.,]\d+)?\s*[€%$]?)(.*)/i);
                        let main = amt; let sub = '';
                        if (match) {
                          main = match[1].trim(); sub = match[2].trim();
                        } else {
                          const sp = amt.indexOf(' ');
                          if (sp > -1) { main = amt.substring(0, sp); sub = amt.substring(sp + 1).trim(); }
                        }

                        return (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'baseline',
                            justifyContent: 'center',
                            background: c.color ? c.color + '1A' : `rgba(${conf.rgb}, 0.1)`,
                            color: c.color || conf.color,
                            padding: '8px 18px',
                            borderRadius: '12px',
                            marginTop: 'auto',
                            alignSelf: 'center',
                            gap: '8px'
                          }}>
                            <span style={{ fontWeight: 800, fontSize: '24px', letterSpacing: '-0.5px' }}>{main}</span>
                            {sub && <span style={{ fontWeight: 600, fontSize: '14px', opacity: 0.85 }}>{sub}</span>}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </div>
                
                {/* BOTONES ABSOLUTOS ARRIBA DERECHA */}
                <div style={{ position: 'absolute', top: '14px', right: '14px', display: 'flex', gap: '4px', zIndex: 10 }}>
                  {isEditing ? (
                    <>
                      <button onClick={() => setEditingId(null)} style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-strong)', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                      <button onClick={() => handleSave(c.id)} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Save size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleReorder(i, 'up')} disabled={i === 0} title="Mover Arriba" style={{ background: 'transparent', color: i === 0 ? 'var(--border-strong)' : 'var(--text-muted)', border: 'none', padding: '4px', cursor: i === 0 ? 'not-allowed' : 'pointer' }}><ArrowUp size={16} /></button>
                      <button onClick={() => handleReorder(i, 'down')} disabled={i === conditions.length - 1} title="Mover Abajo" style={{ background: 'transparent', color: i === conditions.length - 1 ? 'var(--border-strong)' : 'var(--text-muted)', border: 'none', padding: '4px', cursor: i === conditions.length - 1 ? 'not-allowed' : 'pointer' }}><ArrowDown size={16} /></button>
                      <button onClick={() => { setEditingId(c.id); setEditForm(c) }} title="Editar" style={{ background: 'transparent', color: '#3b82f6', border: 'none', padding: '4px', cursor: 'pointer', marginLeft: '4px' }}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(c.id)} title="Borrar" style={{ background: 'transparent', color: '#ef4444', border: 'none', padding: '4px', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
