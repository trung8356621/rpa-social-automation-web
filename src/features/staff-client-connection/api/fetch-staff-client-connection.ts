import { STAFF_CLIENT_CONNECTION_PATHS } from '@/lib/api/config'
import { staffApiRequest } from '@/lib/api/http'

import type { LiveStaffClientConnectionResponse } from './live-types'

export async function fetchStaffClientConnection(options?: {
  signal?: AbortSignal
}): Promise<LiveStaffClientConnectionResponse> {
  return staffApiRequest<LiveStaffClientConnectionResponse>(
    STAFF_CLIENT_CONNECTION_PATHS.connection,
    { method: 'GET', signal: options?.signal },
  )
}
