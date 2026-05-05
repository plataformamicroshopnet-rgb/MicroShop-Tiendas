import React, { useState, useEffect } from 'react'
import { Euro, Calendar, RefreshCcw } from 'lucide-react'
import { renderDashboardData } from '@/lib/salesUtils'

interface RepescaProps {
  user: any
  activeYear: number
}

export const RepescaTrimestral: React.FC<RepescaProps> = ({ user, activeYear }) => {
  const [selectedQuarter, setSelectedQuarter] = useState<string>('Q2')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  const fetchRepescaData = async () => {
    setLoading(true)
    try {
      const qKey = `${activeYear}_${selectedQuarter}`
      const res = await fetch(`/api/repesca?quarterKey=${qKey}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        alert(json.error)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRepescaData()
  }, [activeYear, selectedQuarter])

  if (!data && loading) {
    return <div style={{ padding: 20 }}>Cargando repesca...</div>
  }

  if (!data) return null;

  const { allQuarterSales, salesByMonth, objetivosDB, importesPymeDB, importesPlusDB } = data
  const quarterKey = `${activeYear}_${selectedQuarter}`

  const quartersMap: any = {
    'Q1': ['01', '02', '03'],
    'Q2': ['04', '05', '06'],
    'Q3': ['07', '08', '09'],
    'Q4': ['10', '11', '12']
  }
  const months = (quartersMap[selectedQuarter] || []).map((m: string) => `${activeYear}_${m}`)

  // Evaluamos TODO el trimestre de forma VIRTUAL (sin tocar la DB de trimestres)
  const objPymeQ: any = {}
  const objCaptadorQ: any = {}
  
  months.forEach((mKey: string) => {
    const oPyme = objetivosDB.find((o: any) => o.period_key === mKey && o.profile === 'Pyme')?.objectives || {}
    const oCaptador = objetivosDB.find((o: any) => o.period_key === mKey && o.profile === 'Captador')?.objectives || {}
    
    Object.keys(oPyme).forEach(k => {
      objPymeQ[k] = (objPymeQ[k] || 0) + (Number(oPyme[k]) || 0)
    })
    Object.keys(oCaptador).forEach(k => {
      objCaptadorQ[k] = (objCaptadorQ[k] || 0) + (Number(oCaptador[k]) || 0)
    })
  })

  // Matriz de Importes Trimestrales Virtuales
  const getMatrixFor = (db: any[]) => {
    let m = db.filter((i: any) => months.includes(i.period_key))
    if (m.length > 0) return db.filter((i: any) => i.period_key === m[m.length - 1].period_key) 
    if (db.length > 0) return db.filter((i: any) => i.period_key === db[db.length - 1].period_key) 
    return []
  }
  
  const impPymeQ = getMatrixFor(importesPymeDB)
  const impPlusQ = getMatrixFor(importesPlusDB)

  const pymeDataQ = renderDashboardData('Pyme', impPymeQ, objPymeQ, allQuarterSales, {})
  const plusDataQ = renderDashboardData('Captador', impPlusQ, objCaptadorQ, allQuarterSales, {})

  const getDashboardMes = (periodKey: string, profile: 'Pyme'|'Captador') => {
    const sales = salesByMonth[periodKey] || []
    const obj = objetivosDB.find((o: any) => o.period_key === periodKey && o.profile === profile)?.objectives || {}
    let imp = profile === 'Pyme' 
      ? importesPymeDB.filter((i: any) => i.period_key === periodKey)
      : importesPlusDB.filter((i: any) => i.period_key === periodKey)
      
    if (imp.length === 0) {
      imp = profile === 'Pyme' ? getMatrixFor(importesPymeDB) : getMatrixFor(importesPlusDB)
    }

    return renderDashboardData(profile, imp, obj, sales, {})
  }

  const getGananciaPotencial = (profile: 'Pyme'|'Captador', qData: any) => {
    const payoutTrimestral = qData.totalImporte || 0
    let pagoAcumuladoMeses = 0
    months.forEach((mKey: string) => {
      pagoAcumuladoMeses += getDashboardMes(mKey, profile).totalImporte || 0
    })
    return payoutTrimestral - pagoAcumuladoMeses
  }

  const gananciaPyme = getGananciaPotencial('Pyme', pymeDataQ)
  const gananciaCaptador = getGananciaPotencial('Captador', plusDataQ)

  const gruposSet = new Set<string>()
  const extractGrupos = (rows: any[]) => {
    rows.forEach(r => {
      if (r.grupo && r.grupo.trim() !== '') gruposSet.add(r.grupo.trim().toUpperCase())
    })
  }
  extractGrupos(pymeDataQ.rows)
  extractGrupos(plusDataQ.rows)
  
  const predefinedOrder = ['FD', 'BAF', 'TMA', 'MIC', 'PORT.', 'TI']
  const sortedGrupos = Array.from(gruposSet).sort((a, b) => {
    const ia = predefinedOrder.indexOf(a)
    const ib = predefinedOrder.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  })

  // Funciones de cálculo: Lógica de Operaciones por Grupo Cliente
  const PLUS_CODES = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7']
  const isPlusCode = (c: string) => PLUS_CODES.some(x => (c || '').toLowerCase().includes(x))
  const isBasicoCode = (c: string) => {
    const l = (c || '').toLowerCase()
    return l.includes('básico xcu') || l.includes('basico xcu') || l.includes('bǭsico xcu')
  }

  const getGrupoId = (grupoLabel: string) => {
    const map: any = { 'FD': 'fd', 'BAF': 'baf', 'TMA': 'tma', 'MIC': 'micro', 'PORT.': 'porta', 'TI': 'ti' }
    return map[grupoLabel] || grupoLabel.toLowerCase()
  }

  const filterByTab = (sale: any, tabId: string): boolean => {
    const g = (sale.grupo || '').toUpperCase()
    const d = (sale.detalle || '').toLowerCase().trim()
    switch (tabId) {
      case 'tma':   return d === 'tma'
      case 'micro': return d === 'micro'
      case 'ti':    return d === 'ti'
      case 'fd':    {
        if (g === 'REN' && (sale.producto || '').toLowerCase().includes('dispositivo')) return false
        return ['FD','FN','PF','REN'].includes(g)
      }
      case 'baf':   return ['BAF','FIBRA'].includes(g)
      case 'porta': return ['PORTA','PORTABILIDAD'].includes(g) && d !== 'tma' && d !== 'micro' && d !== 'ti' && d !== 'mpa'
    }
    return false
  }

  const getAvanceForGroup = (monthIndex: number, grupoLabel: string, profile: 'Plus' | 'Basico') => {
    const mKey = months[monthIndex]
    const monthSales = salesByMonth[mKey] || []
    const tabId = getGrupoId(grupoLabel)
    
    const matched = monthSales.filter((s: any) => filterByTab(s, tabId))
    
    let profileMatched: any[] = []
    if (profile === 'Plus') profileMatched = matched.filter((s: any) => isPlusCode(s.codigo))
    if (profile === 'Basico') profileMatched = matched.filter((s: any) => isBasicoCode(s.codigo))
    
    if (['tma', 'micro', 'ti'].includes(tabId)) {
      return profileMatched.reduce((sum, s) => sum + (Number(s.cuota) || 0), 0)
    }

    return profileMatched.length
  }

  const getTargetForGroup = (dashboard: any, group: string) => {
    const gRow = dashboard.rows.find((r: any) => String(r.grupo).trim().toUpperCase() === group)
    return gRow ? (gRow.target || 0) : 0
  }

  const dashboardsPyme = months.map((m: string) => getDashboardMes(m, 'Pyme'))
  const dashboardsCaptador = months.map((m: string) => getDashboardMes(m, 'Captador'))

  const q2Objectives: any = {
    'FD': { plus: [12.26, 13.39, 13.72], basico: [4.79, 4.67, 4.83] },
    'BAF': { plus: [11.57, 13.59, 14.42], basico: [2.68, 2.76, 2.93] },
    'TMA': { plus: [36105.36, 42408.98, 44979.22], basico: [3960.14, 4083.90, 4331.41] },
    'MIC': { plus: [13598.51, 15972.67, 16940.71], basico: [953.13, 982.92, 1042.49] },
    'PORT.': { plus: [31.06, 33.93, 34.75], basico: [17.00, 16.60, 17.15] },
    'TI': { plus: [2910.27, 2643.66, 2759.69], basico: [0, 0, 0] }
  }

  const renderGrupos = selectedQuarter === 'Q2' ? predefinedOrder : sortedGrupos

  const renderNumber = (n: number) => n === 0 ? '-' : n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ backgroundColor: 'var(--mercedes-cyan)', width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCcw size={20} color="#000" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#111827' }}>Simulador Repesca Trimestral</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--medium-gray)' }}>Año: {activeYear}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
            <button
              key={q}
              onClick={() => setSelectedQuarter(q)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                border: 'none',
                backgroundColor: selectedQuarter === q ? 'var(--mercedes-cyan)' : 'var(--bg-input)',
                color: selectedQuarter === q ? '#000' : 'var(--text-main)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginBottom: 24 }}>
        {/* TABLA PLUS */}
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <table className="tabla-liquidacion-compacta" style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ backgroundColor: '#34C759', color: '#fff', borderRight: '1px solid rgba(255,255,255,0.3)', textAlign: 'left', padding: '8px 12px' }}>MICROSHOP</th>
                <th colSpan={7} style={{ backgroundColor: '#34C759', color: '#fff', textAlign: 'center', padding: '8px 12px' }}>Plus</th>
              </tr>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ textAlign: 'left', padding: '6px 12px', borderRight: '1px solid #cbd5e1' }}>Palanca</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>{activeYear}{quartersMap[selectedQuarter][0]}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>{activeYear}{quartersMap[selectedQuarter][1]}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>{activeYear}{quartersMap[selectedQuarter][2]}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 'bold', borderRight: '1px solid #cbd5e1' }}>Total Plus</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Avance</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Faltan</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Porcentaje</th>
              </tr>
            </thead>
            <tbody>
              {renderGrupos.map((grupo, idx) => {
                let plusObjM1 = 0, plusObjM2 = 0, plusObjM3 = 0
                
                if (selectedQuarter === 'Q2' && q2Objectives[grupo]) {
                  plusObjM1 = q2Objectives[grupo].plus[0]
                  plusObjM2 = q2Objectives[grupo].plus[1]
                  plusObjM3 = q2Objectives[grupo].plus[2]
                } else {
                  plusObjM1 = getTargetForGroup(dashboardsPyme[0], grupo)
                  plusObjM2 = getTargetForGroup(dashboardsPyme[1], grupo)
                  plusObjM3 = getTargetForGroup(dashboardsPyme[2], grupo)
                }

                const totalPlusObj = plusObjM1 + plusObjM2 + plusObjM3
                
                const plusSalesM1 = getAvanceForGroup(0, grupo, 'Plus')
                const plusSalesM2 = getAvanceForGroup(1, grupo, 'Plus')
                const plusSalesM3 = getAvanceForGroup(2, grupo, 'Plus')
                const avancePlus = plusSalesM1 + plusSalesM2 + plusSalesM3
                
                const faltanPlus = totalPlusObj > avancePlus ? totalPlusObj - avancePlus : 0
                const pctPlus = totalPlusObj > 0 ? (avancePlus / totalPlusObj) * 100 : (avancePlus > 0 ? 100 : 0)

                const rowColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc'

                return (
                  <tr key={`plus-${grupo}`} style={{ backgroundColor: rowColor, borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 12px', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>{grupo}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{renderNumber(plusObjM1)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{renderNumber(plusObjM2)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{renderNumber(plusObjM3)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>{renderNumber(totalPlusObj)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{renderNumber(avancePlus)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: faltanPlus > 0 ? '#ef4444' : '#10b981' }}>{faltanPlus === 0 && totalPlusObj > 0 ? 'Cumplido' : renderNumber(faltanPlus)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: pctPlus >= 100 ? '#10b981' : 'inherit' }}>{totalPlusObj > 0 ? `${pctPlus.toFixed(2)}%` : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* TABLA BÁSICO */}
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <table className="tabla-liquidacion-compacta" style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th colSpan={8} style={{ backgroundColor: '#00ADEF', color: '#fff', textAlign: 'center', padding: '8px 12px' }}>Básico</th>
              </tr>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ textAlign: 'left', padding: '6px 12px', borderRight: '1px solid #cbd5e1' }}>Palanca</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>{activeYear}{quartersMap[selectedQuarter][0]}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>{activeYear}{quartersMap[selectedQuarter][1]}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>{activeYear}{quartersMap[selectedQuarter][2]}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 'bold', borderRight: '1px solid #cbd5e1' }}>Total Básico</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Avance</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Faltan</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Porcentaje</th>
              </tr>
            </thead>
            <tbody>
              {renderGrupos.map((grupo, idx) => {
                let basObjM1 = 0, basObjM2 = 0, basObjM3 = 0
                
                if (selectedQuarter === 'Q2' && q2Objectives[grupo]) {
                  basObjM1 = q2Objectives[grupo].basico[0]
                  basObjM2 = q2Objectives[grupo].basico[1]
                  basObjM3 = q2Objectives[grupo].basico[2]
                } else {
                  basObjM1 = getTargetForGroup(dashboardsCaptador[0], grupo)
                  basObjM2 = getTargetForGroup(dashboardsCaptador[1], grupo)
                  basObjM3 = getTargetForGroup(dashboardsCaptador[2], grupo)
                }

                const totalBasObj = basObjM1 + basObjM2 + basObjM3
                
                const basSalesM1 = getAvanceForGroup(0, grupo, 'Basico')
                const basSalesM2 = getAvanceForGroup(1, grupo, 'Basico')
                const basSalesM3 = getAvanceForGroup(2, grupo, 'Basico')
                const avanceBas = basSalesM1 + basSalesM2 + basSalesM3
                
                const faltanBas = totalBasObj > avanceBas ? totalBasObj - avanceBas : 0
                const pctBas = totalBasObj > 0 ? (avanceBas / totalBasObj) * 100 : (avanceBas > 0 ? 100 : 0)

                const rowColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc'

                return (
                  <tr key={`bas-${grupo}`} style={{ backgroundColor: rowColor, borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 12px', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>{grupo}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{renderNumber(basObjM1)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{renderNumber(basObjM2)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{renderNumber(basObjM3)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>{renderNumber(totalBasObj)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{renderNumber(avanceBas)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: faltanBas > 0 ? '#ef4444' : '#10b981' }}>{faltanBas === 0 && totalBasObj > 0 ? 'Cumplido' : renderNumber(faltanBas)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: pctBas >= 100 ? '#10b981' : 'inherit' }}>{totalBasObj > 0 ? `${pctBas.toFixed(2)}%` : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <div style={{ backgroundColor: 'rgba(52, 199, 89, 0.1)', padding: 20, borderRadius: 12, border: '1px solid rgba(52, 199, 89, 0.3)' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#34C759', fontSize: 14, textTransform: 'uppercase' }}>Ganancia Potencial PLUS</h4>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#34C759' }}>{gananciaPyme > 0 ? '+' : ''}{gananciaPyme.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</div>
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--medium-gray)' }}>Diferencia económica entre el pago individual de los 3 meses y el abono trimestral completo.</p>
        </div>
        <div style={{ backgroundColor: 'rgba(0, 173, 239, 0.1)', padding: 20, borderRadius: 12, border: '1px solid rgba(0, 173, 239, 0.3)' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--mercedes-cyan)', fontSize: 14, textTransform: 'uppercase' }}>Ganancia Potencial BÁSICO</h4>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--mercedes-cyan)' }}>{gananciaCaptador > 0 ? '+' : ''}{gananciaCaptador.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</div>
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--medium-gray)' }}>Diferencia económica entre el pago individual de los 3 meses y el abono trimestral completo.</p>
        </div>
      </div>
    </div>
  )
}
