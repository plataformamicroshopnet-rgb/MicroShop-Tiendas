'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { usePeriod } from '@/components/PeriodProvider'
import { useGuard } from '@/hooks/useGuard'

const COMERCIAL_CODES: { name: string; code: string }[] = [
  { name: 'Juan Carlos', code: '2FV1WFN7D' },
  { name: 'Elena',       code: '2FV1WF1SK' },
  { name: 'Belén',       code: '2FV1WFK2Z' },
  { name: 'Javier',      code: '2FV1WFNFG' },
  { name: 'Luis',        code: '2FV1WFXCU' },
  { name: 'Maite',       code: '2FV1WFZF7' },
]

const NAVY  = '#1e3a5f'
const CYAN  = '#e8f4fd'
const CYAN2 = '#cce4f6'

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
  const isRespaldo5G = (s: any) => prod(s).includes('respaldo 5g') || prod(s).includes('respaldo5g')
  const isTGTBase    = (s: any) => prod(s).includes('tgt') && !prod(s).includes('soporte') && !prod(s).includes('ciber')
  const isTGTSop     = (s: any) => prod(s).includes('tgt') && prod(s).includes('soporte')
  const isTGTCib     = (s: any) => prod(s).includes('tgt') && prod(s).includes('ciber')
  const isTMAorMicro = (s: any) => ['tma','micro'].includes((s.detalle||'').toLowerCase())

  const allNifsTMamic = useMemo(
    () => new Set(allSales.filter(isTMAorMicro).map((s: any) => (s.nif||'').toUpperCase())),
    [allSales]
  )

  const rows = useMemo(() => COMERCIAL_CODES.map(({ name, code }) => {
    const mine = allSales.filter((s: any) => s.vendedor === name)
    const clients = (list: any[]) => [...new Set(
      list.map((s: any) => `${(s.nif||'').toUpperCase()} – ${s.nombreCliente||''}`.trim())
    )]
    const r5g     = mine.filter(isRespaldo5G)
    const tgt     = mine.filter(isTGTBase)
    const tgtSop  = mine.filter(isTGTSop)
    const tgtCib  = mine.filter(isTGTCib)
    const c5g     = r5g.filter((s: any)  => allNifsTMamic.has((s.nif||'').toUpperCase()))
    const cTGT    = [...tgt,...tgtSop,...tgtCib].filter((s: any) => allNifsTMamic.has((s.nif||'').toUpperCase()))
    return { name, code,
      r5g:    { n: r5g.length,    cl: clients(r5g)    },
      tgt:    { n: tgt.length,    cl: clients(tgt)    },
      tgtSop: { n: tgtSop.length, cl: clients(tgtSop) },
      tgtCib: { n: tgtCib.length, cl: clients(tgtCib) },
      c5g:    { n: c5g.length,    cl: clients(c5g)    },
      cTGT:   { n: cTGT.length,   cl: clients(cTGT)   },
    }
  }), [allSales, allNifsTMamic])

  const totals = {
    r5g:    rows.reduce((s,r) => s + r.r5g.n,    0),
    tgt:    rows.reduce((s,r) => s + r.tgt.n,    0),
    tgtSop: rows.reduce((s,r) => s + r.tgtSop.n, 0),
    tgtCib: rows.reduce((s,r) => s + r.tgtCib.n, 0),
    c5g:    rows.reduce((s,r) => s + r.c5g.n,    0),
    cTGT:   rows.reduce((s,r) => s + r.cTGT.n,   0),
  }

  const thS = (center = false): React.CSSProperties => ({
    padding: '11px 14px', background: NAVY, color: '#fff',
    fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.5, textAlign: center ? 'center' : 'left', whiteSpace: 'nowrap',
  })

  const Cell = ({ data, id }: { data: { n: number; cl: string[] }; id: string }) => (
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
      >{data.n}</span>
    </td>
  )

  if (authorized === null) return <div style={{ padding: 40 }}>Verificando acceso...</div>

  return (
    <div style={{ padding: '24px 32px', paddingBottom: 80, background: 'var(--bg-app)', minHeight: '100vh' }}>
      <PageHeader
        title="💘 Combos Cupido + TGT + Respaldo 5G"
        subtitle="Cross-sell por comercial · Clic en cualquier número para ver los clientes"
        showBack
        backFallback="/seguimiento-ventas"
      />

      {/* KPI strip — full width, even distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginTop: 24, marginBottom: 28 }}>
        {[
          { label: '🌐 Respaldo 5G',  v: totals.r5g },
          { label: '📦 TGT (base)',   v: totals.tgt },
          { label: '🖥 TGT Soporte',  v: totals.tgtSop },
          { label: '🔐 TGT Ciber',    v: totals.tgtCib },
          { label: '⚡ Combo 5G',     v: totals.c5g },
          { label: '⚡ Combo TGT',    v: totals.cTGT },
        ].map(k => (
          <div key={k.label} style={{ background: CYAN, borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: NAVY, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: NAVY }}>{k.v}</div>
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
                <th style={thS(true)}>Código</th>
                <th style={thS(true)}>Respaldo 5G</th>
                <th style={thS(true)}>TGT (usuario)</th>
                <th style={thS(true)}>TGT – Soporte Inf.</th>
                <th style={thS(true)}>TGT – Ciberseguridad</th>
                <th style={thS(true)}>5G + TMA/Micro</th>
                <th style={thS(true)}>TGT + TMA/Micro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const bg = idx % 2 === 0 ? CYAN : '#fff'
                const cells = [
                  { data: row.r5g,    id: `${row.name}-r5g`    },
                  { data: row.tgt,    id: `${row.name}-tgt`    },
                  { data: row.tgtSop, id: `${row.name}-tgtSop` },
                  { data: row.tgtCib, id: `${row.name}-tgtCib` },
                  { data: row.c5g,    id: `${row.name}-c5g`    },
                  { data: row.cTGT,   id: `${row.name}-cTGT`   },
                ]
                const openCell = cells.find(c => expanded === c.id)
                return (
                  <React.Fragment key={row.name}>
                    <tr style={{ background: bg, borderBottom: `1px solid ${CYAN2}` }}>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: NAVY }}>{row.name}</td>
                      <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 11.5, color: '#64748b', textAlign: 'center' }}>{row.code}</td>
                      {cells.map(c => <Cell key={c.id} data={c.data} id={c.id} />)}
                    </tr>
                    {openCell && openCell.data.cl.length > 0 && (
                      <tr style={{ background: '#f0f7ff', borderBottom: `1px solid ${CYAN2}` }}>
                        <td colSpan={8} style={{ padding: '14px 22px' }}>
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
                <td style={{ padding: '12px 14px' }} />
                {[totals.r5g, totals.tgt, totals.tgtSop, totals.tgtCib, totals.c5g, totals.cTGT].map((v, i) => (
                  <td key={i} style={{ padding: '12px 14px', textAlign: 'center', fontSize: 14 }}>{v}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
