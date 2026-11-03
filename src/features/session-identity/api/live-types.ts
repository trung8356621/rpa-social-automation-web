/** Verified CP17B.3+ GET /api/social-automation/bootstrap */

export type StaffSessionRole = 'owner' | 'admin' | 'staff'

export type LiveStaffSessionUser = {
  id: number
  name: string
  role: StaffSessionRole | string
}

export type LiveStaffSessionBootstrapResponse = {
  ok: boolean
  bootstrap?: {
    user?: LiveStaffSessionUser | null
    service?: Record<string, unknown>
    config?: Record<string, unknown>
  }
  message?: string
}
