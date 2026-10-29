import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  EMPTY_CLIENT_API_KEYS_DATA,
  MOCK_CLIENT_API_KEYS_DATA,
} from './mock-data'
import type { ClientApiKeysData, DemoScenario } from './types'

function delay(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms))
}

function cloneSeed(demo: DemoScenario): ClientApiKeysData {
  if (demo === 'empty') return structuredClone(EMPTY_CLIENT_API_KEYS_DATA)
  return structuredClone(MOCK_CLIENT_API_KEYS_DATA)
}

export function useClientApiKeysMock(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ClientApiKeysData>(() => cloneSeed(demo))
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)
  /** One-time reveal after mock create — cleared on dismiss; never persisted. */
  const [oneTimeRawKey, setOneTimeRawKey] = useState<string | null>(null)
  const [oneTimeKeyName, setOneTimeKeyName] = useState<string | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  const reload = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    setData(cloneSeed(demo))
    await delay(demo === 'loading' ? 1200 : 180)
    if (demo === 'error') {
      setError('MOCK ERROR — không tải được Client API Keys.')
      setLoading(false)
      return
    }
    setLoading(false)
  }, [demo, enabled])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(cloneSeed(demo))
    void delay(demo === 'loading' ? 1200 : 180).then(() => {
      if (cancelled) return
      if (demo === 'error') {
        setError('MOCK ERROR — không tải được Client API Keys.')
        setLoading(false)
        return
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [demo, enabled])

  const createKey = useCallback(
    async (name: string) => {
      await delay(200)
      const id =
        data.keys.reduce((max, k) => Math.max(max, k.id), 0) + 1
      const prefix = `rpa_sk_m${String(id).padStart(3, '0')}`
      // MOCK one-time secret — not a real key material for production.
      const raw = `${prefix}_MOCK_ONLY_${crypto.randomUUID().slice(0, 8)}`
      setData((prev) => ({
        keys: [
          {
            id,
            name: name.trim() || `Client ${id}`,
            key_prefix: prefix,
            installation_id: 'inst_demo',
            created_by: 1,
            created_by_name: 'mock.user',
            last_used_at: null,
            revoked_at: null,
            is_active: true,
            created_at: new Date().toISOString(),
            mock_lease: {
              status: 'none',
              connection: 'offline',
              heartbeat_at: null,
              heartbeat_stale: false,
              device_hostname: null,
            },
          },
          ...prev.keys,
        ],
      }))
      setOneTimeRawKey(raw)
      setOneTimeKeyName(name.trim() || `Client ${id}`)
      showToast('Đã tạo Key (MOCK). Sao chép raw key ngay — không lưu lâu dài.')
    },
    [data.keys, showToast],
  )

  const revokeKey = useCallback(
    async (id: number) => {
      await delay(150)
      setData((prev) => ({
        keys: prev.keys.map((k) =>
          k.id === id
            ? {
                ...k,
                is_active: false,
                revoked_at: new Date().toISOString(),
                mock_lease: k.mock_lease
                  ? {
                      ...k.mock_lease,
                      status: 'expired',
                      connection: 'offline',
                      heartbeat_stale: true,
                    }
                  : k.mock_lease,
              }
            : k,
        ),
      }))
      showToast(`Đã revoke Key #${id} trên mock local.`)
    },
    [showToast],
  )

  const dismissOneTime = useCallback(() => {
    setOneTimeRawKey(null)
    setOneTimeKeyName(null)
  }, [])

  return {
    loading,
    error,
    data,
    toast,
    showToast,
    reload,
    createKey,
    revokeKey,
    oneTimeRawKey,
    oneTimeKeyName,
    dismissOneTime,
  }
}
