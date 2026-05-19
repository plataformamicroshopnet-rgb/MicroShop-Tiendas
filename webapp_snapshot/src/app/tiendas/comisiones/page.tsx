'use client'

import { useState, useEffect } from 'react'
import { CreditCard, AlertCircle } from 'lucide-react'
import { usePeriod } from '@/components/PeriodProvider'
import { PageHeader } from '@/components/PageHeader'
import { PeriodSelector } from '@/components/PeriodSelector'

export default function TiendasComisionesPage() {
  const { activePeriodKey, availablePeriods, isLoadingPeriods } = usePeriod()
  const activePeriodObj = availablePeriods.find(p => p.period_key === activePeriodKey)
  const isHistoric = activePeriodObj?.status === 'HISTORIC'

  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<any[]>([])
  const [hours, setHours] = useState<any[]>([])

  useEffect(() => {
    if (!activePeriodKey) return
    setLoading(true)
    fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setRules(res.rules || [])
          setHours(res.hours || [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [activePeriodKey])

  if (loading || isLoadingPeriods) {
    return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', textAlign: 'center' }}>Calculando comisiones...</div>
  }

  return (
    <div style={{ padding: 20, paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, marginTop: 12, alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
          <PageHeader 
            title={'Hub Comercial: Comisiones'}
            showBack={true}
            backFallback="/tiendas"
            showPeriodSelector={false}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <PeriodSelector />
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <CreditCard size={24} color="var(--mercedes-cyan)" />
          <h2 style={{ margin: 0, color: 'var(--light-text)' }}>Objetivos Prorrateados por Comercial</h2>
        </div>

        {rules.length === 0 || hours.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--medium-gray)', border: '1px dashed var(--border-color)', borderRadius: 12 }}>
            Faltan reglas o comerciales configurados para este mes en <strong>Entrada de Datos {'>'} Comisiones para Tiendas</strong>.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--app-bg)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', position: 'sticky', left: 0, backgroundColor: 'var(--app-bg)', zIndex: 1, borderRight: '1px solid var(--border-color)' }}>Comercial</th>
                  <th style={{ padding: '12px 16px', borderRight: '1px solid var(--border-color)', color: 'var(--mercedes-cyan)' }}>Horario</th>
                  {rules.map((rule, i) => (
                    <th key={i} style={{ padding: '12px 16px', borderRight: i === rules.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                      Objetivos<br/>
                      <span style={{ color: 'var(--light-text)' }}>{rule.nombre}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((comercial, rowIdx) => (
                  <tr key={rowIdx} style={{ borderBottom: '1px solid var(--table-border)', backgroundColor: rowIdx % 2 === 0 ? 'var(--active-bg)' : 'transparent' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--mercedes-cyan)', position: 'sticky', left: 0, backgroundColor: rowIdx % 2 === 0 ? 'var(--active-bg)' : 'var(--bg-card)', zIndex: 1, borderRight: '1px solid var(--border-color)' }}>
                      {comercial.comercial}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>
                      {comercial.horario}h
                    </td>
                    {rules.map((rule, colIdx) => {
                      const totalHoras = rule.totalHoras || 0
                      const objetivoGlobal = rule.objPrimerTramo || 0
                      const isMoney = String(rule.importePrimerTramo || '').includes('%') // If importe is percentage, then objective is in Euros. User screenshot indicates things like "96.542,00 €" for Dispositivos + Seguro. This is a heuristic. Let's just format it safely.
                      
                      let cellValue = '0'
                      let suffix = ''

                      if (totalHoras > 0) {
                        const calculated = (objetivoGlobal / totalHoras) * comercial.horario
                        // Format: if it's large (> 1000), show currency formatting. Else, round to integer like 13, 8.
                        if (objetivoGlobal > 1000) {
                          cellValue = calculated.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                          suffix = ' €'
                        } else {
                          cellValue = Math.round(calculated).toString()
                        }
                      }

                      return (
                        <td key={colIdx} style={{ padding: '12px 16px', textAlign: 'center', borderRight: colIdx === rules.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{cellValue}{suffix}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 24, padding: '16px', backgroundColor: 'rgba(0,173,239,0.05)', border: '1px solid var(--mercedes-cyan)', borderRadius: 12 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--mercedes-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={16} /> Próximo Paso
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--light-text)', lineHeight: 1.5 }}>
            Estos objetivos prorrateados se cruzarán automáticamente con las <strong>Ventas Reales</strong> registradas en el sistema para determinar el grado de cumplimiento de cada comercial, aplicando la lógica de negocio <em>(ej: miMovistar + BAF no Fusión + O2)</em> y determinando las comisiones finales basadas en los Tramos definidos.
          </p>
        </div>
      </div>
    </div>
  )
}
