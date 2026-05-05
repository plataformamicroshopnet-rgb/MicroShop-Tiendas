'use client'

import { useEffect, useState } from 'react'
import { UserPlus, Edit2, Trash2, KeyRound, X, ChevronLeft, Users, ShieldAlert } from 'lucide-react'
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

  // User Management State
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'COMERCIAL', codigoComercial: '' })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = () => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUsers(data.users)
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

  const togglePermission = async (username: string, currentPerms: string[] | null, perm: string | string[], role: string) => {
    let basePerms = currentPerms;
    if (basePerms === null) {
      basePerms = getDefaultPermissions(role);
    }

    let newPerms: string[] = [];
    if (Array.isArray(perm)) {
        // MODO BATCH (Para las matrices compuestas)
        newPerms = perm;
    } else {
        // MODO NORMAL (Checkbox simple)
        newPerms = basePerms.includes(perm)
          ? basePerms.filter(p => p !== perm)
          : [...basePerms, perm]
    }

    setUsers(users.map(u => u.username === username ? { ...u, permissions: newPerms } : u))

    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, permissions: newPerms })
    })
  }

  const handleOpenUserModal = (user: any = null) => {
    if (user) {
      setEditingUser(user)
      setUserForm({ username: user.username, password: user.password, role: user.role, codigoComercial: user.codigoComercial || '' })
    } else {
      setEditingUser(null)
      setUserForm({ username: '', password: '', role: 'COMERCIAL', codigoComercial: '' })
    }
    setShowUserModal(true)
  }

  const handleSaveUser = async () => {
    if (!userForm.username || !userForm.password) return alert('Por favor rellena usuario y contraseña')
    
    try {
      if (editingUser) {
        const res = await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldUsername: editingUser.username,
            newUsername: userForm.username,
            password: userForm.password,
            role: userForm.role,
            codigoComercial: userForm.codigoComercial
          })
        })
        if (res.ok) {
           fetchUsers()
           setShowUserModal(false)
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
           fetchUsers()
           setShowUserModal(false)
        } else {
           const data = await res.json()
           alert(data.error)
        }
      }
    } catch(e) {
      alert('Error de conexión')
    }
  }

  const handleDeleteUser = async (username: string) => {
    if (username === 'Admin') return alert('No puedes borrar al Administrador principal')
    if (!confirm(`¿Estás seguro de que quieres borrar al usuario y contraseña de ${username}?`)) return

    try {
      const res = await fetch(`/api/users?username=${encodeURIComponent(username)}`, { method: 'DELETE' })
      if (res.ok) {
        fetchUsers()
      } else {
        const data = await res.json()
        alert(data.error)
      }
    } catch(e) {
      alert('Error de conexión')
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Cargando usuarios...</div>
  if (error) return <div style={{ padding: 20, color: 'red' }}>{error}</div>

  return (
    <div style={{ padding: 20 }}>
      <PageHeader 
        title={<><Users className="text-cyan" size={28} /> Gestión de Accesos</>}
        subtitle="Crea usuarios, revisa las contraseñas, añade roles y otorga permisos especiales."
        showBack={true}
        backFallback="/admin"
        helpContent={
          <div>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Gestión de Usuarios</h4>
            <p style={{ margin: 0, lineHeight: 1.5 }}>Centro de identidades y seguridad. Aquí tienes el control absoluto de quién entra a la plataforma. Puedes dar de alta a nuevos comerciales, bloquear accesos de antiguos empleados, resetear contraseñas olvidadas de forma manual y establecer el nivel jerárquico (Comercial raso, Jefe Tiendas o Administrador).</p>
          </div>
        }
      />

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button 
            onClick={() => handleOpenUserModal()}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}
          >
            <UserPlus size={16} />
            Añadir Usuario
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {users.map(u => (
            <div key={u.username} style={{ backgroundColor: 'var(--active-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <strong style={{ fontSize: 18 }}>{u.username}</strong>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, backgroundColor: 'rgba(0,173,239,0.2)', color: 'var(--mercedes-cyan)', padding: '4px 8px', borderRadius: 6, fontWeight: 'bold' }}>
                    {u.role}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleOpenUserModal(u)} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: 4, opacity: 0.7 }}>
                      <Edit2 size={16} />
                    </button>
                    {u.username !== 'Admin' && (
                      <button onClick={() => handleDeleteUser(u.username)} style={{ background: 'none', border: 'none', color: '#FF453A', cursor: 'pointer', padding: 4, opacity: 0.8 }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 14, color: 'var(--medium-gray)', backgroundColor: 'var(--app-bg)', padding: '8px 12px', borderRadius: 8 }}>
                <KeyRound size={15} />
                <span>Contraseña: </span>
                <strong style={{ color: 'var(--text-color)', letterSpacing: 0.5, marginLeft: 4 }}>{u.password}</strong>
              </div>
              
              <hr style={{ borderColor: 'var(--border-color)', margin: '16px 0' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--medium-gray)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Llaves de Control</span>
                <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 12, backgroundColor: u.permissions === null ? 'var(--app-bg)' : 'rgba(168, 85, 247, 0.1)', color: u.permissions === null ? 'var(--medium-gray)' : '#A855F7', border: `1px solid ${u.permissions === null ? 'var(--border-color)' : 'rgba(168, 85, 247, 0.3)'}` }}>
                  {u.permissions === null ? 'Estado: Heredado del Rol' : 'Estado: Explícito'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Bloque 1: Matriz de Módulos Ver/Editar */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 13, color: 'var(--mercedes-cyan)', marginBottom: 12, borderBottom: '1px solid rgba(0, 173, 239, 0.2)', paddingBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>1. Matriz de Acceso y Modificación</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, maxHeight: 300, overflowY: 'auto', paddingRight: 8 }}>
                    
                    {/* Headers Visivos */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--medium-gray)', fontWeight: 700 }}>MÓDULO DE SISTEMA</span>
                        <div style={{ display: 'flex', gap: 24, paddingRight: 10 }}>
                            <span style={{ fontSize: 11, color: 'var(--medium-gray)', fontWeight: 700, width: 40, textAlign: 'center' }}>VER</span>
                            <span style={{ fontSize: 11, color: 'var(--medium-gray)', fontWeight: 700, width: 60, textAlign: 'center' }}>EDITAR</span>
                        </div>
                    </div>

                    {MODULE_DEFS.map(perm => {
                      const isUnmigrated = u.permissions === null;
                      const activePerms = isUnmigrated ? getDefaultPermissions(u.role) : u.permissions;
                      
                      // Resolutores Granulares Legacy+Modern
                      const hasView = activePerms.includes(`${perm.id}:view`) || activePerms.includes(`${perm.id}:edit`) || activePerms.includes(perm.id) || (perm.id === 'MODULE_TIENDAS' && (activePerms.includes('EDIT_SALES') || activePerms.includes('CREATE_SALES')));
                      
                      let hasEdit = activePerms.includes(`${perm.id}:edit`);
                      if (perm.id === 'MODULE_TIENDAS' && (activePerms.includes('EDIT_SALES') || activePerms.includes('CREATE_SALES'))) hasEdit = true;
                      if (perm.id === 'MANAGE_MAGAZINES' && activePerms.includes('MANAGE_MAGAZINES')) hasEdit = true;
                      if (perm.id === 'MANAGE_CATALOG' && activePerms.includes('MANAGE_CATALOG')) hasEdit = true;
                      if (perm.id === 'MODULE_ADMIN' && activePerms.includes('MODULE_ADMIN')) hasEdit = true;

                      const opacityColor = hasView ? 1 : 0.4;
                      
                      // Manejadores
                      const onToggleView = () => {
                          if (hasView) {
                              // Desactivar ambos
                              const next = activePerms.filter((p: string) => p !== perm.id && p !== `${perm.id}:view` && p !== `${perm.id}:edit` && p !== 'EDIT_SALES' && p !== 'CREATE_SALES');
                              togglePermission(u.username, activePerms, next, u.role);
                          } else {
                              // Solo Ver
                              const next = [...activePerms, `${perm.id}:view`, perm.id]; // Agregamos legacy base y view
                              togglePermission(u.username, activePerms, next, u.role);
                          }
                      };

                      const onToggleEdit = () => {
                          if (hasEdit) {
                              // Quitar Edit, mantener View
                              const next = activePerms.filter((p: string) => p !== `${perm.id}:edit` && p !== 'EDIT_SALES' && p !== 'CREATE_SALES');
                              if (!next.includes(`${perm.id}:view`)) next.push(`${perm.id}:view`);
                              if (!next.includes(perm.id)) next.push(perm.id);
                              togglePermission(u.username, activePerms, next, u.role);
                          } else {
                              // Añadir Edit (y forzar View)
                              const next = [...activePerms, `${perm.id}:edit`, `${perm.id}:view`, perm.id];
                              if (perm.id === 'MODULE_TIENDAS') { next.push('EDIT_SALES'); next.push('CREATE_SALES'); }
                              const uniqueNext = Array.from(new Set(next));
                              togglePermission(u.username, activePerms, uniqueNext, u.role);
                          }
                      };

                      return (
                      <div key={perm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 8, opacity: opacityColor, transition: 'all 0.2s', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontSize: 13, color: hasView ? 'var(--mercedes-cyan)' : 'var(--text-color)', fontWeight: hasView ? 700 : 500 }}>
                          {perm.label} {isUnmigrated && hasView && <span style={{fontSize: 10, color: 'var(--medium-gray)', fontWeight: 400}}>(H)</span>}
                        </span>
                        
                        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40 }}>
                                <input type="checkbox" checked={hasView} onChange={onToggleView} style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--mercedes-cyan)' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 60 }}>
                                <input type="checkbox" checked={hasEdit} onChange={onToggleEdit} style={{ width: 18, height: 18, cursor: hasView ? 'pointer' : 'not-allowed', accentColor: '#A855F7' }} disabled={!hasView} />
                            </div>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>

                {/* Bloque 2: Acciones Extra */}
                <div style={{ gridColumn: '1 / -1', marginTop: 12 }}>
                  <div style={{ fontSize: 13, color: '#A855F7', marginBottom: 12, borderBottom: '1px solid rgba(168, 85, 247, 0.2)', paddingBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>2. Acciones Globales</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, overflowY: 'auto' }}>
                    {EXTRA_ACTION_DEFS.map(perm => {
                      const isUnmigrated = u.permissions === null;
                      const activePerms = isUnmigrated ? getDefaultPermissions(u.role) : u.permissions;
                      const hasPerm = activePerms.includes(perm.id);
                      return (
                      <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 20, cursor: 'pointer', opacity: hasPerm ? 1 : 0.6, border: `1px solid ${hasPerm ? 'rgba(168,85,247,0.4)' : 'transparent'}` }}>
                        <input type="checkbox" checked={hasPerm} onChange={() => togglePermission(u.username, u.permissions, perm.id, u.role)} style={{ accentColor: '#A855F7' }} />
                        <span style={{ fontSize: 12, color: hasPerm ? '#c084fc' : 'var(--text-color)', fontWeight: hasPerm ? 700 : 500 }}>
                          {perm.label} {isUnmigrated && hasPerm && <span style={{fontSize: 9, fontWeight: 400}}>(H)</span>}
                        </span>
                      </label>
                    )})}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showUserModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: 400, maxWidth: '90%', padding: 24, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>{editingUser ? 'Editar Cuenta' : 'Nuevo Usuario'}</h3>
              <button onClick={() => setShowUserModal(false)} style={{ background: 'none', border: 'none', color: 'var(--medium-gray)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--medium-gray)', marginBottom: 6 }}>Nombre de Usuario</label>
              <input 
                type="text" 
                value={userForm.username}
                onChange={e => setUserForm({...userForm, username: e.target.value})}
                placeholder="Ej. Angel"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8,
                  backgroundColor: 'var(--app-bg)', border: '1px solid var(--border-color)',
                  color: 'var(--text-color)', fontSize: 15
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--medium-gray)', marginBottom: 6 }}>Contraseña Secreta</label>
              <input 
                type="text" 
                value={userForm.password}
                onChange={e => setUserForm({...userForm, password: e.target.value})}
                placeholder="Introduce la contraseña"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8,
                  backgroundColor: 'var(--app-bg)', border: '1px solid var(--border-color)',
                  color: 'var(--text-color)', fontSize: 15
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--medium-gray)', marginBottom: 6 }}>Rol Inicial</label>
              
              <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                <select 
                  value={['COMERCIAL', 'JEFE DE VENTAS', 'BACK OFFICE', 'ADMIN'].includes(userForm.role) ? userForm.role : 'CUSTOM'}
                  onChange={e => {
                    if (e.target.value === 'CUSTOM') {
                      setUserForm({...userForm, role: ''})
                    } else {
                      setUserForm({...userForm, role: e.target.value})
                    }
                  }}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8,
                    backgroundColor: 'var(--app-bg)', border: '1px solid var(--border-color)',
                    color: 'var(--text-color)', fontSize: 15, appearance: 'none'
                  }}
                >
                  <option value="COMERCIAL">COMERCIAL (Estándar)</option>
                  <option value="JEFE DE VENTAS">JEFE DE VENTAS</option>
                  <option value="BACK OFFICE">BACK OFFICE</option>
                  <option value="ADMIN">ADMINISTRADOR</option>
                  <option value="CUSTOM">Otro (Personalizado)...</option>
                </select>

                {!['COMERCIAL', 'JEFE DE VENTAS', 'BACK OFFICE', 'ADMIN'].includes(userForm.role) && (
                  <input 
                    type="text" 
                    value={userForm.role}
                    onChange={e => setUserForm({...userForm, role: e.target.value.toUpperCase()})}
                    placeholder="Escribe el nuevo rol (Ej. SUPERVISOR)"
                    autoFocus
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 8,
                      backgroundColor: 'var(--dark-gray)', border: '1px solid var(--mercedes-cyan)',
                      color: 'var(--mercedes-cyan)', fontSize: 15, fontWeight: 'bold'
                    }}
                  />
                )}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--medium-gray)', marginBottom: 6 }}>Código del COMERCIAL</label>
              <input 
                type="text" 
                value={userForm.codigoComercial}
                onChange={e => setUserForm({...userForm, codigoComercial: e.target.value})}
                placeholder="Ej. AV12345"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8,
                  backgroundColor: 'var(--app-bg)', border: '1px solid var(--border-color)',
                  color: 'var(--text-color)', fontSize: 15
                }}
              />
            </div>

            <button 
              onClick={handleSaveUser}
              className="btn btn-primary"
              style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 'bold' }}
            >
              Guardar Usuario
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
