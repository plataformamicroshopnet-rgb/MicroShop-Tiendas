'use client'

import React from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Target } from 'lucide-react'
import { useGuard } from '@/hooks/useGuard'
import { PeriodSelector } from '@/components/PeriodSelector'
import { MonthlyConditionsDisplay } from '@/components/MonthlyConditionsDisplay'

export default function SeguimientoCondicionesMensualesPage() {
  const { authorized } = useGuard('MODULE_JEFE_FFVV')

  if (authorized === null) return null

  return (
    <div className="w-full" style={{ padding: '24px 32px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
      <MonthlyConditionsDisplay />
    </div>
  )
}
