import { BROWSERS_PATHS } from '@/lib/api/config'
import { staffApiRequest } from '@/lib/api/http'

import type { ClientsInventoryData } from '../types'
import type { LiveBrowsersListResponse } from './live-types'
import { mapLiveBrowsersResponse } from './map-browser'

export async function fetchLiveBrowsers(options?: {
  signal?: AbortSignal
}): Promise<ClientsInventoryData> {
  const payload = await staffApiRequest<LiveBrowsersListResponse>(
    BROWSERS_PATHS.list,
    { method: 'GET', signal: options?.signal },
  )
  return mapLiveBrowsersResponse(payload)
}
