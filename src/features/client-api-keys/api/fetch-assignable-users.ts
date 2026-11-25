import { CLIENT_API_KEYS_PATHS } from '@/lib/api/config'
import { staffApiRequest } from '@/lib/api/http'

import type { AssignableUser } from '../types'
import type { LiveAssignableUsersResponse } from './live-types'
import { mapLiveAssignableUser } from './map-client-api-key'

/**
 * GET /social-automation/api/client-keys/assignable-users
 * Owner/Admin only — Staff receives 403 (do not call for Staff UI).
 */
export async function fetchLiveAssignableUsers(options?: {
  signal?: AbortSignal
}): Promise<AssignableUser[]> {
  const payload = await staffApiRequest<LiveAssignableUsersResponse>(
    CLIENT_API_KEYS_PATHS.assignableUsers,
    { method: 'GET', signal: options?.signal },
  )
  const rows = Array.isArray(payload.users) ? payload.users : []
  return rows.map(mapLiveAssignableUser)
}
