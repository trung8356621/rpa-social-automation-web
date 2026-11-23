import type { Campaign, CampaignStatus } from './types.ts'

export const MAX_INTERVAL_MINUTES = 525600

const EDITABLE_INTERVAL_STATUSES = new Set<CampaignStatus>([
  'draft',
  'running',
  'paused',
])

export function isActionTagIntervalEditableStatus(
  status: CampaignStatus,
): boolean {
  return EDITABLE_INTERVAL_STATUSES.has(status)
}

export function canEditActionTagInterval(
  campaign: Pick<Campaign, 'status'>,
  hasHandler: boolean,
): boolean {
  return hasHandler && isActionTagIntervalEditableStatus(campaign.status)
}

export function validateInlineIntervalInput(
  raw: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const s = raw.trim()
  if (s === '') {
    return {
      ok: false,
      message: 'Enter a whole number of minutes (0 or greater).',
    }
  }
  if (!/^\d+$/.test(s)) {
    return {
      ok: false,
      message:
        'Interval must be a non-negative whole number (no decimals or negatives).',
    }
  }
  const n = Number(s)
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_INTERVAL_MINUTES) {
    return {
      ok: false,
      message: `Interval must be between 0 and ${MAX_INTERVAL_MINUTES} minutes.`,
    }
  }
  return { ok: true, value: n }
}
