import type {
  CampaignContentStatus,
  CampaignExecutionMode,
  CampaignRunMode,
  CampaignStatus,
} from './types.ts'

type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

export function campaignStatusBadge(
  status: CampaignStatus,
): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', variant: 'neutral' }
    case 'scheduled':
      return { label: 'Scheduled', variant: 'primary' }
    case 'running':
      return { label: 'Running', variant: 'success' }
    case 'paused':
      return { label: 'Paused', variant: 'warning' }
    case 'completed':
      return { label: 'Completed', variant: 'success' }
    case 'cancelled':
      return { label: 'Cancelled', variant: 'neutral' }
    default:
      return { label: String(status), variant: 'neutral' }
  }
}

export function contentStatusBadge(
  status: CampaignContentStatus,
): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', variant: 'neutral' }
    case 'pending':
      return { label: 'Pending', variant: 'neutral' }
    case 'waiting_resources':
      return { label: 'Waiting Resources', variant: 'warning' }
    case 'running':
      return { label: 'Running', variant: 'primary' }
    case 'success':
      return { label: 'Success', variant: 'success' }
    case 'failed_locked':
      return { label: 'Failed Locked', variant: 'danger' }
    case 'unknown':
      return { label: 'Unknown', variant: 'warning' }
    case 'skipped':
      return { label: 'Skipped', variant: 'neutral' }
    case 'cancelled':
      return { label: 'Cancelled', variant: 'neutral' }
    default:
      return { label: String(status), variant: 'neutral' }
  }
}

export function runModeLabel(mode: CampaignRunMode): string {
  return mode === 'test' ? 'Test Mode' : 'Live Mode'
}

export function executionModeLabel(mode: CampaignExecutionMode): string {
  return mode === 'one_account_one_job'
    ? '1 Account : 1 Job'
    : '1 Account : N Job'
}

export function emptySummary() {
  return {
    total: 0,
    pending: 0,
    waiting_resources: 0,
    running: 0,
    success: 0,
    failed_locked: 0,
    unknown: 0,
    skipped: 0,
    cancelled: 0,
    completed: 0,
    failed: 0,
    waiting: 0,
  }
}

export function summarizeContents(
  statuses: CampaignContentStatus[],
): ReturnType<typeof emptySummary> {
  const s = emptySummary()
  s.total = statuses.length
  for (const st of statuses) {
    if (st === 'pending' || st === 'draft') s.pending += 1
    else if (st === 'waiting_resources') {
      s.waiting_resources += 1
      s.waiting += 1
    } else if (st === 'running') s.running += 1
    else if (st === 'success') {
      s.success += 1
      s.completed += 1
    } else if (st === 'failed_locked') {
      s.failed_locked += 1
      s.failed += 1
    } else if (st === 'unknown') s.unknown += 1
    else if (st === 'skipped') s.skipped += 1
    else if (st === 'cancelled') s.cancelled += 1
  }
  return s
}
