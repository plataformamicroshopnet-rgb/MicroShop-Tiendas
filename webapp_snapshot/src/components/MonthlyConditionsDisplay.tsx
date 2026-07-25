'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Info, AlertCircle, Target, Award, ListFilter, Settings2, ArrowUp, ArrowDown, Save, X } from 'lucide-react'
import { usePeriod } from '@/components/PeriodProvider'
import { PageHeader } from '@/components/PageHeader'

export type ConditionType = 'CONDICION' | 'COMISION_EXTRA' | 'PENALIZACION' | 'NOTA'

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

const TYPE_CONFIG = {
  CONDICION: {
    label: 'Condición',
    icon: ListFilter,
    bgColor: 'rgba(100, 116, 139, 0.1)',
    textColor: '#64748b',
    borderColor: 'rgba(100, 116, 139, 0.2)'
  },
  COMISION_EXTRA: {
    label: 'Comisión Extra',
    icon: Award,
    bgColor: 'rgba(59, 130, 246, 0.1)',
    textColor: '#3b82f6',
    borderColor: 'rgba(59, 130, 246, 0.2)'
  },
  PENALIZACION: {
    label: 'Penalización',
    icon: AlertCircle,
    bgColor: 'rgba(239, 68, 68, 0.1)',
    textColor: '#ef4444',
    borderColor: 'rgba(239, 68, 68, 0.2)'
  },
  NOTA: {
    label: 'Nota',
    icon: Info,
    bgColor: 'rgba(245, 158, 11, 0.1)',
    textColor: '#f59e0b',
    borderColor: 'rgba(245, 158, 11, 0.2)'
  }
}

