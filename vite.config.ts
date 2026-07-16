import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

// The Electron build reuses this same config (vite build --outDir dist-electron-app).
// A registered service worker would persist forever in Electron's session storage
// (the same persistent partition that keeps the user logged in across restarts) and
// silently keep serving a stale cached build after every later `electron:build`,
// which is exactly the kind of "looks like my code change never happened" bug a
// desktop app with its own auto-updater doesn't need - so skip the PWA plugin for it.
const isElectronBuild = process.env.ELECTRON_BUILD === 'true'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    watch: {
      ignored: ['**/dist-electron-app/**', '**/release/**'],
    },
    fs: {
      deny: ['**/dist-electron-app/**', '**/release/**'],
    },
  },
  optimizeDeps: {
    // Only scan the web entry — not dist-electron-app/index.html from electron:build.
    entries: ['./index.html'],
  },
  plugins: [
    react(),
    ...(isElectronBuild ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'NOVAT – AI Project Management',
        short_name: 'NOVAT',
        description: 'Tasks, calendar, projects and team collaboration in one premium workspace.',
        theme_color: '#6B21A8',
        background_color: '#0B0720',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'de',
        icons: [
          { src: '/icons/icon-72.png', sizes: '72x72', type: 'image/png' },
          { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        screenshots: [
          { src: '/icons/screenshot-mobile.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'NOVAT auf dem Handy' },
          { src: '/icons/screenshot-desktop.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'NOVAT auf dem Desktop' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5000000,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
            },
          },
        ],
      },
    })]),
  ],
})
