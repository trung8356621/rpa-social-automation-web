import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Site } from '@/features/action-tags/types'
import { MOCK_ACTION_REGISTRY } from '@/features/action-tags/mock-data'
import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import { fetchAccountSites } from './api/fetch-account-sites'

function useAccountSitesLive(options: { enabled: boolean }) {
  const enabled = options.enabled
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let cancelled = false

    setLoading(true)
    setError(null)

    void fetchAccountSites({ signal: controller.signal })
      .then((list) => {
        if (cancelled) return
        setSites(list)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        setSites([])
        setError(toSafeApiMessage(err))
        setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, reloadToken])

  const reload = useCallback(async () => {
    setReloadToken((n) => n + 1)
  }, [])

  return useMemo(
    () => ({
      mode: 'live' as const satisfies RpaApiMode,
      loading,
      error,
      sites,
      reload,
    }),
    [error, loading, reload, sites],
  )
}

function useAccountSitesMock(options: { enabled: boolean }) {
  const enabled = options.enabled
  const [loading, setLoading] = useState(enabled)
  const [sites, setSites] = useState<Site[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    const t = window.setTimeout(() => {
      if (cancelled) return
      // Same mock Site Registry seed as Action Tags — not a hardcoded platform list.
      setSites(
        structuredClone(MOCK_ACTION_REGISTRY.sites).filter(
          (s) => s.key.trim() !== '',
        ),
      )
      setLoading(false)
    }, 80)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [enabled, reloadToken])

  const reload = useCallback(async () => {
    setReloadToken((n) => n + 1)
  }, [])

  return useMemo(
    () => ({
      mode: 'mock' as const satisfies RpaApiMode,
      loading,
      error: null as string | null,
      sites,
      reload,
    }),
    [loading, reload, sites],
  )
}

/**
 * Site options for Account Create / platform filter.
 * Canonical Account `platform` value = Site.key; display = Site.name.
 */
export function useAccountSites() {
  const mode = getRpaApiMode()
  const isLive = mode === 'live'
  const mock = useAccountSitesMock({ enabled: !isLive })
  const live = useAccountSitesLive({ enabled: isLive })
  return isLive ? live : mock
}

export type AccountSitesController = ReturnType<typeof useAccountSites>
