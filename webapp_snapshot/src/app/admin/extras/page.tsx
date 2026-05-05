'use client'

import React from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Settings } from 'lucide-react'
import { useGuard } from '@/hooks/useGuard'
import ExtrasCard from '@/app/operaciones/ExtrasCard'
import Link from 'next/link'

export default function AdminExtrasPage() {
  const { authorized, user } = useGuard('MODULE_ADMIN')

  if (authorized === null) return null

  return (
    <div className="w-full" style={{ padding: '24px 32px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
      <PageHeader 
        title={<><Settings color="var(--mercedes-cyan)" size={28} /> Extras Plus y Básico</>}
        subtitle="Cruces automáticos y aplicación de importes manuales adicionales."
        showBack={true}
        helpContent={
          <div>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Extras Plus y Básico</h4>
            <p style={{ margin: 0, lineHeight: 1.5 }}>Motor de cruces inteligentes. Te permite automatizar bonificaciones compuestas. Ejemplo: 'Si un comercial vende un Fijo Avanzado y 2 Móviles al mismo cliente, asignar automáticamente un extra de 50€'. El sistema escaneará las ventas reales buscando estas combinaciones para pagarlas solas.</p>
          </div>
        }
      />

      <div style={{ marginTop: '24px' }}>
        <ExtrasCard user={user} />
      </div>
    </div>
  )
}
