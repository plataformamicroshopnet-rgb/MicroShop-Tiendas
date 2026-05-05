'use client'

import { useState, useEffect, useMemo } from 'react'
import { Shield, Moon, Sun, Users, Database, CalendarCheck, FileEdit, Info, Briefcase, BookOpen, CalendarDays, Smartphone, Menu, Cloud, Settings, Settings2, ArrowUp, ArrowDown, Save, X, Activity } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGuard } from '@/hooks/useGuard'
import { can } from '@/lib/permissions'
import { PageHeader } from '@/components/PageHeader'

export default function AdminDashboardPage() {
  const { authorized, user } = useGuard('MODULE_ADMIN')
  const { theme, toggleTheme } = useTheme()
  const [resetting, setResetting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  const [isEditMode, setIsEditMode] = useState(false)
  const [cardOrder, setCardOrder] = useState<string[]>([])

  useEffect(() => {
    const savedOrder = localStorage.getItem('admin_panel_card_order')
    if (savedOrder) {
      try { setCardOrder(JSON.parse(savedOrder)) } catch (e) {}
    }
  }, [])

  // El proceso de Cierre Destructivo fue deprecado a favor de las directrices 'ACTIVE'/'HISTORIC'.

  const cards = [
    {
      title: 'Condiciones y Extras Tiendas',
      description: 'Configurar tabla de objetivos, comisiones y KPIs extendidos',
      icon: Briefcase,
      action: () => router.push('/admin/condiciones-plus'),
      color: 'rgba(0,173,239,0.1)',
      textColor: 'var(--mercedes-cyan)',
      permission: 'MANAGE_CATALOG'
    },
    {
      title: 'Condiciones, Comisiones Extras del mes y Penalizaciones',
      description: 'Escribir condiciones, notas y comisiones estra para el mes en curso.',
      icon: FileEdit,
      action: () => router.push('/admin/condiciones-mensuales'),
      color: 'rgba(245, 158, 11, 0.1)',
      textColor: '#f59e0b',
      permission: 'MODULE_ADMIN'
    },
    {
      title: 'Extras Plus y Básico',
      description: 'Configurar cruces automáticos de productos y comisiones extras.',
      icon: Settings,
      action: () => router.push('/admin/extras'),
      color: 'rgba(0,173,239,0.1)',
      textColor: 'var(--mercedes-cyan)',
      permission: 'MODULE_ADMIN'
    },
    {
      title: 'Gestión de Periodos Operativos',
      description: 'Control estructural de meses DRAFT, ACTIVE e HISTORIC.',
      icon: CalendarDays,
      action: () => router.push('/admin/periodos'),
      color: 'rgba(52, 199, 89, 0.1)',
      textColor: '#34C759',
      permission: 'MODULE_ADMIN'
    },
    {
      title: 'Gestión de Usuarios',
      description: 'Crear perfiles, restablecer contraseñas y asignar permisos.',
      icon: Users,
      action: () => router.push('/admin/usuarios'),
      color: 'rgba(0,173,239,0.1)',
      textColor: 'var(--mercedes-cyan)'
    },
    {
      title: 'Copias de Seguridad',
      description: 'Descargar o restaurar la base de datos Excel.',
      icon: Database,
      action: () => router.push('/admin/backup'),
      color: 'rgba(52, 199, 89, 0.1)',
      textColor: '#34C759'
    },
    {
      title: 'Google Drive Backups',
      description: 'Copias de seguridad autónomas en la nube.',
      icon: Cloud,
      action: () => router.push('/admin/cloud-backup'),
      color: 'rgba(37, 99, 235, 0.1)',
      textColor: '#2563eb'
    },
    {
      title: 'Revista Corporativa',
      description: 'Subir y administrar el historial de revistas premium.',
      icon: BookOpen,
      action: () => router.push('/admin/revistas'),
      color: 'rgba(59, 130, 246, 0.1)',
      textColor: '#3b82f6',
      permission: 'MANAGE_MAGAZINES'
    },
    {
      title: 'Catálogo Dispositivos',
      description: 'Publicar catálogos en formato apaisado.',
      icon: Smartphone,
      action: () => router.push('/admin/catalogos-movistar'),
      color: 'rgba(16, 185, 129, 0.1)',
      textColor: '#10b981',
      permission: 'MANAGE_MAGAZINES'
    },
    {
      title: 'Dosier Empresas',
      description: 'Administrar dosieres corporativos B2B.',
      icon: Briefcase,
      action: () => router.push('/admin/dosier-empresas'),
      color: 'rgba(245, 158, 11, 0.1)',
      textColor: '#f59e0b',
      permission: 'MANAGE_MAGAZINES'
    },
    {
      title: 'Trazabilidad y Accesos',
      description: 'Auditoría en tiempo real de navegación de usuarios.',
      icon: Activity,
      action: () => router.push('/admin/tracking'),
      color: 'rgba(236, 72, 153, 0.1)',
      textColor: '#ec4899',
      permission: 'MODULE_ADMIN'
    },
    {
      title: theme === 'dark' ? 'Modo Día' : 'Modo Noche',
      description: 'Cambiar el tema visual de la plataforma.',
      icon: theme === 'dark' ? Sun : Moon,
      action: toggleTheme,
      color: 'rgba(255, 149, 0, 0.1)',
      textColor: '#FF9500'
    },
    {
      title: 'Entrada de Datos',
      description: 'Editar catálogos de precios, cuotas y objetivos.',
      icon: FileEdit,
      action: () => router.push('/catalogos'),
      color: 'rgba(175, 82, 222, 0.1)',
      textColor: '#AF52DE',
      permission: 'MANAGE_CATALOG'
    }
  ]

  const permittedCards = useMemo(() => {
     return cards.filter((c: any) => !c.permission || can(user, c.permission));
  }, [cards, user])

  const sortedCards = useMemo(() => {
    if (cardOrder.length === 0) return permittedCards;
    return [...permittedCards].sort((a, b) => {
      const indexA = cardOrder.indexOf(a.title);
      const indexB = cardOrder.indexOf(b.title);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });
  }, [permittedCards, cardOrder])

  const moveCard = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sortedCards.length - 1) return;

    const newSorted = [...sortedCards];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newSorted[index];
    newSorted[index] = newSorted[swapIndex];
    newSorted[swapIndex] = temp;

    setCardOrder(newSorted.map(c => c.title));
  }

  const saveOrder = () => {
    const currentOrder = cardOrder.length > 0 ? cardOrder : permittedCards.map(c => c.title);
    localStorage.setItem('admin_panel_card_order', JSON.stringify(currentOrder));
    setIsEditMode(false);
  }

  const cancelEdit = () => {
    const savedOrder = localStorage.getItem('admin_panel_card_order')
    if (savedOrder) setCardOrder(JSON.parse(savedOrder))
    else setCardOrder([])
    setIsEditMode(false)
  }

  if (authorized === null) {
    return <div style={{ paddingTop: 40, paddingRight: 40, paddingBottom: 40, paddingLeft: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>;
  }

  return (
    <div className="w-full" style={{ paddingTop: 12, paddingRight: 32, paddingBottom: 100, paddingLeft: 32, backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .premium-card {
            background-color: var(--bg-card);
            border-radius: 16px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 1px solid var(--border-strong);
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .premium-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 24px rgba(0,0,0,0.10);
            border-color: #3b82f6;
        }
        .card-icon-wrapper {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .card-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-main);
            margin: 0 0 6px 0;
            line-height: 1.25;
            letter-spacing: -0.3px;
        }
        .card-desc {
            font-size: 14px;
            color: var(--text-muted);
            line-height: 1.45;
            margin: 0;
        }

        @keyframes wiggle {
            0% { transform: rotate(0deg); }
            25% { transform: rotate(-0.5deg); }
            50% { transform: rotate(0deg); }
            75% { transform: rotate(0.5deg); }
            100% { transform: rotate(0deg); }
        }
        .wiggle-mode {
            animation: wiggle 0.4s infinite;
            border: 2px dashed #3b82f6 !important;
        }

        /* Hero Card Específica */
        .hero-card {
            grid-column: 1 / -1;
            order: -1;
            padding: 16px 20px;
        }
        .hero-card .card-icon-wrapper {
            width: 44px;
            height: 44px;
            border-radius: 12px;
        }
        .hero-card .card-title {
            font-size: 18px;
        }
        .hero-card .card-desc {
            font-size: 14px;
        }
        
        @media (min-width: 640px) {
            .hero-card {
                flex-direction: row;
                align-items: center;
                gap: 20px;
                padding: 18px 24px;
            }
        }
      `}} />

      {/* HEADER LOCAL */}
      <div className="md:hidden" style={{ display: 'flex', alignItems: 'center', marginBottom: 0 }}>
        <button
          onClick={() => setMenuOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Abrir Menú Móvil"
        >
          <Menu size={28} color="var(--text-main)" strokeWidth={2} />
        </button>
      </div>

      <div
        onClick={() => setMenuOpen(false)}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: menuOpen ? "rgba(0,0,0,0.3)" : "transparent",
          pointerEvents: menuOpen ? "auto" : "none",
          transition: "background-color 0.25s ease",
          zIndex: 999
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 220,
            height: "100%",
            background: "var(--bg-card)",
            color: "var(--text-main)",
            padding: 20,
            borderRight: "1px solid var(--border-strong)",
            boxShadow: "2px 0 10px rgba(0,0,0,0.1)",
            transform: menuOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.25s ease",
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}
        >
          <h3 style={{ color: '#00ADEF', marginTop: 0 }}>Menú</h3>

          {[
            { name: 'Inicio', href: '/', permission: 'MODULE_TIENDAS' },
            { name: 'Tiendas Hub', href: '/tiendas', permission: 'MODULE_TIENDAS' },
            { name: 'Jefe Tiendas', href: '/seguimiento-ventas', permission: 'MODULE_JEFE_TIENDAS' },
            { name: 'Back Office', href: '/back-office', permission: 'MODULE_BACK_OFFICE' },
            { name: 'Liquidaciones', href: '/liquidacion', permission: 'MODULE_LIQUIDACION' },
            { name: 'Dirección Tiendas', href: '/direccion-tiendas', permission: 'MODULE_DIRECCION' },
            { name: 'Admin', href: '/admin', permission: 'MODULE_ADMIN' },
          ].map((item) => {
            if (user && !can(user, item.permission)) return null;
            return (
              <button
                key={item.href}
                style={{ padding: "12px 16px", borderRadius: 10, background: "var(--bg-input)", color: "var(--text-main)", border: "1px solid var(--border-light)", textAlign: "left", fontSize: 16 }}
                onClick={() => { setMenuOpen(false); router.push(item.href); }}
              >
                {item.name}
              </button>
            );
          })}

          <button
            onClick={() => setMenuOpen(false)}
            style={{ padding: "12px 16px", borderRadius: 10, background: "transparent", color: "var(--text-main)", border: "1px solid var(--border-strong)", textAlign: "left", fontSize: 16, marginTop: 20 }}
          >
            Cerrar
          </button>
        </div>
      </div>

      <div style={{ marginBottom: -8 }}>
        <PageHeader 
          title={<><Shield className="text-cyan" size={28} /> Panel de Administración</>}
          subtitle="Centro de control y configuración del punto de venta."
          showBack={true}
          helpContent={
            <div>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Panel de Administración</h4>
              <p style={{ margin: 0, lineHeight: 1.5 }}>Panel central de administración. Desde aquí puedes acceder a la configuración de Periodos, Mapeo de Catálogos, Tablas de Comisiones base, y gestión de Usuarios. Solo usuarios con rol ADMIN tienen acceso.</p>
            </div>
          }
          headerActions={
            isEditMode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={cancelEdit} title="Cancelar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={20} />
                </button>
                <button onClick={saveOrder} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 40, borderRadius: 20, background: '#10b981', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}>
                    <Save size={18} /> Guardar Orden
                </button>
              </div>
            ) : (
                <button onClick={() => { setIsEditMode(true); if(cardOrder.length === 0) setCardOrder(permittedCards.map((c:any)=>c.title)); }} title="Personalizar Orden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                    <Settings2 size={20} />
                </button>
            )
          }
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
        marginTop: '8px'
      }}>
        {sortedCards.map((c: any, i) => {
          const Icon = c.icon
          const isHero = c.title === 'Gestión de Periodos Operativos'

          return (
            <div
              key={c.title}
              className={`premium-card ${isHero ? 'hero-card' : ''} ${isEditMode ? 'wiggle-mode' : ''}`}
              onClick={isEditMode ? undefined : c.action}
              style={{ position: 'relative', cursor: isEditMode ? 'default' : 'pointer' }}
            >
              {isEditMode && (
                <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 4, background: 'var(--bg-card)', padding: 4, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid var(--border-light)' }}>
                  <button onClick={(e) => { e.stopPropagation(); moveCard(i, 'up') }} disabled={i === 0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: i === 0 ? 'transparent' : 'var(--bg-input)', color: i === 0 ? 'var(--border-strong)' : 'var(--text-main)', cursor: i === 0 ? 'not-allowed' : 'pointer' }}>
                    <ArrowUp size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); moveCard(i, 'down') }} disabled={i === sortedCards.length - 1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: i === sortedCards.length - 1 ? 'transparent' : 'var(--bg-input)', color: i === sortedCards.length - 1 ? 'var(--border-strong)' : 'var(--text-main)', cursor: i === sortedCards.length - 1 ? 'not-allowed' : 'pointer' }}>
                    <ArrowDown size={16} />
                  </button>
                </div>
              )}
              <div className="card-icon-wrapper" style={{ backgroundColor: c.color, color: c.textColor }}>
                <Icon size={isHero ? 26 : 22} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="card-title">
                  {c.title}
                </h3>
                <p className="card-desc">
                  {c.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
