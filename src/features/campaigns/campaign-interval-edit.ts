import type { Campaign, CampaignStatus } from './types.ts'

export const MAX_INTERVAL_MINUTES = 10080

export const INTERVAL_MAX_ERROR_MESSAGE =
  'Khoảng cách tối đa là 7 ngày (10.080 phút).'

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
      message: 'Enter a whole number of minutes (0 to 10080).',
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
  if (!Number.isSafeInteger(n) || n < 0) {
    return {
      ok: false,
      message:
        'Interval must be a non-negative whole number (no decimals or negatives).',
    }
  }
  if (n > MAX_INTERVAL_MINUTES) {
    return {
      ok: false,
      message: INTERVAL_MAX_ERROR_MESSAGE,
    }
  }
  return { ok: true, value: n }
}

/**
 * Validates numeric interval_minutes before sending API payloads.
 * Undefined defaults to 0; invalid numbers throw instead of clamping or defaulting to 0.
 */
export function assertValidIntervalMinutes(
  value: unknown,
  tagKey?: string,
): number {
  if (value === undefined) return 0
  const prefix = tagKey ? `${tagKey}: ` : ''
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(
      `${prefix}Interval must be a non-negative whole number (0 to ${MAX_INTERVAL_MINUTES}).`,
    )
  }
  if (value > MAX_INTERVAL_MINUTES) {
    throw new Error(`${prefix}${INTERVAL_MAX_ERROR_MESSAGE}`)
  }
  return value
}
