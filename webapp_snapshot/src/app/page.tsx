'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, BookOpen, Library } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { FeaturedMagazine } from '@/components/FeaturedMagazine'
import { FeaturedDocument } from '@/components/FeaturedDocument'
import Link from 'next/link'
import { usePeriod } from '@/components/PeriodProvider'

export default function DashboardPage() {
  const { activePeriodKey } = usePeriod()
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!activePeriodKey) return;
    setLoading(true);
    fetch(`/api/sales?periodKey=${activePeriodKey}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats(data.stats || [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [activePeriodKey])

  if (loading) return <div style={{ padding: 20 }}>Cargando datos del Dashboard...</div>

  return (
    <div style={{ padding: 20 }}>
      <PageHeader 
        title={<>Dashboard <span className="text-cyan">Tiempo Real</span></>}
        subtitle="Sincronizado directamente con las celdas del Excel central."
        showTheme={true}
        showBack={false}
      />

      {stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          {stats.map((s, idx) => (
            <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '4px' }}>{s.name}</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--medium-gray)', fontSize: 14 }}>Portabilidades</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--mercedes-cyan)' }}>{s.portas}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--medium-gray)', fontSize: 14 }}>Altas Móvil</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--mercedes-cyan)' }}>{s.altas}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--medium-gray)', fontSize: 14 }}>Fijas (FD Total/Flex)</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--mercedes-cyan)' }}>{s.fds}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECCIÓN EDITORIAL (REVISTAS, CATÁLOGOS Y DOSIER) */}
      <div style={{ marginTop: 40, marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800 }}>
              <Library size={24} className="text-cyan" /> Novedades y Revistas
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--medium-gray)' }}>
              Accede a todas las Revistas, Catálogos y Dosieres disponibles en la plataforma.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 220px)', gap: 24, justifyContent: 'start' }}>
          <FeaturedMagazine variant="card" />
          <FeaturedDocument type="catalogo" title="Catálogo Dispositivos" />
          <FeaturedDocument type="dosier" title="Dosier Empresas" />
          
          <Link href="/revistas" style={{ textDecoration: 'none', height: '100%', outline: 'none' }}>
            <div 
              style={{
                background: 'var(--bg-card)',
                borderRadius: 12, cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                color: 'var(--text-main)',
                border: '1px solid var(--border-strong)',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: '16px',
                boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
                height: '100%',
                position: 'relative'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 12px 24px -10px rgba(0,173,239,0.15)'
                e.currentTarget.style.borderColor = 'var(--mercedes-cyan)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 4px 14px -5px rgba(0,0,0,0.05)'
                e.currentTarget.style.borderColor = 'var(--border-strong)'
              }}
            >
              <div style={{ 
                  width: '100%', 
                  height: 160, 
                  borderRadius: 8, 
                  marginBottom: 16,
                  backgroundImage: 'url(/acceso-global.png)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: '1px solid var(--border-light)'
              }} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                  <div>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 800, color: 'var(--mercedes-cyan)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        ACCESO GLOBAL
                      </h3>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.25 }}>
                        Historial de Revistas, Catálogos y Dosieres
                      </p>
                  </div>
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', color: 'var(--mercedes-cyan)', fontSize: 13, fontWeight: 700 }}>
                      Ver archivo histórico &rarr;
                  </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
