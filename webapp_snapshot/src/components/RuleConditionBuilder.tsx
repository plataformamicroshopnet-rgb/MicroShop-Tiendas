'use client'

import React, { useState } from 'react'
import { Plus, Trash2, Settings } from 'lucide-react'

export type ConditionType = 'REQUIRE_GROUP_QTY' | 'REQUIRE_GROUP_PCT' | 'REQUIRE_TEAM_OBJ2' | 'ACCUMULATIVE_TRAMOS' | 'ACCUMULATIVE_FIXED_BASE'

export interface RuleCondition {
  type: ConditionType
  targetGroup: string
  value: number
}

interface Props {
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  availableGroups: string[]
}

export default function RuleConditionBuilder({ value, onChange, disabled, availableGroups }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  let conditions: RuleCondition[] = []
  try {
    if (value && value.startsWith('[')) {
      conditions = JSON.parse(value)
    }
  } catch (e) {
    // If it's old text, ignore or clear it when they open the builder
  }

  const handleAdd = () => {
    const newConds = [...conditions, { type: 'REQUIRE_GROUP_QTY' as ConditionType, targetGroup: availableGroups[0] || '', value: 1 }]
    onChange(JSON.stringify(newConds))
  }

  const handleUpdate = (index: number, field: keyof RuleCondition, val: any) => {
    const newConds = [...conditions]
    newConds[index] = { ...newConds[index], [field]: val }
    onChange(JSON.stringify(newConds))
  }

  const handleRemove = (index: number) => {
    const newConds = [...conditions]
    newConds.splice(index, 1)
    onChange(JSON.stringify(newConds))
  }

  // Si tiene texto antiguo y no es un array JSON, mostrar un botoncito de advertencia
  const isLegacyText = value && !value.startsWith('[')

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          minWidth: 160,
          padding: '6px 10px',
          backgroundColor: isLegacyText ? 'rgba(255, 149, 0, 0.1)' : 'var(--app-bg)',
          color: isLegacyText ? '#f59e0b' : 'var(--light-text)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isLegacyText ? 'Texto antiguo...' : (conditions.length > 0 ? `${conditions.length} condicion(es)` : 'Sin condiciones')}
        </span>
        <Settings size={14} />
      </button>

      {isOpen && !disabled && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: 12,
          zIndex: 50,
          width: 320,
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 13, color: '#f8fafc' }}>Condicionantes</h4>
            <button type="button" onClick={handleAdd} style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <Plus size={14} /> Añadir
            </button>
          </div>

          {isLegacyText && (
            <div style={{ marginBottom: 12, fontSize: 11, color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 8, borderRadius: 4 }}>
              Texto antiguo: "{value}". Añade una condición estructurada para sobrescribirlo.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {conditions.map((cond, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6, backgroundColor: '#0f172a', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    value={cond.type}
                    onChange={e => handleUpdate(idx, 'type', e.target.value)}
                    style={{ flex: 1, padding: 4, fontSize: 11, backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: 4 }}
                  >
                    <option value="REQUIRE_GROUP_QTY">Requiere cantidad de:</option>
                    <option value="REQUIRE_GROUP_PCT">Requiere % objetivo de:</option>
                    <option value="REQUIRE_TEAM_OBJ2">El Tramo 2 es Colectivo (del Equipo)</option>
                    <option value="ACCUMULATIVE_TRAMOS">Tramos Acumulativos (Sumar Ambos x Ud)</option>
                    <option value="ACCUMULATIVE_FIXED_BASE">Tramos Acumulativos (Bono Fijo + Uds Extra)</option>
                  </select>
                  <button type="button" onClick={() => handleRemove(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}>
                    <Trash2 size={14} />
                  </button>
                </div>


                {cond.type !== 'REQUIRE_TEAM_OBJ2' && cond.type !== 'ACCUMULATIVE_TRAMOS' && cond.type !== 'ACCUMULATIVE_FIXED_BASE' && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select
                      value={cond.targetGroup}
                      onChange={e => handleUpdate(idx, 'targetGroup', e.target.value)}
                      style={{ flex: 2, padding: 4, fontSize: 11, backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: 4 }}
                    >
                      <option value="">Selecciona grupo...</option>
                      {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>

                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{cond.type === 'REQUIRE_GROUP_PCT' ? '>=' : '>='}</span>

                    <input
                      type="number"
                      value={cond.value}
                      onChange={e => handleUpdate(idx, 'value', Number(e.target.value))}
                      style={{ flex: 1, padding: 4, fontSize: 11, backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: 4 }}
                    />
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{cond.type === 'REQUIRE_GROUP_PCT' ? '%' : 'uds'}</span>
                  </div>
                )}
              </div>
            ))}

            {conditions.length === 0 && !isLegacyText && (
              <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: '10px 0' }}>
                Sin condiciones adicionales.<br />Se consolidará al llegar a su propio objetivo.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" onClick={() => setIsOpen(false)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '4px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
