import type {
  CampaignDailyWindow,
  CampaignSchedule,
  CampaignScheduleType,
} from './types.ts'

export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'
export const DEFAULT_RESOURCE_RECHECK_SECONDS = 3600
export const DEFAULT_MIN_INTERVAL_SECONDS = 1800

export type ScheduleFormValues = {
  type: CampaignScheduleType
  timezone: string
  start_date: string
  start_time: string
  daily_from: string
  daily_to: string
  /** Minutes in UI */
  min_interval_minutes: number
  resource_recheck_seconds: number
}

export function minutesToSeconds(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes < 0) return 0
  return Math.round(minutes * 60)
}

export function secondsToMinutes(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0
  return Math.round(seconds / 60)
}

export function emptyScheduleForm(
  overrides?: Partial<ScheduleFormValues>,
): ScheduleFormValues {
  return {
    type: 'immediate',
    timezone: DEFAULT_TIMEZONE,
    start_date: '',
    start_time: '08:00',
    daily_from: '08:00',
    daily_to: '22:00',
    min_interval_minutes: secondsToMinutes(DEFAULT_MIN_INTERVAL_SECONDS),
    resource_recheck_seconds: DEFAULT_RESOURCE_RECHECK_SECONDS,
    ...overrides,
  }
}

export function combineDateTimeIso(
  date: string,
  time: string,
  timezone: string,
): string | null {
  const d = date.trim()
  const t = time.trim()
  if (!d || !t) return null
  // Keep offset-aware string for Asia/Ho_Chi_Minh default; other TZ pass as local wall clock +Z label note
  if (timezone === 'Asia/Ho_Chi_Minh') {
    return `${d}T${t.length === 5 ? `${t}:00` : t}+07:00`
  }
  return `${d}T${t.length === 5 ? `${t}:00` : t}`
}

export function scheduleFormToApi(
  form: ScheduleFormValues,
): CampaignSchedule {
  const resource =
    form.resource_recheck_seconds > 0
      ? form.resource_recheck_seconds
      : DEFAULT_RESOURCE_RECHECK_SECONDS

  if (form.type === 'immediate') {
    return {
      type: 'immediate',
      timezone: form.timezone || DEFAULT_TIMEZONE,
      start_at: null,
      daily_window: null,
      min_interval_seconds: null,
      resource_recheck_seconds: resource,
    }
  }

  if (form.type === 'scheduled') {
    return {
      type: 'scheduled',
      timezone: form.timezone || DEFAULT_TIMEZONE,
      start_at: combineDateTimeIso(
        form.start_date,
        form.start_time,
        form.timezone || DEFAULT_TIMEZONE,
      ),
      daily_window: null,
      min_interval_seconds: null,
      resource_recheck_seconds: resource,
    }
  }

  const daily_window: CampaignDailyWindow = {
    from: form.daily_from,
    to: form.daily_to,
  }

  return {
    type: 'time_window',
    timezone: form.timezone || DEFAULT_TIMEZONE,
    start_at: combineDateTimeIso(
      form.start_date,
      form.daily_from,
      form.timezone || DEFAULT_TIMEZONE,
    ),
    daily_window,
    min_interval_seconds: minutesToSeconds(form.min_interval_minutes),
    resource_recheck_seconds: resource,
  }
}

export function scheduleApiToForm(
  schedule: CampaignSchedule,
): ScheduleFormValues {
  const start = schedule.start_at
  let start_date = ''
  let start_time = '08:00'
  if (start) {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(start)
    if (m) {
      start_date = m[1]
      start_time = m[2]
    }
  }

  return emptyScheduleForm({
    type: schedule.type,
    timezone: schedule.timezone || DEFAULT_TIMEZONE,
    start_date,
    start_time,
    daily_from: schedule.daily_window?.from ?? '08:00',
    daily_to: schedule.daily_window?.to ?? '22:00',
    min_interval_minutes: secondsToMinutes(
      schedule.min_interval_seconds ?? DEFAULT_MIN_INTERVAL_SECONDS,
    ),
    resource_recheck_seconds:
      schedule.resource_recheck_seconds || DEFAULT_RESOURCE_RECHECK_SECONDS,
  })
}

export type ScheduleValidationResult =
  | { ok: true }
  | { ok: false; message: string }

const TIME_RE = /^\d{2}:\d{2}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function validateScheduleForm(
  form: ScheduleFormValues,
): ScheduleValidationResult {
  if (!form.timezone.trim()) {
    return { ok: false, message: 'Timezone is required.' }
  }

  if (form.type === 'immediate') return { ok: true }

  if (form.type === 'scheduled') {
    if (!DATE_RE.test(form.start_date)) {
      return { ok: false, message: 'Start Date is required (YYYY-MM-DD).' }
    }
    if (!TIME_RE.test(form.start_time)) {
      return { ok: false, message: 'Start Time is required (HH:MM).' }
    }
    return { ok: true }
  }

  if (!DATE_RE.test(form.start_date)) {
    return { ok: false, message: 'Start Date is required for Daily Time Window.' }
  }
  if (!TIME_RE.test(form.daily_from) || !TIME_RE.test(form.daily_to)) {
    return { ok: false, message: 'Daily Start/End Time must be HH:MM.' }
  }
  if (form.daily_from >= form.daily_to) {
    return { ok: false, message: 'Daily End Time must be after Daily Start Time.' }
  }
  if (
    !Number.isFinite(form.min_interval_minutes) ||
    form.min_interval_minutes < 1
  ) {
    return { ok: false, message: 'Minimum Interval must be at least 1 minute.' }
  }
  return { ok: true }
}

export function formatScheduleLabel(schedule: CampaignSchedule): string {
  if (schedule.type === 'immediate') return 'Run Immediately'
  if (schedule.type === 'scheduled') {
    return schedule.start_at
      ? `Scheduled · ${schedule.start_at}`
      : 'Scheduled'
  }
  const w = schedule.daily_window
  const interval =
    schedule.min_interval_seconds != null
      ? ` · ≥${secondsToMinutes(schedule.min_interval_seconds)}m`
      : ''
  return w
    ? `Daily ${w.from}–${w.to}${interval}`
    : 'Daily Time Window'
}

export const RESOURCE_RECHECK_HELPER =
  'Không đủ tài khoản Online: hệ thống tự kiểm tra lại sau 60 phút.'
