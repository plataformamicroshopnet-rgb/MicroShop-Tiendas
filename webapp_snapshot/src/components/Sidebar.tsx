'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Smartphone, Building2, LogOut, Settings, Archive, List, Briefcase, BookOpen, Euro, LineChart, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import './Sidebar.css'
import { can } from '@/lib/permissions'

export default function Sidebar() {
  const pathname = usePathname()

  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (pathname !== '/login') {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.authenticated) {
            console.log('--- USER IN SIDEBAR ---')
            console.log('session.user:', data.user)
            console.log('session.user.role:', data.user.role)
            console.log('session.user.permissions:', data.user.permissions)
            console.log('session.user.codigoComercial:', data.user.codigoComercial)
            setUser(data.user)
          }
        })
    }
  }, [pathname])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    sessionStorage.clear()
    window.location.href = '/login'
  }

  type NavItem = {
    name: string;
    href: string;
    icon: any;
    permission: string;
  }

  const navItems: NavItem[] = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, permission: 'MODULE_FFVV' },
    { name: 'Tiendas Hub', href: '/ffvv', icon: Briefcase, permission: 'MODULE_FFVV' },
    { name: 'Jefe Tiendas', href: '/seguimiento-ventas', icon: LineChart, permission: 'MODULE_JEFE_FFVV' },
    { name: 'Back Office', href: '/back-office', icon: FolderOpen, permission: 'MODULE_BACK_OFFICE' },
    { name: 'Liquidaciones', href: '/liquidacion', icon: Euro, permission: 'MODULE_LIQUIDACION' },
    { name: 'Dirección Tiendas', href: '/direccion-ffvv', icon: Building2, permission: 'MODULE_DIRECCION' },
    { name: 'Admin', href: '/admin', icon: Settings, permission: 'MODULE_ADMIN' },
  ]

  if (pathname === '/login') return null

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>MicroShop <span className="text-cyan">Tiendas</span></h2>
      </div>
      <nav className="sidebar-nav">
        {navItems.filter(item => {
          if (!user) return true;
          return can(user, item.permission);
        }).map((item) => {
          const Icon = item.icon
          const isActive = item.href === '/seguimiento-ventas'
            ? pathname.startsWith('/seguimiento-ventas')
            : pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>
      <div className="sidebar-footer">
        {user && (
          <div style={{ padding: '0 16px 16px 16px', color: 'var(--medium-gray)', fontSize: 13 }}>
            Logueado como: <strong style={{color: 'var(--light-text)'}}>{user.username}</strong>
            <div style={{fontSize: 10, marginTop: 4}}>{user.role}</div>
          </div>
        )}
        <button onClick={handleLogout} className="sidebar-link logout-btn">
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  )
}
