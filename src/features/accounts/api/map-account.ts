import type { AccountItem } from '../types'
import type { LiveAccountItem } from './live-types'

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Map Staff account row → UI inventory model.
 * Never maps password. Browser binding absent → UI shows "—".
 */
export function mapLiveAccountItem(item: LiveAccountItem): AccountItem {
  const accountName =
    asNullableString(item.account_name) ??
    asNullableString(item.name) ??
    ''

  return {
    id: Number(item.id),
    account_uuid: String(item.account_uuid ?? ''),
    installation_id: String(item.installation_id ?? ''),
    platform: String(item.platform ?? ''),
    account_name: accountName,
    username: asNullableString(item.username),
    email: asNullableString(item.email),
    has_password: Boolean(item.has_password),
    note: asNullableString(item.note),
    last_interaction_at: asNullableString(item.last_interaction_at),
    created_by: item.created_by == null ? null : Number(item.created_by),
    created_by_name: asNullableString(item.created_by_name),
    created_at: asNullableString(item.created_at),
    updated_at: asNullableString(item.updated_at),
    ...(typeof item.verified === 'boolean' ? { verified: item.verified } : {}),
  }
}
