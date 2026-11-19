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
import { buildLiveCampaignCreateBody } from './build-create-payload'
import type {
  LiveCampaignDetailResponse,
  LiveCampaignListResponse,
  LiveCampaignMutationResponse,
} from './live-types'
import { CAMPAIGN_PATHS, CAMPAIGN_CONTENT_PATHS } from './paths'
import { mapLiveCampaign, mapLiveContent } from './mappers'

/**
 * Live Staff Session Campaign adapter (CP19A/B OpenAPI origin/main).
 * Uses relative paths + CSRF via staffApiRequest.
 * Never embeds Client API Key.
 * Manual Content CRUD after create is not in OpenAPI — contents belong on create.
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
    if (!input.contents || input.contents.length === 0) {
      throw new Error(
        'LIVE create requires contents[] (OpenAPI minItems: 1). Add at least one title-only Article.',
      )
    }
    if (!String(input.script_version ?? '').trim()) {
      throw new Error(
        'LIVE create requires script_version (exact published release).',
      )
    }
    if (!String(input.account_id ?? '').trim()) {
      throw new Error(
        'LIVE create requires account_id (hard Account UUID pin). No silent fallback.',
      )
    }
    const body = buildLiveCampaignCreateBody(input)
    const res = await staffApiRequest<LiveCampaignMutationResponse>(
      CAMPAIGN_PATHS.list,
      { method: 'POST', body },
    )
    const row = res.data ?? res.campaign
    if (!row) throw new Error('Create Campaign response missing data.')
    return mapLiveCampaign(row)
  },

  async updateCampaign(
    input: UpdateCampaignInput,
    _meta?: { site_name?: string; script_name?: string },
  ): Promise<Campaign> {
    // OpenAPI update: limited fields — name / platform / execution_mode / recheck while draft
    const body: Record<string, unknown> = {
      name: input.name,
      platform: input.site_key,
      execution_mode: input.execution_mode,
      resource_recheck_seconds: input.schedule.resource_recheck_seconds,
    }
    const res = await staffApiRequest<LiveCampaignMutationResponse>(
      CAMPAIGN_PATHS.detail(input.id),
      { method: 'PUT', body },
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

  async listContents(campaignId?: string): Promise<CampaignContent[]> {
    if (!campaignId) {
      throw new Error(
        'CONTRACT GAP: Global Manual Content list is not in OpenAPI. Load contents via Campaign detail.',
      )
    }
    const detail = await this.getCampaign(campaignId)
    return (detail.contents ?? []).map((c) => ({
      ...c,
      campaign_id: c.campaign_id || campaignId,
    }))
  },

  async createManualContent(_draft: ManualContentDraft): Promise<CampaignContent> {
    throw new Error(
      'CONTRACT GAP: Manual Content create after Campaign is not in OpenAPI. Include contents[] on Campaign create.',
    )
  },

  async updateManualContent(
    _id: string,
    _draft: ManualContentDraft,
  ): Promise<CampaignContent> {
    throw new Error(
      'CONTRACT GAP: Manual Content update is not in OpenAPI. No fake success.',
    )
  },

  async removeDraftContent(_id: string): Promise<void> {
    throw new Error(
      'CONTRACT GAP: Manual Content delete is not in OpenAPI. No fake success.',
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

  async listJobAttempts(campaignId: string): Promise<CampaignJobAttempt[]> {
    // No dedicated Job Attempt history route in OpenAPI — surface content status only.
    const contents = await this.listContents(campaignId)
    return contents
      .filter((c) => c.status !== 'pending' && c.status !== 'draft')
      .map((c, i) => ({
        id: `content-status-${c.id}`,
        content_id: c.id,
        campaign_id: campaignId,
        attempt: i + 1,
        status: c.status,
        agent_label: null,
        browser_label: null,
        started_at: null,
        ended_at: null,
        error: c.last_error_message ?? c.last_result,
        artifacts: [],
      }))
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
