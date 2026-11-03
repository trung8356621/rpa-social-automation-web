import { useCallback, useEffect, useMemo, useState } from 'react'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import { fetchOwnerClientConnections } from './api/fetch-owner-client-connections'
import type { LiveOwnerClientConnectionsResponse } from './api/live-types'
import { MOCK_OWNER_CONNECTIONS } from './mock-data'
import type { OwnerConnectionRow } from './types'

function useOwnerClientConnectionsLive(enabled: boolean) {
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [rows, setRows] = useState<OwnerConnectionRow[]>([])
  const [summary, setSummary] = useState<
    LiveOwnerClientConnectionsResponse['summary'] | null
  >(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setRows([])
      setError(null)
      setAuthRequired(false)
      setForbidden(false)
      return
    }
    const controller = new AbortController()
    let cancelled = false

    setLoading(true)
    setError(null)
    setAuthRequired(false)
    setForbidden(false)

    void fetchOwnerClientConnections({ signal: controller.signal })
      .then((payload) => {
        if (cancelled) return
        setRows(Array.isArray(payload.connections) ? payload.connections : [])
        setSummary(payload.summary ?? null)
        setNotes(typeof payload.notes === 'string' ? payload.notes : null)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
          setError(err.message)
          setRows([])
          setLoading(false)
          return
        }
        if (err instanceof ApiError && err.kind === 'forbidden') {
          // Owner/Admin presentation path — 403 is an authorization error, not empty.
          setForbidden(true)
          setError(err.message)
          setRows([])
          setLoading(false)
          return
        }
        setError(toSafeApiMessage(err))
        setRows([])
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
      loading,
      error,
      authRequired,
      forbidden,
      rows,
      summary,
      notes,
      reload,
      visible: enabled,
    }),
    [
      authRequired,
      enabled,
      error,
      forbidden,
      loading,
      notes,
      reload,
      rows,
      summary,
    ],
  )
}

function useOwnerClientConnectionsMock(options: { enabled: boolean }) {
  const [loading, setLoading] = useState(options.enabled)
  const [rows, setRows] = useState<OwnerConnectionRow[]>([])

  useEffect(() => {
    if (!options.enabled) {
      setLoading(false)
      setRows([])
      return
    }
    setLoading(true)
    const t = window.setTimeout(() => {
      setRows(MOCK_OWNER_CONNECTIONS.connections)
      setLoading(false)
    }, 150)
    return () => window.clearTimeout(t)
  }, [options.enabled])

  const reload = useCallback(async () => {
    setRows([...MOCK_OWNER_CONNECTIONS.connections])
  }, [])

  return useMemo(
    () => ({
      loading,
      error: null as string | null,
      authRequired: false,
      forbidden: false,
      rows,
      summary: MOCK_OWNER_CONNECTIONS.summary ?? null,
      notes: MOCK_OWNER_CONNECTIONS.notes ?? null,
      reload,
      visible: options.enabled,
    }),
    [loading, options.enabled, reload, rows],
  )
}

/**
 * Owner/Admin Client connection inventory.
 * Gate with enabled from bootstrap.user.role (owner|admin) — never from 403 inference.
 */
export function useOwnerClientConnections(options?: { enabled?: boolean }) {
  const mode = getRpaApiMode()
  const isLive = mode === 'live'
  const enabled = options?.enabled ?? false
  const mock = useOwnerClientConnectionsMock({ enabled: !isLive && enabled })
  const live = useOwnerClientConnectionsLive(isLive && enabled)

  if (isLive) {
    return { mode: 'live' as const satisfies RpaApiMode, ...live }
  }
  return { mode: 'mock' as const satisfies RpaApiMode, ...mock }
}

export type OwnerClientConnectionsController = ReturnType<
  typeof useOwnerClientConnections
>
