import { CLIENT_API_KEYS_PATHS } from '@/lib/api/config'
import { staffApiRequest } from '@/lib/api/http'

import type { ClientApiKeyItem } from '../types'
import type { LiveClientApiKeysListResponse } from './live-types'
import { mapLiveClientApiKeyItem } from './map-client-api-key'

export async function fetchLiveClientApiKeys(options?: {
  signal?: AbortSignal
}): Promise<ClientApiKeyItem[]> {
  const payload = await staffApiRequest<LiveClientApiKeysListResponse>(
    CLIENT_API_KEYS_PATHS.list,
    { method: 'GET', signal: options?.signal },
  )
  const rows = Array.isArray(payload.keys) ? payload.keys : []
  return rows.map(mapLiveClientApiKeyItem)
}
