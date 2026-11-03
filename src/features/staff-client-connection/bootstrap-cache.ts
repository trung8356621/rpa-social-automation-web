import { STAFF_CLIENT_BOOTSTRAP_LOCALSTORAGE_KEY } from '@/lib/api/config'

import type { LiveStaffBootstrap } from './api/live-types'

/** Fields documented by backend for `sa_staff_client_bootstrap_v1`. */
export type StaffBootstrapCachePayload = {
  raw_key: string
  expires_at: number
  key_prefix: string
  installation_id: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseCache(raw: string): StaffBootstrapCachePayload | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    const rawKey = parsed.raw_key
    const expiresAt = parsed.expires_at
    const keyPrefix = parsed.key_prefix
    const installationId = parsed.installation_id
    if (typeof rawKey !== 'string' || !rawKey.trim()) return null
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null
    if (typeof keyPrefix !== 'string' || !keyPrefix.trim()) return null
    if (typeof installationId !== 'string' || !installationId.trim()) return null
    return {
      raw_key: rawKey,
      expires_at: expiresAt,
      key_prefix: keyPrefix,
      installation_id: installationId,
    }
  } catch {
    return null
  }
}

/**
 * Read cached bootstrap. Never treat as session proof or display source
 * before the authoritative GET returns.
 */
export function readStaffBootstrapCache(
  storageKey: string = STAFF_CLIENT_BOOTSTRAP_LOCALSTORAGE_KEY,
): StaffBootstrapCachePayload | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    return parseCache(raw)
  } catch {
    return null
  }
}

export function writeStaffBootstrapCache(
  bootstrap: Pick<
    LiveStaffBootstrap,
    'raw_key' | 'expires_at' | 'key_prefix' | 'installation_id'
  >,
  storageKey: string = STAFF_CLIENT_BOOTSTRAP_LOCALSTORAGE_KEY,
): void {
  const payload: StaffBootstrapCachePayload = {
    raw_key: bootstrap.raw_key,
    expires_at: bootstrap.expires_at,
    key_prefix: bootstrap.key_prefix,
    installation_id: bootstrap.installation_id,
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearStaffBootstrapCache(
  storageKey: string = STAFF_CLIENT_BOOTSTRAP_LOCALSTORAGE_KEY,
): void {
  try {
    window.localStorage.removeItem(storageKey)
  } catch {
    /* ignore */
  }
}

export function syncBootstrapCacheFromServer(
  connected: boolean,
  bootstrap: LiveStaffBootstrap | null,
  storageKey?: string,
): void {
  if (connected || !bootstrap?.raw_key) {
    clearStaffBootstrapCache(storageKey)
    return
  }
  writeStaffBootstrapCache(bootstrap, storageKey)
}
