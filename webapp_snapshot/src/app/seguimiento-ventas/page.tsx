'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Package, LineChart, ChevronLeft, Calendar, Globe, Calculator, Building2, Target, Briefcase, Settings2, ArrowUp, ArrowDown, Save, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useGuard } from '@/hooks/useGuard'
import { PageHeader } from '@/components/PageHeader'
export default function SeguimientoVentasPage() {
  const { authorized } = useGuard('MODULE_JEFE_TIENDAS')
  const router = useRouter()

  const [isEditMode, setIsEditMode] = useState(false)
  const [cardOrder, setCardOrder] = useState<string[]>([])

  useEffect(() => {
    const savedOrder = localStorage.getItem('seguimiento_ventas_card_order')
    if (savedOrder) {
      try { setCardOrder(JSON.parse(savedOrder)) } catch (e) {}
    }
  }, [])

  const cards = [
    {
      title: 'Avance de Palancas',
      description: 'Acceso directo a las hojas secundarias de operaciones (Cloud, Novac, Portas, etc.).',
      icon: Package,
      action: () => router.push('/seguimiento-ventas/productos'),
      color: 'rgba(0,173,239,0.1)',
      textColor: 'var(--mercedes-cyan)'
    },
    {
      title: 'Seguimiento Diario',
      description: 'Panel avanzado de seguimiento grupal. Proyecciones en tiempo real.',
      icon: LineChart,
      action: () => router.push('/seguimiento-ventas/diario'),
      color: 'rgba(59, 130, 246, 0.1)',
      textColor: '#3b82f6'
    },
    {
      title: 'Agenda Comercial',
      description: 'Tracking diario visual de la Fuerza de Ventas y asistencia.',
      icon: Calendar,
      action: () => router.push('/seguimiento-ventas/agenda'),
      color: 'rgba(16,185,129,0.1)',
      textColor: '#10b981'
    },
    {
      title: 'Geventas',
      description: 'Acceso corporativo de mando al portal externo de Geventas.',
      icon: Globe,
      action: () => window.open('https://geventas.com', '_blank', 'noopener,noreferrer'),
      color: 'rgba(236, 72, 153, 0.1)',
      textColor: '#ec4899'
    },
    {
      title: 'Comisiones Tiendas Completas',
      description: 'Liquidación grupal y métricas completas de todas las comisiones.',
      icon: Calculator,
      action: () => router.push('/comisiones'),
      color: 'rgba(255, 149, 0, 0.1)',
      textColor: 'rgb(255, 149, 0)'
    },
    {
      title: 'Evolución Visitas Gevico',
      description: 'Panel de seguimiento de volumen de visitas y avance trimestral.',
      icon: Building2,
      action: () => router.push('/cumplimiento-telefonica?from=jefetiendas'),
      color: 'rgba(16, 185, 129, 0.1)',
      textColor: '#10b981'
    },
    {
      title: 'Condiciones, Comisiones Extras del mes y Penalizaciones',
      description: 'Consulta de condiciones, bonificaciones especiales y notas asignadas a este periodo.',
      icon: Target,
      action: () => router.push('/seguimiento-ventas/condiciones-mensuales'),
      color: 'rgba(245, 158, 11, 0.1)',
    },
    {
      title: 'Condiciones y Extras Tiendas',
      description: 'Consultar tabla de objetivos, comisiones y KPIs extendidos',
      icon: Briefcase,
      action: () => router.push('/seguimiento-ventas/condiciones-plus'),
      color: 'rgba(0,173,239,0.1)',
      textColor: 'var(--mercedes-cyan)'
    },
    {
      title: 'Combos Cupido + TGT + Respaldo 5G',
      description: 'Cross-sell por comercial: Respaldo 5G, TGT y combos con TMA/Micro. Clic en cada cifra para ver clientes.',
      icon: Target,
      action: () => router.push('/seguimiento-ventas/combos'),
      color: 'rgba(30,58,95,0.08)',
      textColor: '#1e3a5f'
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
    localStorage.setItem('seguimiento_ventas_card_order', JSON.stringify(currentOrder));
    setIsEditMode(false);
  }

  const cancelEdit = () => {
    const savedOrder = localStorage.getItem('seguimiento_ventas_card_order')
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
        .premium-card {
            background-color: var(--bg-card);
            border-radius: 16px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 1px solid var(--border-strong);
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .premium-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.08);
            border-color: #3b82f6;
        }
        .card-icon-wrapper {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .card-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-main);
            margin: 0 0 6px 0;
            line-height: 1.25;
            letter-spacing: -0.3px;
        }
        .card-desc {
            font-size: 15px;
            color: var(--text-muted);
            line-height: 1.45;
            margin: 0;
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
          title={<><LineChart color="#2563eb" size={28} /> Seguimiento Ventas</>}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '24px' }}>
        {sortedCards.map((c, i) => {
          const Icon = c.icon
          return (
            <div 
              key={c.title} 
              className={`premium-card ${isEditMode ? 'wiggle-mode' : ''}`} 
              onClick={isEditMode ? undefined : c.action}
              style={{ position: 'relative', cursor: isEditMode ? 'default' : 'pointer' }}
            >
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
              <div className="card-icon-wrapper" style={{ backgroundColor: c.color, color: c.textColor }}>
                <Icon size={22} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="card-title">
                  {c.title}
                </h3>
                <p className="card-desc">
                  {c.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
