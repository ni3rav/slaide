import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'android-chrome-192x192.png',
        'android-chrome-512x512.png',
      ],
      manifest: {
        name: 'Slaide',
        short_name: 'Slaide',
        description: 'Local-first presentation editor',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Collect candidates broadly, then keep only the Home shell
        // referenced by index.html. Editor/Excalidraw chunks cache on use.
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff2,woff,webmanifest}',
        ],
        navigateFallback: '/index.html',
        skipWaiting: false,
        clientsClaim: true,
        manifestTransforms: [
          async (entries) => {
            const indexHtml = fs.readFileSync(
              path.resolve(rootDir, 'dist/index.html'),
              'utf8',
            )
            const referenced = new Set(
              [...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
                (match) => match[1]!.replace(/^\//, ''),
              ),
            )

            const manifest = entries.filter((entry) => {
              const url = entry.url.replace(/^\//, '')
              if (referenced.has(url)) return true
              if (url === 'index.html' || url.endsWith('.webmanifest')) {
                return true
              }
              if (/\.(ico|png|svg|woff2?)$/.test(url)) return true
              if (url.includes('workbox-window')) return true
              return false
            })

            return { manifest, warnings: [] }
          },
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/assets/') &&
              url.pathname.endsWith('.js'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'slaide-asset-js',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
})
