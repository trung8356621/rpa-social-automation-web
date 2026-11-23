import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getRpaApiMode, type RpaApiMode } from '@/lib/api/config'
import { ApiError, toSafeApiMessage } from '@/lib/api/errors'

import { getCampaignAdapter } from './api/campaign-adapter'
import { performCampaignDelete } from './campaign-delete'
import type {
  Campaign,
  CampaignContent,
  CampaignJobAttempt,
  CreateCampaignInput,
  CreateCampaignV2Input,
  DemoScenario,
  ManualContentDraft,
  MockPreviewResult,
  MockSaveResult,
  ScriptInputSchema,
  UpdateCampaignInput,
  UpdateCampaignV2Input,
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
  /** Per-campaign Content GET generation — drop stale responses. */
  const contentsFetchSeq = useRef<Record<string, number>>({})

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
        if (mode === 'mock') {
          try {
            const rows = await adapter.listContents()
            if (!cancelled) setContents(rows)
          } catch (contentErr) {
            if (!cancelled && contentErr instanceof Error) {
              setError(contentErr.message)
            }
          }
        }
        // LIVE: do not wipe contents — Detail/Articles own Content GETs.
        // Clearing here races with loadCampaignDetail and empties the Detail list.
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

  const createCampaign = useCallback(
    async (
      input: CreateCampaignInput,
      meta?: { site_name?: string; script_name?: string },
    ) => {
      const created = await adapter.createCampaign(input, meta)
      setCampaigns((prev) => [created, ...prev.filter((c) => c.id !== created.id)])
      if (created.contents?.length) {
        setContents((prev) => {
          const without = prev.filter((c) => c.campaign_id !== created.id)
          return [...created.contents!, ...without]
        })
      }
      showToast('Campaign created')
      return created
    },
    [adapter, showToast],
  )

  const createCampaignV2 = useCallback(
    async (input: CreateCampaignV2Input) => {
      const created = await adapter.createCampaignV2(input)
      setCampaigns((prev) => [created, ...prev.filter((c) => c.id !== created.id)])
      if (created.contents?.length) {
        setContents((prev) => {
          const without = prev.filter((c) => c.campaign_id !== created.id)
          return [...created.contents!, ...without]
        })
      }
      showToast('Campaign V2 draft saved')
      return created
    },
    [adapter, showToast],
  )

  const updateCampaign = useCallback(
    async (
      input: UpdateCampaignInput,
      meta?: { site_name?: string; script_name?: string },
    ) => {
      const updated = await adapter.updateCampaign(input, meta)
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      )
      showToast('Campaign updated')
      return updated
    },
    [adapter, showToast],
  )

  const updateCampaignV2 = useCallback(
    async (input: UpdateCampaignV2Input) => {
      const updated = await adapter.updateCampaignV2(input)
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      )
      if (Array.isArray(updated.contents)) {
        setContents((prev) => {
          const without = prev.filter((c) => c.campaign_id !== updated.id)
          return [...updated.contents!, ...without]
        })
      }
      showToast('Campaign V2 draft updated')
      return updated
    },
    [adapter, showToast],
  )

  const applyAndReloadCampaign = useCallback(
    async (id: string, updated: Campaign, toastLabel: string): Promise<Campaign> => {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
      )
      if (updated.contents) {
        setContents((prev) => {
          const without = prev.filter((c) => c.campaign_id !== id)
          return [...updated.contents!, ...without]
        })
      }

      let canonical = updated
      try {
        const detail = await adapter.getCampaign(id)
        if (detail) {
          canonical = detail
          setCampaigns((prev) =>
            prev.map((c) => (c.id === detail.id ? { ...c, ...detail } : c)),
          )
          if (detail.contents) {
            setContents((prev) => {
              const without = prev.filter((c) => c.campaign_id !== id)
              return [...detail.contents!, ...without]
            })
          }
        }
      } catch {
        /* keep mutation response if detail reload fails transiently */
      }

      try {
        const latestContents = await adapter.listContents(id)
        setContents((prev) => {
          const without = prev.filter((c) => c.campaign_id !== id)
          return [...latestContents, ...without]
        })
      } catch {
        /* keep mutation/detail contents if list reload fails transiently */
      }

      showToast(toastLabel)
      return canonical
    },
    [adapter, showToast],
  )

  const startCampaign = useCallback(
    async (id: string) => {
      const updated = await adapter.startCampaign(id)
      return applyAndReloadCampaign(id, updated, 'Campaign started')
    },
    [adapter, applyAndReloadCampaign],
  )

  const pauseCampaign = useCallback(
    async (id: string) => {
      const updated = await adapter.pauseCampaign(id)
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
      )
      showToast('Campaign paused')
      return updated
    },
    [adapter, showToast],
  )

  const resumeCampaign = useCallback(
    async (id: string) => {
      const updated = await adapter.resumeCampaign(id)
      return applyAndReloadCampaign(id, updated, 'Campaign resumed')
    },
    [adapter, applyAndReloadCampaign],
  )

  const cancelCampaign = useCallback(
    async (id: string) => {
      const updated = await adapter.cancelCampaign(id)
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
      )
      showToast('Campaign cancelled')
      return updated
    },
    [adapter, showToast],
  )

  const deleteCampaign = useCallback(
    async (id: string) => {
      await performCampaignDelete({
        id,
        adapter,
        setCampaigns,
        showToast,
      })
    },
    [adapter, showToast],
  )

  const loadContentsForCampaign = useCallback(
    async (campaignId: string): Promise<CampaignContent[]> => {
      const seq = (contentsFetchSeq.current[campaignId] ?? 0) + 1
      contentsFetchSeq.current[campaignId] = seq
      const rows = await adapter.listContents(campaignId)
      if (contentsFetchSeq.current[campaignId] !== seq) {
        // Newer request for same campaign won — do not overwrite.
        return rows
      }
      setContents((prev) => {
        const prevById = new Map(prev.map((c) => [c.id, c]))
        const merged = rows.map((row) => {
          if (row.assignments === undefined) {
            const existing = prevById.get(row.id)
            if (existing?.assignments) {
              return { ...row, assignments: existing.assignments }
            }
          }
          return row
        })
        const without = prev.filter((c) => c.campaign_id !== campaignId)
        return [...merged, ...without]
      })
      return rows
    },
    [adapter],
  )

  const createManualContent = useCallback(
    async (
      draft: ManualContentDraft,
      opts?: {
        schema: ScriptInputSchema
        allowDiscard?: boolean
        preferShortcode?: boolean
      },
    ) => {
      const row = await adapter.createManualContent(draft, opts)
      setContents((prev) => {
        const without = prev.filter((c) => c.id !== row.id)
        return [row, ...without]
      })
      // Refresh list + campaign counters (do not invent success without server row)
      try {
        const detail = await adapter.getCampaign(draft.campaign_id)
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === detail.id ? { ...c, ...detail, contents: undefined } : c,
          ),
        )
        const rows = await adapter.listContents(draft.campaign_id)
        setContents((prev) => {
          const without = prev.filter((c) => c.campaign_id !== draft.campaign_id)
          return [...rows, ...without]
        })
      } catch {
        // Keep created row even if counter refresh fails
      }
      showToast('Article added')
      return row
    },
    [adapter, showToast],
  )

  const updateManualContent = useCallback(
    async (
      id: string,
      draft: ManualContentDraft,
      opts?: {
        schema: ScriptInputSchema
        allowDiscard?: boolean
        preferShortcode?: boolean
      },
    ) => {
      const row = await adapter.updateManualContent(id, draft, opts)
      setContents((prev) => prev.map((c) => (c.id === row.id ? row : c)))
      try {
        const detail = await adapter.getCampaign(draft.campaign_id)
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === detail.id ? { ...c, ...detail, contents: undefined } : c,
          ),
        )
        const rows = await adapter.listContents(draft.campaign_id)
        setContents((prev) => {
          const without = prev.filter((c) => c.campaign_id !== draft.campaign_id)
          return [...rows, ...without]
        })
      } catch {
        // Keep updated row
      }
      showToast('Article updated')
      return row
    },
    [adapter, showToast],
  )

  const removeDraftContent = useCallback(
    async (id: string) => {
      await adapter.removeDraftContent(id)
      setContents((prev) => prev.filter((c) => c.id !== id))
      showToast('Draft removed')
      reload()
    },
    [adapter, reload, showToast],
  )

  const retryContent = useCallback(
    async (id: string, status: string) => {
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
    [adapter, showToast],
  )

  const skipContent = useCallback(
    async (id: string) => {
      const row = await adapter.skipContent(id)
      setContents((prev) => prev.map((c) => (c.id === row.id ? row : c)))
      showToast('Content skipped')
      return row
    },
    [adapter, showToast],
  )

  const cancelContent = useCallback(
    async (id: string) => {
      const row = await adapter.cancelContent(id)
      setContents((prev) => prev.map((c) => (c.id === row.id ? row : c)))
      showToast('Content cancelled')
      return row
    },
    [adapter, showToast],
  )

  const listJobAttempts = useCallback(
    async (campaignId: string): Promise<CampaignJobAttempt[]> => {
      return adapter.listJobAttempts(campaignId)
    },
    [adapter],
  )

  const loadCampaignDetail = useCallback(
    async (id: string): Promise<Campaign> => {
      const detail = await adapter.getCampaign(id)
      setCampaigns((prev) => {
        const exists = prev.some((c) => c.id === detail.id)
        if (!exists) return [detail, ...prev]
        return prev.map((c) =>
          c.id === detail.id
            ? {
                ...c,
                ...detail,
                // Prefer nested detail summary over stale list flat counters.
                summary: detail.summary,
                contents: detail.contents ?? c.contents,
              }
            : c,
        )
      })
      if (Array.isArray(detail.contents)) {
        setContents((prev) => {
          const without = prev.filter((c) => c.campaign_id !== id)
          return [...detail.contents!, ...without]
        })
      }
      return detail
    },
    [adapter],
  )

  const getScriptInputSchema = useCallback(
    (packageKey: string) => adapter.getScriptInputSchema(packageKey),
    [adapter],
  )

  const mockPreviewContents = useCallback(
    async (campaignId: string, count: number): Promise<MockPreviewResult> => {
      return adapter.mockPreviewContents(campaignId, count)
    },
    [adapter],
  )

  const mockSaveContents = useCallback(
    async (
      campaignId: string,
      count: number,
      idempotencyKey: string,
    ): Promise<MockSaveResult> => {
      const result = await adapter.mockSaveContents(
        campaignId,
        count,
        idempotencyKey,
      )
      setContents((prev) => {
        const without = prev.filter((c) => c.campaign_id !== campaignId)
        return [...result.contents, ...without]
      })
      showToast(`Mock saved (${result.count})`)
      return result
    },
    [adapter, showToast],
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
    createCampaignV2,
    updateCampaign,
    updateCampaignV2,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    deleteCampaign,
    createManualContent,
    updateManualContent,
    removeDraftContent,
    retryContent,
    skipContent,
    cancelContent,
    listJobAttempts,
    loadCampaignDetail,
    loadContentsForCampaign,
    getScriptInputSchema,
    mockPreviewContents,
    mockSaveContents,
    /** LIVE Staff mutations are wired; operator must click — no auto Start. */
    mutationsEnabled: true,
    liveMutationsBlockedReason:
      mode === 'live'
        ? 'LIVE Staff API wired. Client Runtime Claim remains OFF until approved. Do not auto-start Jobs.'
        : null,
  }
}
