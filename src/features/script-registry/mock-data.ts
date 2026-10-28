import { mockThumbnailSvg } from './mock-thumbnails'
import type { ScriptDetail, ScriptListItem, ScriptRegistryData } from './types'

function release(
  id: number,
  version: string,
  status: ScriptListItem['status'],
  publishedAt: string,
  video: {
    status: ScriptListItem['video_demo_status']
    thumb: string | null
    videoUrl: string | null
    mediaId: number | null
    thumbId: number | null
  },
  extras?: Partial<ScriptDetail['releases'][number]>,
): ScriptDetail['releases'][number] {
  return {
    id,
    version,
    content_digest: `sha256:mock_${id}_${version}`,
    status,
    published_at: publishedAt,
    variables: extras?.variables ?? [{ key: 'account_id', type: 'string' }],
    steps: extras?.steps ?? [{ action: 'checkpoint', name: 'main' }],
    assets: extras?.assets ?? [{ path: 'main.js', kind: 'script' }],
    runtime_requirements: extras?.runtime_requirements ?? [],
    video_demo:
      video.status === 'missing'
        ? null
        : { artifact_ref: `mock/${id}/demo.webm` },
    video_demo_status: video.status,
    video_media_id: video.mediaId,
    thumbnail_media_id: video.thumbId,
    thumbnail_url: video.thumb,
    video_url: video.videoUrl,
  }
}

const wpPostThumb = mockThumbnailSvg('wordpress.new_post.post', 'ready')
const wpLoginThumb = mockThumbnailSvg('wordpress.login', 'ready')
const fbComposerThumb = mockThumbnailSvg('facebook.group_composer', 'missing')
const fbCommentThumb = mockThumbnailSvg('facebook.comment', 'unavailable')
const reviewThumb = mockThumbnailSvg('review.assets', 'ready')

const list: ScriptListItem[] = [
  {
    package_key: 'script.wordpress.new_post.post',
    script_id: 'wordpress.new_post.post',
    name: 'WordPress New Post',
    action_tag_key: 'wordpress.new_post.post',
    version: '1.2.0',
    release_id: 101,
    status: 'published',
    assets_complete: true,
    video_demo_status: 'ready',
    has_playable_video: true,
    has_thumbnail: true,
    video_media_id: 501,
    thumbnail_media_id: 502,
    thumbnail_url: wpPostThumb,
    video_url: null,
    last_sync_label: '28/10/2026',
    updated_by_label: 'rpa.creator',
  },
  {
    package_key: 'script.wordpress.login',
    script_id: 'wordpress.login',
    name: 'WordPress Login',
    action_tag_key: null,
    version: '1.0.0',
    release_id: 102,
    status: 'published',
    assets_complete: true,
    video_demo_status: 'ready',
    has_playable_video: true,
    has_thumbnail: true,
    video_media_id: 511,
    thumbnail_media_id: 512,
    thumbnail_url: wpLoginThumb,
    video_url: null,
    last_sync_label: '27/10/2026',
    updated_by_label: 'rpa.creator',
    is_authentication: true,
  },
  {
    package_key: 'script.facebook.group_composer.post',
    script_id: 'facebook.group_composer.post',
    name: 'Facebook Group Composer',
    action_tag_key: 'facebook.group_composer.post',
    version: '2.0.1',
    release_id: 103,
    status: 'published',
    assets_complete: true,
    video_demo_status: 'missing',
    has_playable_video: false,
    has_thumbnail: false,
    video_media_id: null,
    thumbnail_media_id: null,
    thumbnail_url: null,
    video_url: null,
    last_sync_label: '20/10/2026',
    updated_by_label: 'rpa.creator',
  },
  {
    package_key: 'script.facebook.comment',
    script_id: 'facebook.comment',
    name: 'Facebook Comment',
    action_tag_key: 'facebook.post_permalink.comment',
    version: '1.1.0',
    release_id: 104,
    status: 'published',
    assets_complete: true,
    video_demo_status: 'thumbnail_unavailable',
    has_playable_video: true,
    has_thumbnail: false,
    video_media_id: 521,
    thumbnail_media_id: null,
    thumbnail_url: null,
    video_url: null,
    last_sync_label: '18/10/2026',
    updated_by_label: 'tech.lead',
  },
  {
    package_key: 'script.wordpress.collect',
    script_id: 'wordpress.collect',
    name: 'WordPress Collect (Incomplete Assets)',
    action_tag_key: 'wordpress.new_post.collect',
    version: '0.9.0',
    release_id: 105,
    status: 'published',
    assets_complete: false,
    video_demo_status: 'processing',
    has_playable_video: false,
    has_thumbnail: true,
    video_media_id: null,
    thumbnail_media_id: 531,
    thumbnail_url: reviewThumb,
    video_url: null,
    last_sync_label: '15/10/2026',
    updated_by_label: 'rpa.creator',
  },
  {
    package_key: 'script.legacy.disabled',
    script_id: 'legacy.disabled',
    name: 'Legacy Disabled Script',
    action_tag_key: null,
    version: '0.3.0',
    release_id: 106,
    status: 'yanked',
    assets_complete: true,
    video_demo_status: 'missing',
    has_playable_video: false,
    has_thumbnail: false,
    video_media_id: null,
    thumbnail_media_id: null,
    thumbnail_url: fbComposerThumb,
    video_url: null,
    last_sync_label: '01/09/2026',
    updated_by_label: 'admin',
  },
]

