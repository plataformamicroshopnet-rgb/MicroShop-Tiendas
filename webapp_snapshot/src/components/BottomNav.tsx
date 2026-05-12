'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Smartphone, Building2, Settings, Archive, List, Briefcase, LineChart, FolderOpen, Euro } from 'lucide-react'
import { useEffect, useState } from 'react'
import './BottomNav.css'
import { can } from '@/lib/permissions'

export default function BottomNav() {
  const pathname = usePathname()

  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (pathname !== '/login') {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.authenticated) {
            console.log('--- USER IN BOTTOMNAV ---')
            console.log('session.user:', data.user)
            console.log('session.user.role:', data.user.role)
            console.log('session.user.permissions:', data.user.permissions)
            console.log('session.user.codigoComercial:', data.user.codigoComercial)
            setUser(data.user)
          }
        })
    }
  }, [pathname])

  type NavItem = {
    name: string;
    href: string;
    icon: any;
    permission: string;
    matchPaths?: string[];
  }

  const navItems: NavItem[] = [
    { name: 'Inicio', href: '/', icon: LayoutDashboard, permission: 'MODULE_TIENDAS', matchPaths: ['/'] },
    { name: 'Tiendas Hub', href: '/tiendas', icon: Briefcase, permission: 'MODULE_TIENDAS', matchPaths: ['/tiendas'] },
    { name: 'Jefe Tiendas', href: '/seguimiento-ventas', icon: LineChart, permission: 'MODULE_JEFE_TIENDAS', matchPaths: ['/seguimiento-ventas'] },
    { name: 'Back Office', href: '/back-office', icon: FolderOpen, permission: 'MODULE_BACK_OFFICE', matchPaths: ['/back-office'] },
    { name: 'Liquidaciones', href: '/liquidacion', icon: Euro, permission: 'MODULE_LIQUIDACION', matchPaths: ['/liquidacion'] },
    { name: 'Admin', href: '/admin', icon: Settings, permission: 'MODULE_ADMIN', matchPaths: ['/admin'] },
  ]

  if (pathname === '/login') return null

  return (
    <nav className="bottom-nav">
      {navItems.filter(item => !user || can(user, item.permission)).map((item) => {
        const Icon = item.icon
        const isActive = item.matchPaths
          ? item.matchPaths.some(path => pathname === path || pathname.startsWith(path))
          : pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={24} className="bottom-nav-icon" />
            <span className="bottom-nav-label">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
