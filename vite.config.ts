import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon-32.png',
        'logo-light.png',
        'logo-dark.png',
        'apple-touch-icon.png',
        'pwa-192.png',
        'pwa-512.png',
        'pwa-512-maskable.png',
        'google-oauth.json',
      ],
      manifest: {
        name: 'MaintManage',
        short_name: 'MaintManage',
        description: 'Gestión de mantenimiento preventivo y reparaciones',
        theme_color: '#0f766e',
        background_color: '#0f766e',
        display: 'standalone',
        orientation: 'any',
        lang: 'es',
        start_url: './',
        scope: './',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2,woff}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})
