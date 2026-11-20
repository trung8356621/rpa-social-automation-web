import {
  DEFAULT_RESOURCE_RECHECK_SECONDS,
  DEFAULT_TIMEZONE,
} from '../schedule.ts'
import { emptySummary } from '../status-labels.ts'
import { mappingFromApi } from '../shortcode-mapping.ts'
import type {
  Campaign,
  CampaignAction,
  CampaignContent,
  CampaignContentStatus,
  CampaignExecutionMode,
  CampaignJobAttempt,
  CampaignRunMode,
  CampaignSchedule,
  CampaignScheduleType,
  CampaignStatus,
  CampaignSummary,
  ContentSourceFormat,
} from '../types.ts'
import type {
  LiveCampaignRow,
  LiveContentRow,
  LiveJobAttemptRow,
} from './live-types.ts'

const CAMPAIGN_STATUSES = new Set<CampaignStatus>([
  'draft',
  'scheduled',
  'running',
  'paused',
  'completed',
  'cancelled',
])

const CONTENT_STATUSES = new Set<CampaignContentStatus>([
  'draft',
  'pending',
  'waiting_resources',
  'running',
  'success',
  'failed_locked',
  'unknown',
  'skipped',
  'cancelled',
])

function asCampaignStatus(raw: unknown): CampaignStatus {
  const s = String(raw ?? 'draft')
  if (CAMPAIGN_STATUSES.has(s as CampaignStatus)) return s as CampaignStatus
  return 'draft'
}

function asContentStatus(raw: unknown): CampaignContentStatus {
  const s = String(raw ?? 'pending')
  if (CONTENT_STATUSES.has(s as CampaignContentStatus)) {
    return s as CampaignContentStatus
  }
  return 'unknown'
}

function asExecutionMode(raw: unknown): CampaignExecutionMode {
  return raw === 'one_account_many_jobs'
    ? 'one_account_many_jobs'
    : 'one_account_one_job'
}

function asRunMode(raw: unknown): CampaignRunMode {
  return raw === 'test' ? 'test' : 'live'
}

function asScheduleType(raw: unknown): CampaignScheduleType {
  if (raw === 'scheduled' || raw === 'time_window' || raw === 'immediate') {
    return raw
  }
  return 'immediate'
}

function mapSchedule(
  raw: LiveCampaignRow['schedule'],
  resourceRecheck?: number | null,
): CampaignSchedule {
  const type = asScheduleType(raw?.type)
  const fromRow =
    raw?.resource_recheck_seconds != null
      ? Number(raw.resource_recheck_seconds)
      : null
  return {
    type,
    timezone: raw?.timezone?.trim() || DEFAULT_TIMEZONE,
    start_at: raw?.start_at ?? null,
    daily_window: raw?.daily_window
      ? {
          from: String(raw.daily_window.from ?? '08:00'),
          to: String(raw.daily_window.to ?? '22:00'),
        }
      : null,
    min_interval_seconds:
      raw?.min_interval_seconds != null
        ? Number(raw.min_interval_seconds)
        : null,
    resource_recheck_seconds:
      fromRow ??
      (resourceRecheck != null && resourceRecheck > 0
        ? resourceRecheck
        : DEFAULT_RESOURCE_RECHECK_SECONDS),
  }
}

/**
 * Nested Staff detail summary — Pending/Waiting come ONLY from these fields.
 * Never alias aggregate `waiting_contents` into Waiting Resources.
 */
export function mapSummary(raw: LiveCampaignRow['summary']): CampaignSummary {
  const base = emptySummary()
  if (!raw) return base
  return {
    total: Number(raw.total ?? 0),
    pending: Number(raw.pending ?? 0),
    waiting_resources: Number(raw.waiting_resources ?? 0),
    running: Number(raw.running ?? 0),
    success: Number(raw.success ?? 0),
    failed_locked: Number(raw.failed_locked ?? 0),
    unknown: Number(raw.unknown ?? 0),
    skipped: Number(raw.skipped ?? 0),
    cancelled: Number(raw.cancelled ?? 0),
    completed: Number(raw.completed ?? 0),
    failed: Number(raw.failed ?? 0),
    // `waiting` is legacy alias only when API sends it; prefer waiting_resources for UI.
    waiting: Number(raw.waiting ?? raw.waiting_resources ?? 0),
  }
}

/**
 * List rows may expose flat counters only.
 * `waiting_contents` is an aggregate — NOT `waiting_resources`.
 */
export function mapSummaryFromRow(row: LiveCampaignRow): CampaignSummary {
  if (row.summary) return mapSummary(row.summary)
  const base = emptySummary()
  if (
    row.total_contents == null &&
    row.completed_contents == null &&
    row.failed_contents == null &&
    row.waiting_contents == null
  ) {
    return base
  }
  return {
    ...base,
    total: Number(row.total_contents ?? 0),
    success: Number(row.completed_contents ?? 0),
    failed_locked: Number(row.failed_contents ?? 0),
    // Intentionally leave pending / waiting_resources at 0 — flat aggregates
    // do not provide status breakdown. Never map waiting_contents → Waiting.
  }
}

