import type {
  ScriptDetail,
  ScriptListItem,
  ScriptReleaseDetail,
  ScriptReleaseStatus,
  VideoDemoStatus,
} from '../types'
import type {
  LiveScriptDetail,
  LiveScriptListItem,
  LiveScriptRelease,
} from './live-types'

const VIDEO_STATUSES: readonly VideoDemoStatus[] = [
  'ready',
  'missing',
  'thumbnail_unavailable',
  'processing',
  'error',
]

const RELEASE_STATUSES: readonly ScriptReleaseStatus[] = [
  'published',
  'yanked',
  'draft',
]

function asVideoStatus(raw: unknown): VideoDemoStatus {
  if (typeof raw === 'string' && (VIDEO_STATUSES as string[]).includes(raw)) {
    return raw as VideoDemoStatus
  }
  return 'missing'
}

function asReleaseStatus(raw: unknown): ScriptReleaseStatus {
  if (typeof raw === 'string' && (RELEASE_STATUSES as string[]).includes(raw)) {
    return raw as ScriptReleaseStatus
  }
  return 'draft'
}

function formatSyncLabel(publishedAt: string | null | undefined): string {
  if (!publishedAt) return '—'
  const d = new Date(publishedAt)
  if (Number.isNaN(d.getTime())) return publishedAt
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Map Staff list item → UI card model.
 * Presentation URLs come only from backend `*_media_url` (never invented).
 */
export function mapLiveScriptListItem(item: LiveScriptListItem): ScriptListItem {
  const videoUrl =
    typeof item.video_media_url === 'string' && item.video_media_url.trim()
      ? item.video_media_url.trim()
      : null
  const thumbUrl =
    typeof item.thumbnail_media_url === 'string' &&
    item.thumbnail_media_url.trim()
      ? item.thumbnail_media_url.trim()
      : null

  return {
    package_key: item.package_key,
    script_id: item.script_id,
    name: item.name,
    action_tag_key: item.action_tag_key ?? null,
    version: item.version,
    release_id: Number(item.release_id ?? 0),
    status: asReleaseStatus(item.status),
    assets_complete: Boolean(item.assets_complete),
    video_demo_status: asVideoStatus(item.video_demo_status),
    has_playable_video: Boolean(item.has_playable_video),
    has_thumbnail: Boolean(item.has_thumbnail ?? Boolean(thumbUrl)),
    video_media_id:
      item.video_media_id == null ? null : Number(item.video_media_id),
    thumbnail_media_id:
      item.thumbnail_media_id == null ? null : Number(item.thumbnail_media_id),
    thumbnail_url: thumbUrl,
    video_url: videoUrl,
    last_sync_label:
      typeof item.last_sync_label === 'string' && item.last_sync_label.trim()
        ? item.last_sync_label
        : formatSyncLabel(item.published_at),
    updated_by_label:
      typeof item.updated_by_label === 'string' ? item.updated_by_label : '—',
    is_authentication: Boolean(item.is_authentication),
  }
}

function mapLiveRelease(release: LiveScriptRelease): ScriptReleaseDetail {
  const videoUrl =
    typeof release.video_media_url === 'string' && release.video_media_url.trim()
      ? release.video_media_url.trim()
      : null
  const thumbUrl =
    typeof release.thumbnail_media_url === 'string' &&
    release.thumbnail_media_url.trim()
      ? release.thumbnail_media_url.trim()
      : null

  return {
    id: Number(release.id ?? 0),
    version: String(release.version ?? ''),
    content_digest: String(release.content_digest ?? ''),
    status: asReleaseStatus(release.status),
    published_at:
      typeof release.published_at === 'string' ? release.published_at : null,
    variables: Array.isArray(release.variables) ? release.variables : [],
    steps: Array.isArray(release.steps) ? release.steps : [],
    assets: Array.isArray(release.assets) ? release.assets : [],
    runtime_requirements: Array.isArray(release.runtime_requirements)
      ? release.runtime_requirements
      : [],
    video_demo:
      release.video_demo && typeof release.video_demo === 'object'
        ? release.video_demo
        : null,
    video_demo_status: asVideoStatus(release.video_demo_status),
    video_media_id:
      release.video_media_id == null ? null : Number(release.video_media_id),
    thumbnail_media_id:
      release.thumbnail_media_id == null
        ? null
        : Number(release.thumbnail_media_id),
    thumbnail_url: thumbUrl,
    video_url: videoUrl,
  }
}

export function mapLiveScriptDetail(script: LiveScriptDetail): ScriptDetail {
  const releases = Array.isArray(script.releases)
    ? script.releases.map(mapLiveRelease)
    : []

  return {
    package_key: script.package_key,
    name: script.name,
    action_tag_key: script.action_tag_key ?? null,
    description:
      typeof script.description === 'string' ? script.description : null,
    updated_by_label:
      typeof script.updated_by_label === 'string'
        ? script.updated_by_label
        : '—',
    is_authentication: Boolean(script.is_authentication),
    releases,
  }
}
