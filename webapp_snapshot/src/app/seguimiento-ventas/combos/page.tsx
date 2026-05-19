'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { usePeriod } from '@/components/PeriodProvider'
import { useGuard } from '@/hooks/useGuard'
import { getGroupVisual } from '@/lib/comisiones'

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

const NAVY  = '#00ADEF'
const CYAN  = '#e5f7fd'
const CYAN2 = '#ccedfb'

export default function CombosPage() {
  const { authorized } = useGuard('MODULE_JEFE_TIENDAS')
  const { activePeriodKey } = usePeriod()
  const [allSales, setAllSales] = useState<any[]>([])
  const [loading, setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!activePeriodKey) return
    setLoading(true)
    fetch(`/api/sales?periodKey=${activePeriodKey}`)
      .then(r => r.json())
      .then(d => { if (d.success) setAllSales(d.data || d.logs || []) })
      .finally(() => setLoading(false))
  }, [activePeriodKey])

  const prod = (s: any) => (s.producto || s.detalle || '').toLowerCase()
  
  // Lógica de 8 columnas personalizadas
  const isBafTotal = (s: any) => {
    const cat = String(s.detalle || s.sheet || s.categoria || '').toLowerCase()
    const p = prod(s)
    return cat === 'mimovistar' || cat === 'resto baf' || p.includes('baf total') || (p.includes('fibra') && !p.includes('movil') && !p.includes('móvil'))
  }
  const isBafConv = (s: any) => {
    const cat = String(s.detalle || s.sheet || s.categoria || '').toLowerCase()
    const p = prod(s)
    return cat === 'mimovistar' || p.includes('baf convergente') || p.includes('fd total') || p.includes('fd flex') || (p.includes('fibra') && (p.includes('movil') || p.includes('móvil')))
  }
  const isDispSeg = (s: any) => {
    const cat = String(s.detalle || s.sheet || s.categoria || '').toLowerCase()
    const p = prod(s)
    return cat === 'rent' || cat === 'seguro' || p.includes('dispositivo') || p.includes('seguro') || p.includes('rent') || getGroupVisual(s.producto, s.detalle) === 'REN'
  }
  const isMpa = (s: any) => prod(s).includes('mpa') || prod(s).includes('alarma') || getGroupVisual(s.producto, s.detalle) === 'MPA'
  const isFttr = (s: any) => prod(s).includes('fttr')
  const isSolar = (s: any) => prod(s).includes('solar') || prod(s).includes('señaliz')
  const isArpu = (s: any) => prod(s).includes('arpu') || prod(s).includes('ficción') || prod(s).includes('netflix') || prod(s).includes('movistar+') || prod(s).includes('adicional') || prod(s).includes('tv') || String(s.detalle || '').toLowerCase() === 'repos'
  const isRepoFutbol = (s: any) => prod(s).includes('futbol') || prod(s).includes('fútbol') || prod(s).includes('repo f')

  const norm = (str: string) => String(str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()

  const rows = useMemo(() => COMERCIAL_CODES.map(({ name, code }) => {
    const mine = allSales.filter((s: any) => norm(s.vendedor) === norm(name))
    const clients = (list: any[]) => [...new Set(
      list.map((s: any) => `${(s.nif||'').toUpperCase()} – ${s.nombreCliente||''}`.trim())
    )]
    
    const sumImporte = (list: any[]) => list.reduce((sum, s) => {
      const val = parseFloat(String(s.importe || s.cuota || '0').replace(',', '.'))
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
    
    const bafTotal = mine.filter(isBafTotal)
    const bafConv = mine.filter(isBafConv)
    const dispSeg = mine.filter(isDispSeg)
    const mpa = mine.filter(isMpa)
    const fttr = mine.filter(isFttr)
    const solar = mine.filter(isSolar)
    const arpu = mine.filter(isArpu)
    const repoFutbol = mine.filter(isRepoFutbol)

    return { name, code,
      bafTotal: { n: bafTotal.length, cl: clients(bafTotal) },
      bafConv: { n: bafConv.length, cl: clients(bafConv) },
      dispSeg: { n: sumImporte(dispSeg), cl: clients(dispSeg) },
      mpa: { n: mpa.length, cl: clients(mpa) },
      fttr: { n: fttr.length, cl: clients(fttr) },
      solar: { n: solar.length, cl: clients(solar) },
      arpu: { n: sumImporte(arpu), cl: clients(arpu) },
      repoFutbol: { n: repoFutbol.length, cl: clients(repoFutbol) },
    }
  }), [allSales])

  const totals = {
    bafTotal: rows.reduce((s,r) => s + r.bafTotal.n, 0),
    bafConv: rows.reduce((s,r) => s + r.bafConv.n, 0),
    dispSeg: rows.reduce((s,r) => s + r.dispSeg.n, 0),
    mpa: rows.reduce((s,r) => s + r.mpa.n, 0),
    fttr: rows.reduce((s,r) => s + r.fttr.n, 0),
    solar: rows.reduce((s,r) => s + r.solar.n, 0),
    arpu: rows.reduce((s,r) => s + r.arpu.n, 0),
    repoFutbol: rows.reduce((s,r) => s + r.repoFutbol.n, 0),
  }

  const thS = (center = false): React.CSSProperties => ({
    padding: '11px 14px', background: NAVY, color: '#fff',
    fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.5, textAlign: center ? 'center' : 'left', whiteSpace: 'nowrap',
  })

  const Cell = ({ data, id, isEuro }: { data: { n: number; cl: string[] }; id: string; isEuro?: boolean }) => (
    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
      <span
        onClick={() => data.cl.length > 0 && setExpanded(expanded === id ? null : id)}
        title={data.cl.length > 0 ? 'Clic para ver clientes' : ''}
        style={{
          fontWeight: 700, fontSize: 14,
          color: data.n > 0 ? NAVY : '#94a3b8',
          cursor: data.cl.length > 0 ? 'pointer' : 'default',
          textDecoration: data.cl.length > 0 ? 'underline dotted' : 'none',
        }}
      >{isEuro && data.n > 0 ? `${data.n.toFixed(2)} €` : data.n}</span>
    </td>
  )

  if (authorized === null) return <div style={{ padding: 40 }}>Verificando acceso...</div>

  return (
    <div style={{ padding: '24px 32px', paddingBottom: 80, background: 'var(--bg-app)', minHeight: '100vh' }}>
      <PageHeader
        title="Comparativa Rapida de Ventas"
        subtitle="Rendimiento por comercial · Clic en cualquier número para ver los clientes"
        showBack
        backFallback="/seguimiento-ventas"
      />

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginTop: 24, marginBottom: 28 }}>
        {[
          { label: 'Alta BAF Total', v: totals.bafTotal, isEuro: false },
          { label: 'Alta BAF Conv.', v: totals.bafConv, isEuro: false },
          { label: 'Disp. + Seguros', v: totals.dispSeg, isEuro: true },
          { label: 'MPA', v: totals.mpa, isEuro: false },
          { label: 'FTTR', v: totals.fttr, isEuro: false },
          { label: 'Solar 360', v: totals.solar, isEuro: false },
          { label: 'ARPU', v: totals.arpu, isEuro: true },
          { label: 'Repo Fútbol', v: totals.repoFutbol, isEuro: false },
        ].map(k => (
          <div key={k.label} style={{ background: CYAN, borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: NAVY, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', lineHeight: 1.2, height: 24 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: NAVY }}>{k.isEuro && k.v > 0 ? `${k.v.toFixed(2)} €` : k.v}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--medium-gray)' }}>Cargando datos...</div>
      ) : (
        <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${CYAN2}`, boxShadow: '0 4px 20px rgba(30,58,95,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thS()}>Comercial</th>
                <th style={thS(true)}>Alta BAF Total</th>
                <th style={thS(true)}>Alta BAF Conv.</th>
                <th style={thS(true)}>Disp. + Seguros</th>
                <th style={thS(true)}>MPA</th>
                <th style={thS(true)}>FTTR</th>
                <th style={thS(true)}>Solar 360</th>
                <th style={thS(true)}>ARPU</th>
                <th style={thS(true)}>Repo Fútbol</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const bg = idx % 2 === 0 ? CYAN : '#fff'
                const cells = [
                  { data: row.bafTotal,    id: `${row.name}-bafTotal`,    isEuro: false },
                  { data: row.bafConv,     id: `${row.name}-bafConv`,     isEuro: false },
                  { data: row.dispSeg,     id: `${row.name}-dispSeg`,     isEuro: true  },
                  { data: row.mpa,         id: `${row.name}-mpa`,         isEuro: false },
                  { data: row.fttr,        id: `${row.name}-fttr`,        isEuro: false },
                  { data: row.solar,       id: `${row.name}-solar`,       isEuro: false },
                  { data: row.arpu,        id: `${row.name}-arpu`,        isEuro: true  },
                  { data: row.repoFutbol,  id: `${row.name}-repoFutbol`,  isEuro: false },
                ]
                const openCell = cells.find(c => expanded === c.id)
                return (
                  <React.Fragment key={row.name}>
                    <tr style={{ background: bg, borderBottom: `1px solid ${CYAN2}` }}>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: NAVY }}>{row.name}</td>
                      {cells.map(c => <Cell key={c.id} data={c.data} id={c.id} isEuro={c.isEuro} />)}
                    </tr>
                    {openCell && openCell.data.cl.length > 0 && (
                      <tr style={{ background: '#f0f7ff', borderBottom: `1px solid ${CYAN2}` }}>
                        <td colSpan={9} style={{ padding: '14px 22px' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
                            👥 Clientes — {row.name}:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {openCell.data.cl.map((cl, ci) => (
                              <span key={ci} style={{ background: CYAN2, color: NAVY, borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, border: `1px solid ${NAVY}20` }}>
                                {cl}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: NAVY, color: '#fff', fontWeight: 900 }}>
                <td style={{ padding: '12px 14px', fontSize: 13 }}>Total</td>
                {[
                  { v: totals.bafTotal, isEuro: false },
                  { v: totals.bafConv, isEuro: false },
                  { v: totals.dispSeg, isEuro: true },
                  { v: totals.mpa, isEuro: false },
                  { v: totals.fttr, isEuro: false },
                  { v: totals.solar, isEuro: false },
                  { v: totals.arpu, isEuro: true },
                  { v: totals.repoFutbol, isEuro: false }
                ].map((k, i) => (
                  <td key={i} style={{ padding: '12px 14px', textAlign: 'center', fontSize: 14 }}>
                    {k.isEuro && k.v > 0 ? `${k.v.toFixed(2)} €` : k.v}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
