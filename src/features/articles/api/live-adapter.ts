import { staffApiRequest } from '@/lib/api/http'

import type {
  ArticleLibraryFilters,
  AssignCampaignArticleItem,
  CampaignArticleAssignment,
  CompatibleArticleFilters,
  LibraryArticle,
  SaveLibraryArticleInput,
} from '../types'
import {
  mapLiveCampaignArticleAssignment,
  mapLiveLibraryArticle,
} from './mappers'
import { ARTICLE_PATHS, CAMPAIGN_ARTICLE_PATHS } from './paths'

type ApiEnvelope<T> = {
  ok?: boolean
  data?: T
  pending?: string
  errors?: string[]
  message?: string
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue
    qs.set(k, String(v))
  }
  const str = qs.toString()
  return str ? `?${str}` : ''
}

export const liveArticleAdapter = {
  mode: 'live' as const,

  async listArticles(
    filters?: ArticleLibraryFilters,
    signal?: AbortSignal,
  ): Promise<LibraryArticle[]> {
    const query = buildQuery({
      site_id: filters?.site_id,
      site_key: filters?.site_key,
      action_tag_id: filters?.action_tag_id,
      action_tag_key: filters?.action_tag_key,
      status: filters?.status,
      search: filters?.search,
    })
    const res = await staffApiRequest<ApiEnvelope<unknown[]>>(
      `${ARTICLE_PATHS.list}${query}`,
      { method: 'GET', signal },
    )
    return Array.isArray(res.data) ? res.data.map(mapLiveLibraryArticle) : []
  },

  async listCompatibleArticles(
    filters: CompatibleArticleFilters,
    signal?: AbortSignal,
  ): Promise<LibraryArticle[]> {
    const query = buildQuery({
      campaign_id: filters.campaign_id,
      site_id: filters.site_id,
      site_key: filters.site_key,
      action_tag_id: filters.action_tag_id,
      action_tag_key: filters.action_tag_key,
      status: filters.status,
      search: filters.search,
      exclude_assigned: filters.exclude_assigned ?? true,
    })
    const res = await staffApiRequest<ApiEnvelope<unknown[]>>(
      `${ARTICLE_PATHS.compatible}${query}`,
      { method: 'GET', signal },
    )
    return Array.isArray(res.data) ? res.data.map(mapLiveLibraryArticle) : []
  },

  async getArticle(id: string, signal?: AbortSignal): Promise<LibraryArticle> {
    const res = await staffApiRequest<ApiEnvelope<unknown>>(
      ARTICLE_PATHS.detail(id),
      { method: 'GET', signal },
    )
    if (!res.data) throw new Error('Article payload missing.')
    return mapLiveLibraryArticle(res.data)
  },

  async createArticle(input: SaveLibraryArticleInput): Promise<LibraryArticle> {
    const res = await staffApiRequest<ApiEnvelope<unknown>>(ARTICLE_PATHS.list, {
      method: 'POST',
      body: input,
    })
    if (!res.data) throw new Error('Create Article response missing data.')
    return mapLiveLibraryArticle(res.data)
  },

  async updateArticle(
    id: string,
    input: SaveLibraryArticleInput,
  ): Promise<LibraryArticle> {
    const res = await staffApiRequest<ApiEnvelope<unknown>>(
      ARTICLE_PATHS.detail(id),
      {
        method: 'PUT',
        body: input,
      },
    )
    if (!res.data) throw new Error('Update Article response missing data.')
    return mapLiveLibraryArticle(res.data)
  },

  async deleteArticle(id: string): Promise<void> {
    await staffApiRequest<ApiEnvelope<unknown>>(ARTICLE_PATHS.detail(id), {
      method: 'DELETE',
    })
  },

  async listCampaignArticles(
    campaignId: string,
    signal?: AbortSignal,
  ): Promise<CampaignArticleAssignment[]> {
    const res = await staffApiRequest<ApiEnvelope<unknown[]>>(
      CAMPAIGN_ARTICLE_PATHS.list(campaignId),
      { method: 'GET', signal },
    )
    return Array.isArray(res.data)
      ? res.data.map(mapLiveCampaignArticleAssignment)
      : []
  },

  async assignCampaignArticles(
    campaignId: string,
    items: AssignCampaignArticleItem[],
  ): Promise<CampaignArticleAssignment[]> {
    const res = await staffApiRequest<ApiEnvelope<unknown[]>>(
      CAMPAIGN_ARTICLE_PATHS.assign(campaignId),
      {
        method: 'POST',
        body: { articles: items },
      },
    )
    return Array.isArray(res.data)
      ? res.data.map(mapLiveCampaignArticleAssignment)
      : []
  },

  async removeCampaignArticle(
    campaignId: string,
    articleOrContentId: string,
  ): Promise<void> {
    await staffApiRequest<ApiEnvelope<unknown>>(
      CAMPAIGN_ARTICLE_PATHS.remove(campaignId, articleOrContentId),
      { method: 'DELETE' },
    )
  },
}
