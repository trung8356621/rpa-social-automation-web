import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * DEV-only proxy for same-origin relative staff API paths.
 * Does not invent auth: production session cookie is host-scoped to SEO-OPS
 * (Secure + SameSite=Lax). Cross-origin cookie sharing remains blocked without
 * same-origin static hosting or an owner-approved cookie bridge.
 * Never log Cookie / Set-Cookie headers.
 */
const seoOpsProxyTarget =
  process.env.VITE_RPA_DEV_PROXY_TARGET?.trim() ||
  'https://seo-ops.duckdns.org'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/social-automation/api': {
        target: seoOpsProxyTarget,
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
