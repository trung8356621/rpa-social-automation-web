import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { STAFF_CLIENT_BOOTSTRAP_LOCALSTORAGE_KEY } from '@/lib/api/config'

import {
  clearStaffBootstrapCache,
  syncBootstrapCacheFromServer,
} from './bootstrap-cache'
import {
  MOCK_STAFF_CONNECTED,
  MOCK_STAFF_NOT_CONNECTED,
} from './mock-data'
import type { StaffConnectionDemo, StaffConnectionView } from './types'

function toView(
  connected: boolean,
): StaffConnectionView | null {
  if (connected) {
    const c = MOCK_STAFF_CONNECTED.connection
    if (!c) return null
    return {
      kind: 'connected',
      connection: c,
      localstorageKey: STAFF_CLIENT_BOOTSTRAP_LOCALSTORAGE_KEY,
    }
  }
  const b = MOCK_STAFF_NOT_CONNECTED.bootstrap
  if (!b) return null
  return {
    kind: 'not_connected',
    bootstrap: {
      ...b,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_at_iso: new Date(Date.now() + 3600_000).toISOString(),
    },
    localstorageKey: STAFF_CLIENT_BOOTSTRAP_LOCALSTORAGE_KEY,
  }
}

export function useStaffClientConnectionMock(options: { enabled: boolean }) {
  const [searchParams] = useSearchParams()
  const demo =
    (searchParams.get('staffConn') as StaffConnectionDemo | null) ?? 'default'

  const [loading, setLoading] = useState(options.enabled)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(demo === 'connected')
  const [view, setView] = useState<StaffConnectionView | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type })
      window.setTimeout(() => setToast(null), 3500)
    },
    [],
  )

  const applyState = useCallback((nextConnected: boolean) => {
    const next = toView(nextConnected)
    setConnected(nextConnected)
    setView(next)
    if (next?.kind === 'not_connected') {
      syncBootstrapCacheFromServer(false, next.bootstrap)
    } else {
      clearStaffBootstrapCache()
    }
  }, [])

  useEffect(() => {
    if (!options.enabled) return

    if (demo === 'loading') {
      setLoading(true)
      setError(null)
      setView(null)
      return
    }
    if (demo === 'error') {
      setLoading(false)
      setError('MOCK ERROR — Staff Client Connection failed.')
      setView(null)
      return
    }

    setLoading(true)
    setError(null)
    const timer = window.setTimeout(() => {
      const startConnected = demo === 'connected'
      applyState(startConnected)
      setLoading(false)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [applyState, demo, options.enabled])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    await new Promise((r) => window.setTimeout(r, 120))
    applyState(connected)
    setLoading(false)
  }, [applyState, connected])

  const disconnect = useCallback(async () => {
    setBusy(true)
    try {
      await new Promise((r) => window.setTimeout(r, 200))
      clearStaffBootstrapCache()
      applyState(false)
      showToast('Đã ngắt kết nối Client (MOCK).')
    } finally {
      setBusy(false)
    }
  }, [applyState, showToast])

  return useMemo(
    () => ({
      loading,
      error,
      authRequired: false,
      forbidden: false,
      view,
      busy,
      toast,
      reload,
      disconnect,
      mutationsEnabled: true,
    }),
    [busy, disconnect, error, loading, reload, toast, view],
  )
}
