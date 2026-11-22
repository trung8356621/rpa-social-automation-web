import { ApiError } from '../../lib/api/errors.ts'

export const CAMPAIGN_SCHEDULER_DESCRIPTION =
  'Controls how often the server checks running Campaigns and dispatches eligible jobs. Campaigns continue running even when no Clients are online.'

export const DEFAULT_MIN_INTERVAL_SECONDS = 60
export const DEFAULT_MAX_INTERVAL_SECONDS = 86400

export type SchedulerSettingsData = {
  scheduler_interval_seconds: number
  default_interval_seconds: number
  min_interval_seconds: number
  max_interval_seconds: number
  updated_at: string | null
}

export type SchedulerMinuteBounds = {
  minMinutes: number
  maxMinutes: number
}

export type SchedulerMinutesValidation =
  | { valid: true; minutes: number; seconds: number }
  | { valid: false; error: string }

export type SchedulerPermissionIdentity = {
  roleResolved: boolean
  isOwnerOrAdmin: boolean
  isStaff: boolean
}

export function secondsToMinutes(seconds: number): number {
  if (!Number.isFinite(seconds)) return 1
  return Math.round(seconds / 60)
}

export function minutesToSeconds(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_MIN_INTERVAL_SECONDS
  return Math.round(minutes * 60)
}

export function getMinuteBounds(
  settings: Pick<
    SchedulerSettingsData,
    'min_interval_seconds' | 'max_interval_seconds'
  > | null,
): SchedulerMinuteBounds {
  const minSeconds =
    settings && Number.isFinite(settings.min_interval_seconds)
      ? settings.min_interval_seconds
      : DEFAULT_MIN_INTERVAL_SECONDS
  const maxSeconds =
    settings && Number.isFinite(settings.max_interval_seconds)
      ? settings.max_interval_seconds
      : DEFAULT_MAX_INTERVAL_SECONDS

  const minMinutes = Math.max(1, Math.ceil(minSeconds / 60))
  const maxMinutes = Math.max(minMinutes, Math.floor(maxSeconds / 60))

  return { minMinutes, maxMinutes }
}

export function validateSchedulerMinutes(
  rawInput: string | number,
  bounds: SchedulerMinuteBounds = { minMinutes: 1, maxMinutes: 1440 },
): SchedulerMinutesValidation {
  const normalized =
    typeof rawInput === 'number' ? String(rawInput) : rawInput.trim()

  if (!normalized) {
    return {
      valid: false,
      error: `Enter an interval between ${bounds.minMinutes} and ${bounds.maxMinutes} minutes.`,
    }
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return {
      valid: false,
      error: `Interval must be a whole number of minutes (${bounds.minMinutes}–${bounds.maxMinutes}).`,
    }
  }

  if (parsed < bounds.minMinutes || parsed > bounds.maxMinutes) {
    return {
      valid: false,
      error: `Interval must be between ${bounds.minMinutes} and ${bounds.maxMinutes} minutes.`,
    }
  }

  return {
    valid: true,
    minutes: parsed,
    seconds: minutesToSeconds(parsed),
  }
}

export function mapLiveSchedulerSettings(
  payload: unknown,
): SchedulerSettingsData {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid settings response payload.')
  }

  const record = payload as Record<string, unknown>
  const data =
    'data' in record && record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : record

  const schedulerInterval = Number(data.scheduler_interval_seconds)
  const defaultInterval = Number(data.default_interval_seconds)
  const minInterval = Number(data.min_interval_seconds)
  const maxInterval = Number(data.max_interval_seconds)

  if (
    !Number.isFinite(schedulerInterval) ||
    !Number.isFinite(defaultInterval) ||
    !Number.isFinite(minInterval) ||
    !Number.isFinite(maxInterval)
  ) {
    throw new Error('Settings payload is missing required interval fields.')
  }

  const updatedAt =
    typeof data.updated_at === 'string' && data.updated_at.trim().length > 0
      ? data.updated_at
      : null

  return {
    scheduler_interval_seconds: schedulerInterval,
    default_interval_seconds: defaultInterval,
    min_interval_seconds: minInterval,
    max_interval_seconds: maxInterval,
    updated_at: updatedAt,
  }
}

export function isSettingsUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if (error instanceof ApiError) {
    return (
      error.status === 404 ||
      error.status === 503 ||
      error.kind === 'not_found'
    )
  }
  const maybeStatus = (error as { status?: unknown }).status
  const maybeKind = (error as { kind?: unknown }).kind
  return maybeStatus === 404 || maybeStatus === 503 || maybeKind === 'not_found'
}

export function canEditSchedulerSettings(
  identity: SchedulerPermissionIdentity,
): boolean {
  return identity.roleResolved && identity.isOwnerOrAdmin && !identity.isStaff
}
