'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Calendar, Briefcase, Clock } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'


export default function VentasTiendasPage() {
  const { authorized, user } = useGuard('MODULE_TIENDAS')
  const { activePeriodKey } = usePeriod()
  const [comerciales, setComerciales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!activePeriodKey) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/sales?periodKey=${activePeriodKey}&dashboard=true`).then(res => res.json()),

      fetch('/api/comerciales').then(res => res.json()),
      fetch(`/api/extras/assignments?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({}))
    ])
    .then(([salesData, comData, extrasData]) => {
      if (comData.success) {
        const normNameLocal = (n: string) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const agrupados = new Map<string, { name: string, hoy: number, mes: number, pendientes: number }>()
        // Initialize all commercials with 0
        const codeToNameMap = new Map<string, string>()
        
        comData.comerciales.forEach((c: any) => {
          if (c.name.toLowerCase() === 'diego' || c.name.toLowerCase() === 'salva') return;
          agrupados.set(normNameLocal(c.name), { name: c.name, hoy: 0, mes: 0, pendientes: 0 })
          if (c.codigoComercial) {
            codeToNameMap.set(c.codigoComercial, c.name)
          }
        })

        if (salesData.success && salesData.logs) {
          const logs = salesData.logs

          const today = new Date()
          const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`

          logs.forEach((log: any) => {
            // Agrupar exclusivamente por el comercial real (vendedor) para que coincida con la tabla de detalles
            const rawName = log.vendedor?.trim()
            
            if (!rawName || rawName.toLowerCase() === 'diego' || rawName.toLowerCase() === 'salva') return
            
            const pVal = String(log.pendiente || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
            const aVal = String(log.anulado || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
            
            if (pVal === 'anulado' || aVal === 'si') return

            const k = normNameLocal(rawName);

            if (!agrupados.has(k)) {
              agrupados.set(k, { name: rawName, hoy: 0, mes: 0, pendientes: 0 })
            }

            const stats = agrupados.get(k)!
            
            if (log.fecha === todayStr) {
              stats.hoy += 1
            }

            if (pVal === 'si') {
              stats.pendientes += 1
            } else {
              stats.mes += 1
            }
          })

          if (extrasData && extrasData.success && extrasData.assignments) {
            extrasData.assignments.forEach((ea: any) => {
              if (ea.status === 'CANCELLED' || ea.status === 'PENDING') return
              const rawName = ea.seller?.trim()
              if (!rawName || rawName.toLowerCase() === 'diego' || rawName.toLowerCase() === 'salva') return

              const k = normNameLocal(rawName);

              if (!agrupados.has(k)) {
                agrupados.set(k, { name: rawName, hoy: 0, mes: 0, pendientes: 0 })
              }

              const stats = agrupados.get(k)!
              
              const d = new Date(ea.createdAt);
              const extraStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
              
              if (extraStr === todayStr) {
                stats.hoy += 1
              }
              stats.mes += 1
            })
          }
        }
        
        // Orden por nº de operaciones Finalizadas (mes), de mayor a menor; desempate por nombre.
        const results = Array.from(agrupados.values()).sort((a, b) => (b.mes - a.mes) || a.name.localeCompare(b.name))
        setComerciales(results)
      }
      setLoading(false)
    })
    .catch((error) => {
      console.error("Error fetching data", error)
      setLoading(false)
    })
  }, [activePeriodKey])

  if (authorized === null) return <div style={{ padding: 20 }}>Verificando permisos...</div>;
  if (loading) return <div style={{ padding: 20 }}>Cargando datos de comerciales...</div>

  const displayedComerciales = comerciales;


  return (
    <div className="w-full" style={{ padding: '24px 32px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .premium-card-removed { display: none; }
      `}} />

      <PageHeader 
        title={<><Briefcase size={28} color="#2563eb" /> Ventas Tiendas</>}
        subtitle="Resumen de actividad comercial."
        showBack={true}
        backFallback="/tiendas"
        helpContent={
          <div>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Ventas Individuales</h4>
            <p style={{ margin: 0, lineHeight: 1.5 }}>Ficha comercial individual. Al pulsar sobre cualquier integrante del equipo, verás un listado filtrado exclusivamente con las ventas que ha generado, facilitando la validación y el cálculo de comisiones 1 a 1.</p>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '24px', marginTop: '24px' }}>
        {displayedComerciales.map((c, idx) => (
          <div 
            key={idx} 
            style={{
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                padding: '28px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid #e2e8f0',
                borderLeft: '8px solid #3b82f6',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: '28px',
                position: 'relative',
                overflow: 'hidden'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 120, 212, 0.1), 0 8px 10px -6px rgba(0, 120, 212, 0.1)';
                e.currentTarget.style.borderColor = '#93c5fd';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)';
                e.currentTarget.style.borderColor = '#e2e8f0';
            }}
            onClick={() => router.push(`/operaciones?vendedor=${encodeURIComponent(c.name)}`)}
          >
            {/* Top Header: Avatar + Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                  width: 52, height: 52, borderRadius: '16px',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#0078D4', fontSize: 22, fontWeight: 800,
                  boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.05)'
              }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  {c.name}
              </h2>
            </div>
            
            {/* Main Metric (Ventas Totales = Finalizadas + Pendientes) */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <div style={{ fontSize: 56, fontWeight: 900, color: '#0078D4', lineHeight: 0.85, letterSpacing: '-0.04em' }}>
                    {c.mes + c.pendientes}
                </div>
                <div style={{ paddingBottom: 6, fontSize: 13, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Ventas Totales
                </div>
            </div>

            {/* Secondary Metrics (Hoy / Pendientes) */}
            <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
                <div style={{ 
                    flex: 1, backgroundColor: c.hoy > 0 ? '#f0fdf4' : '#f8fafc', border: c.hoy > 0 ? '1px solid #bbf7d0' : '1px solid #f1f5f9',
                    borderRadius: '16px', padding: '14px', display: 'flex', flexDirection: 'column', gap: 6,
                    transition: 'all 0.2s'
                }}>
                    <span style={{ fontSize: 11, color: c.hoy > 0 ? '#166534' : '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Briefcase size={12} strokeWidth={3} /> Hoy
                    </span>
                    <span style={{ fontSize: 24, fontWeight: 900, color: c.hoy > 0 ? '#15803d' : '#94a3b8', lineHeight: 1 }}>{c.hoy}</span>
                </div>
                <div style={{ 
                    flex: 1, backgroundColor: c.pendientes > 0 ? '#fffbeb' : '#f8fafc', border: c.pendientes > 0 ? '1px solid #fde68a' : '1px solid #f1f5f9',
                    borderRadius: '16px', padding: '14px', display: 'flex', flexDirection: 'column', gap: 6,
                    transition: 'all 0.2s'
                }}>
                    <span style={{ fontSize: 11, color: c.pendientes > 0 ? '#92400e' : '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} strokeWidth={3} /> Ptes
                    </span>
                    <span style={{ fontSize: 24, fontWeight: 900, color: c.pendientes > 0 ? '#d97706' : '#94a3b8', lineHeight: 1 }}>{c.pendientes}</span>
                </div>
            </div>
          </div>
        ))}

        {displayedComerciales.length === 0 && !loading && (
          <div style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', padding: '32px', textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed #e5e7eb', fontSize: '14px', fontWeight: 500 }}>
            No se han encontrado comerciales en los registros de operaciones.
          </div>
        )}
      </div>
    </div>
  )
}
