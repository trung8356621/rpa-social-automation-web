import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  buildCreateAccountBody,
  buildUpdateAccountBody,
  type CreateAccountInput,
  type UpdateAccountInput,
} from './api/create-account'
import { EMPTY_ACCOUNTS_DATA, MOCK_ACCOUNTS_DATA } from './mock-data'
import type { AccountItem, AccountsData, DemoScenario } from './types'

function delay(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms))
}

function cloneSeed(demo: DemoScenario): AccountsData {
  if (demo === 'empty') return structuredClone(EMPTY_ACCOUNTS_DATA)
  return structuredClone(MOCK_ACCOUNTS_DATA)
}

export function useAccountsMock(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AccountsData>(() => cloneSeed(demo))
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    setData(cloneSeed(demo))
    await delay(demo === 'loading' ? 1200 : 180)
    if (demo === 'error') {
      setError('MOCK ERROR — không tải được Accounts (local demo).')
      setLoading(false)
      return
    }
    setLoading(false)
  }, [demo])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(cloneSeed(demo))
    void delay(demo === 'loading' ? 1200 : 180).then(() => {
      if (cancelled) return
      if (demo === 'error') {
        setError('MOCK ERROR — không tải được Accounts (local demo).')
        setLoading(false)
        return
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [demo, enabled])

  const createAccount = useCallback(
    async (input: CreateAccountInput) => {
      await delay(180)
      const built = buildCreateAccountBody(input)
      if (!built.ok) {
        showToast(built.message, 'error')
        throw new Error(built.message)
      }
      // Password never retained in mock inventory — only has_password.
      const now = new Date().toISOString()
      const id = Date.now()
      const row: AccountItem = {
        id,
        account_uuid: `mock-acct-${id}`,
        installation_id: 'mock-installation',
        platform: built.body.platform,
        account_name: built.body.name,
        username: built.body.username,
        email: built.body.email ?? null,
        has_password: true,
        note: null,
        last_interaction_at: null,
        created_by: 1,
        created_by_name: 'Mock Owner',
        created_at: now,
        updated_at: now,
        verified: false,
      }
      setData((prev) => ({ accounts: [row, ...prev.accounts] }))
      showToast('Đã tạo Account trên mock local.')
    },
    [showToast],
  )

  const updateAccount = useCallback(
    async (input: UpdateAccountInput) => {
      await delay(180)
      const built = buildUpdateAccountBody(input)
      if (!built.ok) {
        showToast(built.message, 'error')
        throw new Error(built.message)
      }
      const passwordReplaced = Boolean(built.body.password)
      setData((prev) => ({
        accounts: prev.accounts.map((a) => {
          if (a.id !== input.id) return a
          return {
            ...a,
            account_name: built.body.name,
            username: built.body.username,
            email: built.body.email ?? null,
            platform: built.body.platform,
            has_password: passwordReplaced ? true : a.has_password,
            updated_at: new Date().toISOString(),
          }
        }),
      }))
      showToast(
        passwordReplaced
          ? 'Đã cập nhật Account (password replaced) trên mock.'
          : 'Đã cập nhật Account (password preserved) trên mock.',
      )
    },
    [showToast],
  )

  const deleteAccount = useCallback(
    async (id: number, accountUuid: string) => {
      await delay(150)
      setData((prev) => ({
        accounts: prev.accounts.filter((a) => a.id !== id),
      }))
      showToast(`Đã xóa Account [${accountUuid}] trên mock local.`)
    },
    [showToast],
  )

  return {
    loading,
    error,
    data,
    toast,
    reload,
    createAccount,
    updateAccount,
    deleteAccount,
  }
}
