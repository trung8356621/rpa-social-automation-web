import { ApiError } from '../../../lib/api/errors.ts'
import { getMockCampaignStore } from '../../campaigns/api/mock-adapter.ts'
import type {
  ArticleLibraryFilters,
  AssignCampaignArticleItem,
  CampaignArticleAssignment,
  CompatibleArticleFilters,
  LibraryArticle,
  SaveLibraryArticleInput,
} from '../types.ts'
import { isArticleCompatibleWithCampaign } from '../validation.ts'

const SEED_ARTICLES: LibraryArticle[] = [
  {
    id: 'art_mock_wp_1',
    title: 'WordPress Product Launch Guide',
    external_ref: 'wp-launch-1',
    action_tag_id: 1,
    action_tag_key: 'mayhopphat.create_post',
    site_id: 1,
    site_key: 'mayhopphat',
    status: 'ready',
    source_format: 'legacy_input',
    raw_source: null,
    input: {
      title: 'WordPress Product Launch Guide',
      body: 'Step-by-step launch checklist for WordPress.',
    },
    shortcode_mapping: null,
    mapping_version: 0,
    meta: null,
    created_at: '2026-11-22T08:00:00Z',
    updated_at: '2026-11-22T09:15:00Z',
  },
  {
    id: 'art_mock_wp_2',
    title: 'SEO Best Practices 2026',
    external_ref: 'wp-seo-2',
    action_tag_id: 1,
    action_tag_key: 'mayhopphat.create_post',
    site_id: 1,
    site_key: 'mayhopphat',
    status: 'draft',
    source_format: 'legacy_input',
    raw_source: null,
    input: {
      title: 'SEO Best Practices 2026',
      body: 'Draft notes on technical SEO.',
    },
    shortcode_mapping: null,
    mapping_version: 0,
    meta: null,
    created_at: '2026-11-22T10:00:00Z',
    updated_at: '2026-11-22T10:30:00Z',
  },
]

let mockArticles: LibraryArticle[] = structuredClone(SEED_ARTICLES)
let mockAssignmentsByCampaign: Record<string, CampaignArticleAssignment[]> = {}

export function resetMockArticleStore(): void {
  mockArticles = structuredClone(SEED_ARTICLES)
  mockAssignmentsByCampaign = {}
}

function nowIso(): string {
  return new Date().toISOString()
}

