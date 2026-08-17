'use client'

import React, { useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'
import { usePeriod } from './PeriodProvider'
import { can, canView } from '@/lib/permissions'
import { usePathname } from 'next/navigation'

export function PeriodSelector() {
  const { activePeriodKey, setActivePeriodKey, availablePeriods, isLoadingPeriods } = usePeriod()
  const [user, setUser] = useState<any>(null)
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/login') {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.authenticated) {
            setUser(data.user)
          }
        })
        .catch(err => console.error("Error fetching auth:", err))
    }
  }, [pathname])

  if (pathname === '/login' || !user || isLoadingPeriods) return null

  // Restricciones de Visibilidad de la Fase C1 (Permitimos a quienes tienen permiso de lectura o edición de módulos compatibles)
  const canSeeSelector = canView(user, 'MODULE_TIENDAS') || canView(user, 'MODULE_CUMPLIMIENTO') || canView(user, 'MODULE_BACK_OFFICE') || canView(user, 'MODULE_ADMIN') || canView(user, 'MODULE_JEFE_TIENDAS');
  if (!canSeeSelector) return null

  // Restricciones de Selección de Periodos Reales de la BD
  // Si no hay periodos en la DB, mostramos al menos el actual por defecto
  const renderPeriods = availablePeriods.length > 0 
    ? availablePeriods 
    : [{ period_key: activePeriodKey, name: 'Mes Actual (Generado)' }]

  const formatPeriodName = (key: string, name?: string | null) => {
    if (name) return name
    const [year, month] = key.split('_')
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return `${months[parseInt(month) - 1]} ${year}`
  }

  // Identificar el status visualmente
  const currentSelectedPeriod = availablePeriods.find(p => p.period_key === activePeriodKey)
  const isCurrentlyActive = currentSelectedPeriod?.status === 'ACTIVE'

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .period-selector-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          box-shadow: 0 4px 10px -2px rgba(0,0,0,0.1);

          /* Mobile: Circular Button */
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          padding: 0;
          gap: 0;
          transition: all 0.2s ease;
        }

        .period-selector-select {
          /* Mobile: Invisible Hit Area overlayting the circle */
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          z-index: 10;
        }

        .period-selector-icon {
          width: 18px;
          height: 18px;
        }

        /* Mobile: Badge dot top right */
        .period-selector-dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid var(--bg-card);
          z-index: 5;
        }
        
        /* AQUI VIVIA UN BLOQUE @media (min-width: 768px) que en escritorio
           convertia este boton en una pastilla con el NOMBRE DEL PERIODO
           escrito al lado. Fuera por decision del dueno (17-ago-2026): asi
           los tres botones de la cabecera —dia/noche, rueda dentada y
           calendario— miden lo mismo y el titulo recupera el sitio.

           Se queda el circulo de 40 px en TODOS los tamanos. El periodo
           activo no se pierde de vista: esta en el tooltip del boton, y el
           puntito de color sigue diciendo si el mes esta abierto o cerrado. */
      `}} />
      <div
        className="period-selector-wrapper"
        title={`Periodo: ${formatPeriodName(activePeriodKey, currentSelectedPeriod?.name)} — pulsa para cambiarlo`}
      >
        {/* Indicador visual de estado temporal (ACTIVE vs HISTORIC_EDITABLE) */}
        <div 
          className="period-selector-dot"
          title={isCurrentlyActive ? "Periodo de Trabajo: ACTIVO" : "Periodo de Trabajo: HISTÓRICO"}
          style={{
            background: isCurrentlyActive ? '#34C759' : '#8E8E93',
            boxShadow: isCurrentlyActive ? '0 0 6px rgba(52, 199, 89, 0.6)' : 'none',
          }}
        />
        <Calendar className="period-selector-icon" color="var(--text-main)" />
        <select 
          className="period-selector-select"
          value={activePeriodKey}
          onChange={(e) => setActivePeriodKey(e.target.value)}
        >
          {renderPeriods.map(p => (
            <option key={p.period_key} value={p.period_key} style={{ color: 'var(--text-main)' }}>
              {formatPeriodName(p.period_key, (p as any).name)}
            </option>
          ))}
          {/* Asegurar que el mes actual nativo se pueda elegir si aún no existe en DB */}
          {!renderPeriods.find(p => p.period_key === activePeriodKey) && (
            <option value={activePeriodKey} style={{ color: 'var(--text-main)' }}>
              {formatPeriodName(activePeriodKey)}
            </option>
          )}
        </select>
      </div>
    </>
  )
}
