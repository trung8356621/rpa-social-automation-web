/**
 * Index payload from RpaClientApiKeyManagementController.
 * Lease/connection fields below are MOCK presentation — staff list API
 * does not currently return lease/heartbeat (verified Oct 2026).
 */

export type ClientApiKeyItem = {
  id: number
  name: string
  key_prefix: string
  installation_id: string
  created_by: number | null
  created_by_name: string | null
  last_used_at: string | null
  revoked_at: string | null
  is_active: boolean
  created_at: string | null
  /**
   * MOCK-only connection presentation for Control Center UX.
   * Not from keys index JSON.
   */
  mock_lease?: {
    status: 'none' | 'valid' | 'expired'
    connection: 'offline' | 'online'
    heartbeat_at: string | null
    heartbeat_stale: boolean
    device_hostname: string | null
  }
}

export type ClientApiKeysData = {
  keys: ClientApiKeyItem[]
}

export type DemoScenario = 'default' | 'loading' | 'empty' | 'error'

/** Masked display — never show raw secret. */
export function maskKeyPrefix(prefix: string): string {
  const p = prefix.trim() || '****'
  return `${p}${'•'.repeat(12)}`
}
