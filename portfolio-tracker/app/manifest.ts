import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Portfolio Tracker',
    short_name: 'Portfolio',
    description: 'Suivi de portefeuille personnel',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#FFF1C9',
    theme_color: '#FFF1C9',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
