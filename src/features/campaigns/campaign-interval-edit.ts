import type { Campaign, CampaignStatus } from './types.ts'

export const MAX_INTERVAL_MINUTES = 10080

export const INTERVAL_MAX_ERROR_MESSAGE = 'Khoảng cách tối đa là 7 ngày.'

export type IntervalUnit = 'minutes' | 'hours' | 'days'

export type IntervalDraft = {
  value: string
  unit: IntervalUnit
}

export const INTERVAL_UNIT_MULTIPLIER: Record<IntervalUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
}

export const INTERVAL_UNIT_LABELS: Record<IntervalUnit, string> = {
  minutes: 'Phút',
  hours: 'Giờ',
  days: 'Ngày',
}

export function maxInputForUnit(unit: IntervalUnit): number {
  return Math.floor(MAX_INTERVAL_MINUTES / INTERVAL_UNIT_MULTIPLIER[unit])
}

/**
 * Chooses a convenient exact representation when hydrating an existing interval_minutes.
 * Never rounds: 2880 -> 2 days, 240 -> 4 hours, 90 -> 90 minutes, 0 -> 0 minutes.
 */
export function decomposeIntervalMinutes(
  minutes: number | null | undefined,
): IntervalDraft {
  const m =
    typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0
      ? Math.trunc(minutes)
      : 0
  if (m === 0) return { value: '0', unit: 'minutes' }
  if (m % 1440 === 0) return { value: String(m / 1440), unit: 'days' }
  if (m % 60 === 0) return { value: String(m / 60), unit: 'hours' }
  return { value: String(m), unit: 'minutes' }
}

/**
 * Switches unit while preserving exact minute value.
 * If the target unit cannot represent the current duration as an exact integer,
 * retains the current draft and returns an inline warning instead of rounding.
 */
export function switchIntervalUnit(
  current: IntervalDraft,
  nextUnit: IntervalUnit,
): { draft: IntervalDraft; warning: string | null } {
  if (current.unit === nextUnit) {
    return { draft: current, warning: null }
  }
  const s = current.value.trim()
  if (s === '' || !/^\d+$/.test(s)) {
    return { draft: { value: current.value, unit: nextUnit }, warning: null }
  }
  const num = Number(s)
  if (!Number.isSafeInteger(num) || num < 0) {
    return { draft: { value: current.value, unit: nextUnit }, warning: null }
  }
  const totalMinutes = num * INTERVAL_UNIT_MULTIPLIER[current.unit]
  const targetMultiplier = INTERVAL_UNIT_MULTIPLIER[nextUnit]
  if (totalMinutes % targetMultiplier !== 0) {
    return {
      draft: current,
      warning: `${totalMinutes} phút không chia hết theo ${INTERVAL_UNIT_LABELS[nextUnit].toLowerCase()}; giữ nguyên giá trị chính xác.`,
    }
  }
  return {
    draft: {
      value: String(totalMinutes / targetMultiplier),
      unit: nextUnit,
    },
    warning: null,
  }
}

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

export function validateIntervalDraft(
  draft: IntervalDraft,
): { ok: true; value: number } | { ok: false; message: string } {
  const s = draft.value.trim()
  if (s === '') {
    return {
      ok: false,
      message: 'Vui lòng nhập số nguyên không âm.',
    }
  }
  if (!/^\d+$/.test(s)) {
    return {
      ok: false,
      message:
        'Khoảng cách phải là số nguyên không âm (không nhập số âm hoặc số thập phân).',
    }
  }
  const n = Number(s)
  if (!Number.isSafeInteger(n) || n < 0) {
    return {
      ok: false,
      message:
        'Khoảng cách phải là số nguyên không âm (không nhập số âm hoặc số thập phân).',
    }
  }
  const minutes = n * INTERVAL_UNIT_MULTIPLIER[draft.unit]
  if (!Number.isSafeInteger(minutes) || minutes > MAX_INTERVAL_MINUTES) {
    return {
      ok: false,
      message: INTERVAL_MAX_ERROR_MESSAGE,
    }
  }
  return { ok: true, value: minutes }
}

export function validateInlineIntervalInput(
  raw: string,
  unit: IntervalUnit = 'minutes',
): { ok: true; value: number } | { ok: false; message: string } {
  return validateIntervalDraft({ value: raw, unit })
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
