'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Check, Folder, File, Layers } from 'lucide-react'

interface Props {
  value: string // Comma separated string
  onChange: (val: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function ProductTreeSelector({ value, onChange, disabled, placeholder = "Seleccionar..." }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [catalogs, setCatalogs] = useState<Record<string, any[]>>({})
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})
  
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedValues = value ? value.split(',').map(s => s.trim()).filter(Boolean) : []

  useEffect(() => {
    fetch(`/api/catalogs?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCatalogs(data.catalogs)
        }
      })
      .catch(() => {})
  }, [])

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
    const cleanOpt = opt.trim()
    let newSelected = [...selectedValues]
    if (newSelected.includes(cleanOpt)) {
      newSelected = newSelected.filter(v => v !== cleanOpt)
    } else {
      newSelected.push(cleanOpt)
    }
    onChange(newSelected.join(', '))
  }

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const predefined = ["Alta BAF Total", "Alta BAF Convergente", "Dispositivos", "Seguro", "Swap", "MPA", "FTTR", "ARPU", "Repo Fútbol"];
  
  // Palancas RETIRADAS (ago-2026): \u00abRepos\u00bb (la vieja de incremento de ARPU, que en
  // pantalla se ve\u00eda como \u00abArpu (Repos)\u00bb) y \u00abSuscripciones TV\u00bb. Todo eso pasa a la
  // palanca nueva \u00abRepos (Arpu)\u00bb, as\u00ed que ya no se pueden elegir al montar una regla.
  // Las reglas viejas que las tengan puestas siguen funcionando igual, y si una regla
  // ya la tiene marcada se sigue viendo (si no, el due\u00f1o no podr\u00eda ni quitarla).
  const RETIRADAS = ['Repos', 'Suscripciones TV']
  const ETIQUETA_CAT: Record<string, string> = { 'O2': 'O2 MovilFree', 'Repos UP': 'Repos (Arpu)' }

  // Extraemos categorias excluyendo algunas si hace falta, pero mostramos todas las que vienen del server
  const categories = Object.keys(catalogs)
    .filter(cat => cat !== 'Fija' && cat !== 'M\u00f3vil' && cat !== 'Mvil' && cat !== 'Micro')
    .filter(cat => !RETIRADAS.includes(cat) || selectedValues.includes(cat))
    .sort()

  const isLegacy = value && !selectedValues.some(v => predefined.includes(v) || categories.includes(v) || Object.values(catalogs).flat().some(p => p.producto === v)) && !selectedValues.includes('FORMULA_LIBRE')

  const renderCheckbox = (label: string, optValue: string, isFolder: boolean = false, onClickExpand?: () => void, isExpanded?: boolean) => {
    const cleanOpt = optValue.trim()
    const isSelected = selectedValues.includes(cleanOpt)
    return (
      <div 
        key={cleanOpt}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 4,
          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        }}
      >
        {isFolder && onClickExpand ? (
          <div 
            onClick={onClickExpand} 
            style={{ cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isExpanded ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#94a3b8" />}
          </div>
        ) : (
          <div style={{ width: 18 }} /> // Spacer
        )}
        
        <div 
          onClick={() => toggleOption(optValue)}
          style={{ width: 14, height: 14, border: '1px solid', borderColor: isSelected ? '#3b82f6' : '#64748b', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? '#3b82f6' : 'transparent', cursor: 'pointer', flexShrink: 0 }}
        >
          {isSelected && <Check size={10} color="white" strokeWidth={3} />}
        </div>
        
        <div 
          onClick={() => toggleOption(optValue)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: isSelected ? '#60a5fa' : '#e2e8f0', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={label}
        >
          {isFolder ? <Folder size={14} color={isSelected ? '#60a5fa' : '#94a3b8'} /> : <File size={14} color={isSelected ? '#60a5fa' : '#64748b'} />}
          {label}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: 220 }}>
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
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
          {selectedValues.length === 0 ? placeholder : (isLegacy ? 'Fórmula Libre (Antigua)' : `${selectedValues.length} seleccionados`)}
        </span>
        <ChevronDown size={14} />
      </button>

      {isOpen && !disabled && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: 8,
          zIndex: 50,
          width: 320,
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          maxHeight: 400,
          overflowY: 'auto'
        }}>
          
          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 8 }}>
            Alias Predefinidos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
            {predefined.map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 4, backgroundColor: selectedValues.includes(p) ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                <div style={{ width: 18 }} />
                <div onClick={() => toggleOption(p)} style={{ width: 14, height: 14, border: '1px solid', borderColor: selectedValues.includes(p) ? '#3b82f6' : '#64748b', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: selectedValues.includes(p) ? '#3b82f6' : 'transparent', cursor: 'pointer', flexShrink: 0 }}>
                  {selectedValues.includes(p) && <Check size={10} color="white" strokeWidth={3} />}
                </div>
                <div onClick={() => toggleOption(p)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: selectedValues.includes(p) ? '#60a5fa' : '#e2e8f0', fontSize: 12, flex: 1 }}>
                  <Layers size={14} color={selectedValues.includes(p) ? '#60a5fa' : '#94a3b8'} />
                  {p}
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 8 }}>
            Catálogo de Productos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {categories.map(cat => {
              const products = (cat === 'Traslado miMovistar' ? catalogs['miMovistar'] : catalogs[cat]) || []
              // Filter distinct product names
              const distinctProducts = [...new Set(products.map(p => p.producto).filter(Boolean))].sort()
              const isExpanded = expandedCats[cat]
              
              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column' }}>
                  {renderCheckbox(ETIQUETA_CAT[cat] || cat, cat, true, () => toggleCat(cat), isExpanded)}
                  
                  {isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 24, marginTop: 2 }}>
                      {distinctProducts.map(prod => renderCheckbox(String(prod), String(prod), false))}
                    </div>
                  )}
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
              <div style={{ width: 18 }} />
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
