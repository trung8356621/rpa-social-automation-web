import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import { getCampaignAdapter } from './api/campaign-adapter'
import type {
  Campaign,
  CampaignContent,
  CampaignJobAttempt,
  CreateCampaignInput,
  DemoScenario,
  ManualContentDraft,
  UpdateCampaignInput,
} from './types'

type ToastState = { message: string; type: 'success' | 'error' } | null

export function useCampaigns() {
  const mode: RpaApiMode = getRpaApiMode()
  const adapter = useMemo(() => getCampaignAdapter(), [mode])
  const [searchParams] = useSearchParams()
  const demo = (searchParams.get('demo') as DemoScenario | null) ?? 'default'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [contents, setContents] = useState<CampaignContent[]>([])
  const [toast, setToast] = useState<ToastState>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (demo === 'loading') {
      setLoading(true)
      setError(null)
      return
    }
    if (demo === 'error') {
      setLoading(false)
      setCampaigns([])
      setContents([])
      setError('Campaign request failed (local QA scenario).')
      return
    }
    if (demo === 'empty') {
      setLoading(false)
      setError(null)
      setCampaigns([])
      setContents([])
      return
    }

    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)
    setAuthRequired(false)

    void (async () => {
      try {
        const list = await adapter.listCampaigns()
        if (cancelled) return
        setCampaigns(list)
        try {
          const rows = await adapter.listContents()
          if (!cancelled) setContents(rows)
        } catch (contentErr) {
          // Live CP19C gap — keep campaigns, surface content gap softly
          if (!cancelled) {
            setContents([])
            if (mode === 'live') {
              // do not fake content
            } else if (contentErr instanceof Error) {
              setError(contentErr.message)
            }
          }
        }
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        if (err instanceof ApiError && err.isAuthRequired) {
          setAuthRequired(true)
          setError(err.message)
          setLoading(false)
          return
        }
        setError(toSafeApiMessage(err))
        setCampaigns([])
        setContents([])
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [adapter, demo, mode, reloadToken])

  const assertMockMutations = useCallback(() => {
    if (mode === 'live') {
      throw new Error(
        'Production Campaign API is not activated. Switch to MOCK (unset VITE_RPA_API_MODE) for UI mutations. No fake live success.',
      )
    }
  }, [mode])

  const createCampaign = useCallback(
    async (
      input: CreateCampaignInput,
      meta?: { site_name?: string; script_name?: string },
    ) => {
      assertMockMutations()
      const created = await adapter.createCampaign(input, meta)
      setCampaigns((prev) => [created, ...prev.filter((c) => c.id !== created.id)])
      showToast('Campaign created')
      return created
    },
    [adapter, assertMockMutations, showToast],
  )

  const updateCampaign = useCallback(
    async (
      input: UpdateCampaignInput,
      meta?: { site_name?: string; script_name?: string },
    ) => {
      assertMockMutations()
      const updated = await adapter.updateCampaign(input, meta)
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      )
      showToast('Campaign updated')
      return updated
    },
    [adapter, assertMockMutations, showToast],
  )

  const startCampaign = useCallback(
    async (id: string) => {
      assertMockMutations()
      const updated = await adapter.startCampaign(id)
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      )
      showToast('Campaign started')
      return updated
    },
    [adapter, assertMockMutations, showToast],
  )

  const pauseCampaign = useCallback(
    async (id: string) => {
      assertMockMutations()
      const updated = await adapter.pauseCampaign(id)
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      )
      showToast('Campaign paused')
      return updated
    },
    [adapter, assertMockMutations, showToast],
  )

  const resumeCampaign = useCallback(
    async (id: string) => {
      assertMockMutations()
      const updated = await adapter.resumeCampaign(id)
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      )
      showToast('Campaign resumed')
      return updated
    },
    [adapter, assertMockMutations, showToast],
  )

  const cancelCampaign = useCallback(
    async (id: string) => {
      assertMockMutations()
      const updated = await adapter.cancelCampaign(id)
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      )
      showToast('Campaign cancelled')
      return updated
    },
    [adapter, assertMockMutations, showToast],
  )

  const createManualContent = useCallback(
    async (draft: ManualContentDraft) => {
      assertMockMutations()
      const row = await adapter.createManualContent(draft)
      setContents((prev) => [row, ...prev])
      showToast('Article added')
      reload()
      return row
    },
    [adapter, assertMockMutations, reload, showToast],
  )

  const updateManualContent = useCallback(
    async (id: string, draft: ManualContentDraft) => {
      assertMockMutations()
      const row = await adapter.updateManualContent(id, draft)
      setContents((prev) => prev.map((c) => (c.id === row.id ? row : c)))
      showToast('Article updated')
      return row
    },
    [adapter, assertMockMutations, showToast],
  )

  const removeDraftContent = useCallback(
    async (id: string) => {
      assertMockMutations()
      await adapter.removeDraftContent(id)
      setContents((prev) => prev.filter((c) => c.id !== id))
      showToast('Draft removed')
      reload()
    },
    [adapter, assertMockMutations, reload, showToast],
  )

  const retryContent = useCallback(
    async (id: string, status: string) => {
      assertMockMutations()
      const key =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `retry-${Date.now()}`
      const row = await adapter.retryContent(id, { idempotencyKey: key })
      setContents((prev) => prev.map((c) => (c.id === row.id ? row : c)))
      showToast(
        status === 'unknown'
          ? 'Retry requested (unknown result)'
          : 'Retry requested',
      )
      return row
    },
    [adapter, assertMockMutations, showToast],
  )

  const skipContent = useCallback(
    async (id: string) => {
      assertMockMutations()
      const row = await adapter.skipContent(id)
      setContents((prev) => prev.map((c) => (c.id === row.id ? row : c)))
      showToast('Content skipped')
      return row
    },
    [adapter, assertMockMutations, showToast],
  )

  const cancelContent = useCallback(
    async (id: string) => {
      assertMockMutations()
      const row = await adapter.cancelContent(id)
      setContents((prev) => prev.map((c) => (c.id === row.id ? row : c)))
      showToast('Content cancelled')
      return row
    },
    [adapter, assertMockMutations, showToast],
  )

  const listJobAttempts = useCallback(
    async (campaignId: string): Promise<CampaignJobAttempt[]> => {
      return adapter.listJobAttempts(campaignId)
    },
    [adapter],
  )

  const getScriptInputSchema = useCallback(
    (packageKey: string) => adapter.getScriptInputSchema(packageKey),
    [adapter],
  )

  return {
    mode,
    loading,
    error,
    authRequired,
    campaigns,
    contents,
    toast,
    reload,
    createCampaign,
    updateCampaign,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    createManualContent,
    updateManualContent,
    removeDraftContent,
    retryContent,
    skipContent,
    cancelContent,
    listJobAttempts,
    getScriptInputSchema,
    mutationsEnabled: mode === 'mock',
    liveMutationsBlockedReason:
      mode === 'live'
        ? 'Production Campaign API is not activated for UI mutations in this checkpoint. Prefer MOCK.'
        : null,
  }
}
