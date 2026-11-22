import type {
  Campaign,
  CampaignContent,
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
  const waiting = (summary.waiting_resources ?? 0) + (summary.pending ?? 0)
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

function resolveSiteForContent(
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
