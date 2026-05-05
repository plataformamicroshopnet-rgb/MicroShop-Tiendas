'use client'

import React, { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Activity, User, Clock, Route, RefreshCw, BarChart2, PieChart as PieChartIcon, Smartphone, AlertTriangle, Calendar, Layers } from 'lucide-react'
import { useGuard } from '@/hooks/useGuard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function TrackingPage() {
  const { authorized } = useGuard('MODULE_ADMIN')
  const [activeTab, setActiveTab] = useState<'CURRENT' | 'HISTORY' | 'LIVE'>('CURRENT')
  
  // LIVE State
  const [logs, setLogs] = useState<any[]>([])
  const [loadingLive, setLoadingLive] = useState(false)
  
  // CURRENT & HISTORY State
  const [statsData, setStatsData] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [historyMonth, setHistoryMonth] = useState(new Date().getMonth() === 0 ? 12 : new Date().getMonth())
  const [historyYear, setHistoryYear] = useState(new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear())

  const fetchLiveLogs = async () => {
    setLoadingLive(true)
    try {
      const res = await fetch('/api/admin/tracking')
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs)
      }
    } catch(err) {
      console.error(err)
    } finally {
      setLoadingLive(false)
    }
  }

  const fetchStats = async (mode: 'CURRENT' | 'HISTORY') => {
    setLoadingStats(true)
    try {
      const url = mode === 'CURRENT' 
        ? '/api/admin/tracking-history?month=CURRENT&year=CURRENT'
        : `/api/admin/tracking-history?month=${historyMonth}&year=${historyYear}`
      
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setStatsData(data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => {
    if (!authorized) return
    if (activeTab === 'LIVE') fetchLiveLogs()
    if (activeTab === 'CURRENT') fetchStats('CURRENT')
    if (activeTab === 'HISTORY') fetchStats('HISTORY')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, activeTab, historyMonth, historyYear])

  if (!authorized) return null

  // UI Helpers
  const COLORS = ['#00E5FF', '#00B4D8', '#0077B6', '#03045E', '#90E0EF', '#CAF0F8']
  const ERROR_COLORS = ['#FF4D4D', '#FF7979', '#FF9E9E']

  return (
    <div className="page-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <PageHeader 
          title={<><Activity size={28} color="var(--mercedes-cyan)" /> Trazabilidad Avanzada</>}
          subtitle="Telemetría de adopción comercial y auditoría de seguridad"
          showBack={true}
          backFallback="/admin"
          helpContent={
            <div>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Trazabilidad y Accesos</h4>
              <p style={{ margin: 0, lineHeight: 1.5 }}>El 'Gran Hermano' del ERP. Este módulo te permite auditar al milímetro el uso del sistema. Tienes 3 pestañas clave: 1) Mes en Curso (KPIs visuales de adopción y errores), 2) Histórico (Evolución mensual para reportes a gerencia), y 3) Inspector Bruto (Lista cronológica exacta de quién tocó qué botón a qué hora).</p>
            </div>
          }
        />
        
        {/* TABS (Segmented Control Premium) */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-light, #e5e7eb)', padding: '4px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <button 
            onClick={() => setActiveTab('CURRENT')}
            style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '6px', border: 'none', background: activeTab === 'CURRENT' ? 'var(--mercedes-cyan, #00b4d8)' : 'transparent', color: activeTab === 'CURRENT' ? '#fff' : 'var(--text-muted, #6b7280)', fontWeight: activeTab === 'CURRENT' ? 600 : 500, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'CURRENT' ? '0 2px 4px rgba(0,180,216,0.3)' : 'none' }}
          >
            <BarChart2 size={15} /> Mes en Curso
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')}
            style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '6px', border: 'none', background: activeTab === 'HISTORY' ? 'var(--mercedes-cyan, #00b4d8)' : 'transparent', color: activeTab === 'HISTORY' ? '#fff' : 'var(--text-muted, #6b7280)', fontWeight: activeTab === 'HISTORY' ? 600 : 500, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'HISTORY' ? '0 2px 4px rgba(0,180,216,0.3)' : 'none' }}
          >
            <Calendar size={15} /> Histórico Mensual
          </button>
          <button 
            onClick={() => setActiveTab('LIVE')}
            style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '6px', border: 'none', background: activeTab === 'LIVE' ? 'var(--mercedes-cyan, #00b4d8)' : 'transparent', color: activeTab === 'LIVE' ? '#fff' : 'var(--text-muted, #6b7280)', fontWeight: activeTab === 'LIVE' ? 600 : 500, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'LIVE' ? '0 2px 4px rgba(0,180,216,0.3)' : 'none' }}
          >
            <Layers size={15} /> Inspector en Bruto
          </button>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        
        {/* TAB 1: MES EN CURSO (5 Gráficas) */}
        {activeTab === 'CURRENT' && statsData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Fila 1: KPIs Rápidos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
              {/* Origen de Acceso */}
              <div className="premium-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', padding: '32px' }}>
                <div style={{ textAlign: 'center' }}>
                  <Smartphone size={40} color="var(--mercedes-cyan)" style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 32, fontWeight: 'bold' }}>{statsData.devices?.mobile || 0}</div>
                  <div style={{ color: 'var(--medium-gray)', fontSize: 13 }}>Accesos Móvil</div>
                </div>
                <div style={{ width: 1, height: '80%', background: 'var(--border-light)' }} />
                <div style={{ textAlign: 'center' }}>
                  <Activity size={40} color="var(--medium-gray)" style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 32, fontWeight: 'bold' }}>{statsData.devices?.desktop || 0}</div>
                  <div style={{ color: 'var(--medium-gray)', fontSize: 13 }}>Accesos PC</div>
                </div>
              </div>
              
              {/* Radar de Errores */}
              <div className="premium-card">
                 <h3 className="section-title" style={{ color: 'var(--mercedes-red)' }}><AlertTriangle size={16} /> Radar de Errores y Borrados Críticos</h3>
                 {statsData.errorsAndDeletes?.length > 0 ? (
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '16px' }}>
                     {statsData.errorsAndDeletes.map((e: any, i: number) => (
                       <div key={i} style={{ background: 'rgba(255,0,0,0.05)', border: '1px solid rgba(255,0,0,0.1)', padding: '12px 24px', borderRadius: '8px' }}>
                         <div style={{ fontSize: 13, color: 'var(--medium-gray)' }}>{e.name}</div>
                         <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4d' }}>{e.count} incidentes</div>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--medium-gray)', fontSize: '14px' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛡️</div>
                      Sin incidentes destacables registrados. Todo en orden.
                   </div>
                 )}
              </div>
            </div>

            {/* Fila 2: Top 10 Rutas y Comerciales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
              <div className="premium-card" style={{ height: 380 }}>
                 <h3 className="section-title"><Route size={16} /> Top 10 Rutas (Impacto)</h3>
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statsData.topRoutes} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 20 }}>
                      <XAxis type="number" fontSize={11} stroke="var(--medium-gray)" />
                      <YAxis dataKey="path" type="category" width={140} fontSize={10} stroke="var(--medium-gray)" interval={0} />
                      <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 13 }} />
                      <Bar dataKey="views" name="Visitas" fill="var(--mercedes-cyan)" radius={[0, 4, 4, 0]} maxBarSize={32} label={{ position: 'right', fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>

              <div className="premium-card" style={{ height: 380 }}>
                 <h3 className="section-title"><User size={16} /> Top 10 Comerciales Más Activos</h3>
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statsData.topUsers} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 20 }}>
                      <XAxis type="number" fontSize={11} stroke="var(--medium-gray)" />
                      <YAxis dataKey="username" type="category" width={120} fontSize={11} stroke="var(--medium-gray)" interval={0} />
                      <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 13 }} />
                      <Bar dataKey="actions" name="Acciones" fill="#0077B6" radius={[0, 4, 4, 0]} maxBarSize={32} label={{ position: 'right', fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
            </div>

            {/* Fila 3: Horarios Evolución */}
            <div className="premium-card">
              <h3 className="section-title"><Clock size={16} /> Horarios de Acceso (Evolución Diaria)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={statsData.horary || []} layout="horizontal" margin={{ left: 0, right: 10, top: 20, bottom: 0 }}>
                  <XAxis dataKey="name" type="category" fontSize={11} stroke="var(--medium-gray)" axisLine={false} tickLine={false} interval={0} />
                  <YAxis type="number" hide />
                  <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 13 }} />
                  <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} maxBarSize={40} label={{ position: 'top', fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>
        )}

        {/* TAB 2: HISTORY (Meses Pasados Congelados) */}
        {activeTab === 'HISTORY' && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center' }}>
              <div style={{ color: 'var(--medium-gray)' }}>Selecciona el Periodo Consolidado:</div>
              <select className="premium-input" style={{ width: 150 }} value={historyMonth} onChange={e => setHistoryMonth(parseInt(e.target.value))}>
                {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>Mes {i+1}</option>)}
              </select>
              <select className="premium-input" style={{ width: 100 }} value={historyYear} onChange={e => setHistoryYear(parseInt(e.target.value))}>
                {[...Array(5)].map((_, i) => <option key={i} value={2026 - i}>{2026 - i}</option>)}
              </select>
              {loadingStats && <RefreshCw size={18} className="animate-spin" color="var(--mercedes-cyan)" />}
            </div>

            {statsData && statsData.topRoutes?.length === 0 ? (
              <div className="premium-card" style={{ textAlign: 'center', padding: 60, color: 'var(--medium-gray)' }}>
                No hay historial consolidado para este periodo. El cierre automático probablemente no se ejecutó aún.
              </div>
            ) : statsData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
                <div className="premium-card" style={{ height: 400 }}>
                  <h3 className="section-title"><Route size={16} /> Histórico Top Rutas</h3>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statsData.topRoutes} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 20 }}>
                        <XAxis type="number" fontSize={11} stroke="var(--medium-gray)" />
                        <YAxis dataKey="path" type="category" width={100} fontSize={10} stroke="var(--medium-gray)" interval={0} />
                        <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                        <Bar dataKey="views" name="Visitas Totales" fill="#00E5FF" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: 'var(--medium-gray)', fontSize: 11, fontWeight: 500 }} />
                      </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="premium-card" style={{ height: 400 }}>
                  <h3 className="section-title"><User size={16} /> Histórico Top Comerciales</h3>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statsData.topUsers} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 20 }}>
                        <XAxis type="number" fontSize={11} stroke="var(--medium-gray)" />
                        <YAxis dataKey="username" type="category" width={100} fontSize={10} stroke="var(--medium-gray)" interval={0} />
                        <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                        <Bar dataKey="actions" name="Acciones Totales" fill="#0077B6" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: 'var(--medium-gray)', fontSize: 11, fontWeight: 500 }} />
                      </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LIVE (Bruto) */}
        {activeTab === 'LIVE' && (
          <div className="premium-card" style={{ overflowX: 'auto' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Registros en Bruto (Últimos Días)</span>
              <button 
                onClick={fetchLiveLogs} 
                className="btn-primary" 
                style={{ padding: '4px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={14} className={loadingLive ? 'animate-spin' : ''} /> Refrescar
              </button>
            </h3>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--medium-gray)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Fecha / Hora</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Usuario</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Dispositivo</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Acción</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Pantalla</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 300).map((log, i) => (
                  <tr key={log.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--light-text)' }}>
                      <Clock size={12} style={{ display: 'inline', marginRight: 4, opacity: 0.5 }} />
                      {new Date(log.createdAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--mercedes-cyan)' }}>{log.username}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--medium-gray)' }}>
                      {log.device === 'MOBILE' ? <Smartphone size={14} /> : <Activity size={14} />} {log.device}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                      <span style={{ 
                        backgroundColor: log.action === 'ERROR' || log.action === 'DELETE' ? 'rgba(255,0,0,0.1)' : 'rgba(255,255,255,0.05)', 
                        color: log.action === 'ERROR' || log.action === 'DELETE' ? '#ff4d4d' : 'inherit',
                        padding: '2px 8px', borderRadius: '12px' 
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#a1a1aa' }}>
                      <Route size={12} style={{ display: 'inline', marginRight: 4, opacity: 0.5 }} />
                      {log.path}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !loadingLive && (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay datos crudos recientes.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}
