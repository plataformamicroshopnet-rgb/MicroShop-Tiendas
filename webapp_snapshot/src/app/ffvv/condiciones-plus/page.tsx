'use client'

import React from 'react'
import { CondicionesPlusDisplay } from '@/components/CondicionesPlusDisplay'
import { useGuard } from '@/hooks/useGuard'

export default function FFVVCondicionesPlusPage() {
  const { authorized } = useGuard('MODULE_FFVV')

  if (authorized === null) return null

  return (
    <div className="w-full" style={{ padding: '0 12px', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      <CondicionesPlusDisplay title="Condiciones y Extras FFVV" parentHref="/ffvv" />
    </div>
  )
}
