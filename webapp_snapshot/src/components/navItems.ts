import {
  LayoutDashboard, Smartphone, Building2, Settings, Briefcase,
  BookOpen, Euro, LineChart, FolderOpen,
} from 'lucide-react'

/**
 * LA lista del menú. Una sola, para todo el programa.
 *
 * Estaba copiada en TRES sitios —el menú lateral, la barra inferior y un cajón
 * suelto de /admin— y las tres se habían separado ya: la de /admin se había
 * quedado en seis entradas y le faltaban MovilFree, Dirección Tiendas y
 * Cristina Admin. La barra inferior, además, pedía otro permiso para «Inicio»,
 * así que a un usuario sin el módulo de Tiendas el móvil le escondía la
 * portada mientras el escritorio se la enseñaba.
 *
 * `corto` es la etiqueta para sitios estrechos; donde quepa se usa `name`.
 */
export type NavItem = {
  name: string
  corto?: string
  href: string
  icon: any
  permission: string
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', corto: 'Inicio', href: '/', icon: LayoutDashboard, permission: 'VIEW_DASHBOARD' },
  { name: 'Tiendas Hub', corto: 'Tiendas', href: '/tiendas', icon: Briefcase, permission: 'MODULE_TIENDAS' },
  { name: 'Ventas MovilFree', corto: 'MovilFree', href: '/movilfree', icon: Smartphone, permission: 'MODULE_MOVILFREE' },
  { name: 'Dirección Tiendas', corto: 'Dirección', href: '/direccion-tiendas', icon: Building2, permission: 'MODULE_DIRECCION' },
  { name: 'Jefe Tiendas', corto: 'Jefe', href: '/seguimiento-ventas', icon: LineChart, permission: 'MODULE_JEFE_TIENDAS' },
  { name: 'Back Office', corto: 'Back Office', href: '/back-office', icon: FolderOpen, permission: 'MODULE_BACK_OFFICE' },
  { name: 'Liquidaciones', corto: 'Liquidac.', href: '/liquidacion', icon: Euro, permission: 'MODULE_LIQUIDACION' },
  { name: 'Cristina Admin', corto: 'Cristina', href: '/cristina-admin', icon: BookOpen, permission: 'MODULE_CRISTINA' },
  { name: 'Admin', corto: 'Admin', href: '/admin', icon: Settings, permission: 'MODULE_ADMIN' },
]

/**
 * Si una ruta es «donde estoy». El «/» de la portada se compara exacto: con
 * `startsWith` salía resaltado en TODAS las páginas, que es lo que hacía la
 * barra inferior. La excepción es /seguimiento-ventas, que tiene subpáginas.
 */
export function estaActivo(href: string, rutaActual: string): boolean {
  if (href === '/') return rutaActual === '/'
  if (href === '/seguimiento-ventas') return rutaActual.startsWith('/seguimiento-ventas')
  return rutaActual === href
}
