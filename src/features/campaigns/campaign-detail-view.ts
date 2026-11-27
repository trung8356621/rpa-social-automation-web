import { parseShortcodeSegments } from './shortcode-source.ts'
import {
  isScreenshotArtifact,
  resolveArtifactFetchUrl,
  resolveScreenshotOutcome,
} from './campaign-artifacts.ts'
import type {
  Campaign,
  CampaignContent,
  CampaignContentStatus,
  CampaignJobAttempt,
  CampaignSummary,
} from './types.ts'

export type ArticleCounts = {
  waiting: number
  running: number
  successful: number
  failed: number
}

export type SiteErrorGroup = {
  site_key: string
  site_name: string
  code: string | null
  message: string
  article_count: number
  sources: Array<'eligibility' | 'article'>
}

/**
 * Format an actual backend scheduler timestamp for display.
 * Never fabricates a timestamp from frontend polling time.
 */
export function formatSchedulerTimestamp(
  iso: string | null | undefined,
  emptyLabel = 'Not checked yet',
): string {
  if (!iso || !iso.trim()) return emptyLabel
  const trimmed = iso.trim()
  const ms = Date.parse(trimmed)
  if (!Number.isFinite(ms)) return trimmed
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(ms))
  } catch {
    return trimmed
  }
}

/**
 * Derive the 4 user-facing article counters from CampaignSummary.
 */
export function deriveArticleCounts(summary: CampaignSummary): ArticleCounts {
  const waiting =
    (summary.waiting_resources ?? 0) +
    (summary.waiting_interval ?? 0) +
    (summary.pending ?? 0) +
    (summary.blocked_by_failure ?? 0)
  const running = summary.running ?? 0
  const successful = summary.success ?? 0
  const failedFromBreakdown =
    (summary.failed_locked ?? 0) + (summary.unknown ?? 0)
  const failed =
    failedFromBreakdown > 0 ? failedFromBreakdown : (summary.failed ?? 0)

  return {
    waiting,
    running,
    successful,
    failed,
  }
}

/**
 * Produce one concise, non-technical status message for normal users.
 */
export function deriveCampaignStatusMessage(
  campaign: Campaign,
  counts: ArticleCounts,
): string {
  const explicit = campaign.status_message?.trim()
  if (explicit) return explicit

  switch (campaign.status) {
    case 'draft':
      if (campaign.summary.total === 0) {
        return 'Draft campaign. Add articles before starting.'
      }
      return 'Draft campaign ready to start.'
    case 'scheduled':
      if (campaign.schedule.start_at) {
        return `Scheduled to start on ${formatSchedulerTimestamp(campaign.schedule.start_at, 'the configured time')}.`
      }
      return 'Scheduled and waiting for start time.'
    case 'paused':
      return 'Campaign is paused. Resume when ready to continue.'
    case 'completed':
      return counts.failed > 0
        ? 'Campaign finished with some failed articles.'
        : 'All articles completed successfully.'
    case 'cancelled':
      return 'Campaign was cancelled.'
    case 'running': {
      if (counts.running > 0) {
        return 'Campaign is actively running articles on eligible clients.'
      }
      if (campaign.eligible_clients_count === 0 && counts.waiting > 0) {
        return 'Waiting for an eligible Client to become available.'
      }
      if (counts.waiting > 0) {
        return 'Waiting for the next scheduler resource check.'
      }
      if (counts.failed > 0) {
        return 'No articles remaining in queue; some articles failed.'
      }
      return 'Campaign is running.'
    }
    default:
      return 'Campaign status updated.'
  }
}

export function resolveSiteForContent(
  campaign: Campaign,
  content: CampaignContent,
): { site_key: string; site_name: string } {
  const firstTagKey = content.assignments?.[0]?.action_tag_key
  if (firstTagKey && campaign.action_tags?.length) {
    const matched = campaign.action_tags.find(
      (t) => t.action_tag_key === firstTagKey,
    )
    if (matched) {
      return {
        site_key: matched.site_key || campaign.site_key || 'unknown',
        site_name: matched.site_name || matched.site_key || campaign.site_name || 'Unknown Site',
      }
    }
  }
  if (firstTagKey && firstTagKey.includes('.')) {
    const prefix = firstTagKey.split('.')[0] ?? ''
    if (prefix) {
      return { site_key: prefix, site_name: prefix }
    }
  }
  return {
    site_key: campaign.site_key || 'unknown',
    site_name: campaign.site_name || campaign.site_key || 'Unknown Site',
  }
}

/**
 * Group repeated eligibility and article errors by Site instead of displaying
 * identical errors for every Article.
 */
