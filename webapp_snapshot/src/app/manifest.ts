import type { MetadataRoute } from 'next'

// Web App Manifest: hace la app instalable desde Chrome (escritorio y móvil)
// con su icono, nombre y colores propios, como una app nativa.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MicroShop Tiendas',
    short_name: 'MicroShop',
    description: 'Sistema Profesional de Gestión de Ventas',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0F19',
    theme_color: '#0B0F19',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
