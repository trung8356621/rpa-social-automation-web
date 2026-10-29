import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import { fetchLiveClientApiKeys } from './api/fetch-client-api-keys'
import type { ClientApiKeyItem, DemoScenario } from './types'
import { useClientApiKeysMock } from './use-client-api-keys-mock'

function useClientApiKeysLive(enabled: boolean) {
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'

  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [keys, setKeys] = useState<ClientApiKeyItem[]>([])
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

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
      setKeys([])
      setError('LIVE ERROR — Client API Keys request failed (local QA scenario).')
      return
    }
    if (demo === 'empty') {
      setLoading(false)
      setAuthRequired(false)
      setError(null)
      setKeys([])
      return
    }

    const controller = new AbortController()
    let cancelled = false

    setLoading(true)
    setError(null)
    setAuthRequired(false)
    setKeys([])

    void fetchLiveClientApiKeys({ signal: controller.signal })
      .then((list) => {
        if (cancelled) return
        setKeys(list)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
          setError(err.message)
          setKeys([])
          setLoading(false)
          return
        }
        setAuthRequired(false)
        setError(toSafeApiMessage(err))
        setKeys([])
        setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [demo, enabled, reloadToken])

  const reload = useCallback(async () => {
    setReloadToken((n) => n + 1)
  }, [])

  const createKey = useCallback(async (_name: string) => {
    showToast(
      'Create Key bị tắt trong LIVE — Client API Keys là read-only.',
      'error',
    )
  }, [showToast])

  const revokeKey = useCallback(async (_id: number) => {
    showToast(
      'Revoke Key bị tắt trong LIVE — Client API Keys là read-only.',
      'error',
    )
  }, [showToast])

  const dismissOneTime = useCallback(() => {
    /* LIVE never holds one-time raw secrets */
  }, [])

  return useMemo(
    () => ({
      mode: 'live' as const satisfies RpaApiMode,
      mutationsEnabled: false,
      authRequired,
      loading,
      error,
      data: { keys },
      toast,
      showToast,
      reload,
      createKey,
      revokeKey,
      oneTimeRawKey: null as string | null,
      oneTimeKeyName: null as string | null,
      dismissOneTime,
    }),
    [
      authRequired,
      createKey,
      dismissOneTime,
      error,
      keys,
      loading,
      reload,
      revokeKey,
      showToast,
      toast,
    ],
  )
}

/**
 * Client API Keys — mock (default) or live Staff Session read-only list.
 * Live never falls back to mock rows and never stores raw secrets.
 */
export function useClientApiKeys() {
  const mode = getRpaApiMode()
  const isLive = mode === 'live'
  const mock = useClientApiKeysMock({ enabled: !isLive })
  const live = useClientApiKeysLive(isLive)

  if (isLive) return live

  return {
    mode: 'mock' as const satisfies RpaApiMode,
    mutationsEnabled: true,
    authRequired: false,
    ...mock,
  }
}

export type ClientApiKeysController = ReturnType<typeof useClientApiKeys>
