/** Live Staff Session Script Registry shapes (OpenAPI StaffScriptRegistry*). */

export type LiveScriptRegistryListResponse = {
  ok?: boolean
  scripts: LiveScriptListItem[]
  count: number
}

export type LiveScriptListItem = {
  package_key: string
  script_id: string
  name: string
  description?: string | null
  version: string
  release_id?: number
  status: string
  is_authentication: boolean
  action_tag_key?: string | null
  assets_complete: boolean
  video_demo_status: string
  has_playable_video?: boolean
  has_thumbnail?: boolean
  video_media_id?: number | null
  thumbnail_media_id?: number | null
  /** Staff Session URL — do not invent from filesystem paths */
  video_media_url?: string | null
  thumbnail_media_url?: string | null
  published_at?: string | null
  updated_by_label?: string
  widget_dependency_count?: number
  last_sync_label?: string
  sharing_mode?: string | null
  global_scope?: string | null
  global_eligible?: boolean
  global_ineligible_reason?: string | null
  eligible_global_scope?: unknown
  global_conflict?: unknown
  effective_sharing_mode?: string | null
  sharing_managed_automatically?: boolean
  language_label?: string | null
  is_enabled?: boolean
  is_primary?: boolean
}

export type LiveScriptRegistryDetailResponse = {
  ok?: boolean
  script: LiveScriptDetail
}

export type LiveScriptRelease = {
  id?: number
  version?: string
  content_digest?: string
  status?: string
  published_at?: string | null
  /** Present only if Staff projects full variable rows (often omitted). */
  variables?: unknown[]
  /** Count survives Staff sanitization even when `variables` is stripped. */
  variable_count?: number
  step_count?: number
  asset_count?: number
  steps?: unknown[]
  assets?: unknown[]
  runtime_requirements?: unknown[]
  video_demo?: { artifact_ref?: string; path?: string } | null
  video_demo_status?: string
  video_media_id?: number | null
  thumbnail_media_id?: number | null
  video_media_url?: string | null
  thumbnail_media_url?: string | null
  [key: string]: unknown
}

export type LiveScriptDetail = {
  package_key: string
  script_id?: string
  name: string
  description?: string | null
  is_authentication?: boolean
  action_tag_key?: string | null
  version?: string
  status?: string
  assets_complete?: boolean
  video_demo_status?: string
  video_media_id?: number | null
  thumbnail_media_id?: number | null
  video_media_url?: string | null
  thumbnail_media_url?: string | null
  updated_by_label?: string
  sharing_mode?: string | null
  global_scope?: string | null
  global_eligible?: boolean
  global_ineligible_reason?: string | null
  eligible_global_scope?: unknown
  global_conflict?: unknown
  effective_sharing_mode?: string | null
  sharing_managed_automatically?: boolean
  language_label?: string | null
  is_enabled?: boolean
  is_primary?: boolean
  releases?: LiveScriptRelease[]
  [key: string]: unknown
}

export type LiveScriptSharingResponse = {
  ok?: boolean
  sharing_mode?: string
  global_scope?: string | null
  script?: LiveScriptDetail | LiveScriptListItem
  error?: string
  message?: string
}

export type LiveScriptConfigResponse = {
  ok?: boolean
  config?: {
    package_key?: string
    language_label?: string | null
    is_enabled?: boolean
    is_primary?: boolean
  }
  variant_group?: unknown
  script?: LiveScriptDetail | null
  error?: string
  errors?: string[]
  conflict?: {
    package_key?: string
    script_id?: string
    name?: string
    group_id?: string
  }
}
