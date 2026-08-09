'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Package, LineChart, Building2, Target, TrendingUp, DollarSign, Wallet, ClipboardPaste, Settings2, X, Save, ArrowUp, ArrowDown, Scale, CalendarClock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useGuard } from '@/hooks/useGuard'
import { PageHeader } from '@/components/PageHeader'
import { can } from '@/lib/permissions'

export default function DireccionTiendasPage() {
  const { authorized } = useGuard('MODULE_DIRECCION')
  const router = useRouter()

  const [isEditMode, setIsEditMode] = useState(false)
  const [cardOrder, setCardOrder] = useState<string[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const savedOrder = localStorage.getItem('direccion_tiendas_card_order')
    if (savedOrder) {
      try { setCardOrder(JSON.parse(savedOrder)) } catch (e) {}
    }
    
    // Fetch logged in user and permissions
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setCurrentUser(data.user)
        }
      })
  }, [])

  const cards = [
    {
      title: 'Cambio de Mes',
      description: 'Los pasos del mes en un vistazo (verde/ámbar/rojo): clonado, palancas, objetivos, comisiones, mes siguiente. Como el de FFVV.',
      image: '/nx-periodos.png',
      icon: CalendarClock,
      action: () => router.push('/direccion-tiendas/cambio-de-mes'),
      color: 'rgba(2, 117, 216, 0.1)',
      textColor: '#0275d8',
      // Sin permiso propio: lo ve quien entra a Dirección de Tiendas.
    },
    {
      title: 'MOD (Media Operaciones Diaria)',
      description: 'Comparativa de operaciones, importe medio y rentabilidad diaria.',
      image: '/nx-mod.png',
      icon: TrendingUp,
      action: () => router.push('/seguimiento-ventas/mod'),
      color: 'rgba(34, 197, 94, 0.1)',
      textColor: '#22c55e',
      permission: 'CARD_DIR_MOD'
    },
    {
      title: 'Comparativa Rapida de Ventas',
      description: 'Cross-sell por comercial: Palancas principales de comisiones. Clic en cada cifra para ver clientes.',
      image: '/nx-comparativa.png',
      icon: Target,
      action: () => router.push('/seguimiento-ventas/combos'),
      color: 'rgba(30,58,95,0.08)',
      textColor: '#1e3a5f',
      permission: 'CARD_DIR_COMBOS'
    },
    {
      title: 'Avance de Palancas',
      description: 'Acceso directo a las hojas secundarias de operaciones (Cloud, Novac, Portas, etc.).',
      image: '/nx-avance-palancas.png',
      icon: Package,
      action: () => router.push('/seguimiento-ventas/productos'),
      color: 'rgba(0,173,239,0.1)',
      textColor: 'var(--mercedes-cyan)',
      permission: 'CARD_DIR_PRODUCTOS'
    },


    {
      title: 'Rentabilidad por Tiendas',
      description: 'Visión agrupada de personal, ventas y rentabilidad segmentada por tienda.',
      image: '/nx-rentabilidad-tiendas.png',
      icon: DollarSign,
      action: () => router.push('/liquidacion/rentabilidad-tiendas'),
      color: 'rgba(168, 85, 247, 0.1)',
      textColor: '#a855f7',
      permission: 'CARD_DIR_RENTABILIDAD'
    },
    {
      title: 'Ganancias desde el 2014',
      description: 'Ingresos, gastos y rentabilidad por año (Tiendas + FFVV), desde 2014.',
      image: '/nx-ganancias.png',
      icon: Wallet,
      action: () => router.push('/direccion-tiendas/ganancias'),
      color: 'rgba(0, 173, 239, 0.1)',
      textColor: 'var(--mercedes-cyan)',
      permission: 'CARD_DIR_GANANCIAS'
    },
    {
      title: 'Comisiones Personal Tiendas VS Comisiones de la Empresa',
      description: 'Por comercial: lo que gana la empresa (Liquidaciones) frente a lo que se paga al comercial (Panel de Comisiones), grupo a grupo.',
      image: '/nx-comisiones-vs.png',
      icon: Scale,
      action: () => router.push('/direccion-tiendas/comisiones-vs'),
      color: 'rgba(34, 197, 94, 0.1)',
      textColor: '#22c55e'
    }
  ]

  const sortedCards = useMemo(() => {
    if (cardOrder.length === 0) return cards;
    return [...cards].sort((a, b) => {
      const indexA = cardOrder.indexOf(a.title);
      const indexB = cardOrder.indexOf(b.title);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });
  }, [cards, cardOrder])

  const visibleCards = useMemo(() => {
    if (!currentUser) return [];
    return sortedCards.filter(c => {
      if (!c.permission) return true;
      return can(currentUser, c.permission);
    });
  }, [sortedCards, currentUser]);

  const moveCard = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === visibleCards.length - 1) return;

    const newSorted = [...visibleCards];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newSorted[index];
    newSorted[index] = newSorted[swapIndex];
    newSorted[swapIndex] = temp;

    setCardOrder(newSorted.map(c => c.title));
  }

  const saveOrder = () => {
    const currentOrder = cardOrder.length > 0 ? cardOrder : cards.map(c => c.title);
    localStorage.setItem('direccion_tiendas_card_order', JSON.stringify(currentOrder));
    setIsEditMode(false);
  }

  const cancelEdit = () => {
    const savedOrder = localStorage.getItem('direccion_tiendas_card_order')
    if (savedOrder) setCardOrder(JSON.parse(savedOrder))
    else setCardOrder([])
    setIsEditMode(false)
  }

  if (authorized === null) {
      return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>;
  }

  return (
    <div className="w-full" style={{ padding: '24px 32px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .hub-grid {
            display: grid;
            gap: 16px;
            grid-template-columns: 1fr;
        }
        
        @media (min-width: 768px) {
            .hub-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
            .hub-grid { grid-template-columns: repeat(2, 1fr); }
        }

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

        <PageHeader 
          title={<span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Building2 color="#00adef" size={28} /> Dirección Tiendas</span>}
          subtitle="Visión global de rentabilidad, objetivos y operaciones"
          showBack={true}
          headerActions={
            isEditMode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={cancelEdit} title="Cancelar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={20} />
                </button>
                <button onClick={saveOrder} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 40, borderRadius: 20, background: '#10b981', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}>
                    <Save size={18} /> Guardar Orden
                </button>
              </div>
            ) : (
                <button onClick={() => { setIsEditMode(true); if(cardOrder.length === 0) setCardOrder(cards.map(c=>c.title)); }} title="Personalizar Orden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                    <Settings2 size={20} />
                </button>
            )
          }
        />

      <div className="hub-grid" style={{ marginTop: '24px' }}>
        {visibleCards.map((c, i) => {
          const Icon = c.icon
          const iconColor = c.textColor || '#3b82f6';
          
          return (
            <div key={c.title} style={{ position: 'relative' }}>
              {isEditMode && (
                <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 4, background: 'var(--bg-card)', padding: 4, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid var(--border-light)' }}>
                  <button onClick={(e) => { e.stopPropagation(); moveCard(i, 'up') }} disabled={i === 0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: i === 0 ? 'transparent' : 'var(--bg-input)', color: i === 0 ? 'var(--border-strong)' : 'var(--text-main)', cursor: i === 0 ? 'not-allowed' : 'pointer' }}>
                    <ArrowUp size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); moveCard(i, 'down') }} disabled={i === visibleCards.length - 1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: i === visibleCards.length - 1 ? 'transparent' : 'var(--bg-input)', color: i === visibleCards.length - 1 ? 'var(--border-strong)' : 'var(--text-main)', cursor: i === visibleCards.length - 1 ? 'not-allowed' : 'pointer' }}>
                    <ArrowDown size={16} />
                  </button>
                </div>
              )}
              
              <div 
                  className={`hub-card hub-card-main ${isEditMode ? 'wiggle-mode' : ''}`} 
                  onClick={isEditMode ? undefined : c.action}
                  style={{ cursor: isEditMode ? 'default' : 'pointer', borderLeft: `6px solid ${iconColor}`, ...(c.image ? { padding: 0, overflow: 'hidden', gap: 0, alignItems: 'stretch', minHeight: 142 } : {}) }}
              >
                {c.image ? (
                  <div aria-hidden="true" style={{
                    width: 160,
                    minWidth: 160,
                    minHeight: 120,
                    alignSelf: 'stretch',
                    flexShrink: 0,
                    backgroundImage: `url(${c.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: iconColor
                  }} />
                ) : (
                  <div style={{
                      background: c.color || 'rgba(59, 130, 246, 0.1)',
                      color: iconColor,
                      width: 64,
                      height: 64,
                      flexShrink: 0,
                      borderRadius: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.05)'
                  }}>
                    <Icon size={28} strokeWidth={2.5} />
                  </div>
                )}
                <div style={{ flex: 1, ...(c.image ? { padding: '12px 20px' } : {}) }}>
                  <h3 style={{ margin: '0 0 6px 0', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px', fontSize: 20 }}>
                    {c.title}
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 500, fontSize: 14, lineHeight: 1.4 }}>
                    {c.description}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
