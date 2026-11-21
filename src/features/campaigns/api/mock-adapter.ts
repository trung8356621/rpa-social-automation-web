import { draftToScriptInput } from '../content-adapters.ts'
import {
  createMockCampaignStore,
  MOCK_SCRIPT_INPUT_SCHEMAS,
  MOCK_TEST_MODE_COMPATIBLE_SCRIPTS,
} from '../mock-data.ts'
import { summarizeContents } from '../status-labels.ts'
import type {
  Campaign,
  CampaignAction,
  CampaignContent,
  CampaignJobAttempt,
  CampaignStoreSnapshot,
  CreateCampaignInput,
  CreateCampaignV2Input,
  ManualContentDraft,
  MockPreviewResult,
  MockSaveResult,
  ScriptInputSchema,
  UpdateCampaignInput,
} from '../types.ts'
import { parseScriptInputSchema } from '../script-compat.ts'
import { serializeShortcodeSegments } from '../shortcode-source.ts'
import { buildLiveCampaignContentBody } from './build-content-payload.ts'

function actionsFor(status: Campaign['status']): CampaignAction[] {
  switch (status) {
    case 'draft':
      return ['edit', 'start', 'cancel']
    case 'scheduled':
      return ['edit', 'start', 'cancel']
    case 'running':
      return ['pause', 'cancel']
    case 'paused':
      return ['resume', 'cancel', 'start']
    default:
      return []
  }
}

function refreshSummaries(store: CampaignStoreSnapshot): void {
  for (const c of store.campaigns) {
    const statuses = store.contents
      .filter((x) => x.campaign_id === c.id)
      .map((x) => x.status)
    c.summary = summarizeContents(statuses)
    const baseActions = actionsFor(c.status)
    c.allowed_actions =
      c.plan_version === 2
        ? baseActions.filter((a) => a !== 'start')
        : baseActions
  }
}

let store: CampaignStoreSnapshot = createMockCampaignStore()

/** Reset fixtures — tests only */
export function resetMockCampaignStore(): void {
  store = createMockCampaignStore()
}

export function getMockCampaignStore(): CampaignStoreSnapshot {
  return store
}

