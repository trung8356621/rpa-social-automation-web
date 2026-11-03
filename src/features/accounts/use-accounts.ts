import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import {
  createLiveAccount,
  updateLiveAccount,
  type CreateAccountInput,
  type UpdateAccountInput,
} from './api/create-account'
import { fetchLiveAccounts } from './api/fetch-accounts'
import type { AccountItem, DemoScenario } from './types'
import { useAccountsMock } from './use-accounts-mock'

function useAccountsLive(enabled: boolean) {
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'

  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [accounts, setAccounts] = useState<AccountItem[]>([])
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
      setAccounts([])
      setError('LIVE ERROR — Accounts request failed (local QA scenario).')
      return
    }
    if (demo === 'empty') {
      setLoading(false)
      setAuthRequired(false)
      setError(null)
      setAccounts([])
      return
    }

    const controller = new AbortController()
    let cancelled = false

    setLoading(true)
    setError(null)
    setAuthRequired(false)
    setAccounts([])

    void fetchLiveAccounts({ signal: controller.signal })
      .then((list) => {
        if (cancelled) return
        setAccounts(list)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
          setError(err.message)
          setAccounts([])
          setLoading(false)
          return
        }
        setAuthRequired(false)
        setError(toSafeApiMessage(err))
        setAccounts([])
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

  const createAccount = useCallback(
    async (input: CreateAccountInput) => {
      try {
        const result = await createLiveAccount(input)
        setAccounts((prev) => [result.account, ...prev])
        showToast(result.message)
        // Refresh inventory from server (authoritative has_password, etc.)
        setReloadToken((n) => n + 1)
      } catch (err: unknown) {
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
        }
        showToast(toSafeApiMessage(err), 'error')
        throw err
      }
    },
    [showToast],
  )

  const updateAccount = useCallback(
    async (input: UpdateAccountInput) => {
      try {
        const result = await updateLiveAccount(input)
        setAccounts((prev) =>
          prev.map((a) => (a.id === result.account.id ? result.account : a)),
        )
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
    [showToast],
  )

  const deleteAccount = useCallback(
    async (_id: number, _accountUuid: string) => {
      showToast('Delete Account chưa bật trên LIVE SPA.', 'error')
    },
    [showToast],
  )

  return useMemo(
    () => ({
      mode: 'live' as const satisfies RpaApiMode,
      createEnabled: true,
      createSubmitEnabled: true,
      createBlockedReason: null as string | null,
      updateEnabled: true,
      /** Delete stays off in SPA for CP18C.1 */
      mutationsEnabled: false,
      authRequired,
      loading,
      error,
      data: { accounts },
      toast,
      showToast,
      reload,
      createAccount,
      updateAccount,
      deleteAccount,
    }),
    [
      accounts,
      authRequired,
      createAccount,
      deleteAccount,
      error,
      loading,
      reload,
      showToast,
      toast,
      updateAccount,
    ],
  )
}

/**
 * Accounts inventory — mock (default) or live Staff Session.
 * LIVE create/update use CP18C password-capable Staff API.
 */
export function useAccounts() {
  const mode = getRpaApiMode()
  const isLive = mode === 'live'
  const mock = useAccountsMock({ enabled: !isLive })
  const live = useAccountsLive(isLive)

  if (isLive) return live

  return {
    mode: 'mock' as const satisfies RpaApiMode,
    createEnabled: true,
    createSubmitEnabled: true,
    createBlockedReason: null as string | null,
    updateEnabled: true,
    mutationsEnabled: true,
    authRequired: false,
    ...mock,
  }
}

export type AccountsController = ReturnType<typeof useAccounts>
