import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import { fetchLiveBrowsers } from './api/fetch-browsers'
import type { ClientsInventoryData, DemoScenario } from './types'
import { useClientsMock } from './use-clients-mock'

const EMPTY_LIVE: ClientsInventoryData = {
  browsers: [],
  online_clients_no_browser: [],
  summary: null,
  status_policy: null,
}

function useClientsLive(enabled: boolean) {
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'

  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [data, setData] = useState<ClientsInventoryData>(EMPTY_LIVE)
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
      setData(EMPTY_LIVE)
      setError('LIVE ERROR — Browsers inventory request failed (local QA scenario).')
      return
    }
    if (demo === 'empty') {
      setLoading(false)
      setAuthRequired(false)
      setError(null)
      setData({
        browsers: [],
        online_clients_no_browser: [],
        summary: {
          total_browsers: 0,
          online_browsers: 0,
          offline_browsers: 0,
          total_clients: 0,
        },
        status_policy: null,
      })
      return
    }

    const controller = new AbortController()
    let cancelled = false

    setLoading(true)
    setError(null)
    setAuthRequired(false)
    setData(EMPTY_LIVE)

    void fetchLiveBrowsers({ signal: controller.signal })
      .then((inventory) => {
        if (cancelled) return
        setData(inventory)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
          setError(err.message)
          setData(EMPTY_LIVE)
          setLoading(false)
          return
        }
        setAuthRequired(false)
        setError(toSafeApiMessage(err))
        setData(EMPTY_LIVE)
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

  const copyAccountId = useCallback(
    async (accountUuid: string) => {
      if (!accountUuid.trim()) {
        showToast('Account ID không có trên Browser này.', 'error')
        return
      }
      try {
        await navigator.clipboard.writeText(accountUuid)
        showToast(`Copied Account ID: ${accountUuid}`)
      } catch {
        showToast('Không copy được Account ID.', 'error')
      }
    },
    [showToast],
  )

  return useMemo(
    () => ({
      mode: 'live' as const satisfies RpaApiMode,
      mutationsEnabled: false,
      authRequired,
      loading,
      error,
      data,
      toast,
      showToast,
      reload,
      copyAccountId,
    }),
    [
      authRequired,
      copyAccountId,
      data,
      error,
      loading,
      reload,
      showToast,
      toast,
    ],
  )
}

/**
 * Clients Browser-first inventory — mock (default) or live Staff Session read-only.
 * Live never falls back to mock rows.
 */
export function useClients() {
  const mode = getRpaApiMode()
  const isLive = mode === 'live'
  const mock = useClientsMock({ enabled: !isLive })
  const live = useClientsLive(isLive)

  if (isLive) return live

  return {
    mode: 'mock' as const satisfies RpaApiMode,
    mutationsEnabled: false,
    authRequired: false,
    ...mock,
  }
}

export type ClientsController = ReturnType<typeof useClients>
