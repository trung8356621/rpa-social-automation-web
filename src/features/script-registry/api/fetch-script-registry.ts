import { SCRIPT_REGISTRY_PATHS } from '@/lib/api/config'
import { staffApiRequest } from '@/lib/api/http'

import type {
  ScriptDetail,
  ScriptListItem,
  ScriptSharingMode,
} from '../types'
import type {
  LiveScriptRegistryDetailResponse,
  LiveScriptRegistryListResponse,
  LiveScriptSharingResponse,
} from './live-types'
import { mapLiveScriptDetail, mapLiveScriptListItem } from './map-script-registry'

export async function fetchLiveScriptRegistryList(options?: {
  signal?: AbortSignal
}): Promise<ScriptListItem[]> {
  const payload = await staffApiRequest<LiveScriptRegistryListResponse>(
    SCRIPT_REGISTRY_PATHS.list,
    { method: 'GET', signal: options?.signal },
  )
  const scripts = Array.isArray(payload.scripts) ? payload.scripts : []
  return scripts.map(mapLiveScriptListItem)
}

/**
 * Detail identity is package_key (OpenAPI path param `{id}`).
 */
export async function fetchLiveScriptRegistryDetail(
  packageKey: string,
  options?: { signal?: AbortSignal },
): Promise<ScriptDetail> {
  const payload = await staffApiRequest<LiveScriptRegistryDetailResponse>(
    SCRIPT_REGISTRY_PATHS.detail(packageKey),
    { method: 'GET', signal: options?.signal },
  )
  if (!payload.script || typeof payload.script !== 'object') {
    throw new Error('Script detail response missing script object.')
  }
  return mapLiveScriptDetail(payload.script)
}

/**
 * PATCH /social-automation/api/script-registry/{id}/sharing
 * Updates sharing_mode ("cms_global" | "site_specific") via Staff Session + CSRF.
 */
export async function updateLiveScriptSharing(
  packageKey: string,
  sharingMode: ScriptSharingMode,
): Promise<LiveScriptSharingResponse> {
  return staffApiRequest<LiveScriptSharingResponse>(
    SCRIPT_REGISTRY_PATHS.sharing(packageKey),
    {
      method: 'PATCH',
      body: { sharing_mode: sharingMode },
    },
  )
}
