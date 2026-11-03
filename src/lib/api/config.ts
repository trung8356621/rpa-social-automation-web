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

/**
 * Staff Session Accounts inventory.
 * GET list / POST create (staffAccountsStore) / PUT+DELETE on `{id}`.
 * Create/Update/Delete require Owner/Admin (assertCanManageAccounts).
 */
export const ACCOUNTS_PATHS = {
  list: ACCOUNTS_BASE,
  account: (id: number) => `${ACCOUNTS_BASE}/${id}`,
} as const

const CLIENT_API_KEYS_BASE = '/social-automation/api/client-keys'

/** Staff Session Client API Keys (CP14 LIVE is read-only list). */
export const CLIENT_API_KEYS_PATHS = {
  list: CLIENT_API_KEYS_BASE,
  revoke: (id: number) => `${CLIENT_API_KEYS_BASE}/${id}/revoke`,
} as const

const BROWSERS_BASE = '/social-automation/api/browsers'

/** Staff Session Browser-first inventory (CP15B LIVE is read-only). */
export const BROWSERS_PATHS = {
  list: BROWSERS_BASE,
} as const

const STAFF_CLIENT_CONNECTION_BASE =
  '/social-automation/api/staff/client-connection'

/**
 * Staff Client enrollment (CP17A @48b84aa).
 * GET issues bootstrap when not connected (zero DB writes). Do not invent Create Key.
 */
export const STAFF_CLIENT_CONNECTION_PATHS = {
  connection: STAFF_CLIENT_CONNECTION_BASE,
  disconnect: `${STAFF_CLIENT_CONNECTION_BASE}/disconnect`,
} as const

/** Owner/Admin successful Client connection inventory (CP17A). */
export const OWNER_CLIENT_CONNECTIONS_PATHS = {
  list: '/social-automation/api/owner/client-connections',
} as const

/** Backend-documented localStorage key for temporary Staff bootstrap. */
export const STAFF_CLIENT_BOOTSTRAP_LOCALSTORAGE_KEY =
  'sa_staff_client_bootstrap_v1' as const

/**
 * Staff Session UI bootstrap (CP17B.3+).
 * Returns authenticated user id, name, role — not RPA Admin Bearer session.
 */
export const STAFF_SESSION_BOOTSTRAP_PATH =
  '/api/social-automation/bootstrap' as const

const CAMPAIGNS_BASE = '/social-automation/api/campaigns'
const CAMPAIGN_CONTENTS_BASE = '/social-automation/api/campaign-contents'

/** Staff Session Campaigns (CP19A/B). Production mutations require explicit approval. */
export const CAMPAIGN_PATHS = {
  list: CAMPAIGNS_BASE,
  detail: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}`,
  start: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}/start`,
  pause: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}/pause`,
  resume: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}/resume`,
  cancel: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}/cancel`,
} as const

/** Admin Campaign Content actions (CP19A/B). Manual CRUD awaits CP19C OpenAPI. */
export const CAMPAIGN_CONTENT_PATHS = {
  retry: (id: string) =>
    `${CAMPAIGN_CONTENTS_BASE}/${encodeURIComponent(id)}/retry`,
  skip: (id: string) =>
    `${CAMPAIGN_CONTENTS_BASE}/${encodeURIComponent(id)}/skip`,
  cancel: (id: string) =>
    `${CAMPAIGN_CONTENTS_BASE}/${encodeURIComponent(id)}/cancel`,
} as const
