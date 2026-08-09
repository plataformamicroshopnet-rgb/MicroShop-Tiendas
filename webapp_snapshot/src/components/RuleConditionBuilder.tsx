'use client'

import React, { useState } from 'react'
import { Plus, Trash2, Settings } from 'lucide-react'
import { TIPOS_DE_VENTA } from './ProductTreeSelector'

export type ConditionType = 'REQUIRE_GROUP_QTY' | 'REQUIRE_GROUP_PCT' | 'REQUIRE_GROUP_PCT_TRAMO2' | 'REQUIRE_STORE_QTY_TRAMO2' | 'REQUIRE_TEAM_OBJ2' | 'REQUIRE_TEAM_OBJ3' | 'REQUIRE_TEAM_OBJ23' | 'ACCUMULATIVE_TRAMOS' | 'ACCUMULATIVE_FIXED_BASE'

export interface RuleCondition {
  type: ConditionType
  // En casi todas es el nombre de otra REGLA. En REQUIRE_STORE_QTY_TRAMO2 es un
  // TIPO DE VENTA (p. ej. «Dispositivos»), porque el mínimo se cuenta sobre las
  // ventas de esa clase, no sobre una regla de comisión.
  targetGroup: string
  value: number
}

// Condicionantes que se piden sobre un Tipo de Venta en vez de sobre otra regla.
const USA_TIPO_DE_VENTA = (t: ConditionType) => t === 'REQUIRE_STORE_QTY_TRAMO2'

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
    // El «sobre qué» nace EN BLANCO, no con el primero de la lista: un valor
    // puesto solo parece elegido, y así es como acabó una condición exigiendo
    // «Alta BAF Total» sin que nadie lo eligiera. En blanco se ve, y el aviso
    // rojo de abajo lo dice hasta que se elige de verdad.
    const newConds = [...conditions, { type: 'REQUIRE_GROUP_QTY' as ConditionType, targetGroup: '', value: 1 }]
    onChange(JSON.stringify(newConds))
  }

  const handleUpdate = (index: number, field: keyof RuleCondition, val: any) => {
    const newConds = [...conditions]
    newConds[index] = { ...newConds[index], [field]: val }
    // Al cambiar de tipo cambia la lista de la que se elige (reglas o Tipos de
    // Venta). Si lo que había guardado no está en la lista nueva hay que soltarlo
    // — pero SE DEJA EN BLANCO, no se pone el primero de la lista.
    //
    // Antes se ponía el primero «para que la condición no se quedara sin
    // valor», y eso resultó peor: el primero de los Tipos de Venta es «Alta BAF
    // Total», así que al elegir «mínimo EN CADA TIENDA» se quedaba exigiendo 30
    // altas BAF por tienda en vez de 30 dispositivos, sin que nada lo dijera, y
    // el motor lo aplicaba. Un valor puesto solo parece elegido; uno en blanco
    // se ve, y además abajo sale un aviso en rojo.
    if (field === 'type') {
      const actual = String(newConds[index].targetGroup || '')
      const lista = USA_TIPO_DE_VENTA(val) ? TIPOS_DE_VENTA : availableGroups
      if (!lista.includes(actual)) newConds[index].targetGroup = ''
    }
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
          // Ancha pero nunca mas que la pantalla, y contando el padding: asi la
          // tarjeta no se desborda ni en un movil.
          width: 'min(94vw, 400px)',
          boxSizing: 'border-box',
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
                    style={{ flex: 1, minWidth: 0, maxWidth: '100%', padding: 4, fontSize: 11, backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: 4 }}
                  >
                    <option value="REQUIRE_GROUP_QTY">Requiere cantidad de:</option>
                    <option value="REQUIRE_GROUP_PCT">Requiere % objetivo de:</option>
                    <option value="REQUIRE_GROUP_PCT_TRAMO2">Del Tramo 2 en adelante: % objetivo de…</option>
                    <option value="REQUIRE_STORE_QTY_TRAMO2">Del Tramo 2 en adelante: mínimo EN CADA TIENDA de…</option>
                    <option value="REQUIRE_TEAM_OBJ2">El Tramo 2 es Colectivo (del Equipo)</option>
                    <option value="REQUIRE_TEAM_OBJ3">El Tramo 3 es Colectivo (del Equipo)</option>
                    <option value="REQUIRE_TEAM_OBJ23">El Tramo 2 y 3 son Colectivos (del Equipo)</option>
                    <option value="ACCUMULATIVE_TRAMOS">Tramos Acumulativos (Sumar Ambos x Ud)</option>
                    <option value="ACCUMULATIVE_FIXED_BASE">Tramos Acumulativos (Bono Fijo + Uds)</option>
                  </select>
                  <button type="button" onClick={() => handleRemove(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}>
                    <Trash2 size={14} />
                  </button>
                </div>


                {cond.type !== 'REQUIRE_TEAM_OBJ2' && cond.type !== 'REQUIRE_TEAM_OBJ3' && cond.type !== 'REQUIRE_TEAM_OBJ23' && cond.type !== 'ACCUMULATIVE_TRAMOS' && cond.type !== 'ACCUMULATIVE_FIXED_BASE' && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={cond.targetGroup}
                      onChange={e => handleUpdate(idx, 'targetGroup', e.target.value)}
                      style={{ flex: 2, minWidth: 0, maxWidth: '100%', padding: 4, fontSize: 11, backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: 4 }}
                    >
                      <option value="">{USA_TIPO_DE_VENTA(cond.type) ? 'Selecciona tipo de venta...' : 'Selecciona grupo...'}</option>
                      {(USA_TIPO_DE_VENTA(cond.type) ? TIPOS_DE_VENTA : availableGroups).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>

                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{cond.type === 'REQUIRE_GROUP_PCT' ? '>=' : '>='}</span>

                    <input
                      type="number"
                      value={cond.value}
                      onChange={e => handleUpdate(idx, 'value', Number(e.target.value))}
                      style={{ flex: 1, minWidth: 0, maxWidth: '100%', padding: 4, fontSize: 11, backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: 4 }}
                    />
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{(cond.type === 'REQUIRE_GROUP_PCT' || cond.type === 'REQUIRE_GROUP_PCT_TRAMO2') ? '%' : 'uds'}</span>
                  </div>
                )}

                {/* Sin elegir sobre qué, la condición NO hace nada. Antes se
                    quedaba así en silencio (o con el primero de la lista puesto
                    solo): ahora se ve en rojo. */}
                {cond.type !== 'REQUIRE_TEAM_OBJ2' && cond.type !== 'REQUIRE_TEAM_OBJ3' && cond.type !== 'REQUIRE_TEAM_OBJ23'
                  && cond.type !== 'ACCUMULATIVE_TRAMOS' && cond.type !== 'ACCUMULATIVE_FIXED_BASE'
                  && !String(cond.targetGroup || '').trim() && (
                  <div style={{ fontSize: 10.5, color: '#fca5a5', fontWeight: 700, lineHeight: 1.4 }}>
                    ⚠ Falta elegir sobre qué: así esta condición no se aplica.
                  </div>
                )}

                {USA_TIPO_DE_VENTA(cond.type) && (
                  <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
                    Se mira tienda por tienda. Si <b>una sola</b> se queda por debajo,
                    esta palanca se paga al Tramo 1 para todo el equipo. Cuenta ventas
                    (no euros) y la tienda es la del comercial en «Horarios de Comerciales».
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
