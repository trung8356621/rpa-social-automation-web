import { staffApiRequest } from '@/lib/api/http'

import type {
  Campaign,
  CampaignContent,
  CampaignJobAttempt,
  CreateCampaignInput,
  CreateCampaignV2Input,
  ManualContentDraft,
  MockPreviewResult,
  MockSaveResult,
  ScriptInputSchema,
  UpdateCampaignInput,
  UpdateCampaignV2Input,
} from '../types'
import { buildLiveCampaignContentBody } from './build-content-payload'
import {
  buildLiveCampaignCreateBody,
  buildLiveCampaignV2CreateBody,
  buildLiveCampaignV2UpdateBody,
} from './build-create-payload'
import { unavailableScriptInputSchema } from '../script-compat'
import type {
  LiveCampaignDetailResponse,
  LiveCampaignListResponse,
  LiveCampaignMutationResponse,
} from './live-types'
import { extractLiveContentListRows } from './parse-content-list'
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
    if (!input.shortcode_mapping?.entries?.length) {
      throw new Error(
        'LIVE create requires shortcode_mapping (Shortcode V2). Zero contents allowed.',
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

  async createCampaignV2(input: CreateCampaignV2Input): Promise<Campaign> {
    if (!input.action_tags.length) {
      throw new Error('Campaign V2 requires at least one Action Tag.')
    }
    const body = buildLiveCampaignV2CreateBody(input)
    const res = await staffApiRequest<LiveCampaignMutationResponse>(
      CAMPAIGN_PATHS.list,
      { method: 'POST', body },
    )
    const row = res.data ?? res.campaign
    if (!row) throw new Error('Create Campaign V2 response missing data.')
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

  async updateCampaignV2(input: UpdateCampaignV2Input): Promise<Campaign> {
    if (!input.action_tags.length) {
      throw new Error('Campaign V2 requires at least one Action Tag.')
    }
    const body = buildLiveCampaignV2UpdateBody(input)
    const res = await staffApiRequest<LiveCampaignMutationResponse>(
      CAMPAIGN_PATHS.detail(input.id),
      { method: 'PUT', body },
    )
    const row = res.data ?? res.campaign
    if (!row) throw new Error('Update Campaign V2 response missing data.')
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
        'Campaign Content list requires campaignId (GET /campaigns/{id}/contents).',
      )
    }
    const res = await staffApiRequest<unknown>(
      CAMPAIGN_CONTENT_PATHS.list(campaignId),
      { method: 'GET' },
    )
    const rows = extractLiveContentListRows(res)
    return rows.map((row) => mapLiveContent(row, campaignId))
  },

  async createManualContent(
    draft: ManualContentDraft,
    opts?: {
      schema: ScriptInputSchema
      allowDiscard?: boolean
      preferShortcode?: boolean
    },
  ): Promise<CampaignContent> {
    if (!opts?.schema) {
      throw new Error(
        'Script input schema required for LIVE Content create. Do not guess variables.',
      )
    }
    const body = buildLiveCampaignContentBody(draft, {
      schema: opts.schema,
      allowDiscard: opts.allowDiscard === true,
      preferShortcode: opts.preferShortcode === true,
    })
    const res = await staffApiRequest<{ data?: unknown; content?: unknown }>(
      CAMPAIGN_CONTENT_PATHS.create(draft.campaign_id),
      { method: 'POST', body },
    )
    const row = res.data ?? res.content
    if (!row) throw new Error('Create Content response missing data.')
    return mapLiveContent(row, draft.campaign_id)
  },

  async updateManualContent(
    id: string,
    draft: ManualContentDraft,
    opts?: {
      schema: ScriptInputSchema
      allowDiscard?: boolean
      preferShortcode?: boolean
    },
  ): Promise<CampaignContent> {
    if (!opts?.schema) {
      throw new Error(
        'Script input schema required for LIVE Content update. Do not guess variables.',
      )
    }
    const body = buildLiveCampaignContentBody(draft, {
      schema: opts.schema,
      allowDiscard: opts.allowDiscard === true,
      preferShortcode: opts.preferShortcode === true,
    })
    const res = await staffApiRequest<{ data?: unknown; content?: unknown }>(
      CAMPAIGN_CONTENT_PATHS.update(draft.campaign_id, id),
      { method: 'PUT', body },
    )
    const row = res.data ?? res.content
    if (!row) throw new Error('Update Content response missing data.')
    return mapLiveContent(row, draft.campaign_id)
  },

  async mockPreviewContents(
    campaignId: string,
    count: number,
  ): Promise<MockPreviewResult> {
    const res = await staffApiRequest<{
      data?: {
        count?: number
        mapping_version?: number
        articles?: Array<{
          external_ref?: string
          raw_source?: string
          input?: Record<string, string | number | boolean | null>
        }>
      }
    }>(CAMPAIGN_CONTENT_PATHS.mockPreview(campaignId), {
      method: 'POST',
      body: { count },
    })
    const data = res.data
    if (!data) throw new Error('Mock preview response missing data.')
    return {
      count: Number(data.count ?? 0),
      mapping_version: Number(data.mapping_version ?? 0),
      articles: (data.articles ?? []).map((a, i) => ({
        external_ref: String(a.external_ref ?? `preview-${i + 1}`),
        raw_source: String(a.raw_source ?? ''),
        input: (a.input ?? {}) as Record<
          string,
          string | number | boolean | null
        >,
      })),
    }
  },

  async mockSaveContents(
    campaignId: string,
    count: number,
    idempotencyKey: string,
  ): Promise<MockSaveResult> {
    const res = await staffApiRequest<{
      data?: {
        count?: number
        mapping_version?: number
        idempotent?: boolean
        contents?: unknown[]
      }
    }>(CAMPAIGN_CONTENT_PATHS.mockSave(campaignId), {
      method: 'POST',
      body: { count, idempotency_key: idempotencyKey },
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    const data = res.data
    if (!data) throw new Error('Mock save response missing data.')
    return {
      count: Number(data.count ?? 0),
      mapping_version: Number(data.mapping_version ?? 0),
      idempotent: Boolean(data.idempotent),
      contents: (data.contents ?? []).map((row) =>
        mapLiveContent(row, campaignId),
      ),
    }
  },

  async removeDraftContent(_id: string): Promise<void> {
    throw new Error(
      'CONTRACT GAP: Campaign Content DELETE is not in OpenAPI. Use Skip/Cancel for terminal removal.',
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
    // Prefer nested attempts when Backend supplies them; otherwise surface
    // content-level execution status only when an actual job/error exists.
    const contents = await this.listContents(campaignId)
    const nested = contents.flatMap((c) =>
      (c.attempts ?? []).map((a) => ({
        ...a,
        content_id: a.content_id || c.id,
        campaign_id: a.campaign_id || campaignId,
      })),
    )
    if (nested.length > 0) return nested

    return contents
      .filter(
        (c) =>
          c.status !== 'pending' &&
          c.status !== 'draft' &&
          !(
            c.status === 'waiting_resources' &&
            !c.current_job_id &&
            !c.last_error_code &&
            !c.last_error_message
          ),
      )
      .map((c) => ({
        id: `content-status-${c.id}`,
        attempt_uuid: null,
        job_uuid: c.current_job_id ?? null,
        content_id: c.id,
        campaign_id: campaignId,
        attempt: 1,
        status: c.status,
        error_code: c.last_error_code,
        error_message: c.last_error_message,
        agent_label: null,
        browser_label: null,
        started_at: null,
        ended_at: null,
        error: c.last_error_message ?? c.last_result,
        artifacts: [],
      }))
  },

  getScriptInputSchema(_packageKey: string): ScriptInputSchema {
    // LIVE: schema comes from Script Registry detail — never invent keys here.
    return unavailableScriptInputSchema(null)
  },
}

/** True when adapter issues Staff Session requests (relative path + CSRF). */
export function liveAdapterUsesStaffSession(): boolean {
  return true
}
