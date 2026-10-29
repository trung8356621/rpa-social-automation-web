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
  variables?: unknown[]
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
  releases?: LiveScriptRelease[]
  [key: string]: unknown
}
