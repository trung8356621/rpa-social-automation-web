/**
 * Clients (Browser-first) — Checkpoint 6 mock types.
 *
 * Contract classification (see docs/CLIENTS_READ_ONLY_AUDIT_2026-10-28.md):
 * - CONFIRMED: evidenced in Filament device-group / agents blades or docs
 * - MOCK ONLY: presentation for Control Center; no staff REST field yet
 * - MISSING CONTRACT: needed by Design Language; not verified on staff API
 * - DERIVED: computed from other mock fields with explicit rule
 *
 * Do not invent staff endpoints. Live wiring waits for owner-approved contract.
 */

/** CONFIRMED shape intent from device-group online flags + Agents online_state */
export type ClientConnectionState = 'online' | 'offline'

/**
 * Runtime browser instance state for ops inventory.
 * CONFIRMED concept via device-group `$device['browsers'][]` presence;
 * exact enum values are MOCK ONLY until staff REST confirms.
 */
export type BrowserRuntimeState = 'running' | 'stopped'

/**
 * Session Signal taxonomy.
 * CONFIRMED blade values: verified / needs_login / candidate + signal_present.
 * `unknown` / `absent` are MOCK presentation for missing/clear signal.
 */
export type SessionSignalState =
  | 'unknown'
  | 'absent'
  | 'present'
  | 'needs_login'
  | 'verified'
  | 'candidate'

/**
 * Execution Confirmation — MISSING as first-class staff field.
 * `last_task_at` exists in blade (Partial); status enum is MOCK ONLY.
 */
export type ExecutionState =
  | 'idle'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'unknown'

export type LeaseStatus = 'none' | 'valid' | 'expired'

/**
 * One Browser row in the operational inventory.
 * Primary UI title = username (Design Language); Account Name = secondary.
 */
export type BrowserInventoryItem = {
  /** Stable mock row id — not a production PK */
  id: string

  // —— Identity ——
  /**
   * PRIMARY card title (Design Language).
   * MISSING CONTRACT on staff browser payload (device-group titles use account_name).
   * MOCK ONLY until Username field is confirmed on inventory API.
   */
  username: string | null
  /** CONFIRMED: `$browser['account_name']` */
  account_name: string
  /** Partial: Account ID binding — mock uses account_uuid style */
  account_uuid: string
  /** CONFIRMED: `$browser['platform']` */
  platform: string
  /** CONFIRMED: `$browser['site_url']` */
  site_url: string | null

  // —— Browser ——
  /** CONFIRMED: `$browser['browser_id']` */
  browser_id: string
  /** MOCK ONLY — partition/runtime reference for drawer */
  partition_ref: string | null
  /** MOCK ONLY enum — runtime state for ops list */
  browser_state: BrowserRuntimeState

  // —— Logical Client / device metadata ——
  /** CONFIRMED identity: client_api_key_id / sa_client_api_keys.id */
  client_api_key_id: number
  /** MOCK ONLY display label from key name (not identity) */
  client_label: string
  /** CONFIRMED as metadata: device hostname / display_name — not identity */
  device_hostname: string | null
  /** Partial / MOCK: connection presence for staff UI snapshot */
  connection: ClientConnectionState
  /** MOCK ONLY — lease not on staff keys index JSON */
  lease_status: LeaseStatus
  /** MOCK ONLY — heartbeat timestamp */
  heartbeat_at: string | null
  /** DERIVED/MOCK: stale when heartbeat older than ops threshold */
  heartbeat_stale: boolean

  // —— Session ——
  /** CONFIRMED concept; values mapped from blade session_state + signal_present */
  session_signal: SessionSignalState
  /** CONFIRMED: `$browser['signal_checked_at']` */
  signal_checked_at: string | null

  // —— Execution ——
  /** MOCK ONLY / MISSING CONTRACT as first-class confirm */
  execution_state: ExecutionState
  /** MOCK ONLY script package/ref when last run known */
  last_script_ref: string | null
  /** Partial: `$browser['last_task_at']` */
  last_task_at: string | null
}

/**
 * Logical Client online with zero running browsers.
 * Connection ≠ Browser Running.
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
}

export type DemoScenario = 'default' | 'loading' | 'empty' | 'error'
