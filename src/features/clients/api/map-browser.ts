import type {
  BrowserInventoryItem,
  BrowserInventorySummary,
  BrowserOnlinePresence,
  BrowserRuntimeStatus,
  BrowserStatusPolicy,
  ClientsInventoryData,
  SessionSignalState,
} from '../types'
import type {
  LiveBrowserItem,
  LiveBrowserStatusPolicy,
  LiveBrowserSummary,
  LiveBrowsersListResponse,
} from './live-types'

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function asNullableInt(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

/** Backend is_online → UI Online / Offline / Unknown. Never invent. */
export function mapOnlinePresence(
  isOnline: boolean | null | undefined,
): BrowserOnlinePresence {
  if (isOnline === true) return 'online'
  if (isOnline === false) return 'offline'
  return 'unknown'
}

export function mapRuntimeStatus(raw: unknown): BrowserRuntimeStatus {
  const value = typeof raw === 'string' ? raw.trim() : ''
  switch (value) {
    case 'running':
    case 'stopped':
    case 'error':
    case 'crashed':
    case 'unknown_stale':
      return value
    default:
      return 'unknown_stale'
  }
}

function mapSessionSignal(raw: unknown): SessionSignalState {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  switch (value) {
    case 'verified':
      return 'verified'
    case 'needs_login':
      return 'needs_login'
    case 'candidate':
      return 'candidate'
    case 'present':
      return 'present'
    case 'absent':
      return 'absent'
    case 'unknown':
      return 'unknown'
    default:
      return 'unknown'
  }
}

/**
 * Map one Staff browser row → Browser-first UI model.
 * Identity = browser_id. Online presence from is_online only.
 */
export function mapLiveBrowserItem(item: LiveBrowserItem): BrowserInventoryItem {
  const browserId = String(item.browser_id ?? '').trim()
  const onlinePresence = mapOnlinePresence(item.is_online)
  const runtimeStatus = mapRuntimeStatus(item.runtime_status)
  const machineName = asNullableString(item.machine_name)
  const clientId =
    asNullableInt(item.client_id) ?? asNullableInt(item.client_api_key_id)
  const accountName = asNullableString(item.account_name) ?? ''
  const accountUuid = asNullableString(item.account_uuid) ?? ''
  const lastSeen = asNullableString(item.last_seen_at)
  const heartbeat = asNullableString(item.device_heartbeat_at)

  return {
    id: browserId,
    browser_id: browserId,
    username: asNullableString(item.username),
    account_name: accountName,
    account_uuid: accountUuid,
    account_id: asNullableInt(item.account_id),
    platform: asNullableString(item.platform) ?? 'unknown',
    site_url: asNullableString(item.site_url),
    partition_ref: null,
    browser_state: onlinePresence === 'online' ? 'running' : 'stopped',
    runtime_status: runtimeStatus,
    is_online: item.is_online === true ? true : item.is_online === false ? false : null,
    online_presence: onlinePresence,
    client_api_key_id: clientId,
    client_id: clientId,
    client_label: clientId != null ? `Client #${clientId}` : 'Client unknown',
    machine_name: machineName,
    device_hostname: machineName,
    connection: onlinePresence === 'online' ? 'online' : 'offline',
    lease_status: 'none',
    heartbeat_at: heartbeat ?? lastSeen,
    heartbeat_stale: false,
    last_seen_at: lastSeen,
    session_signal: mapSessionSignal(item.signal_status ?? item.session_state),
    signal_checked_at: null,
    execution_state: 'unknown',
    last_script_ref: null,
    last_task_at: asNullableString(item.last_task_at),
  }
}

export function mapLiveBrowserSummary(
  summary: LiveBrowserSummary | null | undefined,
): BrowserInventorySummary {
  return {
    total_browsers: Number(summary?.total_browsers ?? 0) || 0,
    online_browsers: Number(summary?.online_browsers ?? 0) || 0,
    offline_browsers: Number(summary?.offline_browsers ?? 0) || 0,
    total_clients: Number(summary?.total_clients ?? 0) || 0,
  }
}

export function mapLiveStatusPolicy(
  policy: LiveBrowserStatusPolicy | null | undefined,
): BrowserStatusPolicy | null {
  if (!policy || typeof policy !== 'object') return null
  const source = asNullableString(policy.source) ?? 'backend'
  const ttl = Number(policy.heartbeat_ttl_seconds)
  return {
    source,
    heartbeat_ttl_seconds: Number.isFinite(ttl) ? ttl : 0,
    notes: asNullableString(policy.notes),
  }
}

/**
 * Map Staff inventory response. Empty browsers[] is a valid LIVE result.
 * Never invent rows. Never fall back to mock.
 */
export function mapLiveBrowsersResponse(
  payload: LiveBrowsersListResponse,
): ClientsInventoryData {
  const rows = Array.isArray(payload.browsers) ? payload.browsers : []
  return {
    browsers: rows.map(mapLiveBrowserItem),
    online_clients_no_browser: [],
    summary: mapLiveBrowserSummary(payload.summary),
    status_policy: mapLiveStatusPolicy(payload.status_policy),
  }
}
