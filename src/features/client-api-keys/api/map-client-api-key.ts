import type { AssignableUser, ClientApiKeyItem } from '../types'
import type { LiveAssignableUser, LiveClientApiKeyItem } from './live-types'

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function asNullableId(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
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
    issued_by,
    issued_by_name,
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
    created_by: asNullableId(created_by),
    created_by_name: asNullableString(created_by_name),
    issued_by: asNullableId(issued_by),
    issued_by_name: asNullableString(issued_by_name),
    last_used_at: asNullableString(last_used_at),
    revoked_at: asNullableString(revoked_at),
    is_active: Boolean(is_active),
    created_at: asNullableString(created_at),
  }
}

export function mapLiveAssignableUser(item: LiveAssignableUser): AssignableUser {
  return {
    id: Number(item.id),
    name: String(item.name ?? '').trim() || `User #${item.id}`,
    email: asNullableString(item.email),
    role: asNullableString(item.role),
  }
}
