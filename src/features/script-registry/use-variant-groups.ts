import { useCallback, useEffect, useMemo, useState } from 'react'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError } from '@/lib/api/errors'

import { mockVariantGroupApi } from './api/mock-variant-groups-api'
import {
  formatVariantGroupApiError,
  liveVariantGroupApi,
  type AddVariantInput,
  type CreateVariantGroupInput,
  type PersistedVariantGroup,
  type UpdateVariantInput,
} from './api/variant-groups-api'

export function useVariantGroups() {
  const mode: RpaApiMode = getRpaApiMode()
  const api = useMemo(
    () => (mode === 'live' ? liveVariantGroupApi : mockVariantGroupApi),
    [mode],
  )

  const [groups, setGroups] = useState<PersistedVariantGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [unavailableReason, setUnavailableReason] = useState<string | null>(
    null,
  )
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)

    void api
      .listGroups(controller.signal)
      .then((res) => {
        if (cancelled) return
        setGroups(res.groups)
        setUnavailable(res.unavailable)
        setUnavailableReason(res.unavailableReason)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        setError(formatVariantGroupApiError(err))
        setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [api, mode, reloadToken])

  const upsertGroup = useCallback((updated: PersistedVariantGroup) => {
    setGroups((prev) => {
      const exists = prev.some((g) => g.id === updated.id)
      if (!exists) return [updated, ...prev]
      return prev.map((g) => (g.id === updated.id ? updated : g))
    })
  }, [])

  const assertAvailable = useCallback(() => {
    if (unavailable) {
      throw new Error(
        unavailableReason || 'Variant Groups API unavailable on this server.',
      )
    }
  }, [unavailable, unavailableReason])

  const createGroup = useCallback(
    async (input: CreateVariantGroupInput) => {
      assertAvailable()
      const created = await api.createGroup(input)
      upsertGroup(created)
      return created
    },
    [api, assertAvailable, upsertGroup],
  )

  const addVariant = useCallback(
    async (groupId: string, input: AddVariantInput) => {
      assertAvailable()
      const updated = await api.addVariant(groupId, input)
      upsertGroup(updated)
      return updated
    },
    [api, assertAvailable, upsertGroup],
  )

  const updateVariant = useCallback(
    async (groupId: string, variantId: string, input: UpdateVariantInput) => {
      assertAvailable()
      const updated = await api.updateVariant(groupId, variantId, input)
      upsertGroup(updated)
      return updated
    },
    [api, assertAvailable, upsertGroup],
  )

  const removeVariant = useCallback(
    async (groupId: string, variantId: string) => {
      assertAvailable()
      const updated = await api.removeVariant(groupId, variantId)
      upsertGroup(updated)
      return updated
    },
    [api, assertAvailable, upsertGroup],
  )

  const reorderVariants = useCallback(
    async (groupId: string, variantIds: string[]) => {
      assertAvailable()
      const updated = await api.reorderVariants(groupId, variantIds)
      upsertGroup(updated)
      return updated
    },
    [api, assertAvailable, upsertGroup],
  )

  return {
    mode,
    groups,
    loading,
    error,
    unavailable,
    unavailableReason,
    reload,
    createGroup,
    addVariant,
    updateVariant,
    removeVariant,
    reorderVariants,
  }
}
