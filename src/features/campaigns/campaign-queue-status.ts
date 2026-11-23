import { formatSchedulerTimestamp } from './campaign-detail-view.ts'
import type { CampaignContent, CampaignContentStatus } from './types.ts'
import { isPinnedAccountUnavailable } from './validation.ts'

export type ContentQueueFeedback =
  | { kind: 'none' }
  | { kind: 'info'; message: string; code: string | null }
  | { kind: 'warning'; message: string; code: string | null }
  | { kind: 'error'; message: string | null; code: string | null }

/**
 * Resolves the authoritative queue status from Backend fields.
 * Never infers queue states from missing Job/Attempt records.
 */
export function resolveEffectiveContentStatus(
  content: Pick<CampaignContent, 'status' | 'queue_state'>,
): CampaignContentStatus {
  const qs = content.queue_state?.trim().toLowerCase()
  if (
    content.status === 'blocked_by_failure' ||
    qs === 'blocked_by_failure' ||
    qs === 'blocked'
  ) {
    return 'blocked_by_failure'
  }
  if (
    content.status === 'waiting_interval' ||
    (qs === 'waiting_interval' && content.status === 'pending')
  ) {
    return 'waiting_interval'
  }
  if (qs === 'waiting_resources' && content.status === 'pending') {
    return 'waiting_resources'
  }
  return content.status
}

/**
 * Produces user-facing feedback for a Content row without presenting
 * Pending, Waiting Interval, or Waiting Resources as red execution errors.
 */
export function resolveContentQueueFeedback(
  content: Pick<
    CampaignContent,
    | 'status'
    | 'queue_state'
    | 'wait_reason'
    | 'blocked_reason'
    | 'next_run_at'
    | 'last_error_code'
    | 'last_error_message'
    | 'last_result'
  >,
): ContentQueueFeedback {
  const effectiveStatus = resolveEffectiveContentStatus(content)

  if (effectiveStatus === 'pending') {
    return { kind: 'none' }
  }

  if (effectiveStatus === 'waiting_interval') {
    const formattedNext = content.next_run_at
      ? formatSchedulerTimestamp(content.next_run_at, '')
      : ''
    const message = formattedNext
      ? `Next eligible: ${formattedNext} (subject to Client/Account/Browser availability).`
      : 'Waiting for posting interval before next eligible execution.'
    return {
      kind: 'info',
      message,
      code: null,
    }
  }

  if (effectiveStatus === 'waiting_resources') {
    const pinUnavailable = isPinnedAccountUnavailable(content)
    const rawReason =
      content.wait_reason?.trim() ||
      content.last_error_message?.trim() ||
      (pinUnavailable ? 'Pinned account unavailable.' : '')
    const recheckNote = 'Scheduler will automatically recheck availability.'
    const message = rawReason ? `${rawReason} — ${recheckNote}` : recheckNote
    return {
      kind: 'info',
      message,
      code: content.last_error_code?.trim() || null,
    }
  }

  if (effectiveStatus === 'blocked_by_failure') {
    const reason =
      content.blocked_reason?.trim() ||
      content.last_error_message?.trim() ||
      content.last_error_code?.trim() ||
      'Paused because a preceding job in this Action Tag queue failed.'
    return {
      kind: 'warning',
      message: reason,
      code: content.last_error_code?.trim() || null,
    }
  }

  if (
    effectiveStatus === 'failed' ||
    effectiveStatus === 'failed_locked' ||
    effectiveStatus === 'unknown'
  ) {
    const pinUnavailable = isPinnedAccountUnavailable(content)
    const msg =
      content.last_error_message?.trim() ||
      (pinUnavailable ? 'Pinned account unavailable' : null)
    const code = content.last_error_code?.trim() || null
    if (!msg && !code) return { kind: 'none' }
    return { kind: 'error', message: msg, code }
  }

  return { kind: 'none' }
}
