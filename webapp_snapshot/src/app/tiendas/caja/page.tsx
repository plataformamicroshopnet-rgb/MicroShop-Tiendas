'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calculator, Plus, Trash2, CheckCircle2, CircleDashed, Clock, ChevronDown, X } from 'lucide-react'
import { useGuard } from '@/hooks/useGuard'
import { canView } from '@/lib/permissions'

// Importamos el mapeo de tiendas para saber dónde cae el usuario actual
import { TIENDAS_COMERCIALES } from '@/lib/constants'

type CajaEntry = {
  id: string
  tienda: string
  fecha: string
  concepto: string
  detalle: string
  importe: number
  createdAt: string
  vendedor: string | null
  estadoTrazabilidad: 'ROJO' | 'NARANJA' | 'VERDE' | null
}

const CONCEPTOS = [
  '(+) Caja SIAC',
  '(+) Ajuste SIAC',
  '(+) Facturación Microshop',
  '(+) Otras entradas',
  '(+) Facturación MovilFree',
  '(+) Tarjeta MovilFree',
  '(+/-) Corrección',
  '(-) Recogida de Efectivo',
  '(-) Pago Servicio Técnico',
  '(-) Material de oficina',
  '(-) Ingreso en Banco',
  '(-) Otras salidas'
];

