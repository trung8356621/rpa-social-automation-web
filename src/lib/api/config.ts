export type RpaApiMode = 'mock' | 'live'

/**
 * Staff API mode. Default mock — other routes stay mock until approved.
 * Never put secrets in VITE_* variables.
 */
export function getRpaApiMode(): RpaApiMode {
  const raw = (import.meta.env.VITE_RPA_API_MODE as string | undefined)
    ?.trim()
    .toLowerCase()
  return raw === 'live' ? 'live' : 'mock'
}

/**
 * API origin for staff session routes.
 * Empty = same-origin (production static under SEO-OPS, or Vite proxy in DEV).
 * Absolute URL only for explicit same-site setups — cross-origin cookies will not work
 * with production SameSite=Lax + CORS allowlist (localhost:3000 only as of CP9A probe).
 */
export function getRpaApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_RPA_API_BASE as string | undefined)?.trim()
  if (!raw || raw === '/') return ''
  return raw.replace(/\/$/, '')
}

export const RPA_API_TIMEOUT_MS = 20_000

export const ACTION_REGISTRY_PATHS = {
  data: '/social-automation/api/action-registry/data',
  authenticationScripts:
    '/social-automation/api/action-registry/authentication-scripts',
} as const
