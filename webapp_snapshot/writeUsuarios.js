const fs = require('fs');

const fileContent = `
'use client'

import { useEffect, useState } from 'react'
import { UserPlus, Edit2, Trash2, KeyRound, X, ChevronLeft, Users, ShieldAlert, ChevronRight, ChevronDown, Folder, Shield, Lock, Settings, UserCircle, Save } from 'lucide-react'
import Link from 'next/link'
import { getDefaultPermissions } from '@/lib/permissions'
import { PageHeader } from '@/components/PageHeader'

export const MODULE_DEFS = [
  { id: 'MODULE_TIENDAS', label: 'Ventas Tiendas (Operaciones)' },
  { id: 'MODULE_JEFE_TIENDAS', label: 'Jefe Tiendas (Sustituye a SS)' },
  { id: 'MODULE_BACK_OFFICE', label: 'Back Office (Grabaciones)' },
  { id: 'MODULE_CUMPLIMIENTO', label: 'Progresión y Agenda B2B' },
  { id: 'MODULE_COMISIONES', label: 'Comisiones de Equipo' },
  { id: 'MODULE_LIQUIDACION', label: 'Liquidaciones Mensuales' },
  { id: 'MODULE_DIRECCION', label: 'Dirección Comercial' },
  { id: 'MANAGE_MAGAZINES', label: 'Documentación y Revistas' },
  { id: 'MANAGE_CATALOG', label: 'Parámetros y Tablas de Objetivos' },
  { id: 'MODULE_ADMIN', label: 'Administrador Global' }
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
                                <User size={24} color="#475569" />
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
                                        <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Los permisos marcados sobrescriben los permisos por defecto de su Rol.</p>
                                    </div>
                                    <div style={{ marginLeft: 'auto' }}>
                                        <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 12, backgroundColor: selectedUser.permissions === null ? '#F1F5F9' : 'rgba(168, 85, 247, 0.1)', color: selectedUser.permissions === null ? '#64748B' : '#A855F7', border: `1px solid ${selectedUser.permissions === null ? '#CBD5E1' : 'rgba(168, 85, 247, 0.3)'}` }}>
                                            {selectedUser.permissions === null ? 'Estado: Heredado del Rol' : 'Estado: Permisos Explícitos'}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, background: '#FFF' }}>
                                    {/* MÓDULOS DE SISTEMA */}
                                    <TreeCategory title="Módulos de Sistema" icon={<Folder size={16} color="#3B82F6" />}>
                                        {MODULE_DEFS.map(permDef => (
                                            <ModuleTreeNode 
                                                key={permDef.id} 
                                                permDef={permDef} 
                                                user={selectedUser} 
                                                onToggle={togglePermission} 
                                            />
                                        ))}
                                    </TreeCategory>

                                    {/* ACCIONES GLOBALES */}
                                    <TreeCategory title="Acciones Globales y Operativas" icon={<Folder size={16} color="#A855F7" />}>
                                        {EXTRA_ACTION_DEFS.map(permDef => (
                                            <ActionTreeNode 
                                                key={permDef.id} 
                                                permDef={permDef} 
                                                user={selectedUser} 
                                                onToggle={togglePermission} 
                                            />
                                        ))}
                                    </TreeCategory>
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

const TreeCategory = ({ title, icon, children }: any) => {
    const [expanded, setExpanded] = useState(true)
    return (
        <div style={{ borderBottom: '1px solid #F1F5F9' }}>
            <div 
                onClick={() => setExpanded(!expanded)}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: '#F8FAFC', userSelect: 'none' }}
            >
                {expanded ? <ChevronDown size={16} color="#64748B"/> : <ChevronRight size={16} color="#64748B"/>}
                {icon}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{title}</span>
            </div>
            {expanded && (
                <div style={{ padding: '8px 0' }}>
                    {children}
                </div>
            )}
        </div>
    )
}

const ModuleTreeNode = ({ permDef, user, onToggle }: any) => {
    const [expanded, setExpanded] = useState(false)
    const activePerms = user.permissions === null ? getDefaultPermissions(user.role) : user.permissions;
                      
    const hasView = activePerms.includes(`${permDef.id}:view`) || activePerms.includes(`${permDef.id}:edit`) || activePerms.includes(permDef.id) || (permDef.id === 'MODULE_TIENDAS' && (activePerms.includes('EDIT_SALES') || activePerms.includes('CREATE_SALES')));
    
    let hasEdit = activePerms.includes(`${permDef.id}:edit`);
    if (permDef.id === 'MODULE_TIENDAS' && (activePerms.includes('EDIT_SALES') || activePerms.includes('CREATE_SALES'))) hasEdit = true;
    if (permDef.id === 'MANAGE_MAGAZINES' && activePerms.includes('MANAGE_MAGAZINES')) hasEdit = true;
    if (permDef.id === 'MANAGE_CATALOG' && activePerms.includes('MANAGE_CATALOG')) hasEdit = true;
    if (permDef.id === 'MODULE_ADMIN' && activePerms.includes('MODULE_ADMIN')) hasEdit = true;

    const onToggleView = () => {
        if (hasView) {
            const next = activePerms.filter((p: string) => p !== permDef.id && p !== `${permDef.id}:view` && p !== `${permDef.id}:edit` && p !== 'EDIT_SALES' && p !== 'CREATE_SALES');
            onToggle(user.username, activePerms, next, user.role);
        } else {
            const next = [...activePerms, `${permDef.id}:view`, permDef.id];
            onToggle(user.username, activePerms, next, user.role);
        }
    };

    const onToggleEdit = () => {
        if (hasEdit) {
            const next = activePerms.filter((p: string) => p !== `${permDef.id}:edit` && p !== 'EDIT_SALES' && p !== 'CREATE_SALES');
            if (!next.includes(`${permDef.id}:view`)) next.push(`${permDef.id}:view`);
            if (!next.includes(permDef.id)) next.push(permDef.id);
            onToggle(user.username, activePerms, next, user.role);
        } else {
            const next = [...activePerms, `${permDef.id}:edit`, `${permDef.id}:view`, permDef.id];
            if (permDef.id === 'MODULE_TIENDAS') { next.push('EDIT_SALES'); next.push('CREATE_SALES'); }
            const uniqueNext = Array.from(new Set(next));
            onToggle(user.username, activePerms, uniqueNext, user.role);
        }
    };

    return (
        <div style={{ marginLeft: 32, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 4, background: expanded ? '#F8FAFC' : 'transparent' }}>
                <div onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', width: 20 }}>
                    {expanded ? <ChevronDown size={14} color="#94A3B8"/> : <ChevronRight size={14} color="#94A3B8"/>}
                </div>
                <input type="checkbox" checked={hasView} onChange={onToggleView} style={{ accentColor: '#00ADEF', cursor: 'pointer' }} />
                <Folder size={14} color={hasView ? "#FBBF24" : "#CBD5E1"} />
                <span style={{ fontSize: 13, color: hasView ? '#0F172A' : '#64748B', userSelect: 'none', fontWeight: hasView ? 600 : 400 }}>{permDef.label}</span>
            </div>
            
            {expanded && (
                <div style={{ marginLeft: 32, borderLeft: '1px dashed #CBD5E1', paddingLeft: 16, marginTop: 4, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={hasView} onChange={onToggleView} style={{ accentColor: '#00ADEF', width: 14, height: 14 }} />
                        <span style={{ fontSize: 12, color: hasView ? '#334155' : '#94A3B8' }}>Permiso de Lectura (Ver)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: hasView ? 'pointer' : 'not-allowed' }}>
                        <input type="checkbox" checked={hasEdit} onChange={onToggleEdit} disabled={!hasView} style={{ accentColor: '#A855F7', width: 14, height: 14 }} />
                        <span style={{ fontSize: 12, color: hasEdit ? '#A855F7' : '#94A3B8' }}>Permiso de Modificación (Editar)</span>
                    </label>
                </div>
            )}
        </div>
    )
}

const ActionTreeNode = ({ permDef, user, onToggle }: any) => {
    const activePerms = user.permissions === null ? getDefaultPermissions(user.role) : user.permissions;
    const hasPerm = activePerms.includes(permDef.id);

    return (
        <div style={{ marginLeft: 32, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 4 }}>
                <div style={{ width: 20 }}></div>
                <input 
                    type="checkbox" 
                    checked={hasPerm} 
                    onChange={() => onToggle(user.username, user.permissions, permDef.id, user.role)} 
                    style={{ accentColor: '#A855F7', cursor: 'pointer' }} 
                />
                <span style={{ fontSize: 13, color: hasPerm ? '#A855F7' : '#64748B', userSelect: 'none', fontWeight: hasPerm ? 600 : 400 }}>{permDef.label}</span>
            </div>
        </div>
    )
}
`;

fs.writeFileSync('src/app/admin/usuarios/page.tsx', fileContent, 'utf-8');
