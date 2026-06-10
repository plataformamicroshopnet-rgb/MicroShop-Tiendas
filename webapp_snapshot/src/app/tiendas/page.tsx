'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Briefcase, CreditCard, Smartphone, ShieldCheck, Tag, Target, Globe, Settings2, ArrowUp, ArrowDown, Save, X, Calculator, Package } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useGuard } from '@/hooks/useGuard'
import { PeriodSelector } from '@/components/PeriodSelector'

export default function TiendasHubPage() {
  const { authorized, user } = useGuard('MODULE_TIENDAS')
  const router = useRouter()

  const [isEditMode, setIsEditMode] = useState(false)
  const [cardOrder, setCardOrder] = useState<string[]>([])

  useEffect(() => {
    // Cargar el orden guardado localmente al abrir la pantalla
    const savedOrder = localStorage.getItem('tiendas_hub_card_order')
    if (savedOrder) {
      try {
        setCardOrder(JSON.parse(savedOrder))
      } catch (e) {
        console.error('Error parsing card order', e)
      }
    }
  }, [])

  const cards = [
    {
      title: 'Ventas Tiendas',
      description: 'Acceso al módulo principal de registro, tracking y gestión de ventas del canal.',
      icon: Briefcase,
      action: () => router.push('/ventas-tiendas'),
      bgIcon: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.2) 100%)',
      colorIcon: '#3b82f6',
      isMain: true
    },
    {
      title: 'Comisiones',
      description: 'Cálculo de retribuciones, métricas de éxito y liquidaciones en tiempo real.',
      icon: CreditCard,
      action: () => router.push('/comisiones'),
      bgIcon: 'linear-gradient(135deg, rgba(0, 173, 239, 0.15) 0%, rgba(0, 150, 200, 0.2) 100%)',
      colorIcon: 'var(--mercedes-cyan)',
      isMain: false
    },
    {
      title: 'Caja',
      description: 'Gestión de entradas, salidas y trazabilidad de efectivo entre tiendas y Central.',
      icon: Calculator,
      action: () => router.push('/tiendas/caja'),
      bgIcon: 'linear-gradient(135deg, rgba(0, 173, 239, 0.15) 0%, rgba(0, 150, 200, 0.2) 100%)',
      colorIcon: 'var(--mercedes-cyan)',
      isMain: false
    },
    {
      title: 'Condiciones, Comisiones Extras del mes y Penalizaciones',
      description: 'Consulta de condiciones, bonificaciones especiales y notas asignadas a este periodo.',
      icon: Target,
      action: () => router.push('/tiendas/condiciones-mensuales'),
      bgIcon: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.2) 100%)',
      colorIcon: '#f59e0b',
      isMain: false
    },
    {
      title: 'MicroShop Accesorios',
      description: 'Gestión de inventario de accesorios de MicroShop, punto de venta y trazabilidad.',
      icon: Package,
      action: () => router.push('/microshop-accesorios'),
      bgIcon: 'linear-gradient(135deg, rgba(0, 173, 239, 0.15) 0%, rgba(0, 150, 200, 0.2) 100%)',
      colorIcon: 'var(--mercedes-cyan)',
      isMain: false
    },
    {
      title: 'Control de Stock',
      description: 'Gestión y control de inventario y almacén.',
      icon: Package,
      action: () => router.push('/cristina-admin/stock'),
      bgIcon: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(2, 132, 199, 0.2) 100%)',
      colorIcon: '#0ea5e9',
      isMain: false
    }
  ]

  // Aplicar el orden guardado
  const sortedCards = useMemo(() => {
    if (cardOrder.length === 0) return cards;
    return [...cards].sort((a, b) => {
      const indexA = cardOrder.indexOf(a.title);
      const indexB = cardOrder.indexOf(b.title);
      // Si hay cartas nuevas que no están en el localStorage, van al final
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });
  }, [cards, cardOrder])

  const moveCard = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sortedCards.length - 1) return;

    const newSorted = [...sortedCards];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newSorted[index];
    newSorted[index] = newSorted[swapIndex];
    newSorted[swapIndex] = temp;

    // Actualizar el estado temporal de orden (usando los títulos como IDs fijos)
    setCardOrder(newSorted.map(c => c.title));
  }

  const saveOrder = () => {
    // Si aún no hay custom, construimos uno basado en el array oficial actual
    const currentOrder = cardOrder.length > 0 ? cardOrder : cards.map(c => c.title);
    localStorage.setItem('tiendas_hub_card_order', JSON.stringify(currentOrder));
    setIsEditMode(false);
  }

  const cancelEdit = () => {
    // Restaurar desde local storage
    const savedOrder = localStorage.getItem('tiendas_hub_card_order')
    if (savedOrder) setCardOrder(JSON.parse(savedOrder))
    else setCardOrder([])
    setIsEditMode(false)
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
        <style dangerouslySetInnerHTML={{__html: `
            .hub-grid {
                display: grid;
                gap: 16px;
                grid-template-columns: 1fr;
            }
            
            /* -- TYPOGRAPHY SYSTEM (COMPACT) -- */
            .ds-title { font-size: 26px; line-height: 1.1; }
            .ds-subtitle { font-size: 14px; line-height: 1.4; }
            .ds-card-main { font-size: 22px; line-height: 1.2; }
            .ds-card-stand { font-size: 16px; line-height: 1.3; }
            .ds-body { font-size: 13px; line-height: 1.4; }
            .ds-icon-box { width: 44px; height: 44px; border-radius: 12px; }
            
            @media (min-width: 768px) {
                .hub-grid { grid-template-columns: repeat(2, 1fr); }
                .ds-title { font-size: 32px; }
                .ds-subtitle { font-size: 15px; }
                .ds-card-main { font-size: 26px; }
                .ds-card-stand { font-size: 18px; }
                .ds-body { font-size: 14px; }
            }
            @media (min-width: 1024px) {
                .hub-grid { grid-template-columns: repeat(2, 1fr); }
            }
            
            /* -- COMPONENTS -- */
            .hub-card {
                background: var(--bg-card);
                border-radius: 16px;
                padding: 20px;
                cursor: pointer;
                transition: all 0.2s ease;
                border: 1px solid rgba(226, 232, 240, 0.8);
                box-shadow: 0 4px 10px -5px rgba(15, 23, 42, 0.05);
                display: flex;
                flex-direction: column;
                justify-content: center;
                height: 100%;
            }
            .hub-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 15px 30px -10px rgba(15, 23, 42, 0.1);
                border-color: rgba(226, 232, 240, 0);
            }

            .hub-card-main {
                flex-direction: row;
                align-items: center;
                gap: 24px;
                background: linear-gradient(to right, var(--bg-card), var(--active-bg));
            }
            @media (max-width: 768px) {
                .hub-card-main {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 16px;
                }
            }

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

      <div style={{ marginBottom: 32, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
              <h1 className="ds-title" style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 12, fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
                  <div style={{ background: 'var(--text-main)', color: 'var(--bg-card)', padding: 10, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px -4px rgba(15,23,42,0.3)' }}>
                      <Briefcase size={22} />
                  </div> 
                  Hub Comercial Tiendas
                  {user && user.username && (
                      <img 
                          src={`/${user.username.charAt(0).toUpperCase() + user.username.slice(1)}.jpg`} 
                          alt={user.username} 
                          onError={(e) => {
                              const img = e.currentTarget;
                              if (img.src.endsWith('.jpg')) {
                                  img.src = img.src.replace('.jpg', '.jpeg');
                              } else {
                                  img.style.display = 'none';
                              }
                          }}
                          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--mercedes-cyan)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', marginLeft: 8 }} 
                      />
                  )}
              </h1>
              <p className="ds-subtitle" style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 500, maxWidth: 650 }}>
                  Tablero de control federado. Gestiona el tracking de Fuerza de Ventas, monitoriza comisiones e implementa subsidios.
              </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
              {isEditMode ? (
                  <>
                     <button onClick={cancelEdit} title="Cancelar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                         <X size={20} />
                     </button>
                     <button onClick={saveOrder} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 40, borderRadius: 20, background: '#10b981', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}>
                         <Save size={18} /> Guardar Orden
                     </button>
                  </>
              ) : (
                  <button onClick={() => { setIsEditMode(true); if(cardOrder.length === 0) setCardOrder(cards.map(c=>c.title)); }} title="Personalizar Orden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                      <Settings2 size={20} />
                  </button>
              )}
              <PeriodSelector />
          </div>
      </div>

      <div className="hub-grid">
        {sortedCards.map((c, i) => {
          const Icon = c.icon
          const isMain = c.isMain;
          
          return (
            <div key={c.title} style={{ position: 'relative' }}>
              {isEditMode && (
                <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 4, background: 'var(--bg-card)', padding: 4, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid var(--border-light)' }}>
                  <button onClick={(e) => { e.stopPropagation(); moveCard(i, 'up') }} disabled={i === 0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: i === 0 ? 'transparent' : 'var(--bg-input)', color: i === 0 ? 'var(--border-strong)' : 'var(--text-main)', cursor: i === 0 ? 'not-allowed' : 'pointer' }}>
                    <ArrowUp size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); moveCard(i, 'down') }} disabled={i === sortedCards.length - 1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: i === sortedCards.length - 1 ? 'transparent' : 'var(--bg-input)', color: i === sortedCards.length - 1 ? 'var(--border-strong)' : 'var(--text-main)', cursor: i === sortedCards.length - 1 ? 'not-allowed' : 'pointer' }}>
                    <ArrowDown size={16} />
                  </button>
                </div>
              )}
              
              <div className={`hub-card hub-card-main ${isEditMode ? 'wiggle-mode' : ''}`} onClick={isEditMode ? undefined : c.action} style={{ cursor: isEditMode ? 'default' : 'pointer', borderLeft: `6px solid ${c.colorIcon}` }}>
                <div style={{ 
                background: c.bgIcon, 
                color: c.colorIcon, 
                width: 64, 
                height: 64, 
                flexShrink: 0,
                borderRadius: 18, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)'
              }}>
                <Icon size={28} strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="ds-card-main" style={{ margin: '0 0 6px 0', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px', fontSize: 20 }}>
                  {c.title}
                </h3>
                <p className="ds-body" style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 500 }}>
                  {c.description}
                </p>
                  <div style={{ marginTop: 16 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: c.colorIcon, color: '#ffffff', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                          Acceder &rarr;
                      </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