export default function CajaTiendasPage() {
  const { authorized, user } = useGuard('CARD_CAJA')
  const router = useRouter()

  const [entries, setEntries] = useState<CajaEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Mapeo de tienda
  const userTienda = useMemo(() => {
    if (!user) return null
    if (user.role === 'ADMIN' || canView(user, 'HUB_CRISTINA')) return 'ADMIN'
    
    for (const [store, members] of Object.entries(TIENDAS_COMERCIALES)) {
      if (members.includes(user.username)) {
        return store === 'Auxiliadora 45' ? 'Auxiliadora' : store
      }
    }
    
    if (canView(user, 'CARD_CAJA') || canView(user, 'HUB_BACKOFFICE')) return 'ADMIN'
    return null
  }, [user])

  const [activeTab, setActiveTab] = useState<string>('')

  useEffect(() => {
    if (userTienda) {
      if (userTienda === 'ADMIN') {
        setActiveTab('Central')
      } else {
        setActiveTab(userTienda)
      }
    }
  }, [userTienda])

  // Fetch entries
  const fetchEntries = async () => {
    if (!activeTab) return;
    setLoading(true)
    try {
      let url = '/api/caja'
      if (userTienda !== 'ADMIN') {
        url += `?tienda=${activeTab}`
      }

      const res = await fetch(url)
      const data = await res.json()
      if (data.entries) {
        setEntries(data.entries)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries()
  }, [activeTab, userTienda])

  // --- Modal Añadir ---
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newEntry, setNewEntry] = useState({
    fecha: new Date().toISOString().split('T')[0],
    importe: '',
    concepto: CONCEPTOS[0],
    detalle: ''
  })

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEntry.importe || isNaN(Number(newEntry.importe))) return

    const isSalidaTransito = newEntry.concepto.includes('Recogida de Efectivo') || 
                             (newEntry.concepto.includes('salidas') && newEntry.detalle.toLowerCase().includes('central'));
    
    const estado = isSalidaTransito ? 'ROJO' : null;

    try {
      const res = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tienda: activeTab,
          fecha: newEntry.fecha,
          concepto: newEntry.concepto,
          detalle: newEntry.detalle,
          importe: Number(newEntry.importe),
          vendedor: user?.username,
          estadoTrazabilidad: estado
        })
      })

      if (res.ok) {
        setIsModalOpen(false)
        setNewEntry({
          fecha: new Date().toISOString().split('T')[0],
          importe: '',
          concepto: CONCEPTOS[0],
          detalle: ''
        })
        fetchEntries()
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de borrar este movimiento?')) return;
    try {
      await fetch(`/api/caja?id=${id}`, { method: 'DELETE' })
      fetchEntries()
    } catch (e) {
      console.error(e)
    }
  }

  const cycleStatus = async (entry: CajaEntry) => {
    if (!entry.estadoTrazabilidad) return;
    
    let nextStatus: 'ROJO' | 'NARANJA' | 'VERDE' | null = null;
    if (entry.estadoTrazabilidad === 'ROJO') nextStatus = 'NARANJA';
    else if (entry.estadoTrazabilidad === 'NARANJA') nextStatus = 'VERDE';
    else if (entry.estadoTrazabilidad === 'VERDE') nextStatus = 'ROJO';

    try {
      await fetch('/api/caja', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, estadoTrazabilidad: nextStatus })
      })
      fetchEntries()
    } catch (e) {
      console.error(e)
    }
  }

  // --- Cálculos ---
  const activeEntries = userTienda === 'ADMIN' ? entries.filter(e => e.tienda === activeTab) : entries;
  
  const currentSaldo = activeEntries.reduce((acc, curr) => acc + curr.importe, 0)

  // Resumen de todas las tiendas (solo para Central)
  const allStores = ['Auxiliadora', 'Villamayor', 'Béjar', 'Correhuela', 'MovilFree'];
  const storeBalances = allStores.map(tienda => {
    const storeEntries = entries.filter(e => e.tienda === tienda);
    const balance = storeEntries.reduce((acc, curr) => acc + curr.importe, 0);
    return { tienda, balance };
  });
  const totalStores = storeBalances.reduce((acc, curr) => acc + curr.balance, 0);

  if (!authorized || !userTienda) return null

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: 60 }}>
      {/* Header Premium */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', padding: '24px 32px', position: 'sticky', top: 0, zIndex: 40, boxShadow: '0 4px 20px -10px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(0, 173, 239, 0.15) 0%, rgba(0, 150, 200, 0.2) 100%)', color: '#00adef', padding: 10, borderRadius: 12 }}>
                <Calculator size={22} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                  Caja de Tiendas
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: 14, fontWeight: 500 }}>
                  Gestión de caja y trazabilidad
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
             <div style={{ background: currentSaldo >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: currentSaldo >= 0 ? '#10b981' : '#ef4444', padding: '10px 24px', borderRadius: 12, fontWeight: 800, fontSize: 18, border: `1px solid ${currentSaldo >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
                Saldo {activeTab}: {currentSaldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
             </div>
             
             <button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', height: 44, borderRadius: 12, background: '#00adef', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0, 173, 239, 0.3)', transition: 'all 0.2s' }}>
                <Plus size={18} /> Añadir Movimiento
             </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '32px auto', padding: '0 24px' }}>
        
        {/* Tabs for Admin */}
        {userTienda === 'ADMIN' && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto', paddingBottom: 8 }}>
            {['Central', ...allStores].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 24px',
                  borderRadius: 20,
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === tab ? '#00adef' : '#ffffff',
                  color: activeTab === tab ? '#ffffff' : '#64748b',
                  boxShadow: activeTab === tab ? '0 4px 10px rgba(0, 173, 239, 0.2)' : '0 2px 4px rgba(15, 23, 42, 0.05)',
                  transition: 'all 0.2s'
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          
          {/* Main Table */}
          <div style={{ flex: 1, background: '#ffffff', borderRadius: 16, border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 4px 10px -5px rgba(15, 23, 42, 0.05)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Fecha</th>
                  <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Concepto</th>
                  <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Detalle</th>
                  <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Importe</th>
                  <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>Trazabilidad</th>
                  {user.role === 'ADMIN' && <th style={{ padding: '16px 20px', width: 60 }}></th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Cargando movimientos...</td></tr>
                ) : activeEntries.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No hay movimientos en la caja. Añade una corrección inicial.</td></tr>
                ) : (
                  activeEntries.map((e, i) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#ffffff' : '#f8fafc', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: '#334155' }}>
                         {new Date(e.fecha).toLocaleDateString('es-ES')}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: '#0f172a' }}>{e.concepto}</td>
                      <td style={{ padding: '16px 20px', color: '#64748b', fontSize: 14 }}>{e.detalle}</td>
                      <td style={{ padding: '16px 20px', fontWeight: 700, textAlign: 'right', color: e.importe >= 0 ? '#10b981' : '#ef4444' }}>
                        {e.importe.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                         {e.estadoTrazabilidad ? (
                            <button 
                               onClick={() => userTienda === 'ADMIN' ? cycleStatus(e) : undefined}
                               style={{ 
                                 border: 'none', background: 'transparent', cursor: userTienda === 'ADMIN' ? 'pointer' : 'default',
                                 color: e.estadoTrazabilidad === 'ROJO' ? '#ef4444' : 
                                        e.estadoTrazabilidad === 'NARANJA' ? '#f59e0b' : '#10b981',
                                 display: 'inline-flex', alignItems: 'center', gap: 6,
                                 fontWeight: 700, fontSize: 12, padding: '4px 12px', borderRadius: 20,
                                 backgroundColor: e.estadoTrazabilidad === 'ROJO' ? 'rgba(239, 68, 68, 0.1)' : 
                                                  e.estadoTrazabilidad === 'NARANJA' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'
                               }}
                               title={userTienda === 'ADMIN' ? "Clic para cambiar estado" : "Estado actual"}
                            >
                               {e.estadoTrazabilidad === 'ROJO' && <CircleDashed size={14} />}
                               {e.estadoTrazabilidad === 'NARANJA' && <Clock size={14} />}
                               {e.estadoTrazabilidad === 'VERDE' && <CheckCircle2 size={14} />}
                               {e.estadoTrazabilidad}
                            </button>
                         ) : (
                           <span style={{ color: '#cbd5e1' }}>-</span>
                         )}
                      </td>
                      {user.role === 'ADMIN' && (
                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                           <button onClick={() => handleDelete(e.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7 }} title="Borrar entrada">
                              <Trash2 size={16} />
                           </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Central Summary Panel */}
          {activeTab === 'Central' && userTienda === 'ADMIN' && (
            <div style={{ width: 320, background: '#ffffff', borderRadius: 16, border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 4px 10px -5px rgba(15, 23, 42, 0.05)', padding: 24 }}>
               <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Saldos Tiendas</h3>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 {storeBalances.map(st => (
                   <div key={st.tienda} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                     <span style={{ color: '#64748b', fontWeight: 500, fontSize: 14 }}>{st.tienda}</span>
                     <span style={{ color: st.balance >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                        {st.balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                     </span>
                   </div>
                 ))}
               </div>

               <div style={{ marginTop: 16, paddingTop: 16, borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#0f172a', fontWeight: 800 }}>Total Tiendas</span>
                  <span style={{ color: totalStores >= 0 ? '#10b981' : '#ef4444', fontWeight: 800, fontSize: 18 }}>
                     {totalStores.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </span>
               </div>
            </div>
          )}

        </div>
      </main>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
           <style dangerouslySetInnerHTML={{__html: `
              .premium-input {
                 background: #f8fafc;
                 border: 1px solid #e2e8f0;
                 color: #0f172a;
                 transition: all 0.2s;
                 outline: none;
              }
              .premium-input:focus {
                 border-color: #00adef;
                 box-shadow: 0 0 0 4px rgba(0, 173, 239, 0.1);
                 background: #ffffff;
              }
              .premium-btn:hover {
                 transform: translateY(-1px);
                 box-shadow: 0 6px 20px rgba(0, 173, 239, 0.5) !important;
              }
           `}} />
           
           <div style={{ background: '#ffffff', borderRadius: 24, width: '100%', maxWidth: 460, padding: '36px 40px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8)', position: 'relative' }}>
              
              <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: 24, right: 24, background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}>
                <X size={20} />
              </button>

              <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
                 <div style={{ background: 'linear-gradient(135deg, rgba(0, 173, 239, 0.15) 0%, rgba(0, 150, 200, 0.2) 100%)', color: '#00adef', padding: 12, borderRadius: 14 }}>
                    <Plus size={24} strokeWidth={2.5} />
                 </div>
                 <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>Registrar Movimiento</h2>
                    <p style={{ margin: 0, color: '#64748b', fontSize: 14, fontWeight: 500 }}>Añade una entrada o salida de caja</p>
                 </div>
              </div>

              <form onSubmit={handleAddEntry} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                 
                 <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Importe (€)
                      </label>
                      <input className="premium-input" type="number" step="0.01" required value={newEntry.importe} onChange={e => setNewEntry({...newEntry, importe: e.target.value})} style={{ width: '100%', height: 48, borderRadius: 12, padding: '0 16px', fontSize: 18, fontWeight: 800 }} placeholder="0.00" />
                    </div>

                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Fecha
                      </label>
                      <input className="premium-input" type="date" required value={newEntry.fecha} onChange={e => setNewEntry({...newEntry, fecha: e.target.value})} style={{ width: '100%', height: 48, borderRadius: 12, padding: '0 16px', fontSize: 15, fontWeight: 600, fontFamily: 'inherit' }} />
                    </div>
                 </div>

                 <div>
                   <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                     Concepto
                   </label>
                   <div style={{ position: 'relative' }}>
                     <select className="premium-input" required value={newEntry.concepto} onChange={e => setNewEntry({...newEntry, concepto: e.target.value})} style={{ width: '100%', height: 48, borderRadius: 12, padding: '0 16px', fontSize: 15, appearance: 'none', cursor: 'pointer', fontWeight: 600 }}>
                       {CONCEPTOS.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     <ChevronDown size={18} style={{ position: 'absolute', right: 16, top: 15, color: '#64748b', pointerEvents: 'none' }} />
                   </div>
                 </div>

                 <div>
                   <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                     Detalle del movimiento
                   </label>
                   <textarea className="premium-input" required value={newEntry.detalle} onChange={e => setNewEntry({...newEntry, detalle: e.target.value})} style={{ width: '100%', height: 86, borderRadius: 12, padding: '14px 16px', fontSize: 15, resize: 'none', fontFamily: 'inherit', fontWeight: 500 }} placeholder="Escribe observaciones o detalles aquí..." />
                 </div>

                 <button className="premium-btn" type="submit" style={{ marginTop: 8, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #00adef 0%, #008fcc 100%)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 16, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(0, 173, 239, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, letterSpacing: '0.5px' }}>
                   AÑADIR A CAJA <CheckCircle2 size={18} />
                 </button>

              </form>
           </div>
        </div>
      )}

    </div>
  )
}
