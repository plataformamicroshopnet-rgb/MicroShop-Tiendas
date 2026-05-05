'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface WorkPeriod {
  id: string
  period_key: string // Ej: "2026_03"
  year: number
  month: number
  status: string
  name: string | null
}

interface PeriodContextProps {
  activePeriodKey: string
  setActivePeriodKey: (key: string) => void
  availablePeriods: WorkPeriod[]
  isLoadingPeriods: boolean
}

const PeriodContext = createContext<PeriodContextProps | undefined>(undefined)

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [activePeriodKey, setActivePeriodKey] = useState<string>('')
  const [availablePeriods, setAvailablePeriods] = useState<WorkPeriod[]>([])
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(true)

  useEffect(() => {
    // 1. Establecer el mes natural por defecto (Fallback rápido de hidratación)
    const now = new Date()
    const currentKey = `${now.getFullYear()}_${(now.getMonth() + 1).toString().padStart(2, '0')}`
    setActivePeriodKey(currentKey)

    // 2. Fetch de periodos disponibles en la BD (Governing DB State)
    fetch('/api/period')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.periods) {
          // Filtrar cualquier periodo trimestral (Q1, Q2...) para que no contamine el selector general
          const validPeriods = data.periods.filter((p: WorkPeriod) => !p.period_key.includes('_Q'))
          setAvailablePeriods(validPeriods)
          
          // REGLA CORE: El periodo activo DEBE ser el que dice la Base de Datos.
          const activePeriod = validPeriods.find((p: WorkPeriod) => p.status === 'ACTIVE')
          if (activePeriod) {
            setActivePeriodKey(activePeriod.period_key)
          }
        }
      })
      .catch(err => console.error("Error fetching periods:", err))
      .finally(() => setIsLoadingPeriods(false))
  }, [])

  return (
    <PeriodContext.Provider value={{ activePeriodKey, setActivePeriodKey, availablePeriods, isLoadingPeriods }}>
      {children}
    </PeriodContext.Provider>
  )
}

export function usePeriod() {
  const context = useContext(PeriodContext)
  if (!context) {
    throw new Error('usePeriod must be used within a PeriodProvider')
  }
  return context
}
