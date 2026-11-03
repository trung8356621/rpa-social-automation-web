import { draftToScriptInput } from '../content-adapters'
import {
  createMockCampaignStore,
  MOCK_SCRIPT_INPUT_SCHEMAS,
  MOCK_TEST_MODE_COMPATIBLE_SCRIPTS,
} from '../mock-data'
import { summarizeContents } from '../status-labels'
import type {
  Campaign,
  CampaignAction,
  CampaignContent,
  CampaignJobAttempt,
  CampaignStoreSnapshot,
  CreateCampaignInput,
  ManualContentDraft,
  ScriptInputSchema,
  UpdateCampaignInput,
} from '../types'
import { parseScriptInputSchema } from '../script-compat'

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
    c.allowed_actions = actionsFor(c.status)
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
    const campaign: Campaign = {
      id,
      name: input.name,
      site_key: input.site_key,
      site_name: meta?.site_name ?? input.site_key,
      script_package_key: input.script_package_key,
      script_name: meta?.script_name ?? input.script_package_key,
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
    }
    store.campaigns = [campaign, ...store.campaigns]
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

  async createManualContent(draft: ManualContentDraft): Promise<CampaignContent> {
    assertMockOnly()
    findCampaign(draft.campaign_id)
    const mapped = draftToScriptInput(draft)
    const row: CampaignContent = {
      id: `cnt_local_${Date.now()}`,
      campaign_id: draft.campaign_id,
      external_ref: mapped.external_ref,
      source: 'manual',
      status: 'draft',
      input: mapped.input,
      editor_doc: draft.editor_doc,
      assigned_account_id: null,
      assigned_account_label: null,
      current_job_id: null,
      last_result: null,
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
  ): Promise<CampaignContent> {
    assertMockOnly()
    const row = store.contents.find((c) => c.id === id)
    if (!row) throw new Error(`Content not found: ${id}`)
    if (row.status !== 'draft' && row.status !== 'pending') {
      throw new Error(`Cannot edit content in status ${row.status}`)
    }
    const mapped = draftToScriptInput(draft)
    row.external_ref = mapped.external_ref
    row.input = mapped.input
    row.editor_doc = draft.editor_doc
    row.updated_at = nowIso()
    refreshSummaries(store)
    return structuredClone(row)
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
