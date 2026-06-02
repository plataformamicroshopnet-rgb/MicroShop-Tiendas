'use client'

import { useState, useEffect, useMemo } from 'react'
import { Shield, Moon, Sun, Users, Database, CalendarCheck, FileEdit, Info, Briefcase, BookOpen, CalendarDays, Smartphone, Menu, Cloud, Settings, Settings2, ArrowUp, ArrowDown, Save, X, Activity, TrendingUp, Landmark, Calculator } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGuard } from '@/hooks/useGuard'
import { can } from '@/lib/permissions'
import { PageHeader } from '@/components/PageHeader'

export default function AdminDashboardPage() {
  const { authorized, user } = useGuard('MODULE_ADMIN')
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  const cards = [
    // --- GRUPO CIAN ---
    {
      title: 'Entrada de Datos',
      description: 'Editar catálogos de precios, cuotas y objetivos.',
      icon: FileEdit,
      action: () => router.push('/catalogos'),
      color: 'rgba(0,173,239,0.1)',
      textColor: 'var(--mercedes-cyan)',
      permission: 'MANAGE_CATALOG',
      colorGroup: 'cyan'
    },
    {
      title: 'Control de Caja',
      description: 'Gestión de entradas, salidas y trazabilidad de efectivo.',
      icon: Calculator,
      action: () => router.push('/tiendas/caja'),
      color: 'rgba(0,173,239,0.1)',
      textColor: 'var(--mercedes-cyan)',
      permission: 'CARD_CAJA',
      colorGroup: 'cyan'
    },

    // --- GRUPO NARANJA ---
    {
      title: 'Condiciones, Comisiones Extras del mes y Penalizaciones',
      description: 'Escribir condiciones, notas y comisiones estra para el mes en curso.',
      icon: FileEdit,
      action: () => router.push('/admin/condiciones-mensuales'),
      color: 'rgba(249,115,22,0.1)',
      textColor: '#f97316',
      permission: 'MODULE_ADMIN',
      colorGroup: 'orange'
    },
    {
      title: 'Ganancias MicroShop',
      description: 'Dashboard Financiero Macro e Histórico (2011 - 2026).',
      icon: TrendingUp,
      action: () => router.push('/admin/ganancias'),
      color: 'rgba(249,115,22,0.1)',
      textColor: '#f97316',
      colorGroup: 'orange'
    },
    {
      title: 'Préstamos, Créditos e Hipotecas',
      description: 'Dashboard Retrospectivo de Patrimonio (2008 - 2026).',
      icon: Landmark,
      action: () => router.push('/admin/prestamos'),
      color: 'rgba(249,115,22,0.1)',
      textColor: '#f97316',
      colorGroup: 'orange'
    },

    // --- GRUPO VERDE ---
    {
      title: 'Gestión de Periodos Operativos',
      description: 'Control estructural de meses DRAFT, ACTIVE e HISTORIC.',
      icon: CalendarDays,
      action: () => router.push('/admin/periodos'),
      color: 'rgba(91,197,0,0.1)',
      textColor: '#5bc500',
      permission: 'MODULE_ADMIN',
      colorGroup: 'green'
    },
    {
      title: 'Gestión de Usuarios',
      description: 'Crear perfiles, restablecer contraseñas y asignar permisos.',
      icon: Users,
      action: () => router.push('/admin/usuarios'),
      color: 'rgba(91,197,0,0.1)',
      textColor: '#5bc500',
      colorGroup: 'green'
    },
    {
      title: 'Google Drive Backups',
      description: 'Copias de seguridad autónomas en la nube.',
      icon: Cloud,
      action: () => router.push('/admin/cloud-backup'),
      color: 'rgba(91,197,0,0.1)',
      textColor: '#5bc500',
      colorGroup: 'green'
    },
    {
      title: 'Trazabilidad y Accesos',
      description: 'Auditoría en tiempo real de navegación de usuarios.',
      icon: Activity,
      action: () => router.push('/admin/tracking'),
      color: 'rgba(91,197,0,0.1)',
      textColor: '#5bc500',
      permission: 'MODULE_ADMIN',
      colorGroup: 'green'
    }
  ]

  const permittedCards = useMemo(() => {
     return cards.filter((c: any) => !c.permission || can(user, c.permission));
  }, [cards, user])

  const sortedCards = useMemo(() => {
    const groupOrder: Record<string, number> = { cyan: 1, orange: 2, green: 3 };
    return [...permittedCards].sort((a, b) => groupOrder[a.colorGroup] - groupOrder[b.colorGroup]);
  }, [permittedCards])

  if (authorized === null) {
    return <div style={{ paddingTop: 40, paddingRight: 40, paddingBottom: 40, paddingLeft: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>;
  }

  return (
    <div className="w-full" style={{ paddingTop: 12, paddingRight: 32, paddingBottom: 100, paddingLeft: 32, backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .premium-card {
            background-color: var(--bg-card);
            border-radius: 12px;
            padding: 16px 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 1px solid var(--border-strong);
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 16px;
            min-height: 92px;
        }
        .premium-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.08);
            border-color: #3b82f6;
        }
        .card-icon-wrapper {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .card-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-main);
            margin: 0;
            line-height: 1.25;
            letter-spacing: -0.2px;
        }
        .card-desc {
            font-size: 12px;
            color: var(--text-muted);
            line-height: 1.4;
            margin: 0;
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
        />
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        marginTop: '16px'
      }}>
        {['cyan', 'orange', 'green'].map(groupKey => {
          const groupCards = sortedCards.filter(c => c.colorGroup === groupKey);
          if (groupCards.length === 0) return null;

          const groupTitle = groupKey === 'cyan' 
            ? 'CONFIGURACIÓN Y OPERACIONES'
            : groupKey === 'orange'
            ? 'FINANZAS, PATRIMONIO Y NOTAS'
            : 'GESTIÓN, SEGURIDAD Y ACCESOS';

          const groupColor = groupKey === 'cyan'
            ? 'var(--mercedes-cyan)'
            : groupKey === 'orange'
            ? '#f97316'
            : '#5bc500';

          return (
            <div key={groupKey} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 8
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: groupColor }} />
                <h4 style={{
                  color: groupColor,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.8px',
                  margin: 0
                }}>
                  {groupTitle}
                </h4>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '16px'
              }}>
                {groupCards.map((c: any) => {
                  const Icon = c.icon;
                  return (
                    <div
                      key={c.title}
                      className="premium-card"
                      onClick={c.action}
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        backgroundColor: c.bgColorOverride || undefined,
                        color: c.textColorOverride || undefined,
                        borderColor: c.bgColorOverride ? 'transparent' : undefined
                      }}
                    >
                      <div className="card-icon-wrapper" style={{ backgroundColor: c.iconBgOverride || c.color, color: c.iconColorOverride || c.textColor, flexShrink: 0 }}>
                        <Icon size={20} strokeWidth={2.5} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                        <h3 className="card-title" style={{ color: c.textColorOverride || undefined }}>
                          {c.title}
                        </h3>
                        <p className="card-desc" style={{ color: c.textMutedOverride || undefined }}>
                          {c.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )
}
