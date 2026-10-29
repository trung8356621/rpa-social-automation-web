/** Live Staff Session GET /social-automation/api/browsers */

export type LiveBrowserRuntimeStatus =
  | 'running'
  | 'stopped'
  | 'error'
  | 'crashed'
  | 'unknown_stale'

export type LiveBrowserItem = {
  browser_id: string
  browser_name?: string
  browser_label?: string
  username?: string | null
  account_name?: string | null
  account_id?: number | null
  account_uuid?: string | null
  platform?: string
  site_url?: string | null
  client_id?: number | null
  client_api_key_id?: number | null
  machine_name?: string | null
  device_id?: string | null
  runtime_status: LiveBrowserRuntimeStatus | string
  reported_status?: string
  /** true=Online, false=Offline, null=Unknown — backend source of truth */
  is_online: boolean | null
  device_online?: boolean
  last_seen_at?: string | null
  device_heartbeat_at?: string | null
  session_state?: string
  signal_status?: string
  last_task_at?: string | null
}

export type LiveBrowserSummary = {
  total_browsers: number
  online_browsers: number
  offline_browsers: number
  total_clients: number
}

export type LiveBrowserStatusPolicy = {
  source: string
  heartbeat_ttl_seconds: number
  notes?: string | null
}

export type LiveBrowsersListResponse = {
  ok?: boolean
  browsers: LiveBrowserItem[]
  summary: LiveBrowserSummary
  status_policy: LiveBrowserStatusPolicy
}
