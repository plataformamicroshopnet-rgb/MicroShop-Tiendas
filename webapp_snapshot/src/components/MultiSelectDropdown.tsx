'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface Props {
  options: string[]
  value: string // Comma separated string
  onChange: (val: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function MultiSelectDropdown({ options, value, onChange, disabled, placeholder = "Seleccionar..." }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedValues = value ? value.split(',').map(s => s.trim()).filter(Boolean) : []

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const toggleOption = (opt: string) => {
    let newSelected = [...selectedValues]
    if (newSelected.includes(opt)) {
      newSelected = newSelected.filter(v => v !== opt)
    } else {
      newSelected.push(opt)
    }
    onChange(newSelected.join(', '))
  }

  const isLegacy = value && !selectedValues.every(v => options.includes(v))

  return (
    <div ref={containerRef} style={{ position: 'relative', width: 180 }}>
      <button 
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '6px 8px',
          backgroundColor: isLegacy ? 'rgba(255, 149, 0, 0.1)' : 'var(--app-bg)',
          color: isLegacy ? '#f59e0b' : 'var(--light-text)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          cursor: disabled ? 'not-allowed' : 'pointer',
          minHeight: 30
        }}
        title={value}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
          {selectedValues.length === 0 ? placeholder : (isLegacy ? 'Fórmula Libre' : `${selectedValues.length} seleccionados`)}
        </span>
        <ChevronDown size={14} />
      </button>

      {isOpen && !disabled && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: 8,
          zIndex: 50,
          width: 240,
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          maxHeight: 300,
          overflowY: 'auto'
        }}>
          {isLegacy && (
            <div style={{ marginBottom: 8, fontSize: 11, color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 6, borderRadius: 4 }}>
              Contiene fórmula antigua. Usa el modo libre si no quieres perderla.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {options.map(opt => {
              const isSelected = selectedValues.includes(opt)
              return (
                <div 
                  key={opt}
                  onClick={() => toggleOption(opt)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    color: isSelected ? '#60a5fa' : '#f8fafc',
                    fontSize: 12
                  }}
                >
                  <div style={{ width: 14, height: 14, border: '1px solid', borderColor: isSelected ? '#3b82f6' : '#64748b', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? '#3b82f6' : 'transparent' }}>
                    {isSelected && <Check size={10} color="white" strokeWidth={3} />}
                  </div>
                  {opt}
                </div>
              )
            })}
          </div>

          <div style={{ borderTop: '1px solid #334155', marginTop: 8, paddingTop: 8 }}>
            <div 
              onClick={() => {
                if (selectedValues.includes('FORMULA_LIBRE')) {
                  onChange(selectedValues.filter(v => v !== 'FORMULA_LIBRE').join(', '))
                } else {
                  onChange(value ? `${value}, FORMULA_LIBRE` : 'FORMULA_LIBRE')
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: 12
              }}
            >
              <div style={{ width: 14, height: 14, border: '1px solid #64748b', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: selectedValues.includes('FORMULA_LIBRE') ? '#64748b' : 'transparent' }}>
                {selectedValues.includes('FORMULA_LIBRE') && <Check size={10} color="white" strokeWidth={3} />}
              </div>
              Modo Fórmula Libre
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
