/**
 * Isolated Online / Offline / Unknown fixtures (imported by docs / reviews).
 * Executable check: `node scripts/verify-cp15b-browser-map.mjs`
 */

import type { LiveBrowserItem } from './live-types'
import {
  mapLiveBrowserItem,
  mapOnlinePresence,
} from './map-browser'

function baseRow(
  overrides: Partial<LiveBrowserItem> &
    Pick<LiveBrowserItem, 'browser_id' | 'is_online' | 'runtime_status'>,
): LiveBrowserItem {
  return {
    username: 'demo_user',
    account_name: 'Demo Account',
    account_id: 1,
    account_uuid: 'acc_demo',
    platform: 'wordpress',
    client_id: 10,
    client_api_key_id: 10,
    machine_name: 'DESKTOP-QA',
    last_seen_at: '2026-10-29T04:00:00Z',
    ...overrides,
  }
}

export const FIXTURE_ONLINE = baseRow({
  browser_id: 'brw_online',
  runtime_status: 'running',
  is_online: true,
})

export const FIXTURE_OFFLINE = baseRow({
  browser_id: 'brw_offline',
  runtime_status: 'stopped',
  is_online: false,
  username: null,
  account_name: null,
})

export const FIXTURE_UNKNOWN = baseRow({
  browser_id: 'brw_unknown',
  runtime_status: 'unknown_stale',
  is_online: null,
  machine_name: null,
})

export const ONLINE_STATUS_CASES = [
  { is_online: true as const, expect: 'online' as const },
  { is_online: false as const, expect: 'offline' as const },
  { is_online: null, expect: 'unknown' as const },
] as const

export function sampleMappedFixtures() {
  return {
    online: mapLiveBrowserItem(FIXTURE_ONLINE),
    offline: mapLiveBrowserItem(FIXTURE_OFFLINE),
    unknown: mapLiveBrowserItem(FIXTURE_UNKNOWN),
    presence: ONLINE_STATUS_CASES.map((c) => ({
      ...c,
      mapped: mapOnlinePresence(c.is_online),
    })),
  }
}
