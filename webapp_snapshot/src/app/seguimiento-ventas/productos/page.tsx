'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Package, ChevronLeft, Target, FilterX } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useTheme } from '@/components/ThemeProvider'
import { useRouter } from 'next/navigation'
import { renderDashboardData, getCurrentMonthString, normalizeString } from '@/lib/salesUtils'
import { usePeriod } from '@/components/PeriodProvider'

const formatCurrency = (val: any) => {
    if (!val) return '0,00 €'
    const num = typeof val === 'string' ? parseFloat(val.replace(/[^\d,-]/g, '').replace(',', '.')) : val
    return isNaN(num) ? '0,00 €' : num.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

const LEVER_MAPPING: Record<string, string[]> = {
  'FD': ['Alta FD Total', 'Alta FD Total NC', 'Migra FD Total', 'Alta FD Flex', 'Alta FD Flex NC', 'Migra FD Flex'],
  'BAF': ['Alta BAF Total', 'Alta BAF Total NC', 'Respaldo 5G'],
  'PORTA': ['Porta Móvil AV', 'Porta Móvil AV NC', 'Porta Móvil MV', 'Porta Móvil MV NC', 'Porta Móvil BV', 'Porta Móvil BV NC'],
  'TMA': ['TMAs'],
  'TI': ['Tis'],
  'MIC': ['Micro Informática']
}

const LEVERS = Object.keys(LEVER_MAPPING)

const LEVER_LABELS: Record<string, string> = {
  'FD': 'FD - Fusiones Digitales',
  'BAF': 'BAF - Alta BAF Total + Respaldo 5G',
  'PORTA': 'PORTA - Portas Móvil BV NC',
  'TMA': 'TMA - TMAs',
  'TI': 'TI - Tis',
  'MIC': 'MIC - Micro Informática'
}

export default function AvancePalancasPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const { activePeriodKey } = usePeriod()
  const [loading, setLoading] = useState(true)
  const [activeLeverFilter, setActiveLeverFilter] = useState<string | null>(null)
  const [expandedComboCell, setExpandedComboCell] = useState<string | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const [allSales, setAllSales] = useState<any[]>([])
  const [objetivos, setObjetivos] = useState<Record<string, any>>({ Pyme: {}, Captador: {} })
  const [objGrupos, setObjGrupos] = useState<Record<string, any>>({ Pyme: {}, Captador: {} })
  const [importesPyme, setImportesPyme] = useState<any[]>([])
  const [importesPlus, setImportesPlus] = useState<any[]>([])
  const [catalogs, setCatalogs] = useState<Record<string, any[]>>({})

  useEffect(() => {
    if (!activePeriodKey) return;
    setLoading(true)
    Promise.all([
      fetch(`/api/sales?periodKey=${activePeriodKey}`).then(res => res.json()),
      fetch(`/api/objetivos?periodKey=${activePeriodKey}&strictPeriod=1`).then(res => res.json()).catch(() => ({ success: true, objetivos: { Pyme: {}, Captador: {} } })),
      fetch(`/api/importes-pyme?periodKey=${activePeriodKey}&strictPeriod=1`).then(res => res.json()).catch(() => ({})),
      fetch(`/api/importes-plus?periodKey=${activePeriodKey}&strictPeriod=1`).then(res => res.json()).catch(() => ({})),
      fetch('/api/catalogs').then(res => res.json()).catch(() => ({}))
    ]).then(([sData, objData, pymeData, plusData, catData]) => {
      if (sData.success) {
        setAllSales(sData.data || sData.logs || [])
      }

      if (objData && objData.success && objData.objetivos) {
        setObjetivos(objData.objetivos)
        if (objData.grupos) setObjGrupos(objData.grupos)
      }
      if (pymeData && pymeData.success) {
        setImportesPyme(pymeData.importes || pymeData.data || [])
      }
      if (plusData && plusData.success) {
        setImportesPlus(plusData.importes || plusData.data || [])
      }
      if (catData && catData.success) {
        setCatalogs(catData.catalogs || {})
      }

      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [activePeriodKey])

  if (loading) {
    return <div style={{ padding: 20, color: 'var(--mercedes-cyan)', fontWeight: 'bold' }}>Cargando datos del dashboard...</div>
  }

  // Filtrado de servidor gestionado por el periodo actual
  const filteredSales = allSales

  const activeMonthStr = activePeriodKey ? activePeriodKey.replace('_', '') : ''

  // Obtener los perfiles del mes
  // Liquidación UI mapping: Pyme = VENTAS vs IMPORTES PLUS | Captador = VENTAS vs IMPORTES BÁSICO
  // Liquidación UI mapping: Pyme = VENTAS vs IMPORTES PLUS | Captador = VENTAS vs IMPORTES BÁSICO
  const activeObjPlusTarget = objetivos.Pyme?.[activeMonthStr] || {} 
  const activeObjBasicoTarget = objetivos.Captador?.[activeMonthStr] || {}

  // Generar datas de dashboard
  const pymeData = renderDashboardData('Pyme', importesPyme, activeObjPlusTarget, filteredSales, objGrupos)
  const plusData = renderDashboardData('Captador', importesPlus, activeObjBasicoTarget, filteredSales, objGrupos)

  const getStatsForLever = (lever: string, isPlus: boolean) => {
      // Find all valid product aliases for this lever safely ignoring accents/spaces
      const validProductsText = (LEVER_MAPPING[lever] || []).map(p => normalizeString(p))

      // Filter global sales to only include the ones for this specific lever
      const leverSales = filteredSales.filter(s => {
          const prodName = normalizeString(String(s.producto || ''))
          const det = String(s.detalle || '').trim().toLowerCase()
          
          let isLeverMatch = validProductsText.includes(prodName);
          if (lever === 'TI' && det === 'ti') isLeverMatch = true;
          if (lever === 'TMA' && det === 'tma') isLeverMatch = true;
          if (lever === 'MIC' && det === 'micro') isLeverMatch = true;

          if (!isLeverMatch) return false;

          const codigo = String(s.codigo || '').trim().toLowerCase();
          const tipoVenta = String(s.sheet || '').trim().toLowerCase();
          const prodCat = String(s.categoria || '').trim().toLowerCase();

          // Rule: Strict Plus vs Basico targeting based on 'codigo'
          const codigoLower = String(s.codigo || '').trim().toLowerCase();
          
          if (isPlus) {
              const plusCodesExact = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7'];
              return plusCodesExact.some(c => codigoLower.includes(c));
          } else {
              return codigoLower.includes('básico xcu') || codigoLower.includes('basico xcu');
          }
      })

      // Count OK and PED (Ignore NULL/Anulado)
      // We consider both 'OK' / 'No' under finalizadas, 'PED' / 'Si' under pendientes.
      let finalizadas = 0
      let pendientes = 0
      const isMonetary = ['TMA', 'TI', 'MIC'].includes(lever.toUpperCase())

      leverSales.forEach(s => {
        const ped = String(s.pendiente || '').trim().toUpperCase()
        const estado = String(s.estado || '').trim().toUpperCase()
        
        // Summation Value: If monetary, get the Float parsing of importe/cuota, else just 1.
        let val = 1
        if (isMonetary) {
            val = parseFloat(String(s.importe || s.cuota || '0').replace(/[^\d,-]/g, '').replace(',', '.')) || 0
        }

        if (ped === 'NO' || ped === 'OK' || estado === 'OK' || estado === 'FINALIZADO') {
            finalizadas += val
        } else if (ped === 'SI' || ped === 'PED' || estado === 'PENDIENTE') {
            pendientes += val
        }
      })

      const totalCount = finalizadas + pendientes

      // TARGET MAPPING:
      // Both sections now dynamically read exactly what Liquidaciones "TOTAL OBJETIVOS" calculated,
      // avoiding duplicate grouping math by interrogating the rendered matrices representing each color.
      const dashboardRows = isPlus ? pymeData.rows : plusData.rows;
      const targetMatchRow = dashboardRows.find((r: any) => String(r.grupo || '').trim().toUpperCase() === lever);
      
      let target = targetMatchRow && typeof targetMatchRow.target === 'number' ? targetMatchRow.target : 0;

      // Percentage and Value metrics
      let pje = target > 0 ? (totalCount / target) * 100 : (totalCount > 0 ? 100 : 0)
      
      return { target, totalCount, quantity: totalCount, pje, finalizadas, pendientes, isMonetary }
  }

  const renderProgressBar = (stats: any | null, color: string, label: string) => {
      if (!stats) {
          return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 'bold' }}>
                    <span style={{ color: 'var(--medium-gray)' }}>{label}</span>
                    <span style={{ color: 'var(--light-text)' }}>-</span>
                 </div>
                 <div style={{ height: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <span style={{ fontSize: 10, color: 'var(--medium-gray)', fontWeight: 800 }}>SIN MAPEAR</span>
                 </div>
              </div>
          )
      }

      if (stats.target === 0) {
          const rawPje = stats.pje
          return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 'bold' }}>
                    <span style={{ color: color }}>{label}</span>
                    <span style={{ color: 'var(--light-text)' }}>
                       {stats.isMonetary ? formatCurrency(stats.totalCount) : `${stats.totalCount} uds`}
                    </span>
                 </div>
                 <div style={{ height: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: color, borderRadius: 4, opacity: 0.3 }}></div>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ color: 'var(--light-text)', fontSize: 10, fontWeight: 900 }}>
                           {rawPje % 1 === 0 ? rawPje : rawPje.toFixed(1)}%
                       </span>
                    </div>
                 </div>
              </div>
          )
      }

      const rawPje = stats.pje
      const displayPje = Math.min(Math.round(rawPje), 100)
      
      return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 'bold' }}>
                <span style={{ color: color }}>{label}</span>
                <span style={{ color: 'var(--light-text)' }}>
                   {stats.isMonetary 
                      ? `${formatCurrency(stats.totalCount)} / ${formatCurrency(stats.target)}` 
                      : `${stats.totalCount} / ${stats.target}`}
                </span>
             </div>
             
             <div style={{ height: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, position: 'relative' }}>
                <div style={{ height: '100%', width: `${Math.min(rawPje, 100)}%`, backgroundColor: color, borderRadius: 4, transition: 'width 0.5s ease', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: rawPje > 15 ? 6 : 0, overflow: 'hidden' }}>
                    {rawPje > 15 && (
                        <span style={{ color: '#000', fontSize: 10, fontWeight: 900 }}>
                            {rawPje % 1 === 0 ? rawPje : rawPje.toFixed(1)}%
                        </span>
                    )}
                </div>
                {rawPje <= 15 && (
                    <span style={{ position: 'absolute', left: `${Math.min(rawPje, 100)}%`, top: '50%', transform: 'translateY(-50%)', paddingLeft: 6, color: 'var(--light-text)', fontSize: 10, fontWeight: 800 }}>
                        {rawPje % 1 === 0 ? rawPje : rawPje.toFixed(1)}%
                    </span>
                )}
                {rawPje >= 100 && (
                     <div style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 2, backgroundColor: 'var(--bg-card)', boxShadow: '0 0 5px #fff' }}></div>
                )}
             </div>
          </div>
      )
  }

  // Active table filter data
  let activeLeverSales = filteredSales;
  
  if (activeLeverFilter && LEVER_MAPPING[activeLeverFilter]) {
      const validProds = LEVER_MAPPING[activeLeverFilter].map(p => normalizeString(p));
      activeLeverSales = activeLeverSales.filter(s => {
          const prodName = normalizeString(String(s.producto || ''));
          const det = String(s.detalle || '').trim().toLowerCase();
          
          let isLeverMatch = validProds.includes(prodName);
          if (activeLeverFilter === 'TI' && det === 'ti') isLeverMatch = true;
          if (activeLeverFilter === 'TMA' && det === 'tma') isLeverMatch = true;
          if (activeLeverFilter === 'MIC' && det === 'micro') isLeverMatch = true;

          return isLeverMatch;
      });
  }

  return (
    <div style={{ padding: 20 }}>
      <PageHeader 
        title={<><Target className="text-cyan" size={28} /> Avance de Palancas</>}
        subtitle="Seguimiento de ventas y métricas (Finalizadas y Pendientes) frente al objetivo Básico y Plus."
        showBack={true}
        backFallback="/seguimiento-ventas"
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24, marginTop: -8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Filtro gestionado por RootLayout (PeriodSelector) */}
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {LEVERS.map((lever, idx) => {
          const statsPlus = getStatsForLever(lever, true)
          const statsBasico = getStatsForLever(lever, false)

          // Estructura de tarjeta ultra-compacta con Footer OneLake
          const isActive = activeLeverFilter === lever
          return (
            <div 
              key={idx}
              onClick={() => {
                 setActiveLeverFilter(isActive ? null : lever);
                 if (!isActive) {
                    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                 }
              }}
              className="card" 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '16px', 
                padding: '16px 16px 0 16px', // No padding bottom, handled by footer
                border: isActive ? '2px solid var(--mercedes-cyan)' : '1px solid var(--border-color)',
                backgroundColor: isActive ? 'rgba(0,173,239,0.03)' : 'var(--card-bg)',
                boxShadow: theme === 'light' ? '0 4px 6px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = theme === 'light' ? '0 4px 6px rgba(0,0,0,0.05)' : 'none'
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: 6, fontWeight: 900, color: 'var(--light-text)', fontSize: 16 }}>
                          {LEVER_LABELS[lever] || lever}
                      </div>
                  </div>
                  {(() => {
                      const globalTarget = (statsPlus.target || 0) + (statsBasico.target || 0);
                      const globalCount = (statsPlus.totalCount || 0) + (statsBasico.totalCount || 0);
                      const isMonetary = statsPlus.isMonetary;
                      const remaining = globalTarget > globalCount ? globalTarget - globalCount : 0;
                      
                      if (globalTarget > 0) {
                          return (
                              <div style={{ 
                                  fontSize: 12, 
                                  fontWeight: 'bold', 
                                  padding: '4px 8px', 
                                  borderRadius: 4, 
                                  backgroundColor: remaining > 0 ? 'rgba(255, 149, 0, 0.1)' : 'rgba(52, 199, 89, 0.1)',
                                  color: remaining > 0 ? '#FF9500' : '#34C759'
                              }}>
                                  {remaining > 0 ? `Faltan: ${isMonetary ? formatCurrency(remaining) : remaining + ' uds'}` : '✓ Superado'}
                              </div>
                          );
                      }
                      return null;
                  })()}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                  {/* BARRA PLUS (VERDE) */}
                  {renderProgressBar(statsPlus, '#34C759', 'PLUS')}

                  {/* BARRA BÁSICO (AZUL) */}
                  {renderProgressBar(statsBasico, 'var(--mercedes-cyan)', 'BÁSICO')}
              </div>

              {/* FOOTER GRIS ONELAKE STYLE */}
              <div style={{ 
                  marginTop: 'auto',
                  borderTop: '1px solid var(--border-color)', 
                  backgroundColor: 'var(--section-bg)', 
                  margin: '0 -16px 0 -16px', 
                  padding: '12px 16px', 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center'
              }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, fontSize: 11, gap: 2 }}>
                      <span style={{ fontSize: 10, color: 'var(--medium-gray)', marginBottom: 2, fontWeight: 'bold' }}>PLUS</span>
                      <span style={{ color: 'var(--light-text)' }}>
                          {(statsPlus.target || 0) > 0 
                             ? (statsPlus.isMonetary ? `${formatCurrency(statsPlus.totalCount)} / ${formatCurrency(statsPlus.target)}` : `${statsPlus.totalCount} / ${statsPlus.target} uds`)
                             : (statsPlus.isMonetary ? `${formatCurrency(statsPlus.totalCount)}` : `${statsPlus.totalCount} uds`)}
                      </span>
                      <span style={{ color: 'var(--light-text)' }}>
                          F: {statsPlus.isMonetary ? formatCurrency(statsPlus.finalizadas) : statsPlus.finalizadas} | 
                          P: {statsPlus.isMonetary ? formatCurrency(statsPlus.pendientes) : statsPlus.pendientes}
                      </span>
                      <span style={{ fontWeight: 'bold', color: statsPlus.pje >= 100 ? '#34C759' : '#34C759' }}>
                          {statsPlus.pje % 1 === 0 ? `${statsPlus.pje}%` : `${statsPlus.pje.toFixed(1)}%`}
                      </span>
                  </div>
                  <div style={{ width: 1, height: 45, backgroundColor: 'var(--border-color)', margin: '0 12px' }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'right', fontSize: 11, gap: 2 }}>
                      <span style={{ fontSize: 10, color: 'var(--medium-gray)', marginBottom: 2, fontWeight: 'bold' }}>BÁSICO</span>
                      <span style={{ color: 'var(--light-text)' }}>
                          {(statsBasico.target || 0) > 0 
                             ? (statsBasico.isMonetary ? `${formatCurrency(statsBasico.totalCount)} / ${formatCurrency(statsBasico.target)}` : `${statsBasico.totalCount} / ${statsBasico.target} uds`)
                             : (statsBasico.isMonetary ? `${formatCurrency(statsBasico.totalCount)}` : `${statsBasico.totalCount} uds`)}
                      </span>
                      <span style={{ color: 'var(--light-text)' }}>
                          F: {statsBasico.isMonetary ? formatCurrency(statsBasico.finalizadas) : statsBasico.finalizadas} | 
                          P: {statsBasico.isMonetary ? formatCurrency(statsBasico.pendientes) : statsBasico.pendientes}
                      </span>
                      <span style={{ fontWeight: 'bold', color: statsBasico.pje >= 100 ? '#34C759' : 'var(--mercedes-cyan)' }}>
                          {statsBasico.pje % 1 === 0 ? `${statsBasico.pje}%` : `${statsBasico.pje.toFixed(1)}%`}
                      </span>
                  </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── COMBOS CUPIDO + TGT + RESPALDO 5G ── */}
      {(() => {
        // Comercial → Código mapping (from Telefónica codes)
        const COMERCIAL_CODES: { name: string; code: string }[] = [
          { name: 'Cristina', code: 'PINDI0023997' },
          { name: 'Elena',    code: 'PINDI0023998' },
          { name: 'Gabriel',  code: 'PINDI0554690' },
          { name: 'Carmen',   code: 'PINDI0023988' },
          { name: 'Carlos',   code: 'PINDI0023996' },
          { name: 'Nuria',    code: 'PINDI0051346' },
          { name: 'Vanesa',   code: 'PINDI0023994' },
          { name: 'Lara',     code: 'PINDI0023995' }
        ]

        const prod = (s: any) => (s.producto || s.detalle || '').toLowerCase()
        const isRespaldo5G  = (s: any) => prod(s).includes('respaldo 5g') || prod(s).includes('respaldo5g')
        const isTGT         = (s: any) => prod(s).includes('tgt') && !prod(s).includes('soporte') && !prod(s).includes('ciber')
        const isTGTSoporte  = (s: any) => prod(s).includes('tgt') && prod(s).includes('soporte')
        const isTGTCiber    = (s: any) => prod(s).includes('tgt') && prod(s).includes('ciber')
        const isTMA         = (s: any) => (s.detalle || '').toLowerCase() === 'tma'
        const isMicro       = (s: any) => (s.detalle || '').toLowerCase() === 'micro'
        const isTMAorMicro  = (s: any) => isTMA(s) || isMicro(s)

        const allNifsTMamic = new Set(allSales.filter(isTMAorMicro).map((s: any) => (s.nif || '').toUpperCase()))

        const rows = COMERCIAL_CODES.map(({ name, code }) => {
          const mySales = allSales.filter((s: any) => s.vendedor === name)
          const myNifs  = new Set(mySales.map((s: any) => (s.nif || '').toUpperCase()))

          const r5g      = mySales.filter(isRespaldo5G)
          const rTGT     = mySales.filter(isTGT)
          const rTGTSop  = mySales.filter(isTGTSoporte)
          const rTGTCib  = mySales.filter(isTGTCiber)

          // Combos: my 5G clients who also appear in global TMA/Micro pool
          const combo5G  = mySales.filter(isRespaldo5G).filter((s: any) => allNifsTMamic.has((s.nif||'').toUpperCase()))
          // Combos: my TGT clients who also appear in global TMA/Micro pool
          const comboTGT = mySales.filter((s: any) => prod(s).includes('tgt')).filter((s: any) => allNifsTMamic.has((s.nif||'').toUpperCase()))

          const clientsOf = (sales: any[]) => [...new Set(sales.map((s: any) => `${(s.nif||'').toUpperCase()} – ${s.nombreCliente||''}`.trim()))]

          return {
            name, code,
            r5g:     { count: r5g.length,     clients: clientsOf(r5g) },
            tgt:     { count: rTGT.length,     clients: clientsOf(rTGT) },
            tgtSop:  { count: rTGTSop.length,  clients: clientsOf(rTGTSop) },
            tgtCib:  { count: rTGTCib.length,  clients: clientsOf(rTGTCib) },
            combo5G: { count: combo5G.length,  clients: clientsOf(combo5G) },
            comboTGT:{ count: comboTGT.length, clients: clientsOf(comboTGT) },
          }
        })

        const totals = {
          r5g:      rows.reduce((s,r) => s + r.r5g.count,      0),
          tgt:      rows.reduce((s,r) => s + r.tgt.count,      0),
          tgtSop:   rows.reduce((s,r) => s + r.tgtSop.count,   0),
          tgtCib:   rows.reduce((s,r) => s + r.tgtCib.count,   0),
          combo5G:  rows.reduce((s,r) => s + r.combo5G.count,  0),
          comboTGT: rows.reduce((s,r) => s + r.comboTGT.count, 0),
        }

        // Click-to-expand handler (state is at component level)
        const expandedRow     = expandedComboCell
        const setExpandedRow  = setExpandedComboCell

        const NAVY   = '#1e3a5f'
        const CYAN   = '#e8f4fd'
        const CYAN2  = '#cce4f6'
        const thStyle = (right = false): React.CSSProperties => ({
          padding: '10px 14px', background: NAVY, color: '#fff',
          fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
          textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap',
        })
        const tdStyle = (right = false, bold = false, color?: string): React.CSSProperties => ({
          padding: '10px 14px', textAlign: right ? 'right' : 'left',
          fontWeight: bold ? 700 : 400, color: color || 'inherit',
        })

        const renderCell = (data: { count: number; clients: string[] }, cellKey: string) => {
          const isOpen = expandedRow === cellKey
          return (
            <td key={cellKey} style={{ padding: '10px 14px', textAlign: 'right', position: 'relative' }}>
              <span
                onClick={() => setExpandedRow(isOpen ? null : cellKey)}
                style={{ cursor: data.clients.length > 0 ? 'pointer' : 'default', fontWeight: 600,
                  color: data.count > 0 ? NAVY : '#94a3b8',
                  textDecoration: data.clients.length > 0 ? 'underline dotted' : 'none' }}
                title={data.clients.length > 0 ? 'Clic para ver clientes' : ''}
              >
                {data.count}
              </span>
            </td>
          )
        }

        return (
          <div style={{ marginTop: 40, marginBottom: 40, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 22 }}>💘</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--light-text)' }}>Combos Cupido + TGT + Respaldo 5G</div>
                <div style={{ fontSize: 12, color: 'var(--medium-gray)', marginTop: 2 }}>Monitorización de cross-sell por comercial · Haz clic en un número para ver los clientes</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {[['💙','5G', totals.r5g],['🟦','TGT', totals.tgt + totals.tgtSop + totals.tgtCib],['⚡','Combos', totals.combo5G + totals.comboTGT]].map(([ic, lb, v]: any) => (
                  <div key={lb} style={{ background: CYAN, borderRadius: 8, padding: '6px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: NAVY, fontWeight: 600 }}>{ic} {lb}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', padding: '0 0 0 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle()}>Comercial</th>
                    <th style={thStyle()}>Código</th>
                    <th style={thStyle(true)}>Respaldo 5G</th>
                    <th style={thStyle(true)}>TGT (usuario)</th>
                    <th style={thStyle(true)}>TGT – Soporte Inf.</th>
                    <th style={thStyle(true)}>TGT – Ciberseguridad</th>
                    <th style={thStyle(true)}>5G + TMA/Micro</th>
                    <th style={thStyle(true)}>TGT + TMA/Micro</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const bg = idx % 2 === 0 ? CYAN : '#fff'
                    const cells: { data: typeof row.r5g; key: string }[] = [
                      { data: row.r5g,      key: `${row.name}-5g` },
                      { data: row.tgt,      key: `${row.name}-tgt` },
                      { data: row.tgtSop,   key: `${row.name}-tgtSop` },
                      { data: row.tgtCib,   key: `${row.name}-tgtCib` },
                      { data: row.combo5G,  key: `${row.name}-c5g` },
                      { data: row.comboTGT, key: `${row.name}-cTgt` },
                    ]
                    const openCell = cells.find(c => expandedRow === c.key)
                    return (
                      <>
                        <tr key={row.name} style={{ background: bg, borderBottom: `1px solid ${CYAN2}` }}>
                          <td style={{ ...tdStyle(false, true), color: NAVY }}>{row.name}</td>
                          <td style={{ ...tdStyle(), fontFamily: 'monospace', fontSize: 11.5, color: '#64748b' }}>{row.code}</td>
                          {cells.map(c => renderCell(c.data, c.key))}
                        </tr>
                        {openCell && openCell.data.clients.length > 0 && (
                          <tr key={`${row.name}-expand`} style={{ background: '#f0f7ff' }}>
                            <td colSpan={8} style={{ padding: '12px 20px' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
                                👥 Clientes — {row.name}:
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {openCell.data.clients.map((cl, ci) => (
                                  <span key={ci} style={{ background: CYAN2, color: NAVY, borderRadius: 6, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, border: `1px solid ${CYAN}` }}>{cl}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: NAVY, color: '#fff', fontWeight: 800, fontSize: 13 }}>
                    <td style={{ padding: '11px 14px' }}>Total</td>
                    <td style={{ padding: '11px 14px' }} />
                    {[totals.r5g, totals.tgt, totals.tgtSop, totals.tgtCib, totals.combo5G, totals.comboTGT].map((v, i) => (
                      <td key={i} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 900 }}>{v}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })()}

      {/* EXPLORADOR DE OPERACIONES (DATA HUB) */}
      <div style={{ marginTop: 40 }} ref={tableRef}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package className="text-cyan" size={24} /> 
            Explorador de Operaciones {activeLeverFilter ? `- ${LEVER_LABELS[activeLeverFilter] || activeLeverFilter}` : '- Todas'}
          </h2>
          {activeLeverFilter && (
             <button 
                onClick={() => setActiveLeverFilter(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--light-text)', cursor: 'pointer', fontSize: 13, padding: '6px 12px', borderRadius: 4 }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              >
                <FilterX size={16} /> Ver todas
             </button>
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '500px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '900px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ backgroundColor: 'var(--active-bg)', boxShadow: '0 1px 0 var(--table-border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>Fecha</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>Vendedor</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>Cliente (NIF)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>Nombre del Cliente</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>Código</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--medium-gray)' }}>Producto</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--medium-gray)' }}>Importe/Cuota</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--medium-gray)' }}>Anotaciones</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--medium-gray)' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {activeLeverSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--medium-gray)' }}>
                      No hay operaciones para mostrar en esta vista.
                    </td>
                  </tr>
                ) : (
                  activeLeverSales.map((sale: any, i: number) => {
                     // Fast resolution of status for UI
                     const isPed = String(sale.pendiente || '').trim().toUpperCase() === 'SI' || String(sale.pendiente || '').trim().toUpperCase() === 'PED' || String(sale.estado || '').trim().toUpperCase() === 'PENDIENTE'
                     const isAnul = String(sale.anulado || '').trim().toUpperCase() === 'SI' || String(sale.pendiente || '').trim().toUpperCase() === 'ANULADO' || String(sale.estado || '').trim().toUpperCase() === 'ANULADO'
                     let statusText = 'Completado'
                     let statusBg = 'rgba(52, 199, 89, 0.1)'
                     let statusColor = '#34C759'
                     
                     if (isAnul) { statusText = 'Anulado'; statusBg = 'rgba(239, 68, 68, 0.1)'; statusColor = '#EF4444' }
                     else if (isPed) { statusText = 'Pendiente'; statusBg = 'rgba(255, 149, 0, 0.1)'; statusColor = '#FF9500' }

                     // Simple import calculation fallback for simplified view
                     let val = sale.importe || sale.cuota || 0

                     return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', verticalAlign: 'middle' }}>
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{sale.fecha}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 'bold' }}>{sale.vendedor}</td>
                        <td style={{ padding: '10px 16px' }}>{sale.nif}</td>
                        <td style={{ padding: '10px 16px' }}>{sale.nombreCliente || '-'}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--mercedes-cyan)', fontWeight: 600 }}>{sale.codigo}</td>
                        <td style={{ padding: '10px 16px' }}>{sale.producto}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 'bold', color: 'var(--light-text)' }}>
                            {formatCurrency(val)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--medium-gray)' }}>
                           <span style={{ display: 'inline-block', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sale.anotaciones}>{sale.anotaciones || '-'}</span>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: statusBg, color: statusColor, padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>
                                {statusText}
                            </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
