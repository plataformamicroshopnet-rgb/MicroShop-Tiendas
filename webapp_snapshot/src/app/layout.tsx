import type { Metadata, Viewport } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import { ThemeProvider } from '@/components/ThemeProvider'
import { PeriodProvider } from '@/components/PeriodProvider'
import ClientTracker from '@/components/ClientTracker'
import { AuditProvider } from '@/hooks/useAuditMode'
import { AuditDrawer } from '@/components/AuditDrawer'

export const metadata: Metadata = {
  title: 'MicroShop Tiendas',
  description: 'Sistema Profesional de Gestión de Ventas',
  icons: {
    icon: '/icon.png?v=darkblue',
    apple: '/apple-icon.png?v=darkblue',
  },
  appleWebApp: {
    title: 'MicroShop',
    capable: true,
    statusBarStyle: 'black-translucent',
  },
}

// Viewport móvil + color de barra del navegador (PWA)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0F19',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <ThemeProvider>
          <PeriodProvider>
            <AuditProvider>
              <ClientTracker />
              <div className="app-container">
                <Sidebar />
                <main className="main-content">
                  <div className="topbar">
                    <span style={{ fontWeight: 800, fontSize: 18 }}>MicroShop <span style={{ color: 'var(--mercedes-cyan)' }}>Tiendas</span></span>
                  </div>
                  {children}
                </main>
                <BottomNav />
              </div>
              <AuditDrawer />
            </AuditProvider>
          </PeriodProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
