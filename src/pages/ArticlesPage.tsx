import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { useAccountSites } from '@/features/accounts/use-account-sites'
import { resolveArticlesCampaignId } from '@/features/campaigns/articles-selection'
import { ArticlesScreen } from '@/features/campaigns/components/ArticlesScreen'
import {
  parseScriptInputSchema,
  resolveTestModeCompatibility,
  unavailableScriptInputSchema,
} from '@/features/campaigns/script-compat'
import type { ScriptInputSchema } from '@/features/campaigns/types'
import { useCampaigns } from '@/features/campaigns/use-campaigns'
import { fetchLiveScriptRegistryDetail } from '@/features/script-registry/api/fetch-script-registry'
import type { ScriptDetail } from '@/features/script-registry/types'
import { useScriptRegistry } from '@/features/script-registry/use-script-registry'
import { toSafeApiMessage } from '@/lib/api/errors'

export function ArticlesPage() {
  const [params] = useSearchParams()
  const registry = useCampaigns()
  const sites = useAccountSites()
  const scripts = useScriptRegistry()
  const initialCampaignId = params.get('campaign') ?? undefined
  const [activeCampaignId, setActiveCampaignId] = useState(
    initialCampaignId ?? '',
  )
  const [contentsLoading, setContentsLoading] = useState(false)
  const [contentsError, setContentsError] = useState<string | null>(null)
  const [schemaDetail, setSchemaDetail] = useState<ScriptDetail | null>(null)
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const contentsReqSeq = useRef(0)

  useEffect(() => {
    if (initialCampaignId) setActiveCampaignId(initialCampaignId)
  }, [initialCampaignId])

  // After Campaign list loads (incl. F5), pick a Campaign so Content GET can run.
  useEffect(() => {
    if (registry.loading) return
    if (registry.campaigns.length === 0) return
    const next = resolveArticlesCampaignId({
      selectedId: activeCampaignId,
      urlCampaignId: initialCampaignId,
      campaigns: registry.campaigns,
    })
    if (next && next !== activeCampaignId) {
      setActiveCampaignId(next)
    }
  }, [
    activeCampaignId,
    initialCampaignId,
    registry.campaigns,
    registry.loading,
  ])

  useEffect(() => {
    if (registry.mode !== 'live') return
    if (registry.loading) return
    if (!activeCampaignId) {
      setContentsError(null)
      setContentsLoading(false)
      return
    }

    const reqId = ++contentsReqSeq.current
    let cancelled = false
    setContentsLoading(true)
    setContentsError(null)

    void registry
      .loadContentsForCampaign(activeCampaignId)
      .then(() => {
        if (cancelled || reqId !== contentsReqSeq.current) return
        setContentsLoading(false)
        setContentsError(null)
      })
      .catch((err: unknown) => {
        if (cancelled || reqId !== contentsReqSeq.current) return
        setContentsError(toSafeApiMessage(err))
        setContentsLoading(false)
      })

    return () => {
      cancelled = true
    }
    // Re-fetch when Campaign list reloads (LIVE clears contents on list load).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeCampaignId,
    registry.mode,
    registry.loading,
    registry.reload,
  ])

  const activePackageKey = useMemo(() => {
    const camp = registry.campaigns.find((c) => c.id === activeCampaignId)
    return camp?.script_package_key?.trim() || ''
  }, [activeCampaignId, registry.campaigns])

  useEffect(() => {
    if (!activePackageKey) {
      setSchemaDetail(null)
      setSchemaError(null)
      setSchemaLoading(false)
      return
    }

    const cached = scripts.data.details[activePackageKey]
    if (cached) {
      setSchemaDetail(cached)
      setSchemaError(null)
      setSchemaLoading(false)
      return
    }

    if (registry.mode !== 'live') {
      setSchemaDetail(null)
      setSchemaError(null)
      setSchemaLoading(false)
      return
    }

    let cancelled = false
    setSchemaLoading(true)
    setSchemaError(null)
    setSchemaDetail(null)

    void fetchLiveScriptRegistryDetail(activePackageKey)
      .then((detail) => {
        if (cancelled) return
        setSchemaDetail(detail)
        setSchemaLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setSchemaDetail(null)
        setSchemaError(toSafeApiMessage(err))
        setSchemaLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activePackageKey, registry.mode, scripts.data.details])

  const getSchema = useMemo(() => {
    return (packageKey: string): ScriptInputSchema => {
      const detail =
        (packageKey === activePackageKey ? schemaDetail : null) ??
        scripts.data.details[packageKey] ??
        null
      const mockFallback = registry.getScriptInputSchema(packageKey)
      const testMode = resolveTestModeCompatibility(
        detail,
        mockFallback.test_mode_compatible,
      )
      if (detail) {
        return parseScriptInputSchema(detail, { testModeCompatible: testMode })
      }
      if (registry.mode === 'live') {
        return unavailableScriptInputSchema(testMode)
      }
      return mockFallback
    }
  }, [activePackageKey, registry, schemaDetail, scripts.data.details])

  if (registry.loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm">Loading articles…</p>
      </div>
    )
  }

  if (registry.authRequired) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium">Authentication required</p>
        <p className="mt-1 text-sm text-muted">{registry.error}</p>
        <Button className="mt-4" onClick={() => void registry.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <>
      <ArticlesScreen
        campaigns={registry.campaigns}
        contents={registry.contents}
        sites={sites.sites}
        campaignId={activeCampaignId}
        onCampaignChange={setActiveCampaignId}
        getSchema={getSchema}
        contentsLoading={contentsLoading}
        contentsError={
          contentsError ??
          (schemaError ? `Script schema: ${schemaError}` : null)
        }
        schemaLoading={schemaLoading}
        onCreate={async (draft, opts) => {
          await registry.createManualContent(draft, opts)
        }}
        onUpdate={async (id, draft, opts) => {
          await registry.updateManualContent(id, draft, opts)
        }}
        onRemoveDraft={registry.removeDraftContent}
        mode={registry.mode}
      />
      <Toast toast={registry.toast} />
    </>
  )
}
