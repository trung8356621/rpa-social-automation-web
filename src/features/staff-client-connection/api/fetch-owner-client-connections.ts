import { OWNER_CLIENT_CONNECTIONS_PATHS } from '@/lib/api/config'
import { staffApiRequest } from '@/lib/api/http'

import type { LiveOwnerClientConnectionsResponse } from './live-types'

export async function fetchOwnerClientConnections(options?: {
  signal?: AbortSignal
}): Promise<LiveOwnerClientConnectionsResponse> {
  return staffApiRequest<LiveOwnerClientConnectionsResponse>(
    OWNER_CLIENT_CONNECTIONS_PATHS.list,
    { method: 'GET', signal: options?.signal },
  )
}
