/**
 * Shapes aligned with Staff Script Registry REST + ScriptRegistryUiService.
 * LIVE maps `video_media_url` / `thumbnail_media_url` → presentation URLs.
 */

export type VideoDemoStatus =
  | 'ready'
  | 'missing'
  | 'thumbnail_unavailable'
  | 'processing'
  | 'error'

export type ScriptReleaseStatus = 'published' | 'yanked' | 'draft'

export type ScriptListItem = {
  package_key: string
  script_id: string
  name: string
  action_tag_key: string | null
  version: string
  release_id: number
  status: ScriptReleaseStatus
  assets_complete: boolean
  video_demo_status: VideoDemoStatus
  has_playable_video: boolean
  has_thumbnail: boolean
  video_media_id: number | null
  thumbnail_media_id: number | null
  /** Presentation URL for card/thumb — mock asset or Staff `thumbnail_media_url` */
  thumbnail_url: string | null
  /** Presentation URL for player — mock or Staff `video_media_url` */
  video_url: string | null
  last_sync_label: string
  updated_by_label: string
  /** From Staff `is_authentication` (LIVE) or mock seed */
  is_authentication?: boolean
}

export type ScriptReleaseDetail = {
  id: number
  version: string
  content_digest: string
  status: ScriptReleaseStatus
  published_at: string | null
  variables: unknown[]
  steps: unknown[]
  assets: unknown[]
  runtime_requirements: unknown[]
  video_demo: { artifact_ref?: string; path?: string } | null
  video_demo_status: VideoDemoStatus
  video_media_id: number | null
  thumbnail_media_id: number | null
  thumbnail_url: string | null
  video_url: string | null
}

export type ScriptDetail = {
  package_key: string
  name: string
  action_tag_key: string | null
  description: string | null
  updated_by_label: string
  is_authentication?: boolean
  releases: ScriptReleaseDetail[]
}

export type ScriptRegistryData = {
  scripts: ScriptListItem[]
  details: Record<string, ScriptDetail>
}

export type DemoScenario =
  | 'default'
  | 'loading'
  | 'empty'
  | 'error'
  | 'missing-video'

export type UiStatusBadge = {
  label: string
  variant: 'success' | 'warning' | 'neutral' | 'danger'
}

/** Match Filament scripts.blade.php badge rules. */
export function scriptStatusBadge(script: ScriptListItem): UiStatusBadge {
  if (script.status === 'yanked') {
    return { label: 'Disabled', variant: 'neutral' }
  }
  if (!script.assets_complete) {
    return { label: 'Review', variant: 'warning' }
  }
  return { label: 'Published', variant: 'success' }
}

export function displayScriptTitle(script: {
  action_tag_key: string | null
  name: string
}): string {
  return script.action_tag_key?.trim() || script.name
}
