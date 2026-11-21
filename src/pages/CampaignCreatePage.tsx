import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { useActionRegistry } from '@/features/action-tags/use-action-registry'
import { CampaignContentStep2 } from '@/features/campaigns/components/CampaignContentStep2'
import { CampaignPlanStep1 } from '@/features/campaigns/components/CampaignPlanStep1'
import {
  buildV2DraftPlanPayload,
  groupTagsByCompatibleSchema,
  inspectBackendPersistenceSupport,
  resolveActionTagScript,
  validateStep1Plan,
  validateStep2Plan,
  type PlannedContentItem,
} from '@/features/campaigns/multi-tag-plan'
import { emptyScheduleForm, scheduleFormToApi } from '@/features/campaigns/schedule'
import {
  canStartWithRunMode,
  unavailableScriptInputSchema,
} from '@/features/campaigns/script-compat'
import {
  defaultShortcodeMappingForm,
  preferredDefaultVariable,
  type ShortcodeMappingFormEntry,
} from '@/features/campaigns/shortcode-mapping'
import type { CampaignRunMode } from '@/features/campaigns/types'
import { useCampaigns } from '@/features/campaigns/use-campaigns'
import { useMultiScriptSchemas } from '@/features/campaigns/use-multi-script-schemas'
import { useScriptRegistry } from '@/features/script-registry/use-script-registry'
import { toSafeApiMessage } from '@/lib/api/errors'

export function CampaignCreatePage() {
  const navigate = useNavigate()
  const registry = useCampaigns()
  const actionRegistry = useActionRegistry()
  const scriptRegistry = useScriptRegistry()

  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [runMode, setRunMode] = useState<CampaignRunMode>('live')
  const [selectedTagKeys, setSelectedTagKeys] = useState<string[]>([])
  const [mappingsByGroupKey, setMappingsByGroupKey] = useState<
    Record<string, ShortcodeMappingFormEntry[]>
  >({})
  const [contents, setContents] = useState<PlannedContentItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const siteByKey = useMemo(() => {
    const map = new Map(actionRegistry.data.sites.map((s) => [s.key, s]))
    return map
  }, [actionRegistry.data.sites])

  const tagByKey = useMemo(() => {
    const map = new Map(actionRegistry.data.tags.map((t) => [t.tag_key, t]))
    return map
  }, [actionRegistry.data.tags])

  const resolvedTags = useMemo(() => {
    return selectedTagKeys
      .map((tk) => tagByKey.get(tk))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((tag) =>
        resolveActionTagScript(
          tag,
          siteByKey.get(tag.site_key),
          scriptRegistry.data.scripts,
        ),
      )
  }, [selectedTagKeys, tagByKey, siteByKey, scriptRegistry.data.scripts])

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

  // Initialize default shortcode mapping for each newly discovered schema group
  useEffect(() => {
    setMappingsByGroupKey((prev) => {
      let changed = false
      const next = { ...prev }
      for (const g of groups) {
        if (!next[g.group_key]) {
          const preferred = g.schema.schema_available
            ? preferredDefaultVariable(g.schema)
            : null
          next[g.group_key] = defaultShortcodeMappingForm(preferred)
          changed = true
        } else if (
          g.schema.schema_available &&
          next[g.group_key]?.length === 1 &&
          next[g.group_key]![0]?.shortcode === 'body' &&
          !next[g.group_key]![0]?.variable
        ) {
          const preferred = preferredDefaultVariable(g.schema)
          if (preferred) {
            next[g.group_key] = defaultShortcodeMappingForm(preferred)
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [groups])

  const persistenceSupport = useMemo(
    () =>
      inspectBackendPersistenceSupport({
        mode: registry.mode,
        resolvedTags,
        contents,
      }),
    [registry.mode, resolvedTags, contents],
  )

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
      return
    }
    setError(null)
    setStep(2)
  }

  const goBack = () => {
    setError(null)
    setStep(1)
  }

  const submit = async () => {
    const step1 = validateStep1Plan({ name, resolvedTags })
    if (!step1.ok) {
      setError(step1.message)
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
      return
    }

    if (runMode === 'test') {
      for (const g of groups) {
        const gate = canStartWithRunMode('test', g.schema.test_mode_compatible)
        if (!gate.ok) {
          setError(
            `${g.script_package_key}: ${gate.reason ?? 'Test Mode requires an explicitly compatible Script.'}`,
          )
          return
        }
      }
    }

    if (!persistenceSupport.supported) {
      setError(
        `Cannot persist Campaign Plan yet: ${persistenceSupport.blockers[0]}`,
      )
      return
    }

    const firstTag = resolvedTags[0]!
    const firstGroup = groups[0]!
    const firstMapping = step2.groupMappings[firstGroup.group_key]!

    setBusy(true)
    setError(null)
    try {
      const created = await registry.createCampaign(
        {
          name: name.trim(),
          site_key: firstTag.site_key,
          script_package_key: firstTag.effective_script!.package_key,
          script_version: firstTag.effective_script!.version,
          execution_mode: 'one_account_one_job',
          run_mode: runMode,
          schedule: scheduleFormToApi(emptyScheduleForm()),
          account_id: null,
          shortcode_mapping: firstMapping,
          contents: step2.validatedContents.map((c) => ({
            external_ref: c.external_ref,
            raw_source: c.raw_source,
          })),
        },
        {
          site_name: firstTag.site_name,
          script_name: firstTag.effective_script!.name,
        },
      )
      navigate(`/social-automation/campaigns/${created.id}`)
    } catch (err) {
      setError(toSafeApiMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <PageHeader
        title="Create Campaign (Plan V2)"
        description="2-step planning wizard: select Action Tags across Sites/CMS, then plan Content & Shortcode Mapping. Saves as Draft only."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/social-automation/campaigns')}
          >
            Back to Campaigns
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

      {error ? <p className="text-sm text-danger">{error}</p> : null}

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
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={goNext}
          >
            Next: Content &amp; Mapping
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={busy || !persistenceSupport.supported}
            onClick={() => void submit()}
          >
            {persistenceSupport.supported
              ? 'Create Draft Campaign'
              : 'Create Blocked (Backend Contract Required)'}
          </Button>
        )}
      </div>

      <Toast toast={registry.toast} />
    </div>
  )
}