const details: Record<string, ScriptDetail> = {
  'script.wordpress.new_post.post': {
    package_key: 'script.wordpress.new_post.post',
    name: 'WordPress New Post',
    action_tag_key: 'wordpress.new_post.post',
    description:
      'Tạo bài viết WordPress từ Checkpoint. Chạy sau Auth Script (nếu Tag gắn Auth).',
    updated_by_label: 'rpa.creator',
    releases: [
      release(101, '1.2.0', 'published', '2026-10-28T08:00:00Z', {
        status: 'ready',
        thumb: wpPostThumb,
        videoUrl: null,
        mediaId: 501,
        thumbId: 502,
      }),
      release(100, '1.1.0', 'published', '2026-10-10T08:00:00Z', {
        status: 'missing',
        thumb: null,
        videoUrl: null,
        mediaId: null,
        thumbId: null,
      }),
    ],
  },
  'script.wordpress.login': {
    package_key: 'script.wordpress.login',
    name: 'WordPress Login',
    action_tag_key: null,
    description:
      'MOCK Authentication Script — đăng nhập WordPress trước Checkpoint. Backend chưa có flag is_authentication.',
    updated_by_label: 'rpa.creator',
    is_authentication: true,
    releases: [
      release(
        102,
        '1.0.0',
        'published',
        '2026-10-27T10:00:00Z',
        {
          status: 'ready',
          thumb: wpLoginThumb,
          videoUrl: null,
          mediaId: 511,
          thumbId: 512,
        },
        {
          variables: [
            { key: 'username', type: 'string' },
            { key: 'password', type: 'secret' },
          ],
          steps: [
            { action: 'navigate', name: 'wp-login' },
            { action: 'fill', name: 'credentials' },
          ],
        },
      ),
    ],
  },
  'script.facebook.group_composer.post': {
    package_key: 'script.facebook.group_composer.post',
    name: 'Facebook Group Composer',
    action_tag_key: 'facebook.group_composer.post',
    description: 'Đăng bài vào Group Composer. Demo video chưa có.',
    updated_by_label: 'rpa.creator',
    releases: [
      release(103, '2.0.1', 'published', '2026-10-20T12:00:00Z', {
        status: 'missing',
        thumb: null,
        videoUrl: null,
        mediaId: null,
        thumbId: null,
      }),
    ],
  },
  'script.facebook.comment': {
    package_key: 'script.facebook.comment',
    name: 'Facebook Comment',
    action_tag_key: 'facebook.post_permalink.comment',
    description: 'Comment trên permalink. Thumbnail không khả dụng.',
    updated_by_label: 'tech.lead',
    releases: [
      release(104, '1.1.0', 'published', '2026-10-18T09:00:00Z', {
        status: 'thumbnail_unavailable',
        thumb: fbCommentThumb,
        videoUrl: null,
        mediaId: 521,
        thumbId: null,
      }),
    ],
  },
  'script.wordpress.collect': {
    package_key: 'script.wordpress.collect',
    name: 'WordPress Collect (Incomplete Assets)',
    action_tag_key: 'wordpress.new_post.collect',
    description: 'Assets chưa đủ — trạng thái Review.',
    updated_by_label: 'rpa.creator',
    releases: [
      release(
        105,
        '0.9.0',
        'published',
        '2026-10-15T11:00:00Z',
        {
          status: 'processing',
          thumb: reviewThumb,
          videoUrl: null,
          mediaId: null,
          thumbId: 531,
        },
        { assets: [] },
      ),
    ],
  },
  'script.legacy.disabled': {
    package_key: 'script.legacy.disabled',
    name: 'Legacy Disabled Script',
    action_tag_key: null,
    description: 'Release yanked — Disabled.',
    updated_by_label: 'admin',
    releases: [
      release(106, '0.3.0', 'yanked', '2026-09-01T08:00:00Z', {
        status: 'missing',
        thumb: null,
        videoUrl: null,
        mediaId: null,
        thumbId: null,
      }),
    ],
  },
}

/** Labeled MOCK seed — mirrors ScriptRegistryUiService list + detail. */
export const MOCK_SCRIPT_REGISTRY: ScriptRegistryData = {
  scripts: list,
  details,
}

export const EMPTY_SCRIPT_REGISTRY: ScriptRegistryData = {
  scripts: [],
  details: {},
}
