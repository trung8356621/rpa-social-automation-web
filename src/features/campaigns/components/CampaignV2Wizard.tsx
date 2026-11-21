import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { useActionRegistry } from '@/features/action-tags/use-action-registry'
import { useScriptRegistry } from '@/features/script-registry/use-script-registry'

import {
  buildCreateCampaignV2Input,
  buildV2DraftPlanPayload,
  campaignToV2WizardState,
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
} from '../multi-tag-plan'
import {
  canStartWithRunMode,
  unavailableScriptInputSchema,
} from '../script-compat'
import {
  defaultShortcodeMappingForSchema,
  type ShortcodeMappingFormEntry,
} from '../shortcode-mapping'
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
}

export function CampaignV2Wizard({
  wizardMode,
  initialCampaign = null,
  initialContents = [],
  initialStep = 1,
}: Props) {
  const navigate = useNavigate()
  const registry = useCampaigns()
  const actionRegistry = useActionRegistry()
  const scriptRegistry = useScriptRegistry()

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
  const [mappingsByGroupKey, setMappingsByGroupKey] = useState<
    Record<string, ShortcodeMappingFormEntry[]>
  >({})
  const [contents, setContents] = useState<PlannedContentItem[]>(
    hydrated?.contents ?? [],
  )
  const [error, setError] = useState<string | null>(null)
  const [apiErrorDetail, setApiErrorDetail] =
    useState<FormattedCampaignV2Error | null>(null)
  const [busy, setBusy] = useState(false)

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

  useEffect(() => {
    setMappingsByGroupKey((prev) => {
      let changed = false
      const next = { ...prev }
      for (const g of groups) {
        if (!next[g.group_key]) {
          const fromHydrated = g.tag_keys
            .map((tk) => hydrated?.initialMappingsByTagKey[tk])
            .find((m) => m && m.length > 0)
          if (fromHydrated) {
            next[g.group_key] = fromHydrated
          } else {
            next[g.group_key] = defaultShortcodeMappingForSchema(g.schema)
          }
          changed = true
        } else if (
          g.schema.schema_available &&
          next[g.group_key]?.length === 1 &&
          next[g.group_key]![0]?.shortcode === 'body' &&
          !next[g.group_key]![0]?.variable
        ) {
          const updated = defaultShortcodeMappingForSchema(g.schema)
          if (updated[0]?.variable) {
            next[g.group_key] = updated
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [groups, hydrated])

  const persistenceSupport = useMemo(() => {
    if (wizardMode === 'edit') {
      return inspectV2UpdateSupport(registry.mode)
    }
    return inspectBackendPersistenceSupport({
      mode: registry.mode,
      resolvedTags,
      contents,
    })
  }, [wizardMode, registry.mode, resolvedTags, contents])

  const draftPreviewPayload = useMemo(() => {
    const step2 = validateStep2Plan({
      groups,
      mappingsByGroupKey,
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
  }, [name, runMode, resolvedTags, groups, mappingsByGroupKey, contents])

  const goNext = () => {
    const check = validateStep1Plan({ name, resolvedTags })
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

  const submit = async () => {
    if (busy) return

    const step1 = validateStep1Plan({ name, resolvedTags })
    if (!step1.ok) {
      setError(step1.message)
      setApiErrorDetail(null)
      return
    }

    const step2 = validateStep2Plan({
      groups,
      mappingsByGroupKey,
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

    const v2Input = buildCreateCampaignV2Input({
      name,
      run_mode: runMode,
      resolvedTags,
      groups,
      groupMappings: step2.groupMappings,
      validatedContents: step2.validatedContents,
    })

    setBusy(true)
    setError(null)
    setApiErrorDetail(null)
    try {
      const created = await registry.createCampaignV2(v2Input)
      navigate(`/social-automation/campaigns/${created.id}`)
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
        <CampaignPlanStep1
          name={name}
          onNameChange={setName}
          runMode={runMode}
          onRunModeChange={setRunMode}
          selectedTagKeys={selectedTagKeys}
          onSelectedTagKeysChange={setSelectedTagKeys}
          tags={actionRegistry.data.tags}
          sites={actionRegistry.data.sites}
          paths={actionRegistry.data.paths}
          cmsTypes={actionRegistry.data.cms_types}
          scripts={scriptRegistry.data.scripts}
          resolvedTags={resolvedTags}
          loading={actionRegistry.loading || scriptRegistry.loading}
          disabled={busy}
        />
      ) : (
        <CampaignContentStep2
          name={name}
          runMode={runMode}
          resolvedTags={resolvedTags}
          groups={groups}
          mappingsByGroupKey={mappingsByGroupKey}
          onMappingChange={(groupKey, next) =>
            setMappingsByGroupKey((prev) => ({ ...prev, [groupKey]: next }))
          }
          contents={contents}
          onContentsChange={setContents}
          persistenceSupport={persistenceSupport}
          draftPreviewPayload={draftPreviewPayload}
          disabled={busy}
        />
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
              ? 'Save V2 Changes (Blocked — Backend Contract Required)'
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
