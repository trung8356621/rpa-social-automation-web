import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EMPTY_ACCOUNTS_DATA, MOCK_ACCOUNTS_DATA } from './mock-data'
import type { AccountsData, DemoScenario } from './types'

function delay(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms))
}

function cloneSeed(demo: DemoScenario): AccountsData {
  if (demo === 'empty') return structuredClone(EMPTY_ACCOUNTS_DATA)
  return structuredClone(MOCK_ACCOUNTS_DATA)
}

export function useAccountsMock() {
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'
  const [loading, setLoading] = useState(true)
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
  }, [demo])

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

  return { loading, error, data, toast, reload, deleteAccount }
}