function assertMockOnly(): void {
  // Hard guard: mock adapter must never touch fetch / production hosts
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as { __RPA_CAMPAIGN_MOCK_FETCH_GUARD__?: boolean }
    if (g.__RPA_CAMPAIGN_MOCK_FETCH_GUARD__) {
      throw new Error('MOCK campaign adapter must not call production fetch.')
    }
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function findCampaign(id: string): Campaign {
  const c = store.campaigns.find((x) => x.id === id)
  if (!c) throw new Error(`Campaign not found: ${id}`)
  return c
}

export const mockCampaignAdapter = {
  mode: 'mock' as const,

  async listCampaigns(): Promise<Campaign[]> {
    assertMockOnly()
    refreshSummaries(store)
    return structuredClone(store.campaigns)
  },

  async getCampaign(id: string): Promise<Campaign> {
    assertMockOnly()
    refreshSummaries(store)
    return structuredClone(findCampaign(id))
  },

  async createCampaign(
    input: CreateCampaignInput,
    meta?: { site_name?: string; script_name?: string },
  ): Promise<Campaign> {
    assertMockOnly()
    const id = `camp_local_${Date.now()}`
    const mapping = input.shortcode_mapping?.entries?.length
      ? structuredClone(input.shortcode_mapping)
      : null
    const campaign: Campaign = {
      id,
      name: input.name,
      site_key: input.site_key,
      site_name: meta?.site_name ?? input.site_key,
      script_package_key: input.script_package_key,
      script_name: meta?.script_name ?? input.script_package_key,
      script_version: input.script_version || '1.0.0',
      account_id: input.account_id?.trim() || null,
      execution_mode: input.execution_mode,
      run_mode: input.run_mode,
      status: input.schedule.type === 'scheduled' ? 'scheduled' : 'draft',
      schedule: structuredClone(input.schedule),
      summary: summarizeContents([]),
      created_at: nowIso(),
      updated_at: nowIso(),
      allowed_actions: actionsFor(
        input.schedule.type === 'scheduled' ? 'scheduled' : 'draft',
      ),
      shortcode_mapping: mapping,
      shortcode_mapping_version: mapping ? 1 : null,
    }
    store.campaigns = [campaign, ...store.campaigns]
    if (input.contents && input.contents.length > 0) {
      const pinned = input.account_id?.trim() || null
      const rows: CampaignContent[] = input.contents.map((row, i) => {
        const raw = row.raw_source?.trim() || null
        return {
          id: `cnt_local_${Date.now()}_${i}`,
          campaign_id: id,
          external_ref: row.external_ref?.trim() || `manual-${i + 1}`,
          source: 'manual' as const,
          status: 'pending' as const,
          input: {
            title: row.title ?? null,
            body: row.body ?? null,
            variables: { ...(row.variables ?? {}) },
          },
          source_format: raw ? ('shortcode' as const) : ('legacy_input' as const),
          raw_source: raw,
          mapping_version: raw && mapping ? 1 : null,
          editor_doc: null,
          assigned_account_id: pinned,
          assigned_account_label: pinned,
          current_job_id: null,
          last_result: null,
          last_error_code: null,
          last_error_message: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
      })
      store.contents = [...rows, ...store.contents]
      refreshSummaries(store)
    }
    return structuredClone(campaign)
  },

  async createCampaignV2(input: CreateCampaignV2Input): Promise<Campaign> {
    assertMockOnly()
    const id = `camp_v2_${Date.now()}`
    const firstTag = input.action_tags[0]
    const actionTags = input.action_tags.map((t) => ({
      action_tag_id: t.action_tag_id ?? null,
      action_tag_key: t.action_tag_key,
      site_key: t.site_key,
      site_name: t.site_name ?? t.site_key,
      cms_type: t.cms_type ?? null,
      script_package_key: t.script_package_key,
      script_name: t.script_name ?? t.script_package_key,
      script_version: t.script_version,
      release_id: t.release_id ?? null,
      resolution_source: t.resolution_source,
      shortcode_mapping: structuredClone(t.shortcode_mapping),
    }))

    const rows: CampaignContent[] = input.contents.map((c, i) => ({
      id: `cnt_v2_${Date.now()}_${i}`,
      campaign_id: id,
      external_ref: c.external_ref?.trim() || `content-${i + 1}`,
      source: 'manual' as const,
      status: 'pending' as const,
      input: { title: null, body: null, variables: {} },
      source_format: 'shortcode' as const,
      raw_source: c.raw_source,
      mapping_version: 1,
      editor_doc: null,
      assigned_account_id: null,
      assigned_account_label: null,
      current_job_id: null,
      last_result: null,
      last_error_code: null,
      last_error_message: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      assignments: c.assignments.map((a, ai) => ({
        id: `asgn_v2_${Date.now()}_${i}_${ai}`,
        action_tag_id: a.action_tag_id ?? null,
        action_tag_key: a.action_tag_key,
        script_package_key: a.script_package_key,
        script_version: a.script_version,
        release_id: a.release_id ?? null,
        status: 'pending' as const,
        raw_source: a.raw_source,
        shortcode_mapping: structuredClone(a.shortcode_mapping),
      })),
    }))

    const campaign: Campaign = {
      id,
      plan_version: 2,
      name: input.name.trim(),
      site_key: firstTag?.site_key ?? '',
      site_name: firstTag?.site_name ?? firstTag?.site_key ?? '',
      script_package_key: firstTag?.script_package_key ?? '',
      script_name: firstTag?.script_name ?? firstTag?.script_package_key ?? '',
      script_version: firstTag?.script_version ?? '',
      account_id: null,
      execution_mode: input.execution_mode ?? 'one_account_one_job',
      run_mode: input.run_mode,
      status: 'draft',
      schedule: {
        type: 'immediate',
        timezone: 'Asia/Ho_Chi_Minh',
        start_at: null,
        daily_window: null,
        min_interval_seconds: null,
        resource_recheck_seconds: 3600,
      },
      summary: summarizeContents(rows.map((r) => r.status)),
      created_at: nowIso(),
      updated_at: nowIso(),
      allowed_actions: ['edit', 'cancel'],
      shortcode_mapping: firstTag?.shortcode_mapping
        ? structuredClone(firstTag.shortcode_mapping)
        : null,
      shortcode_mapping_version: firstTag ? 1 : null,
      action_tags: actionTags,
    }

    store.campaigns = [campaign, ...store.campaigns]
    if (rows.length > 0) {
      store.contents = [...rows, ...store.contents]
      refreshSummaries(store)
    }
    return structuredClone(campaign)
  },

  async updateCampaign(
    input: UpdateCampaignInput,
    meta?: { site_name?: string; script_name?: string },
  ): Promise<Campaign> {
    assertMockOnly()
    const c = findCampaign(input.id)
    if (!c.allowed_actions.includes('edit') && c.status !== 'draft') {
      throw new Error(`Edit not allowed for status ${c.status}`)
    }
    c.name = input.name
    c.site_key = input.site_key
    c.site_name = meta?.site_name ?? input.site_key
    c.script_package_key = input.script_package_key
    c.script_name = meta?.script_name ?? input.script_package_key
    c.script_version = input.script_version || c.script_version
    if (input.account_id !== undefined) {
      c.account_id = input.account_id?.trim() || null
    }
    c.execution_mode = input.execution_mode
    c.run_mode = input.run_mode
    c.schedule = structuredClone(input.schedule)
    if (input.schedule.type === 'scheduled' && c.status === 'draft') {
      c.status = 'scheduled'
    }
    c.updated_at = nowIso()
    c.allowed_actions = actionsFor(c.status)
    refreshSummaries(store)
    return structuredClone(c)
  },

  async startCampaign(id: string): Promise<Campaign> {
    assertMockOnly()
    const c = findCampaign(id)
    const contents = store.contents.filter((x) => x.campaign_id === id)
    if (contents.length === 0) {
      throw new Error('Cannot Start: Campaign has zero Content.')
    }
    if (c.run_mode === 'test') {
      const ok = MOCK_TEST_MODE_COMPATIBLE_SCRIPTS.has(c.script_package_key)
      if (!ok) {
        throw new Error('Cannot Start Test Mode: Script not Test-compatible.')
      }
    }
    c.status = 'running'
    c.updated_at = nowIso()
    for (const content of contents) {
      if (content.status === 'draft' || content.status === 'pending') {
        content.status = 'pending'
      }
    }
    refreshSummaries(store)
    return structuredClone(c)
  },

  async pauseCampaign(id: string): Promise<Campaign> {
    assertMockOnly()
    const c = findCampaign(id)
    if (c.status !== 'running') throw new Error('Pause only when running.')
    c.status = 'paused'
    c.updated_at = nowIso()
    refreshSummaries(store)
    return structuredClone(c)
  },

  async resumeCampaign(id: string): Promise<Campaign> {
    assertMockOnly()
    const c = findCampaign(id)
    if (c.status !== 'paused') throw new Error('Resume only when paused.')
    c.status = 'running'
    c.updated_at = nowIso()
    refreshSummaries(store)
    return structuredClone(c)
  },

  async cancelCampaign(id: string): Promise<Campaign> {
    assertMockOnly()
    const c = findCampaign(id)
    c.status = 'cancelled'
    c.updated_at = nowIso()
    refreshSummaries(store)
    return structuredClone(c)
  },

  async listContents(campaignId?: string): Promise<CampaignContent[]> {
    assertMockOnly()
    const list = campaignId
      ? store.contents.filter((c) => c.campaign_id === campaignId)
      : store.contents
    return structuredClone(list)
  },

  async createManualContent(
    draft: ManualContentDraft,
    opts?: {
      schema: ScriptInputSchema
      allowDiscard?: boolean
      preferShortcode?: boolean
    },
  ): Promise<CampaignContent> {
    assertMockOnly()
    const campaign = findCampaign(draft.campaign_id)
    const preferShortcode =
      opts?.preferShortcode === true || Boolean(draft.raw_source?.trim())
    if (preferShortcode) {
      const raw = draft.raw_source?.trim() || ''
      if (!raw) throw new Error('raw_source is required for shortcode Content.')
      const row: CampaignContent = {
        id: `cnt_local_${Date.now()}`,
        campaign_id: draft.campaign_id,
        external_ref: draft.external_ref?.trim() || `manual-${Date.now()}`,
        source: 'manual',
        status: 'draft',
        input: { title: null, body: null, variables: {} },
        source_format: 'shortcode',
        raw_source: raw,
        mapping_version: campaign.shortcode_mapping_version ?? 1,
        editor_doc: draft.editor_doc,
        assigned_account_id: campaign.account_id,
        assigned_account_label: campaign.account_id,
        current_job_id: null,
        last_result: null,
        last_error_code: null,
        last_error_message: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      store.contents = [row, ...store.contents]
      refreshSummaries(store)
      return structuredClone(row)
    }
    const mapped = opts?.schema
      ? (() => {
          const body = buildLiveCampaignContentBody(draft, {
            schema: opts.schema,
            allowDiscard: opts.allowDiscard === true,
          })
          const input = body.input ?? {}
          return {
            external_ref: body.external_ref ?? `manual-${Date.now()}`,
            input: {
              title: typeof input.title === 'string' ? input.title : null,
              body: typeof input.body === 'string' ? input.body : null,
              variables: Object.fromEntries(
                Object.entries(input)
                  .filter(([k]) => k !== 'title' && k !== 'body')
                  .map(([k, v]) => [k, v == null ? null : String(v)]),
              ),
            },
          }
        })()
      : draftToScriptInput(draft)
    const row: CampaignContent = {
      id: `cnt_local_${Date.now()}`,
      campaign_id: draft.campaign_id,
      external_ref: mapped.external_ref,
      source: 'manual',
      status: 'draft',
      input: mapped.input,
      source_format: 'legacy_input',
      raw_source: null,
      mapping_version: null,
      editor_doc: draft.editor_doc,
      assigned_account_id: null,
      assigned_account_label: null,
      current_job_id: null,
      last_result: null,
      last_error_code: null,
      last_error_message: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    store.contents = [row, ...store.contents]
    refreshSummaries(store)
    return structuredClone(row)
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
    assertMockOnly()
    const row = store.contents.find((c) => c.id === id)
    if (!row) throw new Error(`Content not found: ${id}`)
    if (row.status !== 'draft' && row.status !== 'pending') {
      throw new Error(`Cannot edit content in status ${row.status}`)
    }
    const campaign = findCampaign(draft.campaign_id)
    const preferShortcode =
      opts?.preferShortcode === true || Boolean(draft.raw_source?.trim())
    if (preferShortcode) {
      const raw = draft.raw_source?.trim() || ''
      if (!raw) throw new Error('raw_source is required for shortcode Content.')
      row.external_ref = draft.external_ref?.trim() || row.external_ref
      row.source_format = 'shortcode'
      row.raw_source = raw
      row.mapping_version = campaign.shortcode_mapping_version ?? 1
      row.editor_doc = draft.editor_doc
      row.updated_at = nowIso()
      refreshSummaries(store)
      return structuredClone(row)
    }
    const mapped = opts?.schema
      ? (() => {
          const body = buildLiveCampaignContentBody(draft, {
            schema: opts.schema,
            allowDiscard: opts.allowDiscard === true,
          })
          const input = body.input ?? {}
          return {
            external_ref: body.external_ref ?? row.external_ref,
            input: {
              title: typeof input.title === 'string' ? input.title : null,
              body: typeof input.body === 'string' ? input.body : null,
              variables: Object.fromEntries(
                Object.entries(input)
                  .filter(([k]) => k !== 'title' && k !== 'body')
                  .map(([k, v]) => [k, v == null ? null : String(v)]),
              ),
            },
          }
        })()
      : draftToScriptInput(draft)
    row.external_ref = mapped.external_ref
    row.input = mapped.input
    row.source_format = 'legacy_input'
    row.raw_source = null
    row.mapping_version = null
    row.editor_doc = draft.editor_doc
    row.updated_at = nowIso()
    refreshSummaries(store)
    return structuredClone(row)
  },

  async mockPreviewContents(
    campaignId: string,
    count: number,
  ): Promise<MockPreviewResult> {
    assertMockOnly()
    const campaign = findCampaign(campaignId)
    if (!campaign.shortcode_mapping?.entries?.length) {
      throw new Error('shortcode_mapping_required')
    }
    const n = Math.min(50, Math.max(1, count))
    const articles = Array.from({ length: n }, (_, i) => {
      const ref = `mock-preview-${Date.now()}-${i + 1}`
      const raw = serializeShortcodeSegments(
        campaign.shortcode_mapping!.entries.map((e) => ({
          name: e.shortcode,
          inner: `Mock ${e.variable} #${i + 1} (${ref})`,
        })),
      )
      const input: Record<string, string | number | boolean | null> = {}
      for (const e of campaign.shortcode_mapping!.entries) {
        input[e.variable] = `Mock ${e.variable} #${i + 1} (${ref})`
      }
      return { external_ref: ref, raw_source: raw, input }
    })
    return {
      count: n,
      mapping_version: campaign.shortcode_mapping_version ?? 1,
      articles,
    }
  },

  async mockSaveContents(
    campaignId: string,
    count: number,
    idempotencyKey: string,
  ): Promise<MockSaveResult> {
    assertMockOnly()
    if (!idempotencyKey.trim()) {
      throw new Error('Idempotency-Key required for mock-save.')
    }
    const preview = await this.mockPreviewContents(campaignId, count)
    const campaign = findCampaign(campaignId)
    const rows: CampaignContent[] = preview.articles.map((a) => ({
      id: `cnt_mock_${Date.now()}_${a.external_ref}`,
      campaign_id: campaignId,
      external_ref: a.external_ref,
      source: 'manual' as const,
      status: 'pending' as const,
      input: {
        title: typeof a.input.title === 'string' ? a.input.title : null,
        body: typeof a.input.body === 'string' ? a.input.body : null,
        variables: Object.fromEntries(
          Object.entries(a.input)
            .filter(([k]) => k !== 'title' && k !== 'body')
            .map(([k, v]) => [k, v == null ? null : String(v)]),
        ),
      },
      source_format: 'shortcode' as const,
      raw_source: a.raw_source,
      mapping_version: preview.mapping_version,
      editor_doc: null,
      assigned_account_id: campaign.account_id,
      assigned_account_label: campaign.account_id,
      current_job_id: null,
      last_result: null,
      last_error_code: null,
      last_error_message: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }))
    store.contents = [...rows, ...store.contents]
    refreshSummaries(store)
    return {
      count: rows.length,
      mapping_version: preview.mapping_version,
      idempotent: false,
      contents: structuredClone(rows),
    }
  },

  async removeDraftContent(id: string): Promise<void> {
    assertMockOnly()
    const row = store.contents.find((c) => c.id === id)
    if (!row) throw new Error(`Content not found: ${id}`)
    if (row.status !== 'draft') {
      throw new Error('Only draft Content can be removed.')
    }
    store.contents = store.contents.filter((c) => c.id !== id)
    refreshSummaries(store)
  },

  async retryContent(
    id: string,
    _opts?: { idempotencyKey: string },
  ): Promise<CampaignContent> {
    assertMockOnly()
    const row = store.contents.find((c) => c.id === id)
    if (!row) throw new Error(`Content not found: ${id}`)
    if (row.status !== 'failed_locked' && row.status !== 'unknown') {
      throw new Error('Retry only for failed_locked or unknown.')
    }
    row.status = 'pending'
    row.last_result = `retry requested (${row.status})`
    row.updated_at = nowIso()
    refreshSummaries(store)
    return structuredClone(row)
  },

  async skipContent(id: string): Promise<CampaignContent> {
    assertMockOnly()
    const row = store.contents.find((c) => c.id === id)
    if (!row) throw new Error(`Content not found: ${id}`)
    row.status = 'skipped'
    row.updated_at = nowIso()
    refreshSummaries(store)
    return structuredClone(row)
  },

  async cancelContent(id: string): Promise<CampaignContent> {
    assertMockOnly()
    const row = store.contents.find((c) => c.id === id)
    if (!row) throw new Error(`Content not found: ${id}`)
    row.status = 'cancelled'
    row.updated_at = nowIso()
    refreshSummaries(store)
    return structuredClone(row)
  },

  async listJobAttempts(campaignId: string): Promise<CampaignJobAttempt[]> {
    assertMockOnly()
    return structuredClone(
      store.job_attempts.filter((j) => j.campaign_id === campaignId),
    )
  },

  getScriptInputSchema(packageKey: string): ScriptInputSchema {
    const seed = MOCK_SCRIPT_INPUT_SCHEMAS[packageKey]
    if (!seed) {
      return {
        fields: [],
        test_mode_compatible: MOCK_TEST_MODE_COMPATIBLE_SCRIPTS.has(packageKey)
          ? true
          : null,
        title_required: false,
        body_required: false,
        schema_available: false,
        title_supported: false,
        body_supported: false,
        unavailable_reason: 'Mock Script schema seed missing for package.',
      }
    }
    const fakeDetail = {
      package_key: packageKey,
      name: packageKey,
      action_tag_key: null,
      description: null,
      updated_by_label: 'mock',
      releases: [
        {
          id: 1,
          version: '0',
          content_digest: '',
          status: 'published' as const,
          published_at: null,
          variables: seed.variables,
          variable_count: seed.variables.length,
          steps: [],
          assets: [],
          runtime_requirements: [],
          video_demo: null,
          video_demo_status: 'missing' as const,
          video_media_id: null,
          thumbnail_media_id: null,
          thumbnail_url: null,
          video_url: null,
        },
      ],
    }
    return parseScriptInputSchema(fakeDetail, {
      testModeCompatible: seed.test_mode_compatible,
    })
  },
}
