'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import { NAV_ITEMS, estaActivo } from '@/components/navItems'
import { can } from '@/lib/permissions'
import './MobileMenu.css'

/**
 * El menú del móvil: tres rayitas que despliegan un panel con todo.
 *
 * Sustituye a la barra inferior, que tenía dos problemas: solo cabían seis de
 * las nueve opciones y las otras tres había que buscarlas arrastrando el dedo,
 * y sobre todo NO HABÍA DÓNDE CERRAR SESIÓN — ese botón vivía únicamente en el
 * menú lateral, que en el móvil está oculto.
 *
 * Solo existe por debajo de 768 px; de ahí para arriba lo esconde el CSS y
 * manda el carril lateral de siempre.
 */
export function MobileMenu() {
  const pathname = usePathname()
  const [abierto, setAbierto] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (pathname === '/login') return
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => { if (d.authenticated) setUser(d.user) })
      .catch(() => {})
  }, [pathname])

  // Al cambiar de página el panel se cierra solo. Sin esto se queda abierto
  // encima del sitio al que acabas de ir.
  useEffect(() => { setAbierto(false) }, [pathname])

  useEffect(() => {
    if (!abierto) return
    const alPulsarTecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    addEventListener('keydown', alPulsarTecla)
    // OJO: aquí NO vale el truco de siempre de bloquear el body. En este
    // programa quien scrollea es .main-content (globals.css), el body no se
    // mueve, así que hay que bloquear ese.
    const principal = document.querySelector('.main-content') as HTMLElement | null
    const antes = principal?.style.overflow
    if (principal) principal.style.overflow = 'hidden'
    return () => {
      removeEventListener('keydown', alPulsarTecla)
      if (principal) principal.style.overflow = antes || ''
    }
  }, [abierto])


  if (pathname === '/login') return null

  const visibles = NAV_ITEMS.filter((i) => can(user, i.permission))

  const salir = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    sessionStorage.clear()
    window.location.href = '/login'
  }

  return (
    <>
      <button
        type="button"
        className="menu-movil-boton"
        aria-label={abierto ? 'Cerrar el menú' : 'Abrir el menú'}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        {abierto ? <X size={22} /> : <Menu size={22} />}
      </button>

      {abierto && (
        <>
          <div className="menu-movil-velo" onClick={() => setAbierto(false)} aria-hidden="true" />
          <nav className="menu-movil-panel" aria-label="Menú principal">
            <ul>
              {visibles.map((i) => {
                const Icono = i.icon
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      className={estaActivo(i.href, pathname) ? 'activo' : ''}
                      onClick={() => setAbierto(false)}
                    >
                      <Icono size={19} />
                      <span>{i.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="menu-movil-pie">
              {user && (
                <p className="quien">
                  <b>{user.username || user.name}</b>
                  {user.role && <span>{user.role}</span>}
                </p>
              )}
              <button type="button" onClick={salir}>
                <LogOut size={18} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </nav>
        </>
      )}
    </>
  )
}
