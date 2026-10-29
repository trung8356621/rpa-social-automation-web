/**
 * Clients (Browser-first) — mock + LIVE Staff inventory types.
 *
 * LIVE source: GET /social-automation/api/browsers
 * Online presence = backend `is_online` only (true|false|null).
 */

/** MOCK Client connection; LIVE prefers `online_presence` from is_online. */
export type ClientConnectionState = 'online' | 'offline'

/** Backend is_online mapped for UI: true→online, false→offline, null→unknown */
export type BrowserOnlinePresence = 'online' | 'offline' | 'unknown'

/**
 * MOCK ops filter (running|stopped).
 * LIVE cards also carry `runtime_status` from backend.
 */
export type BrowserRuntimeState = 'running' | 'stopped'

/** Staff OpenAPI runtime_status enum */
export type BrowserRuntimeStatus =
  | 'running'
  | 'stopped'
  | 'error'
  | 'crashed'
  | 'unknown_stale'

/**
 * Session Signal taxonomy.
 * CONFIRMED blade values: verified / needs_login / candidate + signal_present.
 * `unknown` / `absent` cover missing/clear signal.
 */
export type SessionSignalState =
  | 'unknown'
  | 'absent'
  | 'present'
  | 'needs_login'
  | 'verified'
  | 'candidate'

/**
 * Execution Confirmation — not first-class on staff browsers inventory.
 * LIVE maps to `unknown`.
 */
export type ExecutionState =
  | 'idle'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'unknown'

export type LeaseStatus = 'none' | 'valid' | 'expired'

export type BrowserInventorySummary = {
  total_browsers: number
  online_browsers: number
  offline_browsers: number
  total_clients: number
}

export type BrowserStatusPolicy = {
  source: string
  heartbeat_ttl_seconds: number
  notes: string | null
}

/**
 * One Browser row in the operational inventory.
 * Primary UI title = username (Design Language); Account Name = secondary.
 * Identity (LIVE) = browser_id.
 */
export type BrowserInventoryItem = {
  /** Row key — LIVE uses browser_id */
  id: string

  // —— Identity ——
  /** PRIMARY card title. Null → neutral fallback in browserTitle(). */
  username: string | null
  /** Secondary label; may be empty string when API null */
  account_name: string
  /** Account UUID when joined; empty string when null */
  account_uuid: string
  /** Staff account_id (nullable) */
  account_id: number | null
  platform: string
  site_url: string | null

  // —— Browser ——
  /** PRIMARY identity (session_uuid) */
  browser_id: string
  /** MOCK ONLY — partition/runtime reference for drawer */
  partition_ref: string | null
  /**
   * MOCK ops grouping (running|stopped).
   * LIVE: derived for filters — online→running, else stopped.
   * Prefer `online_presence` / `runtime_status` for status display in LIVE.
   */
  browser_state: BrowserRuntimeState
  /** Staff runtime_status */
  runtime_status: BrowserRuntimeStatus
  /** Staff is_online — source of truth (null = Unknown) */
  is_online: boolean | null
  online_presence: BrowserOnlinePresence

  // —— Logical Client / device metadata ——
  /** Logical Client = client_api_key_id (nullable on LIVE) */
  client_api_key_id: number | null
  client_id: number | null
  /** Display label (MOCK key name / LIVE fallback Client #id) */
  client_label: string
  /** Staff machine_name — small secondary tag */
  machine_name: string | null
  /** MOCK hostname; LIVE mirrors machine_name */
  device_hostname: string | null
  /** MOCK connection flag */
  connection: ClientConnectionState
  lease_status: LeaseStatus
  heartbeat_at: string | null
  heartbeat_stale: boolean
  last_seen_at: string | null

  // —— Session ——
  session_signal: SessionSignalState
  signal_checked_at: string | null

  // —— Execution ——
  execution_state: ExecutionState
  last_script_ref: string | null
  last_task_at: string | null
}

/**
 * Logical Client online with zero running browsers (MOCK).
 * LIVE staff browsers response does not include this list → always [].
 */
export type OnlineClientNoBrowser = {
  id: string
  client_api_key_id: number
  client_label: string
  device_hostname: string | null
  connection: 'online'
  lease_status: LeaseStatus
  heartbeat_at: string | null
  heartbeat_stale: boolean
}

export type ClientsInventoryData = {
  browsers: BrowserInventoryItem[]
  online_clients_no_browser: OnlineClientNoBrowser[]
  summary: BrowserInventorySummary | null
  status_policy: BrowserStatusPolicy | null
}

export type DemoScenario = 'default' | 'loading' | 'empty' | 'error'
