import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { createDevProxy } from './config/dev-proxy.ts'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Production asset prefix for same-origin SEO-OPS hosting.
 * DEV default `/` keeps localhost:5173 unchanged.
 * Production build example: VITE_RPA_ASSET_BASE=/build-rpa-web/
 * Must NOT overlap `/social-automation/api/` or `/social-automation/script-media/`.
 */
const assetBase = (() => {
  const raw = process.env.VITE_RPA_ASSET_BASE?.trim()
  if (!raw || raw === '/') return '/'
  return raw.endsWith('/') ? raw : `${raw}/`
})()

export default defineConfig(({ command }) => {
  const isDevServe = command === 'serve'

  return {
    base: assetBase,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
    build: {
      manifest: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    // DEV proxy is serve-only. Production `vite build` must not register it.
    server: isDevServe
      ? {
          port: 5173,
          strictPort: true,
          proxy: createDevProxy(),
        }
      : undefined,
  }
})