export const mockArticleAdapter = {
  mode: 'mock' as const,

  async listArticles(filters?: ArticleLibraryFilters): Promise<LibraryArticle[]> {
    const q = filters?.search?.trim().toLowerCase() ?? ''
    return structuredClone(
      mockArticles.filter((a) => {
        if (filters?.site_id && a.site_id !== filters.site_id) return false
        if (filters?.site_key && a.site_key !== filters.site_key) return false
        if (filters?.action_tag_id && a.action_tag_id !== filters.action_tag_id) {
          return false
        }
        if (
          filters?.action_tag_key &&
          a.action_tag_key !== filters.action_tag_key
        ) {
          return false
        }
        if (filters?.status && a.status !== filters.status) return false
        if (q) {
          const hay = [a.title, a.external_ref ?? '', a.action_tag_key, a.site_key ?? '']
            .join(' ')
            .toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      }),
    )
  },

  async listCompatibleArticles(
    filters: CompatibleArticleFilters,
  ): Promise<LibraryArticle[]> {
    let rows = mockArticles.filter((a) => a.status !== 'archived')
    if (filters.campaign_id) {
      const camp = getMockCampaignStore().campaigns.find(
        (c) => c.id === filters.campaign_id,
      )
      if (!camp) {
        throw new ApiError('Campaign not found.', {
          kind: 'not_found',
          status: 404,
          code: 'campaign_not_found',
        })
      }
      const assignedIds = new Set(
        (mockAssignmentsByCampaign[camp.id] ?? [])
          .map((x) => x.article_id)
          .filter((x): x is string => Boolean(x)),
      )
      rows = rows.filter((a) => {
        if ((filters.exclude_assigned ?? true) && assignedIds.has(a.id)) {
          return false
        }
        return isArticleCompatibleWithCampaign(a, camp)
      })
    }
    const q = filters.search?.trim().toLowerCase() ?? ''
    if (filters.site_key) rows = rows.filter((a) => a.site_key === filters.site_key)
    if (filters.action_tag_key) {
      rows = rows.filter((a) => a.action_tag_key === filters.action_tag_key)
    }
    if (q) {
      rows = rows.filter((a) =>
        [a.title, a.external_ref ?? ''].join(' ').toLowerCase().includes(q),
      )
    }
    return structuredClone(rows)
  },

  async getArticle(id: string): Promise<LibraryArticle> {
    const found = mockArticles.find((a) => a.id === id)
    if (!found) {
      throw new ApiError('Article not found.', {
        kind: 'not_found',
        status: 404,
        code: 'article_not_found',
      })
    }
    return structuredClone(found)
  },

  async createArticle(input: SaveLibraryArticleInput): Promise<LibraryArticle> {
    if (!input.title.trim()) {
      throw new ApiError('Article title is required.', {
        kind: 'validation',
        status: 422,
        code: 'title_required',
      })
    }
    const tagKey = input.action_tag_key?.trim() || 'mayhopphat.create_post'
    const siteKey = tagKey.includes('.') ? tagKey.split('.')[0]! : 'mayhopphat'
    const created: LibraryArticle = {
      id: `art_mock_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: input.title.trim(),
      external_ref: input.external_ref ?? null,
      action_tag_id: input.action_tag_id ?? 1,
      action_tag_key: tagKey,
      site_id: 1,
      site_key: siteKey,
      status: input.status,
      source_format: input.source_format,
      raw_source: input.raw_source ?? null,
      input: structuredClone(input.input ?? {}),
      shortcode_mapping: input.shortcode_mapping ?? null,
      mapping_version: input.mapping_version ?? 0,
      meta: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    mockArticles = [created, ...mockArticles]
    return structuredClone(created)
  },

  async updateArticle(
    id: string,
    input: SaveLibraryArticleInput,
  ): Promise<LibraryArticle> {
    const idx = mockArticles.findIndex((a) => a.id === id)
    if (idx === -1) {
      throw new ApiError('Article not found.', {
        kind: 'not_found',
        status: 404,
        code: 'article_not_found',
      })
    }
    const prev = mockArticles[idx]!
    const tagKey = input.action_tag_key?.trim() || prev.action_tag_key
    const siteKey = tagKey.includes('.') ? tagKey.split('.')[0]! : prev.site_key
    const updated: LibraryArticle = {
      ...prev,
      title: input.title.trim(),
      external_ref: input.external_ref ?? null,
      action_tag_id: input.action_tag_id ?? prev.action_tag_id,
      action_tag_key: tagKey,
      site_key: siteKey,
      status: input.status,
      source_format: input.source_format,
      raw_source: input.raw_source ?? null,
      input: structuredClone(input.input ?? prev.input),
      shortcode_mapping: input.shortcode_mapping ?? prev.shortcode_mapping,
      mapping_version: input.mapping_version ?? prev.mapping_version,
      updated_at: nowIso(),
    }
    mockArticles[idx] = updated
    return structuredClone(updated)
  },

  async deleteArticle(id: string): Promise<void> {
    const inUse = Object.values(mockAssignmentsByCampaign).some((rows) =>
      rows.some((r) => r.article_id === id),
    )
    if (inUse) {
      throw new ApiError('Article is in use by one or more Campaigns.', {
        kind: 'conflict',
        status: 409,
        code: 'article_in_use',
      })
    }
    mockArticles = mockArticles.filter((a) => a.id !== id)
  },

  async listCampaignArticles(
    campaignId: string,
  ): Promise<CampaignArticleAssignment[]> {
    const camp = getMockCampaignStore().campaigns.find((c) => c.id === campaignId)
    if (!camp) {
      throw new ApiError('Campaign not found.', {
        kind: 'not_found',
        status: 404,
        code: 'campaign_not_found',
      })
    }
    const existing = mockAssignmentsByCampaign[campaignId]
    if (existing) return structuredClone(existing)

    // Preserve legacy inline contents if present in mock store
    const legacy = getMockCampaignStore()
      .contents.filter((c) => c.campaign_id === campaignId)
      .map((c, idx) => ({
        content_id: c.id,
        assignment_id: null,
        article_id: null,
        article_title: c.input.title ?? c.external_ref,
        external_ref: c.external_ref,
        sort_order: idx + 1,
        status: c.status,
        is_legacy_inline: true,
        action_tag_id: null,
        action_tag_key: c.assignments?.[0]?.action_tag_key ?? null,
        site_id: null,
        site_key: camp.site_key || null,
        release_id: c.assignments?.[0]?.release_id ?? null,
        script_id: camp.script_package_key,
        script_version: camp.script_version,
        input: c.input as Record<string, unknown>,
        snapshot_at: camp.status === 'draft' ? null : camp.updated_at,
      }))
    return structuredClone(legacy)
  },

  async assignCampaignArticles(
    campaignId: string,
    items: AssignCampaignArticleItem[],
  ): Promise<CampaignArticleAssignment[]> {
    const camp = getMockCampaignStore().campaigns.find((c) => c.id === campaignId)
    if (!camp) {
      throw new ApiError('Campaign not found.', {
        kind: 'not_found',
        status: 404,
        code: 'campaign_not_found',
      })
    }
    if (camp.status !== 'draft') {
      throw new ApiError(
        'Articles can only be assigned when Campaign is in draft status.',
        { kind: 'validation', status: 422, code: 'campaign_not_draft' },
      )
    }

    const current = mockAssignmentsByCampaign[campaignId] ?? []
    const existingIds = new Set(
      current.map((r) => r.article_id).filter((x): x is string => Boolean(x)),
    )
    let maxOrder = current.reduce((m, r) => Math.max(m, r.sort_order), 0)
    const created: CampaignArticleAssignment[] = []

    for (const item of items) {
      if (existingIds.has(item.article_id)) {
        throw new ApiError(
          `Article '${item.article_id}' is already assigned to this Campaign.`,
          {
            kind: 'validation',
            status: 422,
            code: 'duplicate_article_assignment',
          },
        )
      }
      const art = mockArticles.find((a) => a.id === item.article_id)
      if (!art) {
        throw new ApiError(`Article '${item.article_id}' was not found.`, {
          kind: 'validation',
          status: 422,
          code: 'article_not_found',
        })
      }
      if (!isArticleCompatibleWithCampaign(art, camp)) {
        throw new ApiError(
          `Article Action Tag '${art.action_tag_key}' is not configured on this Campaign.`,
          {
            kind: 'validation',
            status: 422,
            code: 'incompatible_article_action_tag',
          },
        )
      }
      const planTag = camp.action_tags?.find(
        (t) =>
          t.action_tag_key === art.action_tag_key ||
          t.action_tag_id === art.action_tag_id,
      )
      const order = item.sort_order ?? ++maxOrder
      maxOrder = Math.max(maxOrder, order)
      existingIds.add(art.id)
      created.push({
        content_id: `cnt_${Date.now()}_${order}`,
        assignment_id: `asgn_${Date.now()}_${order}`,
        article_id: art.id,
        article_title: art.title,
        external_ref: art.external_ref,
        sort_order: order,
        status: 'pending',
        is_legacy_inline: false,
        action_tag_id: art.action_tag_id,
        action_tag_key: art.action_tag_key,
        site_id: art.site_id,
        site_key: art.site_key,
        release_id: planTag?.release_id ?? null,
        script_id: planTag?.script_package_key ?? camp.script_package_key,
        script_version: planTag?.script_version ?? camp.script_version,
        input: structuredClone(art.input),
        snapshot_at: null,
      })
    }

    mockAssignmentsByCampaign[campaignId] = [...current, ...created]
    return structuredClone(created)
  },

  async removeCampaignArticle(
    campaignId: string,
    articleOrContentId: string,
  ): Promise<void> {
    const camp = getMockCampaignStore().campaigns.find((c) => c.id === campaignId)
    if (!camp) {
      throw new ApiError('Campaign not found.', {
        kind: 'not_found',
        status: 404,
        code: 'campaign_not_found',
      })
    }
    if (camp.status !== 'draft') {
      throw new ApiError(
        'Articles can only be removed when Campaign is in draft status.',
        { kind: 'validation', status: 422, code: 'campaign_not_draft' },
      )
    }
    const current = mockAssignmentsByCampaign[campaignId] ?? []
    mockAssignmentsByCampaign[campaignId] = current.filter(
      (r) =>
        r.article_id !== articleOrContentId &&
        r.content_id !== articleOrContentId &&
        r.assignment_id !== articleOrContentId,
    )
  },
}
