import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Toast } from '@/components/ui/toast'
import { useActionRegistry } from '@/features/action-tags/use-action-registry'
import { CampaignArticleSelector } from '@/features/articles/components/CampaignArticleSelector'
import type { CampaignArticleAssignment } from '@/features/articles/types'
import { useArticleLibrary } from '@/features/articles/use-article-library'
import { useScriptRegistry } from '@/features/script-registry/use-script-registry'
import { toSafeApiMessage } from '@/lib/api/errors'

import type { IntervalDraft } from '../campaign-interval-edit'
import {
  applyTagRemovalResolution,
  buildCreateCampaignV2Input,
  buildUpdateCampaignV2Input,
  buildV2DraftPlanPayload,
  campaignToV2WizardState,
  countDependentContentsForTag,
  findCompatibleReassignmentTags,
  formatCampaignV2ApiError,
  groupTagsByCompatibleSchema,
  inspectBackendPersistenceSupport,
  inspectV2UpdateSupport,
  resolveActionTagWithPin,
  validateStep1Plan,
  validateStep2Plan,
  type FormattedCampaignV2Error,
  type PlannedContentItem,
  type ResolvedActionTagPlan,
  type TagDependentContentCounts,
} from '../multi-tag-plan'
import {
  canStartWithRunMode,
  unavailableScriptInputSchema,
} from '../script-compat'
import type { Campaign, CampaignContent, CampaignRunMode } from '../types'
import { useCampaigns } from '../use-campaigns'
import { useMultiScriptSchemas } from '../use-multi-script-schemas'
import { CampaignContentStep2 } from './CampaignContentStep2'
import { CampaignPlanStep1 } from './CampaignPlanStep1'

type Props = {
  wizardMode: 'create' | 'edit'
  initialCampaign?: Campaign | null
  initialContents?: CampaignContent[]
  initialStep?: 1 | 2
  detailLoaded?: boolean
  onReloadLatest?: () => Promise<void>
}

