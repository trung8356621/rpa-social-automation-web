import { staffApiRequest } from '@/lib/api/http'

import type {
  Campaign,
  CampaignContent,
  CampaignJobAttempt,
  CreateCampaignInput,
  ManualContentDraft,
  ScriptInputSchema,
  UpdateCampaignInput,
} from '../types'
import type {
  LiveCampaignDetailResponse,
  LiveCampaignListResponse,
  LiveCampaignMutationResponse,
} from './live-types'
import { CAMPAIGN_PATHS, CAMPAIGN_CONTENT_PATHS } from './paths'
import { mapLiveCampaign, mapLiveContent } from './mappers'

/**
 * Live Staff Session Campaign adapter (CP19A/B routes).
 * Uses relative paths + CSRF via staffApiRequest.
 * Never embeds Client API Key.
 * Manual Content routes (CP19C) are NOT wired until OpenAPI is available.
 */
export const liveCampaignAdapter = {
  mode: 'live' as const,

  async listCampaigns(signal?: AbortSignal): Promise<Campaign[]> {
    const res = await staffApiRequest<LiveCampaignListResponse>(
      CAMPAIGN_PATHS.list,
      { method: 'GET', signal },
    )
    const rows = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.campaigns)
        ? res.campaigns
        : []
    return rows.map(mapLiveCampaign)
  },

  async getCampaign(id: string, signal?: AbortSignal): Promise<Campaign> {
    const res = await staffApiRequest<LiveCampaignDetailResponse>(
      CAMPAIGN_PATHS.detail(id),
      { method: 'GET', signal },
    )
    const row = res.data ?? res.campaign
    if (!row) throw new Error('Campaign detail payload missing.')
    return mapLiveCampaign(row)
  },

  async createCampaign(
    input: CreateCampaignInput,
    _meta?: { site_name?: string; script_name?: string },
  ): Promise<Campaign> {
    const res = await staffApiRequest<LiveCampaignMutationResponse>(
      CAMPAIGN_PATHS.list,
      { method: 'POST', body: input },
    )
    const row = res.data ?? res.campaign
    if (!row) throw new Error('Create Campaign response missing data.')
    return mapLiveCampaign(row)
  },

  async updateCampaign(
    input: UpdateCampaignInput,
    _meta?: { site_name?: string; script_name?: string },
  ): Promise<Campaign> {
    const res = await staffApiRequest<LiveCampaignMutationResponse>(
      CAMPAIGN_PATHS.detail(input.id),
      { method: 'PUT', body: input },
    )
    const row = res.data ?? res.campaign
    if (!row) throw new Error('Update Campaign response missing data.')
    return mapLiveCampaign(row)
  },

  async startCampaign(id: string): Promise<Campaign> {
    const res = await staffApiRequest<LiveCampaignMutationResponse>(
      CAMPAIGN_PATHS.start(id),
      { method: 'POST', body: {} },
    )
    const row = res.data ?? res.campaign
    if (!row) throw new Error('Start Campaign response missing data.')
    return mapLiveCampaign(row)
  },

  async pauseCampaign(id: string): Promise<Campaign> {
    const res = await staffApiRequest<LiveCampaignMutationResponse>(
      CAMPAIGN_PATHS.pause(id),
      { method: 'POST', body: {} },
    )
    const row = res.data ?? res.campaign
    if (!row) throw new Error('Pause Campaign response missing data.')
    return mapLiveCampaign(row)
  },

  async resumeCampaign(id: string): Promise<Campaign> {
    const res = await staffApiRequest<LiveCampaignMutationResponse>(
      CAMPAIGN_PATHS.resume(id),
      { method: 'POST', body: {} },
    )
    const row = res.data ?? res.campaign
    if (!row) throw new Error('Resume Campaign response missing data.')
    return mapLiveCampaign(row)
  },

  async cancelCampaign(id: string): Promise<Campaign> {
    const res = await staffApiRequest<LiveCampaignMutationResponse>(
      CAMPAIGN_PATHS.cancel(id),
      { method: 'POST', body: {} },
    )
    const row = res.data ?? res.campaign
    if (!row) throw new Error('Cancel Campaign response missing data.')
    return mapLiveCampaign(row)
  },

  async listContents(_campaignId?: string): Promise<CampaignContent[]> {
    // CP19C Manual Content routes — contract gap until OpenAPI available
    throw new Error(
      'CONTRACT GAP: Manual Content list routes (CP19C) are not wired. Do not invent endpoints.',
    )
  },

  async createManualContent(_draft: ManualContentDraft): Promise<CampaignContent> {
    throw new Error(
      'CONTRACT GAP: Manual Content create (CP19C) is not available. No fake success.',
    )
  },

  async updateManualContent(
    _id: string,
    _draft: ManualContentDraft,
  ): Promise<CampaignContent> {
    throw new Error(
      'CONTRACT GAP: Manual Content update (CP19C) is not available. No fake success.',
    )
  },

  async removeDraftContent(_id: string): Promise<void> {
    throw new Error(
      'CONTRACT GAP: Manual Content delete (CP19C) is not available. No fake success.',
    )
  },

  async retryContent(
    id: string,
    opts?: { idempotencyKey: string },
  ): Promise<CampaignContent> {
    const headers: Record<string, string> = {}
    if (opts?.idempotencyKey) {
      headers['Idempotency-Key'] = opts.idempotencyKey
    }
    const res = await staffApiRequest<{
      data?: unknown
      content?: unknown
    }>(CAMPAIGN_CONTENT_PATHS.retry(id), {
      method: 'POST',
      body: {},
      headers,
    })
    const row = res.data ?? res.content
    if (!row) throw new Error('Retry Content response missing data.')
    return mapLiveContent(row)
  },

  async skipContent(id: string): Promise<CampaignContent> {
    const res = await staffApiRequest<{ data?: unknown; content?: unknown }>(
      CAMPAIGN_CONTENT_PATHS.skip(id),
      { method: 'POST', body: {} },
    )
    const row = res.data ?? res.content
    if (!row) throw new Error('Skip Content response missing data.')
    return mapLiveContent(row)
  },

  async cancelContent(id: string): Promise<CampaignContent> {
    const res = await staffApiRequest<{ data?: unknown; content?: unknown }>(
      CAMPAIGN_CONTENT_PATHS.cancel(id),
      { method: 'POST', body: {} },
    )
    const row = res.data ?? res.content
    if (!row) throw new Error('Cancel Content response missing data.')
    return mapLiveContent(row)
  },

  async listJobAttempts(_campaignId: string): Promise<CampaignJobAttempt[]> {
    // History may arrive nested in detail — CP19C gap if separate route
    throw new Error(
      'CONTRACT GAP: Campaign Job Attempt history route not confirmed in OpenAPI.',
    )
  },

  getScriptInputSchema(_packageKey: string): ScriptInputSchema {
    // Live Script Registry variables exist on detail; UI resolves via Script Registry hook.
    return {
      fields: [],
      test_mode_compatible: null,
      title_required: false,
      body_required: false,
    }
  },
}

/** True when adapter issues Staff Session requests (relative path + CSRF). */
export function liveAdapterUsesStaffSession(): boolean {
  return true
}
