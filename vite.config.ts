import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/icon-192.svg', 'icons/icon-512.svg', 'icons/icon-maskable-512.svg'],
      manifest: {
        name: 'mediRem — Your medication, on time.',
        short_name: 'mediRem',
        description: 'Privacy-first, offline-first medication reminders and health tracking. Data stays on this device.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FAF8F4',
        theme_color: '#7D9B87',
        categories: ['health', 'medical', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-maskable-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App-shell offline-first; runtime cache for local fonts only (no health data leaves device)
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
      devOptions: { enabled: false },
    }),
  ],
})
