'use client'

import { useEffect, useState } from 'react'
import { UserPlus, Edit2, Trash2, KeyRound, X, ChevronLeft, Users, ShieldAlert, ChevronRight, ChevronDown, Folder, Shield, Lock, Settings, UserCircle, Save } from 'lucide-react'
import Link from 'next/link'
import { getDefaultPermissions } from '@/lib/permissions'
import { PageHeader } from '@/components/PageHeader'

export const HUB_STRUCTURE_DEFS = [
  {
    id: 'HUB_TIENDAS',
    label: '1. Tiendas Hub',
    cards: [
      { id: 'CARD_VENTAS_TIENDAS', label: 'Ventas Tiendas (Hoja de Registro)' },
      { id: 'CARD_COMISIONES_TIENDAS', label: 'Seguimiento de Comisiones' },
      { id: 'CARD_CAJA', label: 'Control de Caja' },
      { id: 'CARD_OFERTAS', label: 'Ofertas Micro / TI / TMA' },
      { id: 'CARD_CONDICIONES_TIENDAS', label: 'Condiciones y Tablas' },
      { id: 'CARD_EXTRAS_TIENDAS', label: 'Comisiones Extras y Penalizaciones' }
    ]
  },
  {
    id: 'HUB_MOVILFREE',
    label: '2. Ventas MovilFree',
    cards: [
      { id: 'CARD_TPV_MOVILFREE', label: 'Terminal Punto de Venta (TPV)' }
    ]
  },
  {
    id: 'HUB_SEGUIMIENTO',
    label: '3. Jefe de Tiendas (Seguimiento)',
    cards: [
      { id: 'CARD_AGENDA_DIARIO', label: 'Agenda Comercial (Diario)' },
      { id: 'CARD_COMBOS', label: 'Control de Combos y Productos' },
      { id: 'CARD_COMISIONES_EQUIPO', label: 'Comisiones de Equipo' }
    ]
  },
  {
    id: 'HUB_BACKOFFICE',
    label: '4. Back Office',
    cards: [
      { id: 'CARD_NUEVA_VENTA', label: 'Nueva Venta' },
      { id: 'CARD_REGISTRO_OPERACIONES', label: 'Registro de Operaciones' },
      { id: 'CARD_OPERACIONES_PENDIENTES', label: 'Operaciones Pendientes' }
    ]
  },
  {
    id: 'HUB_LIQUIDACIONES',
    label: '5. Liquidaciones (Cierres)',
    cards: [
      { id: 'CARD_LIQUIDACION_TELEFONICA', label: 'Liquidación Territorial Telefónica' },
      { id: 'CARD_RENTABILIDAD_TIENDAS', label: 'Rentabilidad de Tiendas' },
      { id: 'CARD_IMPORTES_PLUS', label: 'Liquidación Importes Plus' },
      { id: 'CARD_IMPORTES_PYME', label: 'Liquidación Importes PYME' }
    ]
  },
  {
    id: 'HUB_CRISTINA',
    label: '6. Cristina Admin',
    cards: [
      { id: 'CARD_AGENDA_CRISTINA', label: 'Agenda de Llamadas' },
      { id: 'CARD_CONTROL_STOCK', label: 'Control de Stock (Correhuela)' },
      { id: 'CARD_INFORMES_GASTOS', label: 'Informes de Gastos' },
      { id: 'CARD_CONTROL_VENCIMIENTOS', label: 'Control de Vencimientos' }
    ]
  },
  {
    id: 'HUB_ADMINISTRADOR',
    label: '7. Administración Global',
    cards: [
      { id: 'CARD_PERIODOS_OPERATIVOS', label: 'Gestión de Periodos Operativos' },
      { id: 'CARD_GESTION_USUARIOS', label: 'Gestión de Usuarios' },
      { id: 'CARD_CATALOGOS', label: 'Catálogos y Tablas de Objetivos' },
      { id: 'CARD_BACKUPS', label: 'Copias de Seguridad (Backups)' },
      { id: 'CARD_TRAZABILIDAD', label: 'Trazabilidad y Accesos' }
    ]
  }
]

