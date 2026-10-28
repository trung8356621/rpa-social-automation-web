import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import { fetchLiveActionRegistry } from './api/fetch-action-registry'
import { EMPTY_REGISTRY } from './mock-data'
import type { ActionRegistryData, DemoScenario } from './types'
import { useActionRegistryMock } from './use-action-registry-mock'

const LIVE_MUTATION_BLOCKED =
  'Live editing not enabled yet (CP9A read-only). Switch to mock mode for local edits.'

function liveMutationBlocked(): never {
  throw new Error(LIVE_MUTATION_BLOCKED)
}

function useActionRegistryLive(enabled: boolean) {
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'

  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [data, setData] = useState<ActionRegistryData>(() =>
    structuredClone(EMPTY_REGISTRY),
  )
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

    // demo=* helpers are visual QA only — never inject mock WordPress/tag rows in live
    if (demo === 'loading') {
      setLoading(true)
      setError(null)
      setAuthRequired(false)
      return
    }
    if (demo === 'error') {
      setLoading(false)
      setAuthRequired(false)
      setData(structuredClone(EMPTY_REGISTRY))
      setError('LIVE ERROR — Action Registry request failed (local QA scenario).')
      return
    }
    if (demo === 'empty-tags' || demo === 'empty-sites' || demo === 'empty-auth-scripts') {
      setLoading(false)
      setAuthRequired(false)
      setError(null)
      const empty = structuredClone(EMPTY_REGISTRY)
      setData(empty)
      return
    }

    const controller = new AbortController()
    let cancelled = false

    setLoading(true)
    setError(null)
    setAuthRequired(false)
    setData(structuredClone(EMPTY_REGISTRY))

    void fetchLiveActionRegistry({ signal: controller.signal })
      .then((registry) => {
        if (cancelled) return
        setData(registry)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
          setError(err.message)
          setData(structuredClone(EMPTY_REGISTRY))
          setLoading(false)
          return
        }
        setAuthRequired(false)
        setError(toSafeApiMessage(err))
        setData(structuredClone(EMPTY_REGISTRY))
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

  const createTag = useCallback(
    async (_payload: {
      site_id: number
      path_id: number
      action_key: string
      auth_script_id?: string | null
    }) => liveMutationBlocked(),
    [],
  )
  const updateTagAuthScript = useCallback(
    async (_tagId: number, _authScriptId: string | null) =>
      liveMutationBlocked(),
    [],
  )
  const deleteTag = useCallback(
    async (_tagId: number, _tagKey: string) => {
      showToast(LIVE_MUTATION_BLOCKED, 'error')
    },
    [showToast],
  )
  const saveSite = useCallback(
    async (_siteData: {
      id?: number
      name: string
      base_url?: string
      base_url_mode?: 'fixed' | 'dynamic'
      test_base_url?: string
      description?: string
    }) => liveMutationBlocked(),
    [],
  )
  const savePath = useCallback(
    async (_pathData: {
      id?: number
      site_id: number
      name: string
      url_pattern: string
      description?: string
    }) => liveMutationBlocked(),
    [],
  )

  return useMemo(
    () => ({
      mode: 'live' as const satisfies RpaApiMode,
      mutationsEnabled: false,
      demo,
      loading,
      error,
      authRequired,
      data,
      toast,
      showToast,
      createTag,
      updateTagAuthScript,
      deleteTag,
      saveSite,
      savePath,
      reload,
    }),
    [
      authRequired,
      createTag,
      data,
      deleteTag,
      demo,
      error,
      loading,
      reload,
      savePath,
      saveSite,
      showToast,
      toast,
      updateTagAuthScript,
    ],
  )
}

/**
 * Action Tags data hook — mock (default) or live staff GET (read-only).
 * Live never silently falls back to mock records.
 */
export function useActionRegistry() {
  const mode = getRpaApiMode()
  const isLive = mode === 'live'
  const mock = useActionRegistryMock({ enabled: !isLive })
  const live = useActionRegistryLive(isLive)

  if (isLive) return live

  return {
    mode: 'mock' as const satisfies RpaApiMode,
    mutationsEnabled: true,
    authRequired: false,
    ...mock,
  }
}

export type ActionRegistryController = ReturnType<typeof useActionRegistry>
