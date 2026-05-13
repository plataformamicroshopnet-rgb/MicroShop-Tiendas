'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Package, Receipt } from 'lucide-react'

export default function CristinaAdminPage() {
  const router = useRouter()

  const cards = [
    {
      title: 'Agenda de Llamadas Cristina',
      description: 'Tracking diario visual de llamadas y métricas independientes.',
      icon: Calendar,
      action: () => router.push('/seguimiento-ventas/agenda-cristina'),
      bgIcon: 'linear-gradient(135deg, rgba(92, 182, 21, 0.15) 0%, rgba(77, 166, 11, 0.2) 100%)',
      colorIcon: '#5CB615'
    },
    {
      title: 'Control de Stock',
      description: 'Gestión y control de inventario y almacén.',
      icon: Package,
      action: () => router.push('/cristina-admin/stock'),
      bgIcon: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(2, 132, 199, 0.2) 100%)',
      colorIcon: '#0ea5e9'
    },
    {
      title: 'Informes de Gastos',
      description: 'Registro y seguimiento de gastos operativos.',
      icon: Receipt,
      action: () => router.push('/cristina-admin/gastos'),
      bgIcon: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.2) 100%)',
      colorIcon: '#ef4444'
    },
    {
      title: 'Vencimientos',
      description: 'Dashboard de pagos a proveedores y control de vencimientos.',
      icon: Receipt,
      action: () => router.push('/cristina-admin/vencimientos'),
      bgIcon: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.2) 100%)',
      colorIcon: '#f59e0b'
    }
  ]

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
      `}} />

      <div style={{ marginBottom: 32, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
              <h1 className="ds-title" style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 12, fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
                  <div style={{ background: 'var(--text-main)', color: 'var(--bg-card)', padding: 10, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px -4px rgba(15,23,42,0.3)' }}>
                      <Calendar size={22} />
                  </div> 
                  Hub de Cristina
              </h1>
              <p className="ds-subtitle" style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 500, maxWidth: 650 }}>
                  Panel centralizado de herramientas de administración y control operativo.
              </p>
          </div>
      </div>

      <div className="hub-grid">
        {cards.map((c) => {
          const Icon = c.icon
          
          return (
            <div key={c.title} style={{ position: 'relative' }}>
              <div className="hub-card hub-card-main" onClick={c.action} style={{ cursor: 'pointer', borderLeft: `6px solid ${c.colorIcon}` }}>
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
