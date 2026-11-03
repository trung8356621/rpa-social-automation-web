import {
  DEFAULT_RESOURCE_RECHECK_SECONDS,
  DEFAULT_TIMEZONE,
} from '../schedule'
import { emptySummary } from '../status-labels'
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
} from '../types'
import type {
  LiveCampaignRow,
  LiveContentRow,
  LiveJobAttemptRow,
} from './live-types'

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
  // Do not invent — fall back to draft display with raw preserved in name? Prefer draft + unknown label
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

function mapSchedule(raw: LiveCampaignRow['schedule']): CampaignSchedule {
  const type = asScheduleType(raw?.type)
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
      raw?.resource_recheck_seconds != null
        ? Number(raw.resource_recheck_seconds)
        : DEFAULT_RESOURCE_RECHECK_SECONDS,
  }
}

function mapSummary(raw: LiveCampaignRow['summary']): CampaignSummary {
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
    waiting: Number(raw.waiting ?? 0),
  }
}

const ACTIONS = new Set<CampaignAction>([
  'start',
  'pause',
  'resume',
  'cancel',
  'edit',
])

export function mapLiveCampaign(row: LiveCampaignRow): Campaign {
  const status = asCampaignStatus(row.status)
  const allowed = Array.isArray(row.allowed_actions)
    ? row.allowed_actions.filter((a): a is CampaignAction =>
        ACTIONS.has(a as CampaignAction),
      )
    : []

  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    site_key: String(row.site_key ?? row.platform ?? ''),
    site_name: String(row.site_name ?? row.site_key ?? row.platform ?? ''),
    script_package_key: String(
      row.script_package_key ?? row.script_id ?? '',
    ),
    script_name: String(row.script_name ?? row.script_package_key ?? ''),
    execution_mode: asExecutionMode(row.execution_mode),
    run_mode: asRunMode(row.run_mode),
    status,
    schedule: mapSchedule(row.schedule),
    summary: mapSummary(row.summary),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    allowed_actions: allowed,
  }
}

export function mapLiveContent(row: unknown): CampaignContent {
  const r = (row ?? {}) as LiveContentRow
  return {
    id: String(r.id ?? ''),
    campaign_id: String(r.campaign_id ?? ''),
    external_ref: String(r.external_ref ?? ''),
    source: 'manual',
    status: asContentStatus(r.status),
    input: {
      title: r.input?.title ?? null,
      body: r.input?.body ?? null,
      variables: { ...(r.input?.variables ?? {}) },
    },
    editor_doc: null,
    assigned_account_id: r.assigned_account_id ?? null,
    assigned_account_label: r.assigned_account_label ?? null,
    current_job_id: r.current_job_id ?? null,
    last_result: r.last_result ?? null,
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
