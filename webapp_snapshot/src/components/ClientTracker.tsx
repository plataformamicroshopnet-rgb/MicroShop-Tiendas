'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function ClientTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return

    // Enviar el path actual al backend de auditoría
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, action: 'VIEW' })
    }).catch(() => {
        // Silenciar errores de red
    })
  }, [pathname])

  return null
}
