import type { StaffSessionRole } from './api/live-types'

export type SessionIdentity = {
  id: number
  name: string
  role: StaffSessionRole
}

export type SessionIdentityStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'error'
  | 'forbidden'

export function isOwnerOrAdminRole(role: StaffSessionRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

export function isStaffRole(role: StaffSessionRole | null): boolean {
  return role === 'staff'
}

export function normalizeSessionRole(
  value: unknown,
): StaffSessionRole | null {
  if (typeof value !== 'string') return null
  const role = value.trim().toLowerCase()
  if (role === 'owner' || role === 'admin' || role === 'staff') return role
  return null
}
