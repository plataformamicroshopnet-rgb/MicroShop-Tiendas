'use client'

import React from 'react'
import { CondicionesPlusDisplay } from '@/components/CondicionesPlusDisplay'
import { useGuard } from '@/hooks/useGuard'

export default function TiendasCondicionesPlusPage() {
  const { authorized } = useGuard('MODULE_TIENDAS')

  if (authorized === null) return null

  return (
    <div className="w-full" style={{ padding: '0 12px', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      <CondicionesPlusDisplay title="Condiciones y Extras Tiendas" parentHref="/tiendas" />
    </div>
  )
}