export function groupErrorsBySite(
  campaign: Campaign,
  contents: CampaignContent[],
): SiteErrorGroup[] {
  const map = new Map<string, SiteErrorGroup>()

  const upsert = (
    siteKey: string,
    siteName: string,
    code: string | null,
    message: string,
    source: 'eligibility' | 'article',
  ) => {
    const normCode = code?.trim() || null
    const normMsg = message.trim() || normCode || 'Unknown error'
    const key = `${siteKey}::${normCode ?? ''}::${normMsg}`
    const existing = map.get(key)
    if (existing) {
      if (source === 'article') existing.article_count += 1
      if (!existing.sources.includes(source)) existing.sources.push(source)
      return
    }
    map.set(key, {
      site_key: siteKey,
      site_name: siteName,
      code: normCode,
      message: normMsg,
      article_count: source === 'article' ? 1 : 0,
      sources: [source],
    })
  }

  const diagErrors = campaign.resource_diagnostics?.eligibility_errors ?? []
  for (const err of diagErrors) {
    upsert(
      err.site_key || 'unknown',
      err.site_name || err.site_key || 'Unknown Site',
      err.code,
      err.message,
      'eligibility',
    )
  }

  for (const content of contents) {
    if (!content.last_error_code && !content.last_error_message) continue
    const site = resolveSiteForContent(campaign, content)
    const msg =
      content.last_error_message?.trim() ||
      content.last_error_code?.trim() ||
      'Article failed'
    upsert(
      site.site_key,
      site.site_name,
      content.last_error_code,
      msg,
      'article',
    )
  }

  return Array.from(map.values())
}

/**
 * Resolve prominent human-readable article title / content name.
 */
export function resolveContentTitle(content: CampaignContent): string {
  const inputTitle = content.input.title?.trim()
  if (inputTitle) return inputTitle

  const raw = content.raw_source?.trim()
  if (raw) {
    const segments = parseShortcodeSegments(raw)
    const titleSeg = segments.find(
      (s) => s.name === 'title' && s.inner.trim().length > 0,
    )
    if (titleSeg) return titleSeg.inner.trim()
  }

  const ext = content.external_ref?.trim()
  if (ext) return ext

  if (raw) return raw
  const body = content.input.body?.trim()
  if (body) return body

  return content.id
}

export function resolveContentUuid(content: CampaignContent): string {
  return content.content_uuid?.trim() || content.id
}