export const EXTRA_ACTION_DEFS = [
  { id: 'PRINT', label: 'Impresión de Pantallas' },
  { id: 'EXPORT_EXCEL', label: 'Descargar Excel' },
  { id: 'CLOSE_MONTH', label: 'Cierre Mensual Físico' }
]

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // UI State
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'seguridad'>('general')

  // Form State for "General" Tab
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'COMERCIAL', codigoComercial: '' })
  const [isNewUser, setIsNewUser] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = () => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUsers(data.users)
          if (selectedUser) {
              const updated = data.users.find((u: any) => u.username === selectedUser.username)
              if (updated) setSelectedUser(updated)
          }
        } else {
          setError(data.error)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Error al cargar usuarios')
        setLoading(false)
      })
  }

  const handleSelectUser = (u: any) => {
    setSelectedUser(u)
    setIsNewUser(false)
    setUserForm({
        username: u.username,
        password: u.password,
        role: u.role,
        codigoComercial: u.codigoComercial || ''
    })
    setActiveTab('general')
  }

  const handleCreateNew = () => {
    setSelectedUser({ username: 'Nuevo Usuario', role: 'COMERCIAL', permissions: [] })
    setIsNewUser(true)
    setUserForm({ username: '', password: '', role: 'COMERCIAL', codigoComercial: '' })
    setActiveTab('general')
  }

  const handleSaveUser = async () => {
    if (!userForm.username || !userForm.password) return alert('Por favor rellena usuario y contraseña')
    
    try {
      if (!isNewUser) {
        const res = await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldUsername: selectedUser.username,
            newUsername: userForm.username,
            password: userForm.password,
            role: userForm.role,
            codigoComercial: userForm.codigoComercial
          })
        })
        if (res.ok) {
           fetchUsers()
           alert("Guardado correctamente")
        } else {
           const data = await res.json()
           alert(data.error)
        }
      } else {
        const res = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: userForm.username,
            password: userForm.password,
            role: userForm.role,
            codigoComercial: userForm.codigoComercial
          })
        })
        if (res.ok) {
           setIsNewUser(false)
           fetchUsers()
           alert("Usuario creado correctamente")
        } else {
           const data = await res.json()
           alert(data.error)
        }
      }
    } catch(e) {
      alert('Error de conexión')
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser || isNewUser) return
    if (selectedUser.username === 'Admin') return alert('No puedes borrar al Administrador principal')
    if (!confirm(`¿Estás seguro de que quieres borrar a ${selectedUser.username}?`)) return

    try {
      const res = await fetch(`/api/users?username=${encodeURIComponent(selectedUser.username)}`, { method: 'DELETE' })
      if (res.ok) {
        setSelectedUser(null)
        fetchUsers()
      } else {
        const data = await res.json()
        alert(data.error)
      }
    } catch(e) {
      alert('Error de conexión')
    }
  }

  const togglePermission = async (username: string, currentPerms: string[] | null, perm: string | string[], role: string) => {
    let basePerms = currentPerms;
    if (basePerms === null) {
      basePerms = getDefaultPermissions(role);
    }

    let newPerms: string[] = [];
    if (Array.isArray(perm)) {
        newPerms = perm;
    } else {
        newPerms = basePerms.includes(perm)
          ? basePerms.filter(p => p !== perm)
          : [...basePerms, perm]
    }

    // Optimistic update
    setUsers(users.map(u => u.username === username ? { ...u, permissions: newPerms } : u))
    if (selectedUser && selectedUser.username === username) {
        setSelectedUser({...selectedUser, permissions: newPerms})
    }

    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, permissions: newPerms })
    })
  }

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ padding: 20 }}>Cargando usuarios...</div>
  if (error) return <div style={{ padding: 20, color: 'red' }}>{error}</div>

  return (
    <div style={{ padding: 20, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title={<><Users className="text-cyan" size={28} /> Gestión de Accesos</>}
        subtitle="Centro de administración de seguridad y roles."
        showBack={true}
        backFallback="/admin"
      />

      <div className="card" style={{ flex: 1, display: 'flex', overflow: 'hidden', border: '1px solid #E2E8F0', padding: 0 }}>
        
        {/* PANEL IZQUIERDO: Directorio */}
        <div style={{ width: '320px', background: '#F8FAFC', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #E2E8F0' }}>
                <button 
                    onClick={handleCreateNew}
                    className="btn btn-primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, marginBottom: 12 }}
                >
                    <UserPlus size={16} />
                    Nuevo Usuario
                </button>
                <input 
                    type="text" 
                    placeholder="Buscar usuario..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
                />
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {filteredUsers.map(u => {
                    const isSelected = selectedUser && selectedUser.username === u.username && !isNewUser
                    return (
                    <div 
                        key={u.username} 
                        onClick={() => handleSelectUser(u)}
                        style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            background: isSelected ? '#EFF6FF' : 'transparent',
                            color: isSelected ? '#1D4ED8' : '#334155',
                            fontWeight: isSelected ? 600 : 500,
                            display: 'flex', alignItems: 'center', gap: 10,
                            transition: 'all 0.1s',
                            border: isSelected ? '1px solid #BFDBFE' : '1px solid transparent'
                        }}
                    >
                        <UserCircle size={18} color={isSelected ? '#3B82F6' : '#64748B'} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 14 }}>{u.username}</span>
                            <span style={{ fontSize: 11, color: isSelected ? '#60A5FA' : '#94A3B8' }}>{u.role}</span>
                        </div>
                    </div>
                )})}
            </div>
        </div>

        {/* PANEL DERECHO: Propiedades */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
            {selectedUser ? (
                <>
                    {/* Header del panel derecho */}
                    <div style={{ padding: '24px 32px 0 32px', borderBottom: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 24, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <UserCircle size={24} color="#475569" />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 24, color: '#0F172A' }}>{isNewUser ? 'Crear Nuevo Usuario' : selectedUser.username}</h2>
                                <span style={{ fontSize: 13, color: '#64748B' }}>Propiedades del objeto y seguridad</span>
                            </div>
                        </div>

                        {/* TABS */}
                        <div style={{ display: 'flex', gap: 32 }}>
                            <button 
                                onClick={() => setActiveTab('general')}
                                style={{ 
                                    background: 'none', border: 'none', padding: '12px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                                    color: activeTab === 'general' ? '#00ADEF' : '#64748B',
                                    borderBottom: activeTab === 'general' ? '3px solid #00ADEF' : '3px solid transparent'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Settings size={16} /> General</div>
                            </button>
                            <button 
                                onClick={() => setActiveTab('seguridad')}
                                disabled={isNewUser}
                                style={{ 
                                    background: 'none', border: 'none', padding: '12px 0', fontSize: 14, fontWeight: 600, cursor: isNewUser ? 'not-allowed' : 'pointer',
                                    color: activeTab === 'seguridad' ? '#00ADEF' : '#64748B',
                                    borderBottom: activeTab === 'seguridad' ? '3px solid #00ADEF' : '3px solid transparent',
                                    opacity: isNewUser ? 0.5 : 1
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={16} /> Seguridad</div>
                            </button>
                        </div>
                    </div>

                    {/* CONTENIDO TABS */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                        
                        {/* TAB GENERAL */}
                        {activeTab === 'general' && (
                            <div style={{ maxWidth: '600px' }}>
                                <div style={{ background: '#F8FAFC', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 24 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px', alignItems: 'center' }}>
                                        <label style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Usuario:</label>
                                        <input 
                                            type="text" 
                                            value={userForm.username}
                                            onChange={e => setUserForm({...userForm, username: e.target.value})}
                                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none' }}
                                        />

                                        <label style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Contraseña:</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <KeyRound size={16} color="#94A3B8" />
                                            <input 
                                                type="text" 
                                                value={userForm.password}
                                                onChange={e => setUserForm({...userForm, password: e.target.value})}
                                                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, flex: 1, outline: 'none' }}
                                            />
                                        </div>

                                        <label style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Rol Base:</label>
                                        <select 
                                            value={['COMERCIAL', 'JEFE DE VENTAS', 'BACK OFFICE', 'ADMIN'].includes(userForm.role) ? userForm.role : 'CUSTOM'}
                                            onChange={e => {
                                                if (e.target.value === 'CUSTOM') setUserForm({...userForm, role: ''})
                                                else setUserForm({...userForm, role: e.target.value})
                                            }}
                                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none', background: '#FFF' }}
                                        >
                                            <option value="COMERCIAL">COMERCIAL (Estándar)</option>
                                            <option value="JEFE DE VENTAS">JEFE DE TIENDAS</option>
                                            <option value="BACK OFFICE">BACK OFFICE</option>
                                            <option value="ADMIN">ADMINISTRADOR</option>
                                            <option value="CUSTOM">Otro (Personalizado)...</option>
                                        </select>
                                        
                                        {!['COMERCIAL', 'JEFE DE VENTAS', 'BACK OFFICE', 'ADMIN'].includes(userForm.role) && (
                                            <>
                                            <div></div>
                                            <input 
                                                type="text" 
                                                value={userForm.role}
                                                onChange={e => setUserForm({...userForm, role: e.target.value.toUpperCase()})}
                                                placeholder="Nombre del Rol..."
                                                style={{ padding: '8px 12px', borderRadius: 6, border: '1px dashed #A855F7', fontSize: 14, outline: 'none', color: '#A855F7' }}
                                            />
                                            </>
                                        )}

                                        <label style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Cód. Vendedor:</label>
                                        <input 
                                            type="text" 
                                            value={userForm.codigoComercial}
                                            onChange={e => setUserForm({...userForm, codigoComercial: e.target.value})}
                                            placeholder="Opcional"
                                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    {!isNewUser && selectedUser.username !== 'Admin' ? (
                                        <button 
                                            onClick={handleDeleteUser}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            <Trash2 size={16} /> Borrar Cuenta
                                        </button>
                                    ) : <div></div>}
                                    
                                    <button 
                                        onClick={handleSaveUser}
                                        className="btn btn-primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', fontSize: 14 }}
                                    >
                                        <Save size={16} /> {isNewUser ? 'Crear Cuenta' : 'Aplicar Cambios'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* TAB SEGURIDAD */}
                        {activeTab === 'seguridad' && !isNewUser && (
                            <div style={{ maxWidth: '800px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 24 }}>
                                    <Lock size={20} color="#64748B" />
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: 14, color: '#334155' }}>Control de Accesos Efectivo</h4>
                                        <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Marca el Hub completo para dar acceso al menú superior, y luego marca individualmente qué cartas de su interior quieres que estén visibles.</p>
                                    </div>
                                    <div style={{ marginLeft: 'auto' }}>
                                        <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 12, backgroundColor: selectedUser.permissions === null ? '#F1F5F9' : 'rgba(168, 85, 247, 0.1)', color: selectedUser.permissions === null ? '#64748B' : '#A855F7', border: `1px solid ${selectedUser.permissions === null ? '#CBD5E1' : 'rgba(168, 85, 247, 0.3)'}` }}>
                                            {selectedUser.permissions === null ? 'Estado: Heredado del Rol' : 'Estado: Permisos Explícitos'}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, background: '#FFF' }}>
                                    {HUB_STRUCTURE_DEFS.map(hubDef => (
                                        <HubTreeNode 
                                            key={hubDef.id} 
                                            hubDef={hubDef} 
                                            user={selectedUser} 
                                            onToggle={togglePermission} 
                                        />
                                    ))}

                                    {/* ACCIONES GLOBALES */}
                                    <div style={{ borderTop: '2px solid #E2E8F0' }}>
                                        <div style={{ padding: '12px 16px', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Folder size={16} color="#A855F7" />
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>8. Acciones Globales (Operativas)</span>
                                        </div>
                                        <div style={{ padding: '8px 0' }}>
                                            {EXTRA_ACTION_DEFS.map(permDef => (
                                                <ActionTreeNode 
                                                    key={permDef.id} 
                                                    permDef={permDef} 
                                                    user={selectedUser} 
                                                    onToggle={togglePermission} 
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
                    <ShieldAlert size={64} color="#CBD5E1" style={{ marginBottom: 16 }} />
                    <h3 style={{ margin: 0, color: '#475569' }}>Ningún Usuario Seleccionado</h3>
                    <p style={{ color: '#94A3B8', marginTop: 8 }}>Selecciona un usuario en el panel izquierdo para gestionar sus propiedades.</p>
                </div>
            )}
        </div>

      </div>
    </div>
  )
}

// COMPONENTES AUXILIARES DEL TREE VIEW

const HubTreeNode = ({ hubDef, user, onToggle }: any) => {
    const [expanded, setExpanded] = useState(false)
    const activePerms = user.permissions === null ? getDefaultPermissions(user.role) : user.permissions;
    
    // Ver si el usuario tiene acceso al Hub
    const hasHubAccess = activePerms.includes(hubDef.id);

    const toggleHub = () => {
        if (hasHubAccess) {
            // Si le quitamos el Hub, le quitamos también todas sus cartas (Batch toggle)
            const idsToRemove = [hubDef.id, ...hubDef.cards.map((c: any) => c.id)];
            const next = activePerms.filter((p: string) => !idsToRemove.includes(p));
            onToggle(user.username, activePerms, next, user.role);
        } else {
            // Si se lo damos, le damos solo el Hub (las cartas las elige luego)
            onToggle(user.username, activePerms, hubDef.id, user.role);
            setExpanded(true); // Auto expandir para mostrar las cartas
        }
    }

    return (
        <div style={{ borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: expanded ? '#F8FAFC' : 'transparent' }}>
                <div onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', width: 20 }}>
                    {expanded ? <ChevronDown size={16} color="#64748B"/> : <ChevronRight size={16} color="#64748B"/>}
                </div>
                <input type="checkbox" checked={hasHubAccess} onChange={toggleHub} style={{ accentColor: '#00ADEF', cursor: 'pointer', width: 16, height: 16 }} />
                <Folder size={16} color={hasHubAccess ? "#FBBF24" : "#CBD5E1"} />
                <span style={{ fontSize: 13, color: hasHubAccess ? '#0F172A' : '#64748B', userSelect: 'none', fontWeight: hasHubAccess ? 700 : 500 }}>{hubDef.label}</span>
            </div>
            
            {expanded && (
                <div style={{ marginLeft: 48, borderLeft: '1px dashed #CBD5E1', paddingLeft: 16, marginTop: 4, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {hubDef.cards.map((card: any) => {
                        const hasCardAccess = activePerms.includes(card.id);
                        
                        const toggleCard = () => {
                            if (hasCardAccess) {
                                // Quitar acceso
                                const next = activePerms.filter((p: string) => p !== card.id);
                                onToggle(user.username, activePerms, next, user.role);
                            } else {
                                // Dar acceso a la carta (y si no tiene acceso al Hub, dárselo también por lógica)
                                const next = [...activePerms, card.id];
                                if (!hasHubAccess) next.push(hubDef.id);
                                // Eliminar duplicados
                                const uniqueNext = Array.from(new Set(next));
                                onToggle(user.username, activePerms, uniqueNext, user.role);
                            }
                        }

                        return (
                            <label key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={hasCardAccess} onChange={toggleCard} style={{ accentColor: '#38BDF8', width: 14, height: 14 }} />
                                <span style={{ fontSize: 12, color: hasCardAccess ? '#1E293B' : '#94A3B8' }}>{card.label}</span>
                            </label>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

const ActionTreeNode = ({ permDef, user, onToggle }: any) => {
    const activePerms = user.permissions === null ? getDefaultPermissions(user.role) : user.permissions;
    const hasPerm = activePerms.includes(permDef.id);

    return (
        <div style={{ marginLeft: 32, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 4 }}>
                <div style={{ width: 12 }}></div>
                <input 
                    type="checkbox" 
                    checked={hasPerm} 
                    onChange={() => onToggle(user.username, user.permissions, permDef.id, user.role)} 
                    style={{ accentColor: '#A855F7', cursor: 'pointer', width: 14, height: 14 }} 
                />
                <span style={{ fontSize: 13, color: hasPerm ? '#A855F7' : '#64748B', userSelect: 'none', fontWeight: hasPerm ? 600 : 400 }}>{permDef.label}</span>
            </div>
        </div>
    )
}
