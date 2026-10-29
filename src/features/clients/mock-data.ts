import type {
  BrowserInventoryItem,
  ClientsInventoryData,
  OnlineClientNoBrowser,
} from './types'

/**
 * Fixed fixtures — Checkpoint 6 scenarios (not random):
 * 1. WordPress Browser Running
 * 2. Facebook Browser Running
 * 3. Client Online / no Browser Running
 * 4. Browser Stopped
 * 5. Client heartbeat Stale
 * 6. Browser Session Unknown
 */

function withLiveCompat(
  row: Omit<
    BrowserInventoryItem,
    | 'runtime_status'
    | 'is_online'
    | 'online_presence'
    | 'client_id'
    | 'machine_name'
    | 'account_id'
    | 'last_seen_at'
  >,
): BrowserInventoryItem {
  const isOnline = row.browser_state === 'running'
  return {
    ...row,
    account_id: null,
    runtime_status: row.browser_state === 'running' ? 'running' : 'stopped',
    is_online: isOnline,
    online_presence: isOnline ? 'online' : 'offline',
    client_id: row.client_api_key_id,
    machine_name: row.device_hostname,
    last_seen_at: row.heartbeat_at,
  }
}

export const MOCK_BROWSERS: BrowserInventoryItem[] = [
  withLiveCompat({
    id: 'brw-wp-running',
    username: 'wp_admin_seo',
    account_name: 'SEO Ops WordPress',
    account_uuid: 'acc_wp_01_seo_long_id_wrap_check_aabbccddeeff',
    platform: 'wordpress',
    site_url:
      'https://blog.example.com/wp-admin/edit.php?post_type=page&page=seo-ops-long-path-for-drawer-wrap-check',
    browser_id: 'brw_wp_01',
    partition_ref: 'persist:acc_wp_01_seo:partition_long_ref_for_wrap_check',
    browser_state: 'running',
    client_api_key_id: 1,
    client_label: 'Office Desktop Client',
    device_hostname: 'DESKTOP-HJ2LKRD',
    connection: 'online',
    lease_status: 'valid',
    heartbeat_at: '2026-10-28T11:48:00Z',
    heartbeat_stale: false,
    session_signal: 'verified',
    signal_checked_at: '2026-10-28T11:40:00Z',
    execution_state: 'idle',
    last_script_ref: 'wordpress.publish_post',
    last_task_at: '2026-10-28T10:15:00Z',
  }),
  withLiveCompat({
    id: 'brw-fb-running',
    username: 'fb.ops.main',
    account_name: 'Facebook Ops Main',
    account_uuid: 'acc_fb_02_main',
    platform: 'facebook',
    site_url: 'https://www.facebook.com',
    browser_id: 'brw_fb_02',
    partition_ref: 'persist:acc_fb_02_main',
    browser_state: 'running',
    client_api_key_id: 1,
    client_label: 'Office Desktop Client',
    device_hostname: 'DESKTOP-HJ2LKRD',
    connection: 'online',
    lease_status: 'valid',
    heartbeat_at: '2026-10-28T11:48:00Z',
    heartbeat_stale: false,
    session_signal: 'needs_login',
    signal_checked_at: '2026-10-28T11:30:00Z',
    execution_state: 'failed',
    last_script_ref: 'facebook.post_status',
    last_task_at: '2026-10-28T11:20:00Z',
  }),
  withLiveCompat({
    id: 'brw-stopped',
    username: 'shop_editor',
    account_name: 'Shop CMS Editor',
    account_uuid: 'acc_wp_03_shop',
    platform: 'wordpress',
    site_url: 'https://shop.example.com/wp-admin',
    browser_id: 'brw_wp_03',
    partition_ref: 'persist:acc_wp_03_shop',
    browser_state: 'stopped',
    client_api_key_id: 1,
    client_label: 'Office Desktop Client',
    device_hostname: 'DESKTOP-HJ2LKRD',
    connection: 'online',
    lease_status: 'valid',
    heartbeat_at: '2026-10-28T11:48:00Z',
    heartbeat_stale: false,
    session_signal: 'absent',
    signal_checked_at: '2026-10-27T18:00:00Z',
    execution_state: 'idle',
    last_script_ref: null,
    last_task_at: '2026-10-27T17:55:00Z',
  }),
  withLiveCompat({
    id: 'brw-stale-hb',
    username: 'stage.fb.bot',
    account_name: 'Staging Facebook',
    account_uuid: 'acc_fb_04_stage',
    platform: 'facebook',
    site_url: 'https://www.facebook.com',
    browser_id: 'brw_fb_04',
    partition_ref: 'persist:acc_fb_04_stage',
    browser_state: 'running',
    client_api_key_id: 2,
    client_label: 'Staging Laptop',
    device_hostname: 'LAPTOP-STAGE-01',
    connection: 'online',
    lease_status: 'valid',
    heartbeat_at: '2026-10-28T07:00:00Z',
    heartbeat_stale: true,
    session_signal: 'present',
    signal_checked_at: '2026-10-28T06:55:00Z',
    execution_state: 'unknown',
    last_script_ref: 'facebook.auth_check',
    last_task_at: '2026-10-28T06:50:00Z',
  }),
  withLiveCompat({
    id: 'brw-session-unknown',
    username: null,
    account_name: 'Legacy LinkedIn',
    account_uuid: 'acc_li_05_legacy',
    platform: 'linkedin',
    site_url: 'https://www.linkedin.com',
    browser_id: 'brw_li_05',
    partition_ref: 'persist:acc_li_05_legacy',
    browser_state: 'running',
    client_api_key_id: 2,
    client_label: 'Staging Laptop',
    device_hostname: 'LAPTOP-STAGE-01',
    connection: 'online',
    lease_status: 'valid',
    heartbeat_at: '2026-10-28T07:00:00Z',
    heartbeat_stale: true,
    session_signal: 'unknown',
    signal_checked_at: null,
    execution_state: 'idle',
    last_script_ref: null,
    last_task_at: null,
  }),
]

export const MOCK_ONLINE_CLIENTS_NO_BROWSER: OnlineClientNoBrowser[] = [
  {
    id: 'cli-online-idle',
    client_api_key_id: 3,
    client_label: 'Ops Notebook',
    device_hostname: 'NOTEBOOK-OPS-02',
    connection: 'online',
    lease_status: 'valid',
    heartbeat_at: '2026-10-28T11:45:00Z',
    heartbeat_stale: false,
  },
]

function mockSummary(
  browsers: BrowserInventoryItem[],
): NonNullable<ClientsInventoryData['summary']> {
  let online = 0
  let offline = 0
  const clients = new Set<number>()
  for (const b of browsers) {
    if (b.is_online === true) online += 1
    else if (b.is_online === false) offline += 1
    if (b.client_api_key_id != null) clients.add(b.client_api_key_id)
  }
  return {
    total_browsers: browsers.length,
    online_browsers: online,
    offline_browsers: offline,
    total_clients: clients.size,
  }
}

export const MOCK_CLIENTS_DATA: ClientsInventoryData = {
  browsers: MOCK_BROWSERS,
  online_clients_no_browser: MOCK_ONLINE_CLIENTS_NO_BROWSER,
  summary: mockSummary(MOCK_BROWSERS),
  status_policy: null,
}

export const EMPTY_CLIENTS_DATA: ClientsInventoryData = {
  browsers: [],
  online_clients_no_browser: [],
  summary: {
    total_browsers: 0,
    online_browsers: 0,
    offline_browsers: 0,
    total_clients: 0,
  },
  status_policy: null,
}
