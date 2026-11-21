import { ACTION_REGISTRY_PATHS } from '@/lib/api/config'
import { staffApiRequest } from '@/lib/api/http'

import type { AuthPinPayload } from './resolve-auth-pin'

type OkResponse = { ok?: boolean; error?: string }

export type SiteMutationResponse = OkResponse & {
  site?: {
    id?: number
    key?: string
    name?: string
    cms_type?: string | null
  }
}

export type PathMutationResponse = OkResponse & {
  path?: {
    id?: number
    site_id?: number
    key?: string
    name?: string
    url_pattern?: string
    description?: string | null
    is_authentication?: boolean | null
    path_inputs?: unknown
  }
}

export type StoreSiteBody = {
  name: string
  key?: string
  base_url?: string
  base_url_mode?: 'fixed' | 'dynamic'
  cms_type?: 'wordpress' | 'custom' | null
  test_base_url?: string | null
  description?: string | null
}

export type UpdateSiteBody = {
  name?: string
  base_url?: string | null
  base_url_mode?: 'fixed' | 'dynamic'
  cms_type?: 'wordpress' | 'custom' | null
  test_base_url?: string | null
  description?: string | null
}

export type StorePathBody = {
  site_id: number
  name: string
  key?: string
  url_pattern: string
  description?: string | null
  /** Authentication Path — persisted on sa_paths when schema ready */
  is_authentication?: boolean
  template_key?: string | null
}

export type UpdatePathBody = {
  name?: string
  url_pattern?: string
  description?: string | null
  is_authentication?: boolean
  template_key?: string | null
}

export type StoreTagBody = {
  site_id: number
  path_id: number
  action_key?: string | null
  auth_script_id?: number
  auth_release_id?: number
}

/** POST /action-registry/sites */
export async function liveStoreSite(
  body: StoreSiteBody,
): Promise<SiteMutationResponse> {
  return staffApiRequest<SiteMutationResponse>(ACTION_REGISTRY_PATHS.sites, {
    method: 'POST',
    body,
  })
}

/** PUT /action-registry/sites/{id} */
export async function liveUpdateSite(
  id: number,
  body: UpdateSiteBody,
): Promise<SiteMutationResponse> {
  return staffApiRequest<SiteMutationResponse>(ACTION_REGISTRY_PATHS.site(id), {
    method: 'PUT',
    body,
  })
}

/** DELETE /action-registry/sites/{id} */
export async function liveDestroySite(siteId: number): Promise<OkResponse> {
  return staffApiRequest<OkResponse>(ACTION_REGISTRY_PATHS.site(siteId), {
    method: 'DELETE',
  })
}

/** POST /action-registry/paths */
export async function liveStorePath(
  body: StorePathBody,
): Promise<PathMutationResponse> {
  return staffApiRequest<PathMutationResponse>(ACTION_REGISTRY_PATHS.paths, {
    method: 'POST',
    body,
  })
}

/** PUT /action-registry/paths/{id} */
export async function liveUpdatePath(
  id: number,
  body: UpdatePathBody,
): Promise<PathMutationResponse> {
  return staffApiRequest<PathMutationResponse>(ACTION_REGISTRY_PATHS.path(id), {
    method: 'PUT',
    body,
  })
}

/**
 * POST /action-registry/tags
 * Atomically creates Tag + Script Request (and optional Auth pin).
 */
export async function liveStoreTag(body: StoreTagBody): Promise<OkResponse> {
  return staffApiRequest<OkResponse>(ACTION_REGISTRY_PATHS.tags, {
    method: 'POST',
    body,
  })
}

/** PUT /action-registry/tags/{id}/auth-pin */
export async function liveUpdateAuthPin(
  tagId: number,
  pin: AuthPinPayload,
): Promise<OkResponse> {
  return staffApiRequest<OkResponse>(ACTION_REGISTRY_PATHS.tagAuthPin(tagId), {
    method: 'PUT',
    body: pin,
  })
}

/** PATCH /action-registry/tags/{id}/enabled */
export async function liveUpdateTagEnabled(
  tagId: number,
  enabled: boolean,
): Promise<OkResponse> {
  return staffApiRequest<OkResponse>(ACTION_REGISTRY_PATHS.tagEnabled(tagId), {
    method: 'PATCH',
    body: { is_enabled: enabled },
  })
}

/** DELETE /action-registry/tags/{id} */
export async function liveDestroyTag(tagId: number): Promise<OkResponse> {
  return staffApiRequest<OkResponse>(ACTION_REGISTRY_PATHS.tag(tagId), {
    method: 'DELETE',
  })
}

/**
 * POST /action-registry/tags/{id}/requests
 * Extra Script Request (create/fix). Tag create already creates one atomically —
 * only call when an approved UI action needs a separate request.
 */
export async function liveCreateTagScriptRequest(
  tagId: number,
  body: {
    request_type?: 'create' | 'fix'
    script_id?: string
    script_version?: string
    error_reason?: string
  } = {},
): Promise<OkResponse> {
  return staffApiRequest<OkResponse>(ACTION_REGISTRY_PATHS.tagRequests(tagId), {
    method: 'POST',
    body,
  })
}
