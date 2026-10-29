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

const ACTION_REGISTRY_BASE = '/social-automation/api/action-registry'

export const ACTION_REGISTRY_PATHS = {
  data: `${ACTION_REGISTRY_BASE}/data`,
  authenticationScripts: `${ACTION_REGISTRY_BASE}/authentication-scripts`,
  sites: `${ACTION_REGISTRY_BASE}/sites`,
  site: (id: number) => `${ACTION_REGISTRY_BASE}/sites/${id}`,
  paths: `${ACTION_REGISTRY_BASE}/paths`,
  path: (id: number) => `${ACTION_REGISTRY_BASE}/paths/${id}`,
  tags: `${ACTION_REGISTRY_BASE}/tags`,
  tag: (id: number) => `${ACTION_REGISTRY_BASE}/tags/${id}`,
  tagAuthPin: (id: number) => `${ACTION_REGISTRY_BASE}/tags/${id}/auth-pin`,
  tagRequests: (id: number) => `${ACTION_REGISTRY_BASE}/tags/${id}/requests`,
} as const

const SCRIPT_REGISTRY_BASE = '/social-automation/api/script-registry'

/** Staff Session Script Registry (read-only). Path `{id}` = package_key. */
export const SCRIPT_REGISTRY_PATHS = {
  list: SCRIPT_REGISTRY_BASE,
  detail: (packageKey: string) =>
    `${SCRIPT_REGISTRY_BASE}/${encodeURIComponent(packageKey)}`,
} as const

const ACCOUNTS_BASE = '/social-automation/api/accounts'

/** Staff Session Accounts inventory (CP13 LIVE is read-only). */
export const ACCOUNTS_PATHS = {
  list: ACCOUNTS_BASE,
  account: (id: number) => `${ACCOUNTS_BASE}/${id}`,
} as const
