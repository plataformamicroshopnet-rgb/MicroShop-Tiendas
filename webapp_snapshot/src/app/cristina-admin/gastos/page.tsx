'use client'

import React from 'react'
import { Receipt, ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'

export default function GastosPage() {
  return (
    <div className="layout-content">
      <Link href="/cristina-admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#64748B', textDecoration: 'none', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
        <ArrowLeft size={16} /> Volver al Hub
      </Link>
      
      <PageHeader 
        title="Informes de Gastos" 
        subtitle="Módulo en construcción para el seguimiento de gastos."
        />

      <div style={{ padding: '40px 24px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginTop: '24px' }}>
        <Receipt size={64} style={{ color: '#CBD5E1', marginBottom: '16px' }} />
        <h2 style={{ margin: '0 0 12px 0', color: '#1B3D6A' }}>Próximamente</h2>
        <p style={{ color: '#64748B', maxWidth: '500px', margin: '0 auto' }}>
          Este módulo está actualmente en desarrollo. Aquí se ubicará el sistema de registro y seguimiento de gastos operativos.
        </p>
      </div>
    </div>
  )
}
