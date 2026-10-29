import type { ClientApiKeyItem } from '../types'
import type { LiveClientApiKeyItem } from './live-types'

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Map Staff key row → UI model.
 * Allowlisted fields only — never maps secret-bearing properties.
 * No lease/heartbeat invention — mock_lease omitted in LIVE.
 */
export function mapLiveClientApiKeyItem(
  item: LiveClientApiKeyItem,
): ClientApiKeyItem {
  const {
    id,
    name,
    key_prefix,
    installation_id,
    created_by,
    created_by_name,
    last_used_at,
    revoked_at,
    is_active,
    created_at,
  } = item

  return {
    id: Number(id),
    name: String(name ?? ''),
    key_prefix: String(key_prefix ?? ''),
    installation_id: String(installation_id ?? ''),
    created_by: created_by == null ? null : Number(created_by),
    created_by_name: asNullableString(created_by_name),
    last_used_at: asNullableString(last_used_at),
    revoked_at: asNullableString(revoked_at),
    is_active: Boolean(is_active),
    created_at: asNullableString(created_at),
  }
}