export function CampaignV2Wizard({
  wizardMode,
  initialCampaign = null,
  initialContents = [],
  initialStep = 1,
  detailLoaded = true,
  onReloadLatest,
}: Props) {
  const navigate = useNavigate()
  const registry = useCampaigns()
  const actionRegistry = useActionRegistry()
  const scriptRegistry = useScriptRegistry()
  const articleLibrary = useArticleLibrary()

  const hydrated = useMemo(
    () =>
      wizardMode === 'edit' && initialCampaign
        ? campaignToV2WizardState(initialCampaign, initialContents)
        : null,
    [wizardMode, initialCampaign, initialContents],
  )

  const [step, setStep] = useState<1 | 2>(initialStep)
  const [name, setName] = useState(hydrated?.name ?? '')
  const [runMode, setRunMode] = useState<CampaignRunMode>(
    hydrated?.runMode ?? 'live',
  )
  const [selectedTagKeys, setSelectedTagKeys] = useState<string[]>(
    hydrated?.selectedTagKeys ?? [],
  )
  const [intervalsByTagKey, setIntervalsByTagKey] = useState<
    Record<string, IntervalDraft>
  >(() => hydrated?.initialIntervalDraftsByTagKey ?? {})
  const [contents, setContents] = useState<PlannedContentItem[]>(
    hydrated?.contents ?? [],
  )
  const [error, setError] = useState<string | null>(null)
  const [apiErrorDetail, setApiErrorDetail] =
    useState<FormattedCampaignV2Error | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingTagRemoval, setPendingTagRemoval] = useState<
    ({ tagKey: string } & TagDependentContentCounts) | null
  >(null)
  const [reassignTargetKey, setReassignTargetKey] = useState<string>('')
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([])
  const [assignedRows, setAssignedRows] = useState<CampaignArticleAssignment[]>([])
  const [assignmentBusy, setAssignmentBusy] = useState(false)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)

  const hydratedKey = hydrated
    ? `${hydrated.campaignId}:${hydrated.revision ?? 'none'}:${hydrated.updatedAt ?? ''}`
    : ''

  useEffect(() => {
    if (!hydrated) return
    setName(hydrated.name)
    setRunMode(hydrated.runMode)
    setSelectedTagKeys(hydrated.selectedTagKeys)
    setIntervalsByTagKey(hydrated.initialIntervalDraftsByTagKey)
    setContents(hydrated.contents)
    setPendingTagRemoval(null)
    setReassignTargetKey('')
    setError(null)
    setApiErrorDetail(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydratedKey])

  useEffect(() => {
    if (wizardMode !== 'edit' || !initialCampaign?.id) return
    let cancelled = false
    void articleLibrary.adapter
      .listCampaignArticles(initialCampaign.id)
      .then((rows) => {
        if (!cancelled) {
          setAssignedRows(rows)
          setAssignmentError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setAssignmentError(toSafeApiMessage(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [wizardMode, initialCampaign?.id, articleLibrary.adapter])

  const handleAssignPersisted = async (articleIds: string[]) => {
    if (!initialCampaign?.id) return
    setAssignmentBusy(true)
    setAssignmentError(null)
    try {
      const startOrder =
        assignedRows.reduce((m, r) => Math.max(m, r.sort_order), 0) + 1
      await articleLibrary.adapter.assignCampaignArticles(
        initialCampaign.id,
        articleIds.map((article_id, i) => ({
          article_id,
          sort_order: startOrder + i,
        })),
      )
      const refreshed = await articleLibrary.adapter.listCampaignArticles(
        initialCampaign.id,
      )
      setAssignedRows(refreshed)
    } catch (err: unknown) {
      setAssignmentError(toSafeApiMessage(err))
    } finally {
      setAssignmentBusy(false)
    }
  }

  const handleRemovePersisted = async (articleOrContentId: string) => {
    if (!initialCampaign?.id) return
    setAssignmentBusy(true)
    setAssignmentError(null)
    try {
      await articleLibrary.adapter.removeCampaignArticle(
        initialCampaign.id,
        articleOrContentId,
      )
      const refreshed = await articleLibrary.adapter.listCampaignArticles(
        initialCampaign.id,
      )
      setAssignedRows(refreshed)
    } catch (err: unknown) {
      setAssignmentError(toSafeApiMessage(err))
    } finally {
      setAssignmentBusy(false)
    }
  }

  const siteByKey = useMemo(
    () => new Map(actionRegistry.data.sites.map((s) => [s.key, s])),
    [actionRegistry.data.sites],
  )

  const tagByKey = useMemo(
    () => new Map(actionRegistry.data.tags.map((t) => [t.tag_key, t])),
    [actionRegistry.data.tags],
  )

  const resolvedTags = useMemo(() => {
    return selectedTagKeys
      .map((tk) =>
        resolveActionTagWithPin(
          tagByKey.get(tk),
          hydrated?.pinnedTagsByKey[tk],
          siteByKey.get(
            tagByKey.get(tk)?.site_key ??
              hydrated?.pinnedTagsByKey[tk]?.site_key ??
              '',
          ),
          scriptRegistry.data.scripts,
          {
            paths: actionRegistry.data.paths,
            cmsTypes: actionRegistry.data.cms_types,
          },
        ),
      )
      .filter((t): t is ResolvedActionTagPlan => Boolean(t))
  }, [
    selectedTagKeys,
    tagByKey,
    hydrated,
    siteByKey,
    scriptRegistry.data.scripts,
    actionRegistry.data.paths,
    actionRegistry.data.cms_types,
  ])

  useEffect(() => {
    const authTags = resolvedTags.filter((t) => t.is_system_auth)
    if (authTags.length === 0) return
    const authKeys = new Set(authTags.map((t) => t.tag_key))
    setSelectedTagKeys((prev) => prev.filter((k) => !authKeys.has(k)))
    setError(
      `Removed system authentication tag(s) from plan: ${authTags
        .map((t) => t.tag_key)
        .join(', ')}. Login is managed automatically by CMS Authentication.`,
    )
  }, [resolvedTags])

  const schemaTargets = useMemo(
    () =>
      resolvedTags
        .filter((t) => t.is_runnable && t.effective_script)
        .map((t) => ({
          packageKey: t.effective_script!.package_key,
          scriptVersion: t.effective_script!.version,
        })),
    [resolvedTags],
  )

  const schemaLookup = useMultiScriptSchemas({
    targets: schemaTargets,
    cachedDetails: scriptRegistry.data.details,
    getMockSchema: registry.getScriptInputSchema,
  })

  const groups = useMemo(
    () =>
      groupTagsByCompatibleSchema(
        resolvedTags,
        schemaLookup,
        (reason) => unavailableScriptInputSchema(null, reason),
      ),
    [resolvedTags, schemaLookup],
  )

  const persistenceSupport = useMemo(() => {
    if (wizardMode === 'edit') {
      return inspectV2UpdateSupport({
        campaign: initialCampaign,
        detailLoaded,
        resolvedTags,
      })
    }
    return inspectBackendPersistenceSupport({
      mode: registry.mode,
      resolvedTags,
      contents,
    })
  }, [
    wizardMode,
    initialCampaign,
    detailLoaded,
    registry.mode,
    resolvedTags,
    contents,
  ])

  const draftPreviewPayload = useMemo(() => {
    const step2 = validateStep2Plan({
      groups,
      contents,
      resolvedTags,
    })
    if (!step2.ok) return null
    return buildV2DraftPlanPayload({
      name,
      run_mode: runMode,
      resolvedTags,
      groups,
      groupMappings: step2.groupMappings,
      validatedContents: step2.validatedContents,
    })
  }, [name, runMode, resolvedTags, groups, contents])

  const compatibleReassignmentTags = useMemo(() => {
    if (!pendingTagRemoval) return []
    return findCompatibleReassignmentTags({
      removedTagKey: pendingTagRemoval.tagKey,
      resolvedTags,
      schemaLookup,
    })
  }, [pendingTagRemoval, resolvedTags, schemaLookup])

  const handleSelectedTagKeysChange = (nextKeys: string[]) => {
    const removed = selectedTagKeys.find((k) => !nextKeys.includes(k))
    if (!removed) {
      setSelectedTagKeys(nextKeys)
      setPendingTagRemoval(null)
      return
    }
    const deps = countDependentContentsForTag(contents, removed)
    if (deps.totalAffected === 0) {
      setSelectedTagKeys(nextKeys)
      setPendingTagRemoval(null)
      return
    }
    const compat = findCompatibleReassignmentTags({
      removedTagKey: removed,
      resolvedTags,
      schemaLookup,
    })
    setPendingTagRemoval({ tagKey: removed, ...deps })
    setReassignTargetKey(compat[0]?.tag_key ?? '')
    setError(null)
  }

  const resolveTagRemoval = (mode: 'delete' | 'reassign') => {
    if (!pendingTagRemoval) return
    const compatSet = new Set(
      compatibleReassignmentTags.map((t) => t.tag_key),
    )
    const result = applyTagRemovalResolution({
      contents,
      selectedTagKeys,
      removedTagKey: pendingTagRemoval.tagKey,
      resolution:
        mode === 'delete'
          ? { mode: 'delete' }
          : { mode: 'reassign', targetTagKey: reassignTargetKey },
      compatibleTagKeys: compatSet,
    })
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSelectedTagKeys(result.nextSelectedTagKeys)
    setContents(result.nextContents)
    setPendingTagRemoval(null)
    setReassignTargetKey('')
    setError(null)
  }

  const goNext = () => {
    if (pendingTagRemoval) {
      setError(
        `Resolve dependent Articles for "${pendingTagRemoval.tagKey}" before continuing.`,
      )
      return
    }
    const check = validateStep1Plan({
      name,
      resolvedTags,
      intervalsByTagKey,
    })
    if (!check.ok) {
      setError(check.message)
      setApiErrorDetail(null)
      return
    }
    setError(null)
    setApiErrorDetail(null)
    setStep(2)
  }

  const goBack = () => {
    setError(null)
    setApiErrorDetail(null)
    setStep(1)
  }

  const refreshResolution = () => {
    actionRegistry.reload()
    scriptRegistry.reload()
    setError(null)
    setApiErrorDetail(null)
  }

  const handleReloadLatest = async () => {
    if (!onReloadLatest || busy) return
    if (
      !window.confirm(
        'Reloading the latest Campaign plan from the server will discard your unsaved local changes. Continue?',
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await onReloadLatest()
      setError(null)
      setApiErrorDetail(null)
    } catch (err) {
      setApiErrorDetail(formatCampaignV2ApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (busy) return

    const step1 = validateStep1Plan({
      name,
      resolvedTags,
      intervalsByTagKey,
    })
    if (!step1.ok) {
      setError(step1.message)
      setApiErrorDetail(null)
      return
    }

    const step2 = validateStep2Plan({
      groups,
      contents,
      resolvedTags,
    })
    if (!step2.ok) {
      setError(step2.message)
      setApiErrorDetail(null)
      return
    }

    if (runMode === 'test') {
      for (const g of groups) {
        const gate = canStartWithRunMode('test', g.schema.test_mode_compatible)
        if (!gate.ok) {
          setError(
            `${g.script_package_key}: ${gate.reason ?? 'Test Mode requires an explicitly compatible Script.'}`,
          )
          setApiErrorDetail(null)
          return
        }
      }
    }

    if (!persistenceSupport.supported) {
      setError(
        persistenceSupport.blockers[0] ?? 'Cannot persist Campaign Plan.',
      )
      setApiErrorDetail(null)
      return
    }

    setBusy(true)
    setError(null)
    setApiErrorDetail(null)
    try {
      if (wizardMode === 'edit' && initialCampaign) {
        const v2Update = buildUpdateCampaignV2Input({
          id: initialCampaign.id,
          revision: initialCampaign.revision ?? null,
          updated_at: initialCampaign.updated_at || null,
          name,
          run_mode: runMode,
          resolvedTags,
          groups,
          groupMappings: step2.groupMappings,
          validatedContents: step2.validatedContents,
          intervalsByTagKey,
        })
        const updated = await registry.updateCampaignV2(v2Update)
        navigate(`/social-automation/campaigns/${updated.id}`)
      } else {
        const v2Create = buildCreateCampaignV2Input({
          name,
          run_mode: runMode,
          resolvedTags,
          groups,
          groupMappings: step2.groupMappings,
          validatedContents: step2.validatedContents,
          intervalsByTagKey,
        })
        const created = await registry.createCampaignV2(v2Create)
        if (selectedArticleIds.length > 0) {
          await articleLibrary.adapter.assignCampaignArticles(
            created.id,
            selectedArticleIds.map((article_id, idx) => ({
              article_id,
              sort_order: idx + 1,
            })),
          )
        }
        navigate(`/social-automation/campaigns/${created.id}`)
      }
    } catch (err) {
      const formatted = formatCampaignV2ApiError(err)
      setError(formatted.message)
      setApiErrorDetail(formatted)
    } finally {
      setBusy(false)
    }
  }

  const backTarget =
    wizardMode === 'edit' && initialCampaign
      ? `/social-automation/campaigns/${initialCampaign.id}`
      : '/social-automation/campaigns'

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <PageHeader
        title={
          wizardMode === 'edit'
            ? `Edit Campaign (Plan V2): ${initialCampaign?.name ?? ''}`
            : 'Create Campaign (Plan V2)'
        }
        description={
          wizardMode === 'edit'
            ? 'Review or plan edits in the 2-step V2 wizard. Existing Release pins and IDs are preserved.'
            : '2-step planning wizard: select Action Tags across Sites/CMS, then plan Content & Shortcode Mapping. Saves as Draft only.'
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(backTarget)}
          >
            {wizardMode === 'edit' ? 'Back to Detail' : 'Back to Campaigns'}
          </Button>
        }
      />

      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => (step === 2 ? goBack() : undefined)}
          className={`rounded-[var(--radius-control)] border px-3 py-1.5 font-medium ${
            step === 1
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-surface text-muted hover:text-foreground'
          }`}
        >
          1. Campaign Plan
        </button>
        <span className="text-muted">&rarr;</span>
        <button
          type="button"
          onClick={() => (step === 1 ? goNext() : undefined)}
          className={`rounded-[var(--radius-control)] border px-3 py-1.5 font-medium ${
            step === 2
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-surface text-muted hover:text-foreground'
          }`}
        >
          2. Content &amp; Mapping
        </button>
      </div>

      {step === 1 ? (
        <>
          {pendingTagRemoval ? (
            <div className="rounded-[var(--radius-card)] border border-warning/60 bg-warning/10 p-4 space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    Action Tag &ldquo;{pendingTagRemoval.tagKey}&rdquo; has{' '}
                    {pendingTagRemoval.totalAffected} dependent Article(s)
                  </p>
                  <p className="text-muted">
                    Existing Articles in this Draft reference{' '}
                    <code className="font-mono">{pendingTagRemoval.tagKey}</code>{' '}
                    ({pendingTagRemoval.singleTargetCount} single-target
                    {pendingTagRemoval.multiTargetCount > 0
                      ? `, ${pendingTagRemoval.multiTargetCount} multi-assigned`
                      : ''}
                    ). Choose how to resolve them before removing this Tag:
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                {compatibleReassignmentTags.length > 0 ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted">
                        Reassign to compatible Tag
                      </span>
                      <Select
                        className="w-64"
                        disabled={busy}
                        value={reassignTargetKey}
                        onChange={(e) => setReassignTargetKey(e.target.value)}
                      >
                        {compatibleReassignmentTags.map((t) => (
                          <option key={t.tag_key} value={t.tag_key}>
                            {t.site_name} · {t.tag_key}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || !reassignTargetKey}
                      onClick={() => resolveTagRemoval('reassign')}
                    >
                      Reassign &amp; Remove Tag
                    </Button>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted">
                    No remaining compatible Action Tag is available for
                    reassignment.
                  </span>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-danger"
                  disabled={busy}
                  onClick={() => resolveTagRemoval('delete')}
                >
                  {pendingTagRemoval.multiTargetCount > 0 &&
                  pendingTagRemoval.singleTargetCount === 0
                    ? 'Remove Affected Assignments & Tag'
                    : 'Delete Dependent Articles & Remove Tag'}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setPendingTagRemoval(null)
                    setReassignTargetKey('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <CampaignPlanStep1
            name={name}
            onNameChange={setName}
            runMode={runMode}
            onRunModeChange={setRunMode}
            selectedTagKeys={selectedTagKeys}
            onSelectedTagKeysChange={handleSelectedTagKeysChange}
            tags={actionRegistry.data.tags}
            sites={actionRegistry.data.sites}
            paths={actionRegistry.data.paths}
            cmsTypes={actionRegistry.data.cms_types}
            scripts={scriptRegistry.data.scripts}
            resolvedTags={resolvedTags}
            intervalsByTagKey={intervalsByTagKey}
            onIntervalChange={(tagKey, draft) =>
              setIntervalsByTagKey((prev) => ({ ...prev, [tagKey]: draft }))
            }
            loading={actionRegistry.loading || scriptRegistry.loading}
            disabled={busy}
          />
        </>
      ) : (
        <div className="space-y-5">
          <CampaignContentStep2
            name={name}
            runMode={runMode}
            resolvedTags={resolvedTags}
            groups={groups}
            historicalMappingsByTagKey={hydrated?.initialMappingsByTagKey}
            contents={contents}
            persistenceSupport={persistenceSupport}
            draftPreviewPayload={draftPreviewPayload}
          />
          <CampaignArticleSelector
            mode={wizardMode}
            campaignStatus={initialCampaign?.status ?? 'draft'}
            resolvedTags={resolvedTags}
            availableArticles={articleLibrary.articles}
            loadingArticles={articleLibrary.loading}
            selectedArticleIds={selectedArticleIds}
            onChangeSelectedArticleIds={setSelectedArticleIds}
            assignedRows={assignedRows}
            onAssignPersisted={handleAssignPersisted}
            onRemovePersisted={handleRemovePersisted}
            busy={busy || assignmentBusy}
            error={assignmentError}
          />
        </div>
      )}

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 p-3 space-y-2 text-xs">
          <p className="font-medium text-danger">{error}</p>
          {apiErrorDetail?.validationErrors.length ? (
            <ul className="list-disc pl-4 space-y-0.5 text-danger">
              {apiErrorDetail.validationErrors.map((ve, i) => (
                <li key={i}>{ve}</li>
              ))}
            </ul>
          ) : null}
          {apiErrorDetail?.isRevisionConflict ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-muted">
                This Campaign was modified elsewhere. Reload the latest plan
                (discards unsaved local changes) before saving again.
              </span>
              {onReloadLatest ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void handleReloadLatest()}
                >
                  Reload Latest Plan
                </Button>
              ) : null}
            </div>
          ) : null}
          {apiErrorDetail?.isStaleReleaseConflict ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-muted">
                Pinned Script Release is stale. Refresh Script resolution and
                review before retrying (pinned Scripts are not swapped silently).
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={refreshResolution}
              >
                Refresh Script Resolution
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        {step === 2 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={goBack}
          >
            Back
          </Button>
        ) : (
          <div />
        )}

        {step === 1 ? (
          <Button type="button" size="sm" disabled={busy} onClick={goNext}>
            Next: Content &amp; Mapping
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={busy || !persistenceSupport.supported}
            onClick={() => void submit()}
          >
            {wizardMode === 'edit'
              ? busy
                ? 'Saving V2 Draft…'
                : 'Save V2 Draft'
              : busy
                ? 'Saving Draft…'
                : 'Create Draft Campaign'}
          </Button>
        )}
      </div>

      <Toast toast={registry.toast} />
    </div>
  )
}
