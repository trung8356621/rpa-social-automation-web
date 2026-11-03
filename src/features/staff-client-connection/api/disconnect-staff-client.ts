import { STAFF_CLIENT_CONNECTION_PATHS } from '@/lib/api/config'
import { staffApiRequest } from '@/lib/api/http'

import type { LiveStaffDisconnectResponse } from './live-types'

export async function disconnectStaffClient(options?: {
  signal?: AbortSignal
}): Promise<LiveStaffDisconnectResponse> {
  return staffApiRequest<LiveStaffDisconnectResponse>(
    STAFF_CLIENT_CONNECTION_PATHS.disconnect,
    { method: 'POST', signal: options?.signal },
  )
}
