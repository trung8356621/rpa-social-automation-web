import { staffApiRequest } from '../../../lib/api/http.ts'
import {
  mapLiveSchedulerSettings,
  type SchedulerSettingsData,
} from '../scheduler-settings.ts'

export async function fetchSchedulerSettings(options?: {
  signal?: AbortSignal
}): Promise<SchedulerSettingsData> {
  const payload = await staffApiRequest<unknown>(
    '/social-automation/api/settings',
    {
      method: 'GET',
      signal: options?.signal,
    },
  )
  return mapLiveSchedulerSettings(payload)
}

export async function updateSchedulerSettings(
  schedulerIntervalSeconds: number,
): Promise<SchedulerSettingsData> {
  const payload = await staffApiRequest<unknown>(
    '/social-automation/api/settings',
    {
      method: 'PUT',
      body: {
        scheduler_interval_seconds: schedulerIntervalSeconds,
      },
    },
  )
  return mapLiveSchedulerSettings(payload)
}
