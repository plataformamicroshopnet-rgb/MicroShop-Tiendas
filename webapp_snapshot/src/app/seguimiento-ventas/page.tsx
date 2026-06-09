'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Package, LineChart, ChevronLeft, ChevronRight, Calendar, Globe, Calculator, Building2, Target, Briefcase, Settings2, ArrowUp, ArrowDown, Save, X, Trophy, TrendingUp, GripVertical } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useGuard } from '@/hooks/useGuard'
import { PageHeader } from '@/components/PageHeader'
import { can } from '@/lib/permissions'

export default function SeguimientoVentasPage() {
  const { authorized } = useGuard('MODULE_JEFE_TIENDAS')
  const router = useRouter()

  const [isEditMode, setIsEditMode] = useState(false)
  const [cardOrder, setCardOrder] = useState<string[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)

  const longPressTimeout = useRef<NodeJS.Timeout | null>(null)
  const isLongPressActive = useRef<boolean>(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    const savedOrder = localStorage.getItem('seguimiento_ventas_card_order')
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
      title: 'Ventas Tiendas',
      description: 'Acceso al módulo principal de registro, tracking y gestión de ventas del canal.',
      icon: Briefcase,
      action: () => router.push('/ventas-tiendas'),
      color: 'rgba(59,130,246,0.1)',
      textColor: '#3b82f6',
      permission: 'CARD_VENTAS_TIENDAS'
    },
    {
      title: 'Avance de Palancas',
      description: 'Acceso directo a las hojas secundarias de operaciones (Cloud, Novac, Portas, etc.).',
      icon: Package,
      action: () => router.push('/seguimiento-ventas/productos'),
      color: 'rgba(0,173,239,0.1)',
      textColor: 'var(--mercedes-cyan)',
      permission: 'CARD_AVANCE_PALANCAS'
    },
    {
      title: 'Agenda Comercial Salva',
      description: 'Tracking diario visual de la Fuerza de Ventas y asistencia.',
      icon: Calendar,
      action: () => router.push('/seguimiento-ventas/agenda'),
      color: 'rgba(16,185,129,0.1)',
      textColor: '#10b981',
      permission: 'CARD_AGENDA_DIARIO'
    },
    {
      title: 'Comisiones Tiendas Completas',
      description: 'Liquidación grupal y métricas completas de todas las comisiones.',
      icon: Calculator,
      action: () => router.push('/comisiones'),
      color: 'rgba(255, 149, 0, 0.1)',
      textColor: 'rgb(255, 149, 0)',
      permission: 'CARD_COMISIONES_COMPLETAS'
    },
    {
      title: 'Comisiones Tiendas Reducidas',
      description: 'Vista unificada de alto impacto con el ranking de ventas y comisiones totales de todos los comerciales.',
      icon: Target,
      action: () => router.push('/seguimiento-ventas/comisiones-equipo'),
      color: 'rgba(168, 85, 247, 0.1)',
      textColor: '#a855f7',
      permission: 'CARD_COMISIONES_EQUIPO'
    },
    {
      title: 'Condiciones, Comisiones Extras del mes y Penalizaciones',
      description: 'Consulta de condiciones, bonificaciones especiales y notas asignadas a este periodo.',
      icon: Target,
      action: () => router.push('/seguimiento-ventas/condiciones-mensuales'),
      color: 'rgba(245, 158, 11, 0.1)',
      permission: 'CARD_CONDICIONES_EXTRAS'
    },
    {
      title: 'Comparativa Rapida de Ventas',
      description: 'Cross-sell por comercial: Palancas principales de comisiones. Clic en cada cifra para ver clientes.',
      icon: Target,
      action: () => router.push('/seguimiento-ventas/combos'),
      color: 'rgba(30,58,95,0.08)',
      textColor: '#1e3a5f',
      permission: 'CARD_COMBOS'
    },
    {
      title: 'Comisiones del Mes (Jefe)',
      description: 'Cálculo dinámico de comisiones del Jefe Tiendas (media de equipo y bonos).',
      icon: Calculator,
      action: () => router.push('/seguimiento-ventas/comisiones-jefe'),
      color: 'rgba(239, 68, 68, 0.1)',
      textColor: '#ef4444',
      permission: 'CARD_COMISIONES_JEFE'
    },
    {
      title: 'MicroShop Accesorios',
      description: 'Gestión de inventario de accesorios de MicroShop, punto de venta y trazabilidad.',
      icon: Package,
      action: () => router.push('/microshop-accesorios'),
      color: 'rgba(0,173,239,0.1)',
      textColor: 'var(--mercedes-cyan)'
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

  const moveCard = (index: number, direction: 'prev' | 'next') => {
    if (direction === 'prev' && index === 0) return;
    if (direction === 'next' && index === visibleCards.length - 1) return;

    const newSorted = [...visibleCards];
    const swapIndex = direction === 'prev' ? index - 1 : index + 1;
    
    const temp = newSorted[index];
    newSorted[index] = newSorted[swapIndex];
    newSorted[swapIndex] = temp;

    setCardOrder(newSorted.map(c => c.title));
  }

  const saveOrder = () => {
    const currentOrder = cardOrder.length > 0 ? cardOrder : cards.map(c => c.title);
    localStorage.setItem('seguimiento_ventas_card_order', JSON.stringify(currentOrder));
    setIsEditMode(false);
  }

  const cancelEdit = () => {
    const savedOrder = localStorage.getItem('seguimiento_ventas_card_order')
    if (savedOrder) setCardOrder(JSON.parse(savedOrder))
    else setCardOrder([])
    setIsEditMode(false)
  }

  const resetOrder = () => {
    setCardOrder([]);
    localStorage.removeItem('seguimiento_ventas_card_order');
    setIsEditMode(false);
  }

  const handleStartPress = (e: React.MouseEvent | React.TouchEvent, index: number) => {
    if (isEditMode) return;
    
    if (longPressTimeout.current) return;
    
    isLongPressActive.current = false;
    longPressTimeout.current = setTimeout(() => {
      isLongPressActive.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(60);
      }
      if (cardOrder.length === 0) {
        setCardOrder(cards.map(c => c.title));
      }
      setIsEditMode(true);
    }, 550);
  };

  const handleReleasePress = (e: React.MouseEvent | React.TouchEvent, action: () => void) => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }

    if (isEditMode) return;

    if (!isLongPressActive.current) {
      action();
    }
    isLongPressActive.current = false;
  };

  const handleMovePress = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!isEditMode) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = (index: number) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const currentOrder = cardOrder.length > 0 ? [...cardOrder] : cards.map(c => c.title);
    const draggedTitle = visibleCards[draggedIndex].title;
    const targetTitle = visibleCards[targetIndex].title;

    const filteredOrder = currentOrder.filter(title => title !== draggedTitle);
    const insertAt = filteredOrder.indexOf(targetTitle);

    filteredOrder.splice(insertAt, 0, draggedTitle);

    setCardOrder(filteredOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

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
            .hub-grid { grid-template-columns: repeat(3, 1fr); }
        }

        .hub-card {
            background: var(--bg-card);
            border-radius: 16px;
            padding: 16px;
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
            gap: 16px;
            background: linear-gradient(to right, var(--bg-card), var(--active-bg));
            transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s, border-color 0.2s;
        }
        @media (max-width: 768px) {
            .hub-card-main {
                flex-direction: row;
                align-items: center;
                gap: 16px;
            }
        }

        .edit-mode-card {
            border: 2px dashed rgba(37, 99, 235, 0.4) !important;
            background-color: var(--bg-input) !important;
            box-shadow: none !important;
            cursor: grab !important;
        }
        .edit-mode-card:hover {
            transform: none !important;
            border-color: rgba(37, 99, 235, 0.8) !important;
            background-color: var(--bg-card) !important;
        }
        .edit-mode-card:active {
            cursor: grabbing !important;
            transform: scale(0.97);
        }

        .dragging {
            opacity: 0.4 !important;
            border: 2px dashed #2563eb !important;
            transform: scale(0.98) !important;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
        }

        .drag-over {
            border: 2px solid #2563eb !important;
            background-color: rgba(37, 99, 235, 0.05) !important;
            box-shadow: 0 0 12px rgba(37, 99, 235, 0.25) !important;
            transform: scale(1.01) !important;
        }
      `}} />

        <PageHeader 
          title={<span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><LineChart color="#2563eb" size={28} /> Seguimiento Ventas <img src="/Salva.jpg" alt="Salva" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #2563eb', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} /></span>}
          subtitle="Monitorización y analítica de los productos vendidos."
          showBack={true}
          helpContent={
            <div>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Seguimiento Diario</h4>
              <p style={{ margin: 0, lineHeight: 1.5 }}>Rastreo diario (Daily) de operaciones. Permite ver el pulso de ventas semana a semana y compararlo contra los objetivos mensuales marcados. Ideal para dirigir las reuniones matinales de equipo.</p>
            </div>
          }
          headerActions={
            isEditMode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button 
                    onClick={resetOrder} 
                    title="Restablecer orden predeterminado" 
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 6, 
                        padding: '0 14px', 
                        height: 40, 
                        borderRadius: 20, 
                        background: 'transparent', 
                        border: '1px solid #f97316', 
                        color: '#f97316', 
                        fontWeight: 600, 
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f97316'; e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#f97316' }}
                >
                    Restablecer
                </button>
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

      {isEditMode && (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            backgroundColor: 'rgba(59, 130, 246, 0.08)', 
            border: '1px solid rgba(59, 130, 246, 0.2)', 
            borderRadius: 12, 
            padding: '12px 20px', 
            marginTop: 16,
            color: 'var(--text-main)',
            fontSize: 14,
            fontWeight: 500,
        }}>
          <div style={{ 
              backgroundColor: '#2563eb', 
              color: '#fff', 
              borderRadius: '50%', 
              width: 22, 
              height: 22, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 12,
              flexShrink: 0
          }}>!</div>
          <div style={{ flex: 1 }}>
            <strong>Modo reorganización activo:</strong> Mantén pulsado y arrastra cualquier tarjeta sobre otra para moverla de lugar, o utiliza los cheurones laterales. Haz clic en <strong>Guardar Orden</strong> para aplicar.
          </div>
        </div>
      )}

      <div className="hub-grid" style={{ marginTop: '24px' }}>
        {visibleCards.map((c, i) => {
          const Icon = c.icon
          const iconColor = c.textColor || '#3b82f6';
          
          return (
            <div 
              key={c.title} 
              style={{ position: 'relative' }}
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragLeave={() => handleDragLeave(i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
            >
              <div 
                  className={`hub-card hub-card-main ${isEditMode ? 'edit-mode-card' : ''} ${draggedIndex === i ? 'dragging' : ''} ${dragOverIndex === i ? 'drag-over' : ''}`} 
                  onMouseDown={(e) => handleStartPress(e, i)}
                  onMouseUp={(e) => handleReleasePress(e, c.action)}
                  onMouseMove={handleMovePress}
                  onTouchStart={(e) => handleStartPress(e, i)}
                  onTouchEnd={(e) => handleReleasePress(e, c.action)}
                  onTouchMove={handleMovePress}
                  style={{ 
                      cursor: isEditMode ? 'grab' : 'pointer', 
                      borderLeft: `6px solid ${iconColor}`,
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: '16px'
                  }}
              >
                <div style={{ 
                    background: c.color || 'rgba(59, 130, 246, 0.1)', 
                    color: iconColor, 
                    width: 56, 
                    height: 56, 
                    flexShrink: 0,
                    borderRadius: 16, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.05)'
                }}>
                  <Icon size={26} strokeWidth={2.5} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 4px 0', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px', fontSize: 18 }}>
                    {c.title}
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 500, fontSize: 14, lineHeight: 1.4 }}>
                    {c.description}
                  </p>
                </div>

                {isEditMode && (
                  <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      height: '100%', 
                      paddingLeft: 12, 
                      borderLeft: '1px solid var(--border-light)',
                      gap: 8,
                      flexShrink: 0
                  }} onClick={e => e.stopPropagation()}>
                    <div 
                        style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 4px' }}
                        title="Arrastra para reordenar"
                    >
                      <GripVertical size={20} />
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button 
                          onClick={(e) => { e.stopPropagation(); moveCard(i, 'prev') }} 
                          disabled={i === 0} 
                          style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              width: 26, 
                              height: 26, 
                              borderRadius: 6, 
                              border: 'none', 
                              background: i === 0 ? 'transparent' : 'var(--bg-input)', 
                              color: i === 0 ? 'var(--border-strong)' : 'var(--text-main)', 
                              cursor: i === 0 ? 'not-allowed' : 'pointer',
                              boxShadow: i === 0 ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
                          }}
                          title="Anterior"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button 
                          onClick={(e) => { e.stopPropagation(); moveCard(i, 'next') }} 
                          disabled={i === visibleCards.length - 1} 
                          style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              width: 26, 
                              height: 26, 
                              borderRadius: 6, 
                              border: 'none', 
                              background: i === visibleCards.length - 1 ? 'transparent' : 'var(--bg-input)', 
                              color: i === visibleCards.length - 1 ? 'var(--border-strong)' : 'var(--text-main)', 
                              cursor: i === visibleCards.length - 1 ? 'not-allowed' : 'pointer',
                              boxShadow: i === visibleCards.length - 1 ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
                          }}
                          title="Siguiente"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
