import { ACTION_REGISTRY_PATHS } from '@/lib/api/config'
import { ApiError } from '@/lib/api/errors'
import { staffApiRequest } from '@/lib/api/http'
import { mapLiveSites } from '@/features/action-tags/api/mappers'
import type { LiveActionRegistryDataResponse } from '@/features/action-tags/api/live-types'
import type { Site } from '@/features/action-tags/types'

/**
 * Sites for Account platform selector — same Action Registry data source as Action Tags.
 * GET /social-automation/api/action-registry/data (sites[] only). No new endpoint.
 */
export async function fetchAccountSites(options?: {
  signal?: AbortSignal
}): Promise<Site[]> {
  const data = await staffApiRequest<LiveActionRegistryDataResponse>(
    ACTION_REGISTRY_PATHS.data,
    { method: 'GET', signal: options?.signal },
  )

  if (!data.ok) {
    throw new ApiError('Action Registry response was not ok.', {
      kind: 'server',
      status: 200,
      code: 'ok_false',
    })
  }

  return mapLiveSites(data.sites).filter((s) => s.key.trim() !== '')
}
