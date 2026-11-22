import { mappingFromApi } from '../../campaigns/shortcode-mapping.ts'
import type {
  ArticleSourceFormat,
  ArticleStatus,
  CampaignArticleAssignment,
  LibraryArticle,
} from '../types.ts'

function asArticleStatus(raw: unknown): ArticleStatus {
  if (raw === 'draft' || raw === 'ready' || raw === 'archived') return raw
  return 'ready'
}

function asSourceFormat(raw: unknown): ArticleSourceFormat {
  if (raw === 'shortcode' || raw === 'json' || raw === 'legacy_input') return raw
  return 'legacy_input'
}

export function mapLiveLibraryArticle(raw: unknown): LibraryArticle {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    external_ref:
      typeof r.external_ref === 'string' && r.external_ref.trim()
        ? r.external_ref.trim()
        : null,
    action_tag_id: Number(r.action_tag_id ?? 0),
    action_tag_key: String(r.action_tag_key ?? ''),
    site_id: r.site_id != null && Number.isFinite(Number(r.site_id)) ? Number(r.site_id) : null,
    site_key:
      typeof r.site_key === 'string' && r.site_key.trim()
        ? r.site_key.trim()
        : null,
    status: asArticleStatus(r.status),
    source_format: asSourceFormat(r.source_format),
    raw_source: typeof r.raw_source === 'string' ? r.raw_source : null,
    input:
      r.input && typeof r.input === 'object' && !Array.isArray(r.input)
        ? (r.input as Record<string, unknown>)
        : {},
    shortcode_mapping: mappingFromApi(
      r.shortcode_mapping as
        | { entries?: Array<{ shortcode?: string; variable?: string }> }
        | null
        | undefined,
    ),
    mapping_version: Number(r.mapping_version ?? 0),
    meta:
      r.meta && typeof r.meta === 'object' && !Array.isArray(r.meta)
        ? (r.meta as Record<string, unknown>)
        : null,
    created_at: typeof r.created_at === 'string' ? r.created_at : null,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : null,
  }
}

export function mapLiveCampaignArticleAssignment(
  raw: unknown,
): CampaignArticleAssignment {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    content_id: String(r.content_id ?? ''),
    assignment_id:
      typeof r.assignment_id === 'string' && r.assignment_id
        ? r.assignment_id
        : null,
    article_id:
      typeof r.article_id === 'string' && r.article_id ? r.article_id : null,
    article_title:
      typeof r.article_title === 'string' && r.article_title
        ? r.article_title
        : null,
    external_ref:
      typeof r.external_ref === 'string' && r.external_ref.trim()
        ? r.external_ref.trim()
        : null,
    sort_order: Number(r.sort_order ?? 0),
    status: String(r.status ?? 'pending'),
    is_legacy_inline: Boolean(r.is_legacy_inline),
    action_tag_id:
      r.action_tag_id != null && Number.isFinite(Number(r.action_tag_id))
        ? Number(r.action_tag_id)
        : null,
    action_tag_key:
      typeof r.action_tag_key === 'string' && r.action_tag_key
        ? r.action_tag_key
        : null,
    site_id:
      r.site_id != null && Number.isFinite(Number(r.site_id))
        ? Number(r.site_id)
        : null,
    site_key:
      typeof r.site_key === 'string' && r.site_key ? r.site_key : null,
    release_id:
      r.release_id != null && Number.isFinite(Number(r.release_id))
        ? Number(r.release_id)
        : null,
    script_id: String(r.script_id ?? ''),
    script_version: String(r.script_version ?? ''),
    input:
      r.input && typeof r.input === 'object' && !Array.isArray(r.input)
        ? (r.input as Record<string, unknown>)
        : {},
    snapshot_at: typeof r.snapshot_at === 'string' ? r.snapshot_at : null,
  }
}

export function extractArticlePreview(article: {
  raw_source?: string | null
  input?: Record<string, unknown>
}): string {
  if (article.raw_source && article.raw_source.trim()) {
    return article.raw_source.trim()
  }
  const input = article.input ?? {}
  const preferredKeys = ['wp_body', 'body', 'content', 'wp_title', 'title']
  for (const k of preferredKeys) {
    const val = input[k]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  for (const val of Object.values(input)) {
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return ''
}