export function actionsForStatus(status: CampaignStatus): CampaignAction[] {
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

const ACTIONS = new Set<CampaignAction>([
  'start',
  'pause',
  'resume',
  'cancel',
  'edit',
])

function mapContentInput(
  raw: LiveContentRow['input'],
): CampaignContent['input'] {
  if (!raw || typeof raw !== 'object') {
    return { title: null, body: null, variables: {} }
  }
  const row = raw as Record<string, unknown>
  const nestedVars =
    row.variables && typeof row.variables === 'object' && !Array.isArray(row.variables)
      ? (row.variables as Record<string, string | null>)
      : null

  const title =
    typeof row.title === 'string'
      ? row.title
      : row.title == null
        ? null
        : String(row.title)
  const bodyRaw = row.body ?? row.content
  const body =
    typeof bodyRaw === 'string'
      ? bodyRaw
      : bodyRaw == null
        ? null
        : String(bodyRaw)

  const variables: Record<string, string | null> = { ...(nestedVars ?? {}) }
  if (!nestedVars) {
    for (const [k, v] of Object.entries(row)) {
      if (k === 'title' || k === 'body' || k === 'content' || k === 'variables') {
        continue
      }
      if (v == null) variables[k] = null
      else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        variables[k] = String(v)
      }
    }
  }

  return { title, body, variables }
}

export function mapLiveCampaign(row: LiveCampaignRow): Campaign {
  const status = asCampaignStatus(row.status)
  const allowed = Array.isArray(row.allowed_actions)
    ? row.allowed_actions.filter((a): a is CampaignAction =>
        ACTIONS.has(a as CampaignAction),
      )
    : actionsForStatus(status)

  const scriptKey = String(row.script_package_key ?? row.script_id ?? '')
  const campaignId = String(row.id ?? '')
  const contents = Array.isArray(row.contents)
    ? row.contents.map((c) =>
        mapLiveContent(c, campaignId),
      )
    : undefined
  const pinned =
    row.account_id == null || String(row.account_id).trim() === ''
      ? null
      : String(row.account_id).trim()

  const mappingVersion =
    row.shortcode_mapping_version == null
      ? null
      : Number(row.shortcode_mapping_version)

  return {
    id: campaignId,
    name: String(row.name ?? ''),
    site_key: String(row.site_key ?? row.platform ?? ''),
    site_name: String(row.site_name ?? row.site_key ?? row.platform ?? ''),
    script_package_key: scriptKey,
    script_name: String(row.script_name ?? scriptKey),
    script_version: String(row.script_version ?? ''),
    account_id: pinned,
    execution_mode: asExecutionMode(row.execution_mode),
    run_mode: asRunMode(row.run_mode),
    status,
    schedule: mapSchedule(row.schedule, row.resource_recheck_seconds),
    summary: mapSummaryFromRow(row),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    allowed_actions: allowed,
    contents,
    shortcode_mapping: mappingFromApi(row.shortcode_mapping),
    shortcode_mapping_version: Number.isFinite(mappingVersion)
      ? mappingVersion
      : null,
  }
}

export function mapLiveContent(
  row: unknown,
  fallbackCampaignId = '',
): CampaignContent {
  const r = (row ?? {}) as LiveContentRow
  const errCode =
    typeof r.last_error_code === 'string' && r.last_error_code.trim()
      ? r.last_error_code.trim()
      : null
  const errMsg =
    typeof r.last_error_message === 'string' && r.last_error_message.trim()
      ? r.last_error_message.trim()
      : null
  const lastResult =
    r.last_result ??
    (errCode || errMsg
      ? [errCode, errMsg].filter(Boolean).join(': ')
      : null)

  const sourceFormat: ContentSourceFormat =
    r.source_format === 'shortcode' ? 'shortcode' : 'legacy_input'
  const mappingVersion =
    r.mapping_version == null ? null : Number(r.mapping_version)
  const rawSource =
    typeof r.raw_source === 'string'
      ? r.raw_source
      : r.raw_source == null
        ? null
        : String(r.raw_source)

  return {
    id: String(r.id ?? ''),
    campaign_id: String(r.campaign_id ?? fallbackCampaignId),
    external_ref: String(r.external_ref ?? ''),
    source: 'manual',
    status: asContentStatus(r.status),
    input: mapContentInput(r.input),
    source_format: sourceFormat,
    raw_source: rawSource,
    mapping_version: Number.isFinite(mappingVersion) ? mappingVersion : null,
    editor_doc: null,
    assigned_account_id:
      r.assigned_account_id == null ? null : String(r.assigned_account_id),
    assigned_account_label:
      r.assigned_account_label ??
      (r.assigned_account_id != null ? String(r.assigned_account_id) : null),
    current_job_id:
      r.current_job_id == null ? null : String(r.current_job_id),
    last_result: lastResult,
    last_error_code: errCode,
    last_error_message: errMsg,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

export function mapLiveJobAttempt(row: unknown): CampaignJobAttempt {
  const r = (row ?? {}) as LiveJobAttemptRow
  return {
    id: String(r.id ?? ''),
    content_id: String(r.content_id ?? ''),
    campaign_id: String(r.campaign_id ?? ''),
    attempt: Number(r.attempt ?? 1),
    status: asContentStatus(r.status),
    agent_label: r.agent_label ?? null,
    browser_label: r.browser_label ?? null,
    started_at: r.started_at ?? null,
    ended_at: r.ended_at ?? null,
    error: r.error ?? null,
    artifacts: (r.artifacts ?? []).map((a, i) => ({
      id: String(a.id ?? `art_${i}`),
      kind:
        a.kind === 'screenshot' || a.kind === 'log' || a.kind === 'other'
          ? a.kind
          : 'other',
      label: String(a.label ?? 'artifact'),
      url: a.url ?? null,
    })),
  }
}
