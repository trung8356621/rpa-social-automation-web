/** Live Staff Session GET /social-automation/api/accounts */

export type LiveAccountsListResponse = {
  ok?: boolean
  accounts: LiveAccountItem[]
}

export type LiveAccountItem = {
  id: number
  account_uuid: string
  installation_id?: string
  platform: string
  /** Alias of account_name in some payloads */
  name?: string
  account_name?: string
  username?: string | null
  email?: string | null
  has_password?: boolean
  note?: string | null
  last_interaction_at?: string | null
  created_by?: number | null
  created_by_name?: string | null
  created_at?: string | null
  updated_at?: string | null
  /** Not in Staff list SOURCE — do not invent if absent */
  verified?: boolean
}
