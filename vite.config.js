import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Nourish/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
  name: 'Nourish',
  short_name: 'Nourish',
  description: 'Intermittent fasting, weight & period tracker',
  theme_color: '#fdf0f0',
  background_color: '#fdf0f0',
  display: 'standalone',
  orientation: 'portrait',
  scope: '/Nourish/',
  start_url: '/Nourish/',
  icons: [...]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ]
      }
    })
  ]
})
