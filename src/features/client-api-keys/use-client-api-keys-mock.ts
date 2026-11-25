import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { CreateClientApiKeyInput } from './api/create-payload'
import {
  EMPTY_CLIENT_API_KEYS_DATA,
  MOCK_ASSIGNABLE_USERS,
  MOCK_CLIENT_API_KEYS_DATA,
} from './mock-data'
import type {
  AssignableUser,
  ClientApiKeysData,
  DemoScenario,
} from './types'

function delay(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms))
}

function cloneSeed(demo: DemoScenario): ClientApiKeysData {
  if (demo === 'empty') return structuredClone(EMPTY_CLIENT_API_KEYS_DATA)
  return structuredClone(MOCK_CLIENT_API_KEYS_DATA)
}

export function useClientApiKeysMock(options: {
  enabled?: boolean
  canAssignToOthers?: boolean
  currentUserId?: number | null
} = {}) {
  const enabled = options.enabled !== false
  const canAssignToOthers = options.canAssignToOthers === true
  const currentUserId = options.currentUserId ?? null
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
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([])

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type })
      window.setTimeout(() => setToast(null), 3500)
    },
    [],
  )

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
      setAssignableUsers([])
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

  useEffect(() => {
    if (!enabled || !canAssignToOthers) {
      setAssignableUsers([])
      return
    }
    setAssignableUsers(structuredClone(MOCK_ASSIGNABLE_USERS))
  }, [canAssignToOthers, enabled])

  const createKey = useCallback(
    async (input: CreateClientApiKeyInput | string) => {
      await delay(200)
      const normalized: CreateClientApiKeyInput =
        typeof input === 'string'
          ? { name: input, canAssignToOthers }
          : { ...input, canAssignToOthers }

      if (
        normalized.assigned_to_user_id != null &&
        !canAssignToOthers
      ) {
        const message =
          'Only Owner/Admin may assign a Client API Key to another user.'
        showToast(message, 'error')
        throw new Error(message)
      }

      if (
        canAssignToOthers &&
        normalized.assigned_to_user_id != null &&
        !MOCK_ASSIGNABLE_USERS.some(
          (u) => u.id === normalized.assigned_to_user_id,
        )
      ) {
        const message =
          'Assigned user is not an eligible Staff/Owner in this account scope.'
        showToast(message, 'error')
        throw new Error(message)
      }

      const id = data.keys.reduce((max, k) => Math.max(max, k.id), 0) + 1
      const prefix = `rpa_sk_m${String(id).padStart(3, '0')}`
      // MOCK one-time secret — not a real key material for production.
      const raw = `${prefix}_MOCK_ONLY_${crypto.randomUUID().slice(0, 8)}`
      const label = normalized.name.trim() || `Client ${id}`
      const ownerId =
        canAssignToOthers && normalized.assigned_to_user_id != null
          ? normalized.assigned_to_user_id
          : (currentUserId ?? 1)
      const ownerMeta =
        MOCK_ASSIGNABLE_USERS.find((u) => u.id === ownerId) ?? null
      const issuerId = currentUserId ?? 1
      const issuerMeta =
        MOCK_ASSIGNABLE_USERS.find((u) => u.id === issuerId) ?? null

      setData((prev) => ({
        keys: [
          {
            id,
            name: label,
            key_prefix: prefix,
            installation_id: 'inst_demo',
            created_by: ownerId,
            created_by_name: ownerMeta?.name ?? `User #${ownerId}`,
            issued_by: issuerId,
            issued_by_name: issuerMeta?.name ?? `User #${issuerId}`,
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
      setOneTimeKeyName(label)
      showToast(
        'Đã tạo Key (MOCK). Sao chép raw key ngay — không lưu lâu dài.',
      )
    },
    [canAssignToOthers, currentUserId, data.keys, showToast],
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
    assignableUsers,
    canAssignToOthers,
  }
}
