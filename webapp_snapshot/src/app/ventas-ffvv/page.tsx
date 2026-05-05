'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Calendar, Briefcase, Clock } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'
import { normalizeRole } from '@/lib/appConfig'

export default function VentasFFVVPage() {
  const { authorized, user } = useGuard('MODULE_FFVV')
  const { activePeriodKey } = usePeriod()
  const [comerciales, setComerciales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!activePeriodKey) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/sales?periodKey=${activePeriodKey}`).then(res => res.json()),
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
          if (c.name.toLowerCase() === 'diego') return;
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
            
            if (!rawName || rawName.toLowerCase() === 'diego') return
            if (log.pendiente === 'Anulado' || log.anulado === 'Si') return

            const k = normNameLocal(rawName);

            if (!agrupados.has(k)) {
              agrupados.set(k, { name: rawName, hoy: 0, mes: 0, pendientes: 0 })
            }

            const stats = agrupados.get(k)!
            
            if (log.fecha === todayStr) {
              stats.hoy += 1
            }

            if (log.pendiente === 'Si') {
              stats.pendientes += 1
            } else {
              stats.mes += 1
            }
          })

          if (extrasData && extrasData.success && extrasData.assignments) {
            extrasData.assignments.forEach((ea: any) => {
              if (ea.status === 'CANCELLED' || ea.status === 'PENDING') return
              const rawName = ea.seller?.trim()
              if (!rawName || rawName.toLowerCase() === 'diego') return

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
        
        const results = Array.from(agrupados.values()).sort((a, b) => a.name.localeCompare(b.name))
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

  const isComercial = user && normalizeRole(user.role) === 'COMERCIAL';
  const normName = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  let displayedComerciales = comerciales;
  if (isComercial && user.username) {
      displayedComerciales = comerciales.filter(c => normName(c.name) === normName(user.username));
  }

  return (
    <div className="w-full" style={{ padding: '24px 32px', backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .premium-card {
            background-color: var(--bg-card);
            border-radius: 16px;
            padding: 18px;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 1px solid var(--border-strong);
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .premium-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.08);
            border-color: #3b82f6;
        }
        .premium-icon-box {
            background-color: rgba(37, 99, 235, 0.08);
            padding: 10px;
            border-radius: 12px;
            color: #2563eb;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .card-header-user {
            display: flex;
            align-items: center;
            gap: 12px;
            border-bottom: 1px solid var(--border-strong);
            padding-bottom: 14px;
        }
        .user-name {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-main);
            margin: 0;
            line-height: 1.2;
            letter-spacing: -0.3px;
        }
        .metrics-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .metric-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .metric-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--text-muted);
            font-weight: 500;
        }
        .metric-val-secondary {
            font-size: 16px;
            font-weight: 500;
            color: var(--text-main);
        }
        .metric-val-secondary.highlight {
            color: #2563eb;
            font-weight: 600;
        }
        .metric-val-primary {
            font-size: 22px;
            font-weight: 700;
            color: var(--text-main);
            line-height: 1;
        }
      `}} />

      <PageHeader 
        title={<><Briefcase size={28} color="#2563eb" /> Ventas FFVV</>}
        subtitle="Resumen de actividad comercial."
        showBack={true}
        backFallback="/ffvv"
        helpContent={
          <div>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Ventas Individuales</h4>
            <p style={{ margin: 0, lineHeight: 1.5 }}>Ficha comercial individual. Al pulsar sobre cualquier integrante del equipo, verás un listado filtrado exclusivamente con las ventas que ha generado, facilitando la validación y el cálculo de comisiones 1 a 1.</p>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '24px' }}>
        {displayedComerciales.map((c, idx) => (
          <div 
            key={idx} 
            className="premium-card" 
            onClick={() => router.push(`/operaciones?vendedor=${encodeURIComponent(c.name)}`)}
          >
            <div className="card-header-user">
              <div className="premium-icon-box">
                <User size={20} strokeWidth={2.5} />
              </div>
              <h2 className="user-name">{c.name}</h2>
            </div>
            
            <div className="metrics-container">
              <div className="metric-row">
                <div className="metric-label">
                  <Briefcase size={14} color="#6b7280" /> Hoy
                </div>
                <div className={`metric-val-secondary ${c.hoy > 0 ? 'highlight' : ''}`}>
                  {c.hoy}
                </div>
              </div>
              
              <div className="metric-row" style={{ marginTop: '2px' }}>
                <div className="metric-label">
                  <Calendar size={14} color="#6b7280" /> Finalizadas
                </div>
                <div className="metric-val-primary">
                  {c.mes}
                </div>
              </div>

              <div className="metric-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                <div className="metric-label">
                  <Clock size={14} color="#f59e0b" /> Pendientes
                </div>
                <div className="metric-val-primary" style={{ color: '#f59e0b', fontSize: '18px' }}>
                  {c.pendientes}
                </div>
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
