import type { Metadata, Viewport } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { ThemeProvider } from '@/components/ThemeProvider'
import { MobileMenu } from '@/components/MobileMenu'
import { PeriodProvider } from '@/components/PeriodProvider'
import ClientTracker from '@/components/ClientTracker'

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
              <ClientTracker />
              <div className="app-container">
                <Sidebar />
                <main className="main-content">
                  <div className="topbar">
                    <MobileMenu />
                    <span style={{ fontWeight: 800, fontSize: 18 }}>MicroShop <span style={{ color: 'var(--mercedes-cyan)' }}>Tiendas</span></span>
                  </div>
                  {children}
                </main>
              </div>
          </PeriodProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
