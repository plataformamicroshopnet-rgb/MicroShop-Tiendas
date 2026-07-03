'use client'

import React, { useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { useGuard } from '@/hooks/useGuard'
import { useComisionesData } from '@/hooks/useComisionesData'
import { getSaleCommission } from '@/lib/saleCommission'
import { getCurrentMonthString } from '@/lib/salesUtils'
import { Scale } from 'lucide-react'

// Grupos de producto (igual que «Resumen por Grupo» de Operaciones)
const GROUPS = [
  { id: 'ti', label: 'Contratos Móvil', icon: '📋' },
  { id: 'rent', label: 'Rent', icon: '🔄' },
  { id: 'o2', label: 'O2 MovilFree', icon: '🌐' },
  { id: 'seguro', label: 'Seguro', icon: '🛡️' },
  { id: 'mimovistar', label: 'Alta BAF Convergente (miMovistar)', icon: '🏠' },
  { id: 'tv', label: 'Suscripciones TV', icon: '📺' },
  { id: 'prepago', label: 'Prepago', icon: '💳' },
  { id: 'varios', label: 'Varios', icon: '📦' },
  { id: 'repos', label: 'Repos', icon: '🔁' },
  { id: 'resto_baf', label: 'Resto BAF (Alta BAF Total)', icon: '📡' },
  { id: 'accesorios', label: 'Accesorios', icon: '🎧' },
  { id: 'traslado_mimovistar', label: 'Traslado miMovistar', icon: '🚚' },
  { id: 'extras', label: 'Extras', icon: '⚡' },
]

const getSaleGroupId = (sale: any): string => {
  const det = String(sale.detalle || '').toLowerCase().trim()
  const cat = String(sale.categoria || sale.sheet || '').toLowerCase().trim()
  if (det === 'ti' || det === 'contratos movil') return 'ti'
  if (det === 'tma' || det === 'rent' || cat === 'rent') return 'rent'
  if (det === 'o2' || det === 'o2 movilfree') return 'o2'
  if (det === 'seguro' || cat === 'seguro') return 'seguro'
  if (det === 'mimovistar') return 'mimovistar'
  if (det === 'suscripciones tv' || det === 'suscripcion tv') return 'tv'
  if (det === 'prepago') return 'prepago'
  if (det === 'varios') return 'varios'
  if (det === 'repos') return 'repos'
  if (det === 'resto baf') return 'resto_baf'
  if (det === 'accesorios') return 'accesorios'
  if (det === 'traslado mimovistar') return 'traslado_mimovistar'
  if (det === 'extra' || det === 'extra telefónica' || det === 'extra telefonica' || sale.sheet === 'EXTRA TELEFÓNICA') return 'extras'
  return 'varios'
}

const num = (v: any): number => {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const n = parseFloat(String(v).replace('€', '').replace(/\s/g, '').replace(',', '.').trim())
  return isNaN(n) ? 0 : n
}
const isAnul = (s: any) => {
  const a = String(s.anulado || '').toLowerCase().trim()
  const p = String(s.pendiente || '').toLowerCase().trim()
  return a === 'si' || a === 'sí' || p === 'anulado'
}
const eur = (v: number) => (Math.abs(v) < 0.005 ? '—' : `${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`)

export default function ComisionesVsPage() {
  const { authorized } = useGuard('MODULE_DIRECCION')
  const { loading, sellerStats, catalogs, activePeriodKey } = useComisionesData()
  const [expanded, setExpanded] = useState<string | null>(null)   // `${comercial}|${grupo}` desplegado

  const ctx = useMemo(() => ({
    catalogs: catalogs || {},
    dashRowsPlus: [] as any[],
    dashRowsBasico: [] as any[],
    viewingPeriod: activePeriodKey ? String(activePeriodKey).replace(/[_-]/g, '') : getCurrentMonthString(),
  }), [catalogs, activePeriodKey])

  // Por comercial: comisión de la EMPRESA por grupo (saleCommission) y del COMERCIAL por grupo (panel)
  const bloques = useMemo(() => {
    return (sellerStats || []).map((s: any) => {
      const empresa: Record<string, number> = {}
      GROUPS.forEach(g => { empresa[g.id] = 0 })
      let rentVal = 0, segVal = 0
      ;(s.rawSales || []).forEach((sale: any) => {
        if (isAnul(sale)) return
        const gid = getSaleGroupId(sale)
        empresa[gid] = (empresa[gid] || 0) + getSaleCommission(sale, ctx)
        if (gid === 'rent') rentVal += num(sale.cuota)
        if (gid === 'seguro') segVal += num(sale.seguroImporte) || num(sale.cuota)
      })

      // Comisión del comercial por regla -> a grupos de producto
      const gc: Record<string, number> = s.groupComisions || {}
      const sumRules = (pred: (k: string) => boolean) =>
        Object.keys(gc).reduce((a, k) => (pred(k.toLowerCase()) ? a + num(gc[k]) : a), 0)
      const ds = sumRules(k => k.includes('dispositiv'))           // Dispositivos + Seguros
      const totVal = rentVal + segVal
      const comercial: Record<string, number> = {}
      GROUPS.forEach(g => { comercial[g.id] = 0 })
      comercial.rent = totVal > 0 ? ds * (rentVal / totVal) : ds
      comercial.seguro = totVal > 0 ? ds * (segVal / totVal) : 0
      comercial.resto_baf = sumRules(k => k.includes('baf') && k.includes('total'))         // Alta BAF Total → Resto BAF
      comercial.mimovistar = sumRules(k => k.includes('baf') && k.includes('convergente'))  // Alta BAF Convergente → miMovistar
      comercial.repos = sumRules(k => k.includes('repos') || k.includes('arpu') || k.includes('fútbol') || k.includes('futbol'))
      comercial.varios = sumRules(k => k.includes('fttr') || k.includes('mpa') || k === 'swap')
      comercial.o2 = sumRules(k => k.includes('fibra'))            // Altas/Portas Fibra + Internas Fibra (O2/Marta)

      const totalEmpresa = GROUPS.reduce((a, g) => a + (empresa[g.id] || 0), 0)
      const mapped = GROUPS.reduce((a, g) => a + (comercial[g.id] || 0), 0)
      // Lo que no encaja en ningún grupo (extras/territorial) -> fila Extras, para cuadrar con el panel
      comercial.extras = Math.max(0, num(s.totalComision) - mapped)
      const totalComercial = mapped + comercial.extras

      return { name: s.name, empresa, comercial, totalEmpresa, totalComercial, sales: s.rawSales || [] }
    }).filter((b: any) => b.totalEmpresa > 0.005 || b.totalComercial > 0.005)
  }, [sellerStats, ctx])

  const granEmpresa = bloques.reduce((a: number, b: any) => a + b.totalEmpresa, 0)
  const granComercial = bloques.reduce((a: number, b: any) => a + b.totalComercial, 0)

  if (authorized === null) return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales…</div>

  return (
    <div className="w-full" style={{ padding: '24px 32px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
      <PageHeader
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Scale color="#00adef" size={28} /> Comisiones Personal Tiendas VS Comisiones de la Empresa</span>}
        subtitle="Por comercial: lo que GANA la empresa (Liquidaciones) frente a lo que se PAGA al comercial (Panel de Comisiones)."
        showBack={true}
      />

      {loading ? (
        <div style={{ padding: 40, color: 'var(--text-muted)' }}>Cargando comisiones…</div>
      ) : (
        <>
          {/* Resumen general de la tienda */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '20px 0' }}>
            <div style={{ flex: 1, minWidth: 220, background: 'var(--bg-card)', borderRadius: 14, padding: '16px 20px', borderLeft: '6px solid #0078D4' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Comisiones de la Empresa</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#0078D4', marginTop: 4 }}>{eur(granEmpresa)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 220, background: 'var(--bg-card)', borderRadius: 14, padding: '16px 20px', borderLeft: '6px solid #22c55e' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Comisiones del Personal</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#22c55e', marginTop: 4 }}>{eur(granComercial)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 220, background: 'var(--bg-card)', borderRadius: 14, padding: '16px 20px', borderLeft: '6px solid #a855f7' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Margen (Empresa − Personal)</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#a855f7', marginTop: 4 }}>{eur(granEmpresa - granComercial)}</div>
            </div>
          </div>

          {/* Un bloque «Resumen por Grupo» por comercial */}
          {bloques.map((b: any) => (
            <div key={b.name} style={{ background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', marginBottom: 18, border: '1px solid var(--border-light)' }}>
              <div style={{ padding: '12px 18px', fontWeight: 800, fontSize: 16, color: 'var(--text-main)', borderBottom: '1px solid var(--border-light)' }}>{b.name}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0091D5', color: '#fff' }}>
                    <th style={{ textAlign: 'left', padding: '10px 18px' }}>Grupo</th>
                    <th style={{ textAlign: 'right', padding: '10px 18px' }}>Comisiones de la Empresa</th>
                    <th style={{ textAlign: 'right', padding: '10px 18px' }}>Comisión {b.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map(g => {
                    const e = b.empresa[g.id] || 0
                    const c = b.comercial[g.id] || 0
                    if (e < 0.005 && c < 0.005) return null
                    const key = `${b.name}|${g.id}`
                    const isOpen = expanded === key
                    const ops = isOpen ? (b.sales || []).filter((s: any) => getSaleGroupId(s) === g.id) : []
                    return (
                      <React.Fragment key={g.id}>
                        <tr
                          style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer', background: isOpen ? 'var(--active-bg)' : 'transparent' }}
                          onClick={() => setExpanded(isOpen ? null : key)}
                          title="Ver operaciones de este grupo"
                        >
                          <td style={{ padding: '8px 18px', fontWeight: 600 }}>
                            <span style={{ color: 'var(--mercedes-cyan)', marginRight: 6, display: 'inline-block', width: 10 }}>{isOpen ? '▾' : '▸'}</span>
                            {g.icon} {g.label}
                          </td>
                          <td style={{ padding: '8px 18px', textAlign: 'right', fontWeight: 700, color: '#0078D4' }}>{eur(e)}</td>
                          <td style={{ padding: '8px 18px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{eur(c)}</td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={3} style={{ padding: '0 18px 12px', background: 'var(--active-bg)' }}>
                              {ops.length === 0 ? (
                                <div style={{ padding: 10, color: 'var(--text-muted)', fontSize: 12 }}>Sin operaciones en este grupo.</div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: 'var(--bg-card)', borderRadius: 8, overflow: 'hidden' }}>
                                  <thead>
                                    <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                                      <th style={{ padding: '6px 8px' }}>Fecha</th>
                                      <th style={{ padding: '6px 8px' }}>Cliente</th>
                                      <th style={{ padding: '6px 8px' }}>NIF</th>
                                      <th style={{ padding: '6px 8px' }}>Producto</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Cuota</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Comisión Empresa</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ops.map((s: any, i: number) => {
                                      const an = isAnul(s)
                                      const comm = an ? 0 : getSaleCommission(s, ctx)
                                      const estado = an ? 'Anulada' : (String(s.pendiente || '').toLowerCase() === 'si' ? 'Pendiente' : 'OK')
                                      const col = an ? '#ef4444' : (estado === 'Pendiente' ? '#f59e0b' : '#16a34a')
                                      return (
                                        <tr key={i} style={{ borderTop: '1px solid var(--border-light)', opacity: an ? 0.55 : 1 }}>
                                          <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{s.fecha || '—'}</td>
                                          <td style={{ padding: '5px 8px' }}>{s.nombreCliente || '—'}</td>
                                          <td style={{ padding: '5px 8px' }}>{s.nif || '—'}</td>
                                          <td style={{ padding: '5px 8px' }}>{s.producto || '—'}</td>
                                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{eur(num(s.cuota))}</td>
                                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#0078D4' }}>{eur(comm)}</td>
                                          <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: col }}>{estado}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                  <tr style={{ background: 'var(--active-bg)', fontWeight: 800 }}>
                    <td style={{ padding: '10px 18px' }}>TOTAL</td>
                    <td style={{ padding: '10px 18px', textAlign: 'right', color: '#0078D4' }}>{eur(b.totalEmpresa)}</td>
                    <td style={{ padding: '10px 18px', textAlign: 'right', color: '#16a34a' }}>{eur(b.totalComercial)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
