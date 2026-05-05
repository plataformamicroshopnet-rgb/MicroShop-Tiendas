'use client'

import React, { useState, useEffect } from 'react'
import { Database, ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { usePeriod } from '@/components/PeriodProvider'
import { PeriodSelector } from '@/components/PeriodSelector'

const FIXED_COLUMNS = [
  'Productos FFVV',
  'Objetivo1 Plus',
  'Objetivo2 Plus',
  'Objetivo1 Básico',
  'Objetivo2 Básico',
  'Comisiones Objetivo 1',
  'Comisiones Objetivo 2',
  'Extras llegando toda la Empresa',
  'Objetivos Toda la empresa'
]

const GROUPED_COLUMNS = [
  'Objetivo1 Plus',
  'Objetivo2 Plus',
  'Objetivo1 Básico',
  'Objetivo2 Básico',
  'Objetivos Toda la empresa'
]

const getGroup = (producto: string) => {
  if (!producto) return null;
  const p = String(producto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (p.includes('kit') && p.includes('consulting')) return 'KIT';
  if (p.includes('migra baf')) return 'MBAF';
  if (p.includes('baf') || p.includes('respaldo 5g')) return 'BAF';
  if (p.includes('fd')) return 'FD';
  if (p.includes('fn')) return 'FN';
  if (p.includes('puesto fijo')) return 'PF';
  if (p.includes('renovacion') && p.includes('dispositivo')) return 'REN';
  if (p.includes('alta movil')) return 'ALTA';
  if (p.includes('porta movil') || p.includes('porta')) return 'PORTA';
  if (p.includes('tma')) return 'TMA';
  if (p.includes('micro')) return 'MIC';
  if (p.includes('ti') || p.includes('tgt')) return 'TI';
  if (p.includes('alarma') || p.includes('mpa')) return 'MPA';

  return p.trim();
}

export function CondicionesPlusDisplay({ title, parentHref }: { title?: string, parentHref?: string }) {
  const { activePeriodKey } = usePeriod()
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!activePeriodKey) return;
    setLoading(true)
    fetch(`/api/condiciones-plus?periodKey=${activePeriodKey}&strictPeriod=1`)
      .then(res => res.json())
      .then(data => {
        setRows(data?.rows || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [activePeriodKey])

  const isNumericValue = (val: string) => !isNaN(parseFloat(val)) && isFinite(Number(val))

  if (loading) {
    return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--light-text)'}}>Cargando configuración...</div>
  }

  return (
    <div style={{ padding: 20 }}>
      <PageHeader 
          title={<><Database className="text-cyan" size={28} /> {title || "Condiciones y Extras FFVV"}</>}
          subtitle="Consulta de la tabla de objetivos, comisiones y KPIs extendidos del periodo."
          showBack={true}
          backFallback={parentHref || "/"}
      />

      <div className="card" style={{ padding: 0, overflowX: 'auto', marginTop: 24, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#00ADEF', color: 'var(--bg-card)' }}>
                {FIXED_COLUMNS.map((col, idx) => {
                  let colWidth: string | number | undefined = undefined;
                  let inlinePadding = '12px 16px';

                  if (idx === 0) colWidth = '24%'; // Productos FFVV
                  else if (idx >= 1 && idx <= 4) { colWidth = '8%'; inlinePadding = '12px 6px'; } // Objetivos
                  else if (idx >= 5 && idx <= 8) { colWidth = '11%'; inlinePadding = '12px 6px'; }
                  
                  return (
                    <th key={col} style={{ padding: inlinePadding, textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)', width: colWidth, boxSizing: 'border-box' }}>
                      {col}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={FIXED_COLUMNS.length} style={{ padding: 40, textAlign: 'center', color: 'var(--medium-gray)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <ClipboardList size={32} opacity={0.5} />
                      No hay matriz de condiciones configurada para este mes.
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => {
                  const prodName = row['Productos FFVV']?.trim() || ''
                  const currentGroup = prodName ? getGroup(prodName) : `empty_${i}`
                  const prodNamePrev = i > 0 ? rows[i - 1]['Productos FFVV']?.trim() || '' : ''
                  const prevGroup = i > 0 ? (prodNamePrev ? getGroup(prodNamePrev) : `empty_${i - 1}`) : null
                  
                  const isGroupStart = currentGroup !== prevGroup
                  
                  let rowSpanCount = 1
                  if (isGroupStart && prodName) {
                    let j = i + 1
                    while (j < rows.length) {
                      const nextProd = rows[j]['Productos FFVV']?.trim() || ''
                      if (nextProd && getGroup(nextProd) === currentGroup) {
                        rowSpanCount++
                        j++
                      } else {
                        break
                      }
                    }
                  }

                  return (
                    <tr key={i} style={{ 
                      borderBottom: '1px solid var(--border-color)',
                      borderTop: isGroupStart && prodName ? `2px solid rgba(0, 173, 239, 0.4)` : 'none'
                    }}>
                      {FIXED_COLUMNS.map((col, colIdx) => {
                        const isGroupedCol = GROUPED_COLUMNS.includes(col)
                        
                        if (isGroupedCol && !isGroupStart) {
                          return null
                        }

                        const val = row[col] || ''
                        const isNumeric = isNumericValue(val)
                        const align = colIdx === 0 ? 'left' : 'center'
                        
                        return (
                          <td 
                            key={col} 
                            rowSpan={isGroupedCol ? rowSpanCount : 1}
                            style={{ 
                              padding: '12px 16px', 
                              borderRight: '1px solid var(--border-color)',
                              verticalAlign: 'middle',
                              color: isNumeric ? 'var(--mercedes-cyan)' : 'var(--text-main)',
                              fontWeight: isNumeric ? 600 : 500,
                              textAlign: align,
                              height: isGroupedCol ? Math.max(44, (rowSpanCount * 44)) : 44
                            }}
                          >
                            {val === '' && isGroupedCol && isGroupStart && prodName ? "-" : val}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
      </div>
    </div>
  )
}
