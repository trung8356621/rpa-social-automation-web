import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import { disconnectStaffClient } from './api/disconnect-staff-client'
import { fetchStaffClientConnection } from './api/fetch-staff-client-connection'
import type { LiveStaffClientConnectionResponse } from './api/live-types'
import {
  clearStaffBootstrapCache,
  syncBootstrapCacheFromServer,
} from './bootstrap-cache'
import type { StaffConnectionView } from './types'
import { useStaffClientConnectionMock } from './use-staff-client-connection-mock'

const POLL_MS_NOT_CONNECTED = 15_000
const POLL_MS_CONNECTED = 30_000

function mapResponse(
  payload: LiveStaffClientConnectionResponse,
): StaffConnectionView | null {
  const storageKey =
    typeof payload.localstorage_key === 'string' && payload.localstorage_key
      ? payload.localstorage_key
      : 'sa_staff_client_bootstrap_v1'

  if (payload.connected && payload.connection) {
    return {
      kind: 'connected',
      connection: payload.connection,
      localstorageKey: storageKey,
    }
  }

  if (!payload.connected && payload.bootstrap?.raw_key) {
    return {
      kind: 'not_connected',
      bootstrap: payload.bootstrap,
      localstorageKey: storageKey,
    }
  }

  return null
}

function useStaffClientConnectionLive(enabled: boolean) {
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [view, setView] = useState<StaffConnectionView | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  /** Monotonic fetch generation — avoids Strict Mode abort + in-flight skip races. */
  const fetchGenRef = useRef(0)
  const pollInFlightRef = useRef(false)

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type })
      window.setTimeout(() => setToast(null), 3500)
    },
    [],
  )

  const applyPayload = useCallback((payload: LiveStaffClientConnectionResponse) => {
    const next = mapResponse(payload)
    setView(next)
    syncBootstrapCacheFromServer(
      Boolean(payload.connected),
      payload.bootstrap,
      typeof payload.localstorage_key === 'string'
        ? payload.localstorage_key
        : undefined,
    )
  }, [])

  const fetchState = useCallback(
    async (signal: AbortSignal, opts?: { silent?: boolean }) => {
      if (opts?.silent && pollInFlightRef.current) return
      const gen = ++fetchGenRef.current
      if (opts?.silent) pollInFlightRef.current = true
      if (!opts?.silent) {
        setLoading(true)
        setError(null)
        setAuthRequired(false)
        setForbidden(false)
      }

      try {
        const payload = await fetchStaffClientConnection({ signal })
        if (signal.aborted || gen !== fetchGenRef.current) return
        applyPayload(payload)
        setError(null)
        setAuthRequired(false)
        setForbidden(false)
      } catch (err: unknown) {
        if (signal.aborted || gen !== fetchGenRef.current) return
        if (err instanceof ApiError && err.kind === 'abort') return
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
          setForbidden(false)
          setError(err.message)
          setView(null)
          // Do not show or trust cached key without verified session.
          return
        }
        if (err instanceof ApiError && err.kind === 'forbidden') {
          setForbidden(true)
          setAuthRequired(false)
          setError(err.message)
          setView(null)
          return
        }
        if (!opts?.silent) {
          setError(toSafeApiMessage(err))
        }
      } finally {
        if (opts?.silent) pollInFlightRef.current = false
        if (!opts?.silent && gen === fetchGenRef.current) setLoading(false)
      }
    },
    [applyPayload],
  )

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    // Authoritative GET first — never paint from localStorage before this.
    void fetchState(controller.signal)
    return () => controller.abort()
  }, [enabled, fetchState, reloadToken])

  // Poll so Electron register flips UI to connected without WebSocket.
  useEffect(() => {
    if (!enabled || authRequired || forbidden || error) return
    if (!view) return

    const ms =
      view.kind === 'connected' ? POLL_MS_CONNECTED : POLL_MS_NOT_CONNECTED
    const id = window.setInterval(() => {
      const controller = new AbortController()
      void fetchState(controller.signal, { silent: true })
    }, ms)
    return () => window.clearInterval(id)
  }, [authRequired, enabled, error, fetchState, forbidden, view])

  const reload = useCallback(async () => {
    setReloadToken((n) => n + 1)
  }, [])

  const disconnect = useCallback(async () => {
    setBusy(true)
    try {
      await disconnectStaffClient()
      clearStaffBootstrapCache()
      showToast('Đã ngắt kết nối Client.')
      setReloadToken((n) => n + 1)
    } catch (err: unknown) {
      showToast(toSafeApiMessage(err), 'error')
      // Preserve connected state on failure — re-GET to resync truth.
      setReloadToken((n) => n + 1)
      throw err
    } finally {
      setBusy(false)
    }
  }, [showToast])

  return useMemo(
    () => ({
      loading,
      error,
      authRequired,
      forbidden,
      view,
      busy,
      toast,
      reload,
      disconnect,
      mutationsEnabled: true,
    }),
    [
      authRequired,
      busy,
      disconnect,
      error,
      forbidden,
      loading,
      reload,
      toast,
      view,
    ],
  )
}

/**
 * Staff Client Connection — mock or LIVE staff session (CP17B).
 * LIVE never falls back to mock; server GET is authoritative.
 * Pass enabled=false for Owner/Admin / unresolved role (no Staff key fetch).
 */
export function useStaffClientConnection(options?: { enabled?: boolean }) {
  const mode = getRpaApiMode()
  const isLive = mode === 'live'
  const enabled = options?.enabled ?? true

  useEffect(() => {
    if (!enabled) clearStaffBootstrapCache()
  }, [enabled])

  const mock = useStaffClientConnectionMock({
    enabled: !isLive && enabled,
  })
  const live = useStaffClientConnectionLive(isLive && enabled)

  if (!enabled) {
    return {
      mode: (isLive ? 'live' : 'mock') as RpaApiMode,
      loading: false,
      error: null,
      authRequired: false,
      forbidden: false,
      view: null,
      busy: false,
      toast: null,
      reload: async () => undefined,
      disconnect: async () => undefined,
      mutationsEnabled: false,
    }
  }

  if (isLive) {
    return { mode: 'live' as const satisfies RpaApiMode, ...live }
  }
  return { mode: 'mock' as const satisfies RpaApiMode, ...mock }
}

export type StaffClientConnectionController = ReturnType<
  typeof useStaffClientConnection
>
