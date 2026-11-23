import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import {
  fetchLiveScriptRegistryDetail,
  fetchLiveScriptRegistryList,
  updateLiveScriptSharing,
} from './api/fetch-script-registry'
import { formatSharingErrorMessage } from './sharing'
import type {
  DemoScenario,
  ScriptDetail,
  ScriptListItem,
  ScriptOperationalSettingsInput,
  ScriptSharingMode,
} from './types'
import { useScriptRegistryMock } from './use-script-registry-mock'

function useScriptRegistryLive(enabled: boolean) {
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'
  const selectedKey = searchParams.get('detail')

  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [scripts, setScripts] = useState<ScriptListItem[]>([])
  const [details, setDetails] = useState<Record<string, ScriptDetail>>({})
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const detailsRef = useRef(details)

  useEffect(() => {
    detailsRef.current = details
  }, [details])

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type })
      window.setTimeout(() => setToast(null), 3500)
    },
    [],
  )

  useEffect(() => {
    if (!enabled) return

    if (demo === 'loading') {
      setLoading(true)
      setError(null)
      setAuthRequired(false)
      return
    }
    if (demo === 'error') {
      setLoading(false)
      setAuthRequired(false)
      setScripts([])
      setError('LIVE ERROR — Script Registry request failed (local QA scenario).')
      return
    }
    if (demo === 'empty' || demo === 'missing-video') {
      setLoading(false)
      setAuthRequired(false)
      setError(null)
      setScripts([])
      setDetails({})
      return
    }

    const controller = new AbortController()
    let cancelled = false

    setLoading(true)
    setError(null)
    setAuthRequired(false)
    setScripts([])

    void fetchLiveScriptRegistryList({ signal: controller.signal })
      .then((list) => {
        if (cancelled) return
        setScripts(list)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
          setError(err.message)
          setScripts([])
          setLoading(false)
          return
        }
        setAuthRequired(false)
        setError(toSafeApiMessage(err))
        setScripts([])
        setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [demo, enabled, reloadToken])

  useEffect(() => {
    if (!enabled || !selectedKey) {
      setDetailLoading(false)
      setDetailError(null)
      return
    }
    if (detailsRef.current[selectedKey]) {
      setDetailLoading(false)
      setDetailError(null)
      return
    }

    const controller = new AbortController()
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)

    void fetchLiveScriptRegistryDetail(selectedKey, {
      signal: controller.signal,
    })
      .then((detail) => {
        if (cancelled) return
        setDetails((prev) => ({ ...prev, [selectedKey]: detail }))
        setDetailLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        setDetailError(toSafeApiMessage(err))
        setDetailLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, selectedKey, reloadToken])

  const reload = useCallback(async () => {
    setDetails({})
    setDetailError(null)
    setReloadToken((n) => n + 1)
  }, [])

  const getDetail = useCallback(
    (packageKey: string) => details[packageKey] ?? null,
    [details],
  )

  const removeScript = useCallback(async (_packageKey: string) => {
    showToast(
      'Remove Script chưa có Staff REST — Script Registry LIVE là read-only.',
      'error',
    )
  }, [showToast])

  const updateScriptSharing = useCallback(
    async (packageKey: string, sharingMode: ScriptSharingMode) => {
      try {
        await updateLiveScriptSharing(packageKey, sharingMode)
        const [freshList, freshDetail] = await Promise.all([
          fetchLiveScriptRegistryList(),
          fetchLiveScriptRegistryDetail(packageKey),
        ])
        setScripts(freshList)
        setDetails((prev) => ({ ...prev, [packageKey]: freshDetail }))
        showToast(
          freshDetail.sharing_mode === 'cms_global'
            ? `Đã bật chia sẻ CMS Global (${freshDetail.global_scope ?? 'global'}).`
            : 'Đã chuyển về Site-specific.',
        )
      } catch (err: unknown) {
        const msg = formatSharingErrorMessage(err)
        showToast(msg, 'error')
        throw new Error(msg)
      }
    },
    [showToast],
  )

  const updateOperationalSettings = useCallback(
    async (_packageKey: string, _input: ScriptOperationalSettingsInput) => {
      throw new Error(
        'Operational Settings API is not available on the Backend yet. LIVE mutations are disabled.',
      )
    },
    [],
  )

  return useMemo(
    () => ({
      mode: 'live' as const satisfies RpaApiMode,
      mutationsEnabled: false,
      operationalSettingsSupported: false,
      authRequired,
      loading,
      error,
      detailLoading,
      detailError,
      data: {
        scripts,
        details,
      },
      toast,
      showToast,
      reload,
      getDetail,
      removeScript,
      updateScriptSharing,
      updateOperationalSettings,
    }),
    [
      authRequired,
      detailError,
      detailLoading,
      details,
      error,
      getDetail,
      loading,
      reload,
      removeScript,
      scripts,
      showToast,
      toast,
      updateOperationalSettings,
      updateScriptSharing,
    ],
  )
}

/**
 * Script Registry — mock (default) or live Staff Session read-only.
 * Live never falls back to mock catalog rows.
 */
export function useScriptRegistry() {
  const mode = getRpaApiMode()
  const isLive = mode === 'live'
  const mock = useScriptRegistryMock({ enabled: !isLive })
  const live = useScriptRegistryLive(isLive)

  if (isLive) return live

  return {
    mode: 'mock' as const satisfies RpaApiMode,
    mutationsEnabled: true,
    operationalSettingsSupported: true,
    authRequired: false,
    detailLoading: false,
    detailError: null as string | null,
    ...mock,
  }
}

export type ScriptRegistryController = ReturnType<typeof useScriptRegistry>
