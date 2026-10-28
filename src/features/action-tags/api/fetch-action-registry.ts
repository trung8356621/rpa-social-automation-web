import { ACTION_REGISTRY_PATHS } from '@/lib/api/config'
import { ApiError } from '@/lib/api/errors'
import { staffApiRequest } from '@/lib/api/http'

import type { ActionRegistryData } from '../types'
import type {
  LiveActionRegistryDataResponse,
  LiveAuthScriptsCatalogResponse,
} from './live-types'
import { mapLiveActionRegistry } from './mappers'

export type FetchActionRegistryOptions = {
  signal?: AbortSignal
}

/**
 * Live read-only Action Registry + Authentication Script catalog.
 * Never falls back to mock data.
 */
export async function fetchLiveActionRegistry(
  options: FetchActionRegistryOptions = {},
): Promise<ActionRegistryData> {
  const data = await staffApiRequest<LiveActionRegistryDataResponse>(
    ACTION_REGISTRY_PATHS.data,
    { method: 'GET', signal: options.signal },
  )

  if (!data.ok) {
    throw new ApiError('Action Registry response was not ok.', {
      kind: 'server',
      status: 200,
      code: 'ok_false',
    })
  }

  let packages: LiveAuthScriptsCatalogResponse['packages'] = []
  try {
    const catalog = await staffApiRequest<LiveAuthScriptsCatalogResponse>(
      ACTION_REGISTRY_PATHS.authenticationScripts,
      { method: 'GET', signal: options.signal },
    )
    if (catalog.ok && Array.isArray(catalog.packages)) {
      packages = catalog.packages
    }
  } catch (error) {
    // Auth catalog is required for honest Auth Script column; do not invent packages.
    // If data succeeded but catalog failed with auth, surface auth.
    if (error instanceof ApiError && error.isAuthRequired) throw error
    if (error instanceof ApiError && error.kind === 'forbidden') throw error
    throw error
  }

  return mapLiveActionRegistry(data, packages)
}