export function MonthlyConditionsDisplay() {
  const { activePeriodKey } = usePeriod()
  const [conditions, setConditions] = useState<IMonthlyCondition[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activePeriodKey) return

    setLoading(true)
    fetch(`/api/admin/monthly-conditions?periodKey=${activePeriodKey}`)
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setConditions(res.data)
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [activePeriodKey])

  const [isEditMode, setIsEditMode] = useState(false)
  const [cardOrder, setCardOrder] = useState<string[]>([])

  useEffect(() => {
    const savedOrder = localStorage.getItem('monthly_conditions_local_order')
    if (savedOrder) {
      try { setCardOrder(JSON.parse(savedOrder)) } catch(e){}
    }
  }, [])

  const sortedConditions = useMemo(() => {
    if (cardOrder.length === 0) return conditions;
    return [...conditions].sort((a, b) => {
      const idxA = cardOrder.indexOf(a.id);
      const idxB = cardOrder.indexOf(b.id);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }, [conditions, cardOrder]);

  const moveCard = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sortedConditions.length - 1) return;

    const newSorted = [...sortedConditions];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newSorted[index];
    newSorted[index] = newSorted[swapIndex];
    newSorted[swapIndex] = temp;

    setCardOrder(newSorted.map(c => c.id));
  };

  const saveOrder = () => {
    const currentOrder = cardOrder.length > 0 ? cardOrder : conditions.map(c => c.id);
    localStorage.setItem('monthly_conditions_local_order', JSON.stringify(currentOrder));
    setIsEditMode(false);
  };

  const cancelEdit = () => {
    const savedOrder = localStorage.getItem('monthly_conditions_local_order')
    if (savedOrder) setCardOrder(JSON.parse(savedOrder))
    else setCardOrder([])
    setIsEditMode(false)
  };

  const headerActions = isEditMode ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={cancelEdit} title="Cancelar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={20} />
      </button>
      <button onClick={saveOrder} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 40, borderRadius: 20, background: '#10b981', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}>
          <Save size={18} /> Guardar Orden
      </button>
    </div>
  ) : (
      <button onClick={() => { setIsEditMode(true); if(cardOrder.length === 0) setCardOrder(conditions.map(c=>c.id)); }} title="Personalizar Orden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}>
          <Settings2 size={20} />
      </button>
  );

  if (loading) {
    return (
      <div className="w-full">
        <PageHeader 
          title={<><Target color="#f59e0b" size={28} /> Condiciones, Comisiones Extras del mes y Penalizaciones</>}
          subtitle="Consulta de condiciones y notas aplicables al periodo actual."
          showBack={true}
        />
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
          Cargando condiciones del mes...
        </div>
      </div>
    )
  }

  if (conditions.length === 0) {
    return (
      <div className="w-full">
        <PageHeader 
          title={<><Target color="#f59e0b" size={28} /> Condiciones, Comisiones Extras del mes y Penalizaciones</>}
          subtitle="Consulta de condiciones y notas aplicables al periodo actual."
          showBack={true}
        />
        {/* Empty state implicitly handled by returning just the header */}
      </div>
    ) 
  }

  return (
    <div className="w-full">
      <div style={{ marginBottom: -8 }}>
        <PageHeader 
          title={<><Target color="#f59e0b" size={28} /> Condiciones, Comisiones Extras del mes y Penalizaciones</>}
          subtitle="Consulta de condiciones y notas aplicables al periodo actual."
          showBack={true}
          headerActions={headerActions}
        />
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes wiggle {
            0% { transform: rotate(0deg); }
            25% { transform: rotate(-0.5deg); }
            50% { transform: rotate(0deg); }
            75% { transform: rotate(0.5deg); }
            100% { transform: rotate(0deg); }
        }
        .wiggle-mode {
            animation: wiggle 0.4s infinite;
            border: 2px dashed #3b82f6 !important;
        }
      `}} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '20px',
        padding: '0',
        alignItems: 'start' /* UI: cada tarjeta con su altura natural, sin igualarse a la más alta */
      }}>
        {sortedConditions.map((condition, i) => {
          const config = TYPE_CONFIG[condition.type]
          const Icon = config.icon

          return (
            <div key={condition.id} className={isEditMode ? 'wiggle-mode' : ''} style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '18px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '14px',
              borderTop: '1px solid var(--border-strong)',
              borderRight: '1px solid var(--border-strong)',
              borderBottom: '1px solid var(--border-strong)',
              borderLeft: `4px solid ${condition.color || config.textColor}`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              transition: 'transform 0.2s ease'
            }}>
              {isEditMode && (
                <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 4, background: 'var(--bg-card)', padding: 4, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid var(--border-light)' }}>
                  <button onClick={(e) => { e.preventDefault(); moveCard(i, 'up') }} disabled={i === 0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: i === 0 ? 'transparent' : 'var(--bg-input)', color: i === 0 ? 'var(--border-strong)' : 'var(--text-main)', cursor: i === 0 ? 'not-allowed' : 'pointer' }}>
                    <ArrowUp size={16} />
                  </button>
                  <button onClick={(e) => { e.preventDefault(); moveCard(i, 'down') }} disabled={i === sortedConditions.length - 1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: i === sortedConditions.length - 1 ? 'transparent' : 'var(--bg-input)', color: i === sortedConditions.length - 1 ? 'var(--border-strong)' : 'var(--text-main)', cursor: i === sortedConditions.length - 1 ? 'not-allowed' : 'pointer' }}>
                    <ArrowDown size={16} />
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div style={{ 
                  width: '36px', height: '36px', borderRadius: '10px', 
                  backgroundColor: condition.color ? condition.color + '1A' : config.bgColor, 
                  color: condition.color || config.textColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '2px'
                }}>
                  <Icon size={18} strokeWidth={2.5} />
                </div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: condition.color || config.textColor, letterSpacing: '-0.3px' }}>
                  {condition.title || config.label}
                </h4>
                <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 400, lineHeight: 1.6, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: condition.text }} />
              </div>

              {condition.amount && (() => {
                const amt = condition.amount.trim();
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
                    background: condition.color ? condition.color + '1A' : config.bgColor,
                    color: condition.color || config.textColor,
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
