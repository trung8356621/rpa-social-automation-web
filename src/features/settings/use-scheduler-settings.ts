import { useCallback, useEffect, useRef, useState } from 'react'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import {
  fetchSchedulerSettings,
  updateSchedulerSettings,
} from './api/scheduler-settings-api'
import {
  DEFAULT_MAX_INTERVAL_SECONDS,
  DEFAULT_MIN_INTERVAL_SECONDS,
  isSettingsUnavailableError,
  type SchedulerSettingsData,
} from './scheduler-settings'

const INITIAL_MOCK_SETTINGS: SchedulerSettingsData = {
  scheduler_interval_seconds: 3600,
  default_interval_seconds: 3600,
  min_interval_seconds: DEFAULT_MIN_INTERVAL_SECONDS,
  max_interval_seconds: DEFAULT_MAX_INTERVAL_SECONDS,
  updated_at: null,
}

export type UseSchedulerSettingsResult = {
  mode: RpaApiMode
  settings: SchedulerSettingsData | null
  loading: boolean
  saving: boolean
  unavailable: boolean
  authRequired: boolean
  error: string | null
  saveError: string | null
  saveSuccess: string | null
  reload: () => Promise<void>
  saveIntervalSeconds: (seconds: number) => Promise<boolean>
  clearSaveFeedback: () => void
}

export function useSchedulerSettings(): UseSchedulerSettingsResult {
  const mode = getRpaApiMode()
  const [settings, setSettings] = useState<SchedulerSettingsData | null>(
    mode === 'mock' ? INITIAL_MOCK_SETTINGS : null,
  )
  const [loading, setLoading] = useState(mode === 'live')
  const [saving, setSaving] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const mockStoreRef = useRef<SchedulerSettingsData>(INITIAL_MOCK_SETTINGS)
  const loadGenRef = useRef(0)

  const clearSaveFeedback = useCallback(() => {
    setSaveError(null)
    setSaveSuccess(null)
  }, [])

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const gen = ++loadGenRef.current
      if (mode === 'mock') {
        setSettings(mockStoreRef.current)
        setLoading(false)
        setUnavailable(false)
        setAuthRequired(false)
        setError(null)
        return
      }

      setLoading(true)
      setUnavailable(false)
      setAuthRequired(false)
      setError(null)

      try {
        const data = await fetchSchedulerSettings({ signal })
        if (signal?.aborted || gen !== loadGenRef.current) return
        setSettings(data)
        setLoading(false)
      } catch (err: unknown) {
        if (signal?.aborted || gen !== loadGenRef.current) return
        if (err instanceof ApiError && err.kind === 'abort') return
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
          setError(err.message)
          setLoading(false)
          return
        }
        if (isSettingsUnavailableError(err)) {
          setUnavailable(true)
          setError(
            'Scheduler Settings API is currently unavailable on this server (404/503).',
          )
          setLoading(false)
          return
        }
        setError(toSafeApiMessage(err))
        setLoading(false)
      }
    },
    [mode],
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const reload = useCallback(async () => {
    await load()
  }, [load])

  const saveIntervalSeconds = useCallback(
    async (seconds: number): Promise<boolean> => {
      setSaving(true)
      setSaveError(null)
      setSaveSuccess(null)

      if (mode === 'mock') {
        const next: SchedulerSettingsData = {
          ...mockStoreRef.current,
          scheduler_interval_seconds: seconds,
          updated_at: new Date().toISOString(),
        }
        mockStoreRef.current = next
        setSettings(next)
        setSaving(false)
        setSaveSuccess('Scheduler interval saved.')
        return true
      }

      try {
        await updateSchedulerSettings(seconds)
        const reloaded = await fetchSchedulerSettings()
        setSettings(reloaded)
        setUnavailable(false)
        setSaving(false)
        setSaveSuccess('Scheduler interval saved.')
        return true
      } catch (err: unknown) {
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
        }
        if (isSettingsUnavailableError(err)) {
          setUnavailable(true)
          setSaveError(
            'Scheduler Settings API is currently unavailable on this server (404/503). Changes were not saved.',
          )
          setSaving(false)
          return false
        }
        setSaveError(toSafeApiMessage(err))
        setSaving(false)
        return false
      }
    },
    [mode],
  )

  return {
    mode,
    settings,
    loading,
    saving,
    unavailable,
    authRequired,
    error,
    saveError,
    saveSuccess,
    reload,
    saveIntervalSeconds,
    clearSaveFeedback,
  }
}
