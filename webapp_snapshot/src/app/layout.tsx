import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import { ThemeProvider } from '@/components/ThemeProvider'
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
                  <span style={{ fontWeight: 800, fontSize: 18 }}>MicroShop <span style={{ color: 'var(--mercedes-cyan)' }}>Tiendas</span></span>
                </div>
                {children}
              </main>
              <BottomNav />
            </div>
          </PeriodProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
