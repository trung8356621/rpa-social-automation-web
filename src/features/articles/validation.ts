import type { Campaign, ScriptInputSchema } from '../campaigns/types.ts'
import type {
  ArticleLibraryFilters,
  LibraryArticle,
  SaveLibraryArticleInput,
} from './types.ts'

export type ArticleValidationResult =
  | { ok: true; payload: SaveLibraryArticleInput }
  | { ok: false; message: string }

export function validateSaveLibraryArticle(
  input: SaveLibraryArticleInput & { campaign_id?: unknown; action_tags?: unknown },
  schema?: ScriptInputSchema | null,
): ArticleValidationResult {
  if ('campaign_id' in input && input.campaign_id != null && input.campaign_id !== '') {
    return {
      ok: false,
      message: 'Articles are independent of Campaigns and must not include campaign_id.',
    }
  }
  if (Array.isArray(input.action_tags) && input.action_tags.length > 1) {
    return {
      ok: false,
      message: 'An Article must be associated with exactly one Action Tag.',
    }
  }

  const title = input.title.trim()
  if (!title) {
    return { ok: false, message: 'Article title is required.' }
  }

  const hasTagId = input.action_tag_id != null && Number.isFinite(Number(input.action_tag_id)) && Number(input.action_tag_id) > 0
  const hasTagKey = Boolean(input.action_tag_key?.trim())
  if (!hasTagId && !hasTagKey) {
    return {
      ok: false,
      message: 'Select one Action Tag for this Article.',
    }
  }

  if (input.status !== 'draft' && input.status !== 'ready' && input.status !== 'archived') {
    return { ok: false, message: 'Status must be draft, ready, or archived.' }
  }

  if (input.source_format === 'shortcode') {
    if (!input.raw_source?.trim()) {
      return {
        ok: false,
        message: 'Shortcode content is required for shortcode format.',
      }
    }
    if (!input.shortcode_mapping?.entries?.length) {
      return {
        ok: false,
        message: 'Shortcode mapping is required for shortcode format.',
      }
    }
  } else if (input.status === 'ready' && schema?.schema_available) {
    const vars = input.input ?? {}
    for (const field of schema.fields) {
      if (!field.required) continue
      const val = vars[field.key]
      if (val == null || String(val).trim() === '') {
        return {
          ok: false,
          message: `Required Script variable "${field.label || field.key}" must be populated for Ready articles.`,
        }
      }
    }
  }

  const payload: SaveLibraryArticleInput = {
    title: title.slice(0, 255),
    external_ref: input.external_ref?.trim() ? input.external_ref.trim().slice(0, 191) : null,
    ...(hasTagId ? { action_tag_id: Number(input.action_tag_id) } : {}),
    ...(hasTagKey ? { action_tag_key: input.action_tag_key!.trim() } : {}),
    status: input.status,
    source_format: input.source_format,
    ...(input.source_format === 'shortcode'
      ? {
          raw_source: input.raw_source ?? '',
          shortcode_mapping: input.shortcode_mapping ?? null,
          mapping_version: input.mapping_version ?? 1,
        }
      : {
          input: input.input ?? {},
        }),
  }

  return { ok: true, payload }
}

export function canEditCampaignAssignments(
  campaign: Pick<Campaign, 'status'> | null | undefined,
): boolean {
  return campaign?.status === 'draft'
}

export function isArticleCompatibleWithCampaign(
  article: Pick<LibraryArticle, 'status' | 'action_tag_id' | 'action_tag_key' | 'site_key'>,
  campaign: Pick<Campaign, 'action_tags' | 'site_key'>,
): boolean {
  if (article.status === 'archived') return false
  const planTags = campaign.action_tags ?? []
  if (planTags.length === 0) return false

  return planTags.some((t) => {
    const tagMatch =
      (t.action_tag_id != null &&
        article.action_tag_id > 0 &&
        Number(t.action_tag_id) === Number(article.action_tag_id)) ||
      (t.action_tag_key &&
        article.action_tag_key &&
        t.action_tag_key.toLowerCase() === article.action_tag_key.toLowerCase())
    if (!tagMatch) return false
    if (t.site_key && article.site_key) {
      return t.site_key.toLowerCase() === article.site_key.toLowerCase()
    }
    return true
  })
}

export function filterSelectableArticlesForCampaign(
  articles: LibraryArticle[],
  campaign: Pick<Campaign, 'action_tags' | 'site_key'>,
  assignedArticleIds: Set<string>,
  filters?: ArticleLibraryFilters,
): LibraryArticle[] {
  const search = filters?.search?.trim().toLowerCase() ?? ''
  return articles.filter((a) => {
    if (assignedArticleIds.has(a.id)) return false
    if (!isArticleCompatibleWithCampaign(a, campaign)) return false
    if (filters?.site_key && a.site_key !== filters.site_key) return false
    if (filters?.action_tag_key && a.action_tag_key !== filters.action_tag_key) {
      return false
    }
    if (filters?.status && a.status !== filters.status) return false
    if (search) {
      const hay = [a.title, a.external_ref ?? '', a.action_tag_key, a.site_key ?? '']
        .join(' ')
        .toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })
}
