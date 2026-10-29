/** Live Staff Session GET /social-automation/api/client-keys */

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
  last_used_at?: string | null
  revoked_at?: string | null
  is_active: boolean
  created_at?: string | null
}
