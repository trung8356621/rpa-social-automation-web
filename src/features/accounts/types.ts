/**
 * Mirrors SocialAutomationAccountManagementController::index payload.
 * Password never included — only has_password boolean from contract.
 */

export type AccountItem = {
  id: number
  /** Stable identity for staff UI */
  account_uuid: string
  installation_id: string
  platform: string
  /** End-user facing name (name/label) */
  account_name: string
  /** Debug handle — not a key */
  username: string | null
  email: string | null
  has_password: boolean
  note: string | null
  last_interaction_at: string | null
  created_by: number | null
  created_by_name: string | null
  created_at: string | null
  updated_at: string | null
  /**
   * Optional model field not always in list API — mock may set for inventory status.
   * Not Session Signal / login proof.
   */
  verified?: boolean
}

export type AccountsData = {
  accounts: AccountItem[]
}

export type DemoScenario = 'default' | 'loading' | 'empty' | 'error'
