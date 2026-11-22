import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { useAccountSites } from '@/features/accounts/use-account-sites'
import { resolveArticlesCampaignId } from '@/features/campaigns/articles-selection'
import { ArticlesScreen } from '@/features/campaigns/components/ArticlesScreen'
import {
  buildV2PlanUpdateFromCampaign,
  campaignToV2WizardState,
  createPlannedContentItem,
  generateBulkMockContentsForGroup,
  groupTagsByCompatibleSchema,
  type PlannedContentItem,
  type ResolvedActionTagPlan,
} from '@/features/campaigns/multi-tag-plan'
import {
  parseScriptInputSchema,
  resolveTestModeCompatibility,
  unavailableScriptInputSchema,
} from '@/features/campaigns/script-compat'
import type { ScriptInputSchema } from '@/features/campaigns/types'
import { useCampaigns } from '@/features/campaigns/use-campaigns'
import { useMultiScriptSchemas } from '@/features/campaigns/use-multi-script-schemas'
import { isCampaignV2 } from '@/features/campaigns/validation'
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

  const activeCampaign = useMemo(
    () => registry.campaigns.find((c) => c.id === activeCampaignId) ?? null,
    [activeCampaignId, registry.campaigns],
  )
  const isV2 = activeCampaign ? isCampaignV2(activeCampaign) : false

  useEffect(() => {
    if (registry.mode !== 'live' || registry.loading || !activeCampaignId) return
    if (isV2 && !activeCampaign?.action_tags?.length) {
      void registry.loadCampaignDetail(activeCampaignId).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId, isV2, registry.mode, registry.loading])
  const activePackageKey = isV2
    ? ''
    : activeCampaign?.script_package_key?.trim() || ''
  const activeScriptVersion = activeCampaign?.script_version?.trim() || ''

  const v2SchemaTargets = useMemo(() => {
    if (!isV2 || !activeCampaign?.action_tags?.length) return []
    return activeCampaign.action_tags
      .filter((t) => t.script_package_key)
      .map((t) => ({
        packageKey: t.script_package_key,
        scriptVersion: t.script_version,
      }))
  }, [isV2, activeCampaign])

  const v2SchemaLookup = useMultiScriptSchemas({
    targets: v2SchemaTargets,
    cachedDetails: scripts.data.details,
    getMockSchema: registry.getScriptInputSchema,
  })

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
        return parseScriptInputSchema(detail, {
          testModeCompatible: testMode,
          scriptVersion:
            packageKey === activePackageKey ? activeScriptVersion : null,
        })
      }
      if (registry.mode === 'live') {
        return unavailableScriptInputSchema(testMode)
      }
      return mockFallback
    }
  }, [
    activePackageKey,
    activeScriptVersion,
    registry,
    schemaDetail,
    scripts.data.details,
  ])

  const v2SchemaError = useMemo(() => {
    if (!isV2) return null
    const errs = Object.values(v2SchemaLookup)
      .map((e) => e.error)
      .filter((e): e is string => Boolean(e))
    return errs.length > 0 ? errs.join(' · ') : null
  }, [isV2, v2SchemaLookup])

  const v2Groups = useMemo(() => {
    if (!isV2 || !activeCampaign?.action_tags?.length) return []
    const resolved: ResolvedActionTagPlan[] = activeCampaign.action_tags.map(
      (t) => ({
        plan_tag_uuid: t.plan_tag_uuid ?? null,
        tag_id: t.action_tag_id,
        tag_key: t.action_tag_key,
        tag_name: t.action_tag_key,
        tag_enabled: true,
        site_key: t.site_key,
        site_name: t.site_name,
        cms_type: t.cms_type,
        path_key: '',
        path_name: '',
        effective_script: t.script_package_key
          ? {
              package_key: t.script_package_key,
              script_id: t.script_package_key,
              name: t.script_name || t.script_package_key,
              version: t.script_version,
              release_id: t.release_id ?? 0,
            }
          : null,
        resolution_source: t.resolution_source,
        is_system_auth: false,
        is_runnable: Boolean(
          t.script_package_key && t.resolution_source !== 'missing',
        ),
        status_reason: null,
      }),
    )
    return groupTagsByCompatibleSchema(
      resolved,
      v2SchemaLookup,
      (reason) => unavailableScriptInputSchema(null, reason),
    )
  }, [isV2, activeCampaign, v2SchemaLookup])

  const reloadActiveCampaign = async () => {
    if (!activeCampaignId || registry.mode !== 'live') return
    await registry.loadCampaignDetail(activeCampaignId)
    await registry.loadContentsForCampaign(activeCampaignId)
  }

  const persistV2Contents = async (nextContents: PlannedContentItem[]) => {
    if (!activeCampaign || !isV2) {
      throw new Error('Select a Campaign V2 Draft first.')
    }
    const built = buildV2PlanUpdateFromCampaign({
      campaign: activeCampaign,
      contents: nextContents,
      schemaLookup: v2SchemaLookup,
    })
    if (!built.ok) {
      throw new Error(built.message)
    }
    await registry.updateCampaignV2(built.input)
    if (registry.mode === 'live') {
      await reloadActiveCampaign()
    }
  }

  const activeCampaignContents = useMemo(() => {
    if (!activeCampaign) return []
    const fromStore = registry.contents.filter(
      (c) => c.campaign_id === activeCampaign.id,
    )
    return fromStore.length > 0 ? fromStore : (activeCampaign.contents ?? [])
  }, [activeCampaign, registry.contents])

  const handleV2BulkMockSave = async (
    count: number,
    groupKey: string | 'all',
  ) => {
    if (!activeCampaign || !isV2) {
      throw new Error('Select a Campaign V2 Draft first.')
    }
    const targetGroups =
      groupKey === 'all'
        ? v2Groups.filter((g) => g.schema.schema_available)
        : v2Groups.filter((g) => g.group_key === groupKey)
    if (targetGroups.length === 0) {
      throw new Error('No compatible Script group with loaded schema.')
    }

    const existingPlanned = campaignToV2WizardState(
      activeCampaign,
      activeCampaignContents,
    ).contents
    const existingRefs = new Set(existingPlanned.map((c) => c.external_ref))
    const generated: PlannedContentItem[] = []
    const basePerGroup = Math.floor(count / targetGroups.length)
    let remainder = count % targetGroups.length
    let seq = existingPlanned.length + 1

    for (const g of targetGroups) {
      const qty = basePerGroup + (remainder > 0 ? 1 : 0)
      if (remainder > 0) remainder--
      if (qty <= 0) continue
      const res = generateBulkMockContentsForGroup({
        group: g,
        count: qty,
        existingRefs,
        startSeq: seq,
      })
      if (!res.ok) throw new Error(res.message)
      for (const item of res.items) {
        existingRefs.add(item.external_ref)
        generated.push(item)
      }
      seq += qty
    }

    await persistV2Contents([...existingPlanned, ...generated])
  }

  const handleV2SaveSingleContent = async (draft: {
    editingId: string | null
    externalRef: string
    rawSource: string
    targetTagKeys: string[]
  }) => {
    if (!activeCampaign || !isV2) return
    const existingPlanned = campaignToV2WizardState(
      activeCampaign,
      activeCampaignContents,
    ).contents
    let nextContents: PlannedContentItem[]
    if (draft.editingId) {
      nextContents = existingPlanned.map((item) =>
        item.id === draft.editingId || item.persisted_id === draft.editingId
          ? {
              ...item,
              external_ref: draft.externalRef.trim() || item.external_ref,
              raw_source: draft.rawSource,
              target_tag_keys: draft.targetTagKeys,
            }
          : item,
      )
    } else {
      nextContents = [
        ...existingPlanned,
        createPlannedContentItem({
          external_ref:
            draft.externalRef.trim() || `post-${existingPlanned.length + 1}`,
          raw_source: draft.rawSource,
          target_tag_keys: draft.targetTagKeys,
        }),
      ]
    }
    await persistV2Contents(nextContents)
  }

  const handleV2DeleteContent = async (contentId: string) => {
    if (!activeCampaign || !isV2) return
    const existingPlanned = campaignToV2WizardState(
      activeCampaign,
      activeCampaignContents,
    ).contents
    const nextContents = existingPlanned.filter(
      (c) => c.id !== contentId && c.persisted_id !== contentId,
    )
    await persistV2Contents(nextContents)
  }

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
        contentsError={contentsError}
        schemaLoading={
          schemaLoading ||
          (isV2 && Object.values(v2SchemaLookup).some((e) => e.loading))
        }
        schemaError={isV2 ? v2SchemaError : schemaError}
        v2Groups={v2Groups}
        onV2BulkMockSave={handleV2BulkMockSave}
        onV2SaveContent={handleV2SaveSingleContent}
        onV2DeleteContent={handleV2DeleteContent}
        onReloadCampaign={reloadActiveCampaign}
        onCreate={async (draft, opts) => {
          await registry.createManualContent(draft, opts)
        }}
        onUpdate={async (id, draft, opts) => {
          await registry.updateManualContent(id, draft, opts)
        }}
        onRemoveDraft={registry.removeDraftContent}
        onMockPreview={registry.mockPreviewContents}
        onMockSave={registry.mockSaveContents}
        mode={registry.mode}
      />
      <Toast toast={registry.toast} />
    </>
  )
}
