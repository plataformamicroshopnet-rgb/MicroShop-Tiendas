'use client'

import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import './ThemeToggle.css'

/**
 * Interruptor de día / noche con forma de pastilla.
 *
 * Enseña los DOS modos a la vez y marca con un círculo de color el que está
 * puesto. El botón anterior mostraba un solo icono —el del modo al que ibas—
 * y obligaba a pensar si la luna quería decir «estoy en noche» o «ve a noche».
 *
 * `acento` deja usar el mismo componente en los demás programas de la casa con
 * el color de cada uno, sin tocar una línea del CSS.
 */
export function ThemeToggle({ acento = '#00ADEF' }: { acento?: string }) {
  const { theme, toggleTheme } = useTheme()
  const esNoche = theme === 'dark'

  return (
    <button
      type="button"
      className="pastilla-tema"
      data-modo={theme}
      style={{ ['--pastilla-acento' as string]: acento }}
      onClick={toggleTheme}
      // `switch` y `aria-checked` para que un lector de pantalla diga
      // «interruptor, activado» en vez de leer dos iconos sueltos.
      role="switch"
      aria-checked={esNoche}
      aria-label={esNoche ? 'Modo noche activado. Cambiar a modo día' : 'Modo día activado. Cambiar a modo noche'}
      title={esNoche ? 'Cambiar a Modo Día' : 'Cambiar a Modo Noche'}
    >
      <span className="pastilla-bola" aria-hidden="true" />
      <span className={`pastilla-hueco${esNoche ? '' : ' activo'}`} aria-hidden="true">
        <Sun size={16} strokeWidth={2} />
      </span>
      <span className={`pastilla-hueco${esNoche ? ' activo' : ''}`} aria-hidden="true">
        <Moon size={16} strokeWidth={2} />
      </span>
    </button>
  )
}
