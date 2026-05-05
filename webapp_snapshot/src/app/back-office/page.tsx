'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Building2, List, MapPin, Settings2, ArrowUp, ArrowDown, Save, X } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useGuard } from '@/hooks/useGuard'
import { canEdit } from '@/lib/permissions'

export default function BackOfficePage() {
  const { authorized, user } = useGuard('MODULE_BACK_OFFICE')

  const hasEditAccess = canEdit(user, 'MODULE_TIENDAS')

  const [isEditMode, setIsEditMode] = useState(false)
  const [cardOrder, setCardOrder] = useState<string[]>([])

  useEffect(() => {
    const savedOrder = localStorage.getItem('back_office_card_order')
    if (savedOrder) {
      try { setCardOrder(JSON.parse(savedOrder)) } catch (e) {}
    }
  }, [])

  const cardsRaw = [
    hasEditAccess ? {
      title: 'Nueva Venta',
      description: 'Registra nuevas operaciones de catálogo fijo, móvil o TI en el sistema unificado.',
      icon: Building2,
      href: '/nueva-venta',
      color: 'rgba(37, 99, 235, 0.1)',
      textColor: '#2563eb'
    } : null,
    {
      title: 'Registro de Operaciones',
      description: 'Visualiza, edita o anula las ventas introducidas en la base de datos central.',
      icon: List,
      href: '/operaciones',
      color: 'rgba(37, 99, 235, 0.1)',
      textColor: '#2563eb'
    },
    {
      title: 'Operaciones Pendientes',
      description: 'Acceso directo a las operaciones en estado Pendiente para su tramitación.',
      icon: List,
      href: '/operaciones?filter=pendientes',
      color: 'rgba(245, 158, 11, 0.1)',
      textColor: '#d97706',
      border: '1px solid rgba(245, 158, 11, 0.2)'
    },
    {
      title: 'Visitas Tiendas',
      description: 'Gestiona y registra las visitas presenciales realizadas por la Fuerza de Ventas.',
      icon: MapPin,
      href: '/visitas-tiendas',
      color: 'rgba(37, 99, 235, 0.1)',
      textColor: '#2563eb'
    },
    {
      title: 'Evolución Visitas Gevico',
      description: 'Dashboard analítico de actividad real vs foco core de cartera trimestral.',
      icon: Building2,
      href: '/cumplimiento-telefonica?from=backoffice',
      color: 'rgba(16, 185, 129, 0.1)',
      textColor: '#059669',
      border: '1px solid rgba(16, 185, 129, 0.2)'
    }
  ]

  const cards = cardsRaw.filter(Boolean) as any[]

  const sortedCards = useMemo(() => {
    if (cardOrder.length === 0) return cards;
    return [...cards].sort((a, b) => {
      const indexA = cardOrder.indexOf(a.title);
      const indexB = cardOrder.indexOf(b.title);
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

    setCardOrder(newSorted.map(c => c.title));
  }

  const saveOrder = () => {
    const currentOrder = cardOrder.length > 0 ? cardOrder : cards.map(c => c.title);
    localStorage.setItem('back_office_card_order', JSON.stringify(currentOrder));
    setIsEditMode(false);
  }

  const cancelEdit = () => {
    const savedOrder = localStorage.getItem('back_office_card_order')
    if (savedOrder) setCardOrder(JSON.parse(savedOrder))
    else setCardOrder([])
    setIsEditMode(false)
  }

  if (authorized === null) {
    return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>
  }

  return (
    <div style={{ padding: '24px 32px', paddingBottom: 100, background: 'var(--bg-app)', minHeight: '100vh' }}>
      <style>{`
        .premium-card {
           background: var(--bg-card);
           border-radius: 16px;
           padding: 18px;
           box-shadow: 0 2px 8px rgba(0,0,0,0.04);
           transition: all 0.2s ease;
           display: flex;
           flex-direction: column;
           align-items: flex-start;
           text-align: left;
           height: 100%;
           border: 1px solid transparent;
        }
        .premium-card:hover {
           transform: translateY(-3px);
           box-shadow: 0 8px 20px rgba(0,0,0,0.08);
           border-color: rgba(37, 99, 235, 0.1);
        }
        .card-icon-wrapper {
           border-radius: 12px;
           padding: 10px;
           margin-bottom: 12px;
           display: inline-flex;
           align-items: center;
           justify-content: center;
        }
        .card-title {
           font-size: 18px;
           font-weight: 600;
           color: var(--text-main);
           margin: 0 0 6px 0;
           line-height: 1.2;
        }
        .card-desc {
           font-size: 13px;
           color: var(--text-muted);
           margin: 0;
           line-height: 1.4;
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
      `}</style>
        <PageHeader 
          title={<>Back <span style={{ color: '#2563eb' }}>Office</span></>}
          subtitle="Acceso rápido a las herramientas de registro e inserción de datos."
          showBack={true}
          helpContent={
            <div>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Back Office</h4>
              <p style={{ margin: 0, lineHeight: 1.5 }}>Auditoría integral de todas las operaciones registradas. Permite buscar ventas, anular operaciones conflictivas o cambiar estados. Las anulaciones aquí repercuten automáticamente en el resto de dashboards de comisiones.</p>
            </div>
          }
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

      <div style={{
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
        gap: '16px',
        marginTop: '16px'
      }}>
        {sortedCards.map((c, i) => {
          const Icon = c.icon
          
          const cardContent = (
            <div className={`premium-card ${isEditMode ? 'wiggle-mode' : ''}`} style={{ position: 'relative', border: c.border || '1px solid transparent' }}>
              {isEditMode && (
                <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 4, background: 'var(--bg-card)', padding: 4, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid var(--border-light)' }}>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveCard(i, 'up') }} disabled={i === 0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: i === 0 ? 'transparent' : 'var(--bg-input)', color: i === 0 ? 'var(--border-strong)' : 'var(--text-main)', cursor: i === 0 ? 'not-allowed' : 'pointer' }}>
                    <ArrowUp size={16} />
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveCard(i, 'down') }} disabled={i === sortedCards.length - 1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: i === sortedCards.length - 1 ? 'transparent' : 'var(--bg-input)', color: i === sortedCards.length - 1 ? 'var(--border-strong)' : 'var(--text-main)', cursor: i === sortedCards.length - 1 ? 'not-allowed' : 'pointer' }}>
                    <ArrowDown size={16} />
                  </button>
                </div>
              )}
              
              <div className="card-icon-wrapper" style={{ backgroundColor: c.color, color: c.textColor }}>
                <Icon size={24} strokeWidth={2.5} />
              </div>
              <h2 className="card-title">{c.title}</h2>
              <p className="card-desc">
                {c.description}
              </p>
            </div>
          )

          if (isEditMode) {
             return <div key={c.title} style={{ cursor: 'default' }}>{cardContent}</div>
          }
          
          return (
            <Link key={c.title} href={c.href} style={{ textDecoration: 'none' }}>
              {cardContent}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
