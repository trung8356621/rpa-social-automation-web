/** Live Staff Session Client API Keys (backend ≥833e2a3). */

export type LiveClientApiKeysListResponse = {
  ok?: boolean
  keys: LiveClientApiKeyItem[]
}

export type LiveClientApiKeyItem = {
  id: number
  name: string
  key_prefix: string
  installation_id?: string
  created_by?: number | null
  created_by_name?: string | null
  issued_by?: number | null
  issued_by_name?: string | null
  last_used_at?: string | null
  revoked_at?: string | null
  is_active: boolean
  created_at?: string | null
}

export type LiveAssignableUser = {
  id: number
  name: string
  email?: string | null
  role?: string | null
}

export type LiveAssignableUsersResponse = {
  ok?: boolean
  users: LiveAssignableUser[]
}

export type LiveCreateClientApiKeyResponse = {
  ok?: boolean
  message?: string
  raw_key?: string
  key?: LiveClientApiKeyItem
}
