import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import {
  createLiveClientApiKey,
  type CreateClientApiKeyInput,
} from './api/create-client-api-key'
import { fetchLiveAssignableUsers } from './api/fetch-assignable-users'
import { fetchLiveClientApiKeys } from './api/fetch-client-api-keys'
import type { AssignableUser, ClientApiKeyItem, DemoScenario } from './types'
import { useClientApiKeysMock } from './use-client-api-keys-mock'

function useClientApiKeysLive(options: {
  enabled: boolean
  canAssignToOthers: boolean
  currentUserId: number | null
}) {
  const { enabled, canAssignToOthers, currentUserId } = options
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
  const [oneTimeRawKey, setOneTimeRawKey] = useState<string | null>(null)
  const [oneTimeKeyName, setOneTimeKeyName] = useState<string | null>(null)
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([])
  const [assignableLoading, setAssignableLoading] = useState(false)

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

  useEffect(() => {
    if (!enabled || !canAssignToOthers) {
      setAssignableUsers([])
      setAssignableLoading(false)
      return
    }

    const controller = new AbortController()
    let cancelled = false
    setAssignableLoading(true)

    void fetchLiveAssignableUsers({ signal: controller.signal })
      .then((users) => {
        if (cancelled) return
        setAssignableUsers(users)
        setAssignableLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        // Owner gate is server-authoritative — hide selector on forbidden.
        setAssignableUsers([])
        setAssignableLoading(false)
        if (err instanceof ApiError && err.kind === 'forbidden') {
          return
        }
        if (!(err instanceof ApiError && err.isAuthRequired)) {
          showToast(toSafeApiMessage(err), 'error')
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [canAssignToOthers, enabled, reloadToken, showToast])

  const reload = useCallback(async () => {
    setReloadToken((n) => n + 1)
  }, [])

  const createKey = useCallback(
    async (input: CreateClientApiKeyInput | string) => {
      const normalized: CreateClientApiKeyInput =
        typeof input === 'string'
          ? { name: input, canAssignToOthers }
          : { ...input, canAssignToOthers }

      try {
        const result = await createLiveClientApiKey(normalized)
        // Ephemeral reveal only — never localStorage / never key list secret.
        setOneTimeRawKey(result.rawKey)
        setOneTimeKeyName(result.key.name)
        setKeys((prev) => {
          const without = prev.filter((k) => k.id !== result.key.id)
          return [result.key, ...without]
        })
        showToast(result.message)
        setReloadToken((n) => n + 1)
      } catch (err: unknown) {
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
        }
        showToast(toSafeApiMessage(err), 'error')
        throw err
      }
    },
    [canAssignToOthers, showToast],
  )

  const revokeKey = useCallback(async (_id: number) => {
    showToast(
      'Revoke Key bị tắt trong LIVE SPA — dùng Filament nếu cần revoke.',
      'error',
    )
  }, [showToast])

  const dismissOneTime = useCallback(() => {
    setOneTimeRawKey(null)
    setOneTimeKeyName(null)
  }, [])

  return useMemo(
    () => ({
      mode: 'live' as const satisfies RpaApiMode,
      createEnabled: true,
      revokeEnabled: false,
      mutationsEnabled: true,
      canAssignToOthers,
      currentUserId,
      assignableUsers,
      assignableLoading,
      authRequired,
      loading,
      error,
      data: { keys },
      toast,
      showToast,
      reload,
      createKey,
      revokeKey,
      oneTimeRawKey,
      oneTimeKeyName,
      dismissOneTime,
    }),
    [
      assignableLoading,
      assignableUsers,
      authRequired,
      canAssignToOthers,
      createKey,
      currentUserId,
      dismissOneTime,
      error,
      keys,
      loading,
      oneTimeKeyName,
      oneTimeRawKey,
      reload,
      revokeKey,
      showToast,
      toast,
    ],
  )
}

export type UseClientApiKeysOptions = {
  canAssignToOthers?: boolean
  currentUserId?: number | null
}

/**
 * Client API Keys — mock or LIVE Staff Session.
 * LIVE create uses real Backend; mock credentials never used in LIVE.
 */
export function useClientApiKeys(options: UseClientApiKeysOptions = {}) {
  const mode = getRpaApiMode()
  const isLive = mode === 'live'
  const canAssignToOthers = options.canAssignToOthers === true
  const currentUserId = options.currentUserId ?? null

  const mock = useClientApiKeysMock({
    enabled: !isLive,
    canAssignToOthers,
    currentUserId,
  })
  const live = useClientApiKeysLive({
    enabled: isLive,
    canAssignToOthers,
    currentUserId,
  })

  if (isLive) return live

  return {
    mode: 'mock' as const satisfies RpaApiMode,
    createEnabled: true,
    revokeEnabled: true,
    mutationsEnabled: true,
    currentUserId,
    assignableLoading: false,
    authRequired: false,
    ...mock,
  }
}

export type ClientApiKeysController = ReturnType<typeof useClientApiKeys>
