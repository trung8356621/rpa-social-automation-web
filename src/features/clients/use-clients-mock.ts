import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EMPTY_CLIENTS_DATA, MOCK_CLIENTS_DATA } from './mock-data'
import type { ClientsInventoryData, DemoScenario } from './types'

function delay(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms))
}

function cloneSeed(demo: DemoScenario): ClientsInventoryData {
  if (demo === 'empty') return structuredClone(EMPTY_CLIENTS_DATA)
  return structuredClone(MOCK_CLIENTS_DATA)
}

export function useClientsMock() {
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ClientsInventoryData>(() => cloneSeed(demo))
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type })
      window.setTimeout(() => setToast(null), 2800)
    },
    [],
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    setData(cloneSeed(demo))
    await delay(demo === 'loading' ? 1200 : 180)
    if (demo === 'error') {
      setError('MOCK ERROR — không tải được Clients inventory.')
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
        setError('MOCK ERROR — không tải được Clients inventory.')
        setLoading(false)
        return
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [demo])

  const copyAccountId = useCallback(
    async (accountUuid: string) => {
      try {
        await navigator.clipboard.writeText(accountUuid)
        showToast(`Copied Account ID: ${accountUuid}`)
      } catch {
        showToast('Không copy được Account ID.', 'error')
      }
    },
    [showToast],
  )

  return {
    loading,
    error,
    data,
    toast,
    reload,
    copyAccountId,
  }
}
