/**
 * Isolated Online/Offline/Unknown + summary fixture checks for CP15B.
 * Mirrors src/features/clients/api/map-browser.ts semantics (no mock fallback).
 */

function mapOnlinePresence(isOnline) {
  if (isOnline === true) return 'online'
  if (isOnline === false) return 'offline'
  return 'unknown'
}

function mapItem(item) {
  const presence = mapOnlinePresence(item.is_online)
  return {
    id: String(item.browser_id),
    browser_id: String(item.browser_id),
    username: item.username ?? null,
    account_name: item.account_name == null || item.account_name === ''
      ? ''
      : String(item.account_name),
    machine_name: item.machine_name ?? null,
    is_online:
      item.is_online === true ? true : item.is_online === false ? false : null,
    online_presence: presence,
    browser_state: presence === 'online' ? 'running' : 'stopped',
  }
}

function mapResponse(payload) {
  const browsers = (payload.browsers ?? []).map(mapItem)
  return {
    browsers,
    online_clients_no_browser: [],
    summary: {
      total_browsers: Number(payload.summary?.total_browsers ?? 0) || 0,
      online_browsers: Number(payload.summary?.online_browsers ?? 0) || 0,
      offline_browsers: Number(payload.summary?.offline_browsers ?? 0) || 0,
      total_clients: Number(payload.summary?.total_clients ?? 0) || 0,
    },
    status_policy: payload.status_policy ?? null,
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(mapOnlinePresence(true) === 'online', 'true → online')
assert(mapOnlinePresence(false) === 'offline', 'false → offline')
assert(mapOnlinePresence(null) === 'unknown', 'null → unknown')
assert(mapOnlinePresence(undefined) === 'unknown', 'undefined → unknown')

const online = mapItem({
  browser_id: 'brw_online',
  runtime_status: 'running',
  is_online: true,
  username: 'demo_user',
  account_name: 'Demo',
  machine_name: 'DESKTOP-QA',
})
assert(online.online_presence === 'online' && online.is_online === true, 'ONLINE row')
assert(online.machine_name === 'DESKTOP-QA', 'machine_name')

const offline = mapItem({
  browser_id: 'brw_offline',
  runtime_status: 'stopped',
  is_online: false,
  username: null,
  account_name: null,
})
assert(offline.online_presence === 'offline' && offline.is_online === false, 'OFFLINE row')
assert(offline.username === null, 'username null')
assert(offline.account_name === '', 'account_name null → ""')

const unknown = mapItem({
  browser_id: 'brw_unknown',
  runtime_status: 'unknown_stale',
  is_online: null,
})
assert(unknown.online_presence === 'unknown' && unknown.is_online === null, 'UNKNOWN row')
assert(unknown.browser_state !== 'running', 'unknown not running')

const mixed = mapResponse({
  ok: true,
  browsers: [
    { browser_id: 'a', is_online: true, runtime_status: 'running' },
    { browser_id: 'b', is_online: false, runtime_status: 'stopped' },
    { browser_id: 'c', is_online: null, runtime_status: 'unknown_stale' },
  ],
  summary: {
    total_browsers: 3,
    online_browsers: 1,
    offline_browsers: 1,
    total_clients: 1,
  },
  status_policy: { source: 'backend', heartbeat_ttl_seconds: 90 },
})
assert(mixed.summary.online_browsers === 1, 'summary online')
assert(mixed.summary.offline_browsers === 1, 'summary offline excludes unknown')
assert(mixed.summary.total_browsers === 3, 'summary total')
assert(mixed.online_clients_no_browser.length === 0, 'no invented idle clients')
assert(mixed.status_policy.heartbeat_ttl_seconds === 90, 'ttl 90')

const empty = mapResponse({
  ok: true,
  browsers: [],
  summary: {
    total_browsers: 0,
    online_browsers: 0,
    offline_browsers: 0,
    total_clients: 0,
  },
  status_policy: { source: 'backend', heartbeat_ttl_seconds: 90 },
})
assert(empty.browsers.length === 0, 'empty inventory valid')

console.log('CP15B browser map fixtures: OK')
