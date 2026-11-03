import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'
import { clearStaffBootstrapCache } from '@/features/staff-client-connection/bootstrap-cache'

import { fetchStaffSessionBootstrap } from './api/fetch-staff-session-bootstrap'
import type { StaffSessionRole } from './api/live-types'
import {
  isOwnerOrAdminRole,
  isStaffRole,
  normalizeSessionRole,
  type SessionIdentity,
  type SessionIdentityStatus,
} from './types'

function useSessionIdentityLive(enabled: boolean) {
  const [status, setStatus] = useState<SessionIdentityStatus>(
    enabled ? 'loading' : 'unauthenticated',
  )
  const [user, setUser] = useState<SessionIdentity | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const lastUserIdRef = useRef<number | null>(null)
  const fetchGenRef = useRef(0)

  const clearIdentity = useCallback(() => {
    setUser(null)
    lastUserIdRef.current = null
    clearStaffBootstrapCache()
  }, [])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const gen = ++fetchGenRef.current

    setStatus('loading')
    setError(null)
    // Keep previous user only until response — do not paint role-gated UI from stale role
    // while loading a new session; consumers must wait for status !== loading.

    void fetchStaffSessionBootstrap({ signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted || gen !== fetchGenRef.current) return
        const raw = payload.bootstrap?.user
        const role = normalizeSessionRole(raw?.role)
        const id = raw?.id != null ? Number(raw.id) : NaN
        const name = typeof raw?.name === 'string' ? raw.name.trim() : ''

        if (!raw || !Number.isFinite(id) || id <= 0 || !role) {
          clearIdentity()
          setStatus('error')
          setError(
            'Session bootstrap missing user id/name/role. Cannot determine presentation role.',
          )
          return
        }

        if (lastUserIdRef.current != null && lastUserIdRef.current !== id) {
          clearStaffBootstrapCache()
        }
        lastUserIdRef.current = id

        setUser({ id, name: name || `User #${id}`, role })
        setStatus('authenticated')
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || gen !== fetchGenRef.current) return
        if (err instanceof ApiError && err.kind === 'abort') return
        if (err instanceof ApiError && err.isAuthRequired) {
          clearIdentity()
          setStatus('unauthenticated')
          setError(err.message)
          return
        }
        if (err instanceof ApiError && err.kind === 'forbidden') {
          clearIdentity()
          setStatus('forbidden')
          setError(err.message)
          return
        }
        clearIdentity()
        setStatus('error')
        setError(toSafeApiMessage(err))
      })

    return () => controller.abort()
  }, [clearIdentity, enabled, reloadToken])

  const reload = useCallback(async () => {
    setReloadToken((n) => n + 1)
  }, [])

  const role = user?.role ?? null

  return useMemo(
    () => ({
      status,
      user,
      error,
      role,
      isAuthenticated: status === 'authenticated' && user != null,
      isStaff: isStaffRole(role),
      isOwnerOrAdmin: isOwnerOrAdminRole(role),
      /** True only after bootstrap resolved — gates role-aware panels. */
      roleResolved: status === 'authenticated' && role != null,
      reload,
      clearIdentity,
    }),
    [clearIdentity, error, reload, role, status, user],
  )
}

function useSessionIdentityMock(options: { enabled: boolean }) {
  const [searchParams] = useSearchParams()
  const demoRole = (searchParams.get('sessionRole') ?? 'staff').toLowerCase()
  const enabled = options.enabled

  const user = useMemo<SessionIdentity | null>(() => {
    if (!enabled) return null
    const role = normalizeSessionRole(demoRole) ?? 'staff'
    if (role === 'owner') {
      return { id: 1, name: 'Mock Owner', role: 'owner' }
    }
    if (role === 'admin') {
      return { id: 2, name: 'Mock Admin', role: 'admin' }
    }
    return { id: 7, name: 'Mock Staff', role: 'staff' }
  }, [demoRole, enabled])

  const [status, setStatus] = useState<SessionIdentityStatus>(
    enabled ? 'loading' : 'unauthenticated',
  )

  useEffect(() => {
    if (!enabled) return
    if (demoRole === 'error') {
      setStatus('error')
      return
    }
    if (demoRole === 'unauthenticated') {
      clearStaffBootstrapCache()
      setStatus('unauthenticated')
      return
    }
    setStatus('loading')
    const t = window.setTimeout(() => setStatus('authenticated'), 120)
    return () => window.clearTimeout(t)
  }, [demoRole, enabled])

  const role: StaffSessionRole | null =
    status === 'authenticated' ? (user?.role ?? null) : null

  return useMemo(
    () => ({
      status:
        demoRole === 'error'
          ? ('error' as const)
          : demoRole === 'unauthenticated'
            ? ('unauthenticated' as const)
            : status,
      user: status === 'authenticated' ? user : null,
      error:
        demoRole === 'error'
          ? 'MOCK — session bootstrap failed'
          : demoRole === 'unauthenticated'
            ? 'Authentication required. Sign in to SEO-OPS staff session, then retry.'
            : null,
      role,
      isAuthenticated: status === 'authenticated' && user != null,
      isStaff: isStaffRole(role),
      isOwnerOrAdmin: isOwnerOrAdminRole(role),
      roleResolved: status === 'authenticated' && role != null,
      reload: async () => undefined,
      clearIdentity: () => {
        clearStaffBootstrapCache()
      },
    }),
    [demoRole, role, status, user],
  )
}

/**
 * Authenticated Staff Session identity from GET /api/social-automation/bootstrap.
 * Role comes only from bootstrap.user.role — never inferred from 403/route/localStorage.
 */
export function useSessionIdentity() {
  const mode = getRpaApiMode()
  const isLive = mode === 'live'
  const mock = useSessionIdentityMock({ enabled: !isLive })
  const live = useSessionIdentityLive(isLive)

  if (isLive) {
    return { mode: 'live' as const satisfies RpaApiMode, ...live }
  }
  return { mode: 'mock' as const satisfies RpaApiMode, ...mock }
}

export type SessionIdentityController = ReturnType<typeof useSessionIdentity>
