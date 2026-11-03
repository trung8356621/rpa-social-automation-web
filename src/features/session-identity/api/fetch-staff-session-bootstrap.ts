import { STAFF_SESSION_BOOTSTRAP_PATH } from '@/lib/api/config'
import { staffApiRequest } from '@/lib/api/http'

import type { LiveStaffSessionBootstrapResponse } from './live-types'

export async function fetchStaffSessionBootstrap(options?: {
  signal?: AbortSignal
}): Promise<LiveStaffSessionBootstrapResponse> {
  return staffApiRequest<LiveStaffSessionBootstrapResponse>(
    STAFF_SESSION_BOOTSTRAP_PATH,
    { method: 'GET', signal: options?.signal },
  )
}