function attemptTimestampMs(attempt: CampaignJobAttempt): number | null {
  const raw = attempt.started_at?.trim() || attempt.ended_at?.trim()
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Group job attempts by Content using the actual Backend Content-to-Job-to-Attempt
 * relationship (`attempt.content_id === content.id`, or `attempt.content_uuid` when
 * `content_id` is omitted and `content.content_uuid` matches).
 * Never associates records by display order, article title, or fuzzy UUIDs.
 * Returns attempts sorted chronologically per Content.
 */
export function groupAttemptsByContent(
  contents: CampaignContent[],
  attempts: CampaignJobAttempt[],
): Map<string, CampaignJobAttempt[]> {
  const result = new Map<string, CampaignJobAttempt[]>()
  const byContentId = new Map<string, CampaignContent>()
  const byContentUuid = new Map<string, CampaignContent>()

  for (const c of contents) {
    result.set(c.id, [])
    if (c.id) byContentId.set(c.id, c)
    if (c.content_uuid?.trim()) byContentUuid.set(c.content_uuid.trim(), c)
  }

  const seenPerContent = new Map<string, Map<string, number>>()
  const append = (contentId: string, att: CampaignJobAttempt) => {
    const list = result.get(contentId)
    if (!list) return
    let seen = seenPerContent.get(contentId)
    if (!seen) {
      seen = new Map<string, number>()
      seenPerContent.set(contentId, seen)
    }
    const uuid = att.attempt_uuid?.trim()
    const keys = [uuid ? `uuid:${uuid}` : '', att.id ? `id:${att.id}` : ''].filter(Boolean)
    const existingIndex = keys.map((key) => seen.get(key)).find((index) => index !== undefined)
    const index = existingIndex ?? list.length
    const existing = list[index]
    if (existing) {
      const preferred = existing.ended_at && !att.ended_at ? existing : att
      const fallback = preferred === existing ? att : existing
      list[index] = {
        ...preferred,
        attempt_uuid: preferred.attempt_uuid ?? fallback.attempt_uuid,
        job_id: preferred.job_id ?? fallback.job_id,
        job_uuid: preferred.job_uuid ?? fallback.job_uuid,
        started_at: preferred.started_at ?? fallback.started_at,
        agent_uuid: preferred.agent_uuid ?? fallback.agent_uuid,
        agent_label: preferred.agent_label ?? fallback.agent_label,
        artifacts: preferred.artifacts.length ? preferred.artifacts : fallback.artifacts,
      }
    } else {
      list.push(att)
    }
    for (const key of keys) seen.set(key, index)
  }

  for (const c of contents) {
    if (Array.isArray(c.attempts)) {
      for (const att of c.attempts) {
        append(c.id, att)
      }
    }
  }

  for (const att of attempts) {
    const cid = att.content_id?.trim()
    if (cid && byContentId.has(cid)) {
      append(cid, att)
      continue
    }
    const cuuid = att.content_uuid?.trim()
    if (!cid && cuuid) {
      const matched = byContentUuid.get(cuuid)
      if (matched) append(matched.id, att)
    }
  }

  for (const [cid, list] of result.entries()) {
    const indexed = list.map((item, idx) => ({ item, idx }))
    indexed.sort((a, b) => {
      const aMs = attemptTimestampMs(a.item)
      const bMs = attemptTimestampMs(b.item)
      if (aMs !== null && bMs !== null && aMs !== bMs) return aMs - bMs
      if (aMs !== null && bMs === null) return -1
      if (aMs === null && bMs !== null) return 1
      if (a.item.attempt !== b.item.attempt) return a.item.attempt - b.item.attempt
      return a.idx - b.idx
    })
    result.set(
      cid,
      indexed.map((x) => x.item),
    )
  }

  return result
}

function isFailure(status: CampaignContentStatus): boolean {
  return status === 'failed' || status === 'failed_locked' || status === 'unknown'
}

export function resolveQuickAudit(
  content: CampaignContent,
  status: CampaignContentStatus,
  attempts: CampaignJobAttempt[],
  retryRequested = false,
) {
  const latest = attempts.at(-1)
  const waiting = status === 'pending' || status === 'waiting_interval' || status === 'waiting_resources'
  const retrying = retryRequested || status === 'retrying' || (waiting && content.recovery_job_in_flight === true)
  const active = status === 'running' || retrying
  const currentStatus = retrying ? 'retrying' : status
  const matchesJob = !content.current_job_id ||
    latest?.job_id === content.current_job_id ||
    latest?.job_uuid === content.current_job_id
  const activeAttempt = latest?.status === 'running' || latest?.status === 'retrying'
  const success = status === 'success' || status === 'completed'
  const latestSucceeded = latest?.status === 'success' || latest?.status === 'completed'
  let attempt = matchesJob && !retryRequested ? latest : undefined
  if (active && !activeAttempt) attempt = undefined
  if (waiting && !retrying) attempt = undefined
  if (success && !latestSucceeded) attempt = undefined
  if (isFailure(status) && !active && (!latest || !isFailure(latest.status))) attempt = undefined
  const resultStatus = waiting || active ? currentStatus : attempt?.status ?? null
  const screenshots = attempt?.artifacts.filter((artifact) =>
    isScreenshotArtifact(artifact) && resolveArtifactFetchUrl(artifact),
  ) ?? []
  const outcome = latestSucceeded ? 'success' : latest && isFailure(latest.status) ? 'danger' : null
  const screenshot = screenshots.findLast((artifact) =>
    resolveScreenshotOutcome(artifact)?.variant === outcome,
  ) ?? screenshots.findLast((artifact) => {
    const variant = resolveScreenshotOutcome(artifact)?.variant
    return variant !== 'success' && variant !== 'danger'
  })

  return {
    status: resultStatus,
    attempt,
    completed: attempts.findLast((row) => row.ended_at),
    screenshot,
    error: resultStatus && isFailure(resultStatus) && attempt ? resolveAttemptFailureDisplay(attempt).reason : null,
  }
}

export function resolveAttemptFailureDisplay(attempt: CampaignJobAttempt): {
  reason: string | null
  stepLabel: string | null
  errorCode: string | null
} {
  const errorCode = attempt.error_code?.trim() || null
  const errorMessage = attempt.error_message?.trim() || null
  const fallbackError = attempt.error?.trim() || null
  const reason = errorMessage || fallbackError || errorCode || null

  const rawStep =
    attempt.step != null && String(attempt.step).trim() !== ''
      ? String(attempt.step).trim()
      : null
  const stepLabel = rawStep
    ? /^step\b/i.test(rawStep)
      ? rawStep
      : `Step ${rawStep}`
    : null

  return { reason, stepLabel, errorCode }
}
