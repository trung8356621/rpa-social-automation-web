import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { useAccountSites } from '@/features/accounts/use-account-sites'
import { CampaignFormFields } from '@/features/campaigns/components/CampaignFormFields'
import { CampaignV2Wizard } from '@/features/campaigns/components/CampaignV2Wizard'
import { scheduleApiToForm } from '@/features/campaigns/schedule'
import {
  emptyShortcodeMappingEntry,
  defaultShortcodeMappingForm,
} from '@/features/campaigns/shortcode-mapping'
import { useCampaigns } from '@/features/campaigns/use-campaigns'
import { usePublishedScriptSchema } from '@/features/campaigns/use-published-script-schema'
import {
  isCampaignV2,
  validateCampaignForm,
  type CampaignFormValues,
} from '@/features/campaigns/validation'
import { useScriptRegistry } from '@/features/script-registry/use-script-registry'
import { toSafeApiMessage } from '@/lib/api/errors'

export function CampaignEditPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const registry = useCampaigns()
  const sites = useAccountSites()
  const scripts = useScriptRegistry()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [detailLoading, setDetailLoading] = useState(registry.mode === 'live')
  const [detailError, setDetailError] = useState<string | null>(null)
  const [form, setForm] = useState<CampaignFormValues | null>(null)

  useEffect(() => {
    if (!id) return
    if (registry.mode !== 'live') {
      setDetailLoading(false)
      setDetailError(null)
      return
    }
    if (registry.loading) {
      setDetailLoading(true)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    void (async () => {
      try {
        await registry.loadCampaignDetail(id)
        if (cancelled) return
        try {
          await registry.loadContentsForCampaign(id)
        } catch {
          /* non-fatal for edit prepopulation */
        }
        if (!cancelled) setDetailLoading(false)
      } catch (err: unknown) {
        if (cancelled) return
        setDetailError(toSafeApiMessage(err))
        setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, registry.mode, registry.loading])

  const campaign = registry.campaigns.find((c) => c.id === id) ?? null
  const isV2 = campaign ? isCampaignV2(campaign) : false
  const campaignContents = useMemo(() => {
    if (!campaign) return []
    if (Array.isArray(campaign.contents) && campaign.contents.length > 0) {
      return campaign.contents
    }
    return registry.contents.filter((c) => c.campaign_id === id)
  }, [campaign, registry.contents, id])

  useEffect(() => {
    if (!campaign || isV2) return
    const mappingEntries = campaign.shortcode_mapping?.entries?.length
      ? campaign.shortcode_mapping.entries.map((e) =>
          emptyShortcodeMappingEntry({
            shortcode: e.shortcode,
            variable: e.variable,
          }),
        )
      : defaultShortcodeMappingForm()
    setForm({
      name: campaign.name,
      site_key: campaign.site_key,
      script_package_key: campaign.script_package_key,
      script_version: campaign.script_version || '',
      execution_mode: campaign.execution_mode,
      run_mode: campaign.run_mode,
      schedule: scheduleApiToForm(campaign.schedule),
      account_id: campaign.account_id ?? '',
      shortcode_mapping: mappingEntries,
    })
  }, [campaign, isV2])

  const cachedDetail = form?.script_package_key
    ? (scripts.data.details[form.script_package_key] ?? null)
    : null
  const mockSchema = form?.script_package_key
    ? registry.getScriptInputSchema(form.script_package_key)
    : undefined

  const {
    schema: scriptSchema,
    loading: schemaLoading,
    error: schemaError,
  } = usePublishedScriptSchema({
    packageKey: form?.script_package_key ?? '',
    scriptVersion: form?.script_version,
    cachedDetail,
    mockSchema,
  })

  const testCompatible = useMemo(() => {
    if (!form?.script_package_key) return null
    return scriptSchema.test_mode_compatible
  }, [form?.script_package_key, scriptSchema.test_mode_compatible])

  if (registry.loading || detailLoading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm">Loading…</p>
      </div>
    )
  }

  if (detailError) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm text-danger">{detailError}</p>
        <Button
          className="mt-3"
          onClick={() => navigate('/social-automation/campaigns')}
        >
          Back
        </Button>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm">Campaign not found.</p>
        <Button
          className="mt-3"
          onClick={() => navigate('/social-automation/campaigns')}
        >
          Back
        </Button>
      </div>
    )
  }

  if (isV2) {
    return (
      <CampaignV2Wizard
        wizardMode="edit"
        initialCampaign={campaign}
        initialContents={campaignContents}
        initialStep={searchParams.get('step') === '2' ? 2 : 1}
      />
    )
  }

  if (!form) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm">Loading…</p>
      </div>
    )
  }

  const submit = async () => {
    const validated = validateCampaignForm(form)
    if (!validated.ok) {
      setError(validated.message)
      return
    }
    const site = sites.sites.find((s) => s.key === validated.value.site_key)
    const script = scripts.data.scripts.find(
      (s) => s.package_key === validated.value.script_package_key,
    )
    setBusy(true)
    setError(null)
    try {
      await registry.updateCampaign(
        { id: campaign.id, ...validated.value },
        { site_name: site?.name, script_name: script?.name },
      )
      navigate(`/social-automation/campaigns/${campaign.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageHeader
        title={`Edit · ${campaign.name}`}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigate(`/social-automation/campaigns/${campaign.id}`)
            }
          >
            Back
          </Button>
        }
      />
      <CampaignFormFields
        value={form}
        onChange={setForm}
        sites={sites.sites}
        scripts={scripts.data.scripts}
        testCompatible={testCompatible}
        scriptSchema={scriptSchema}
        schemaLoading={schemaLoading}
        schemaError={schemaError}
        disabled={busy || campaign.status !== 'draft'}
      />
      {campaign.status !== 'draft' ? (
        <p className="text-xs text-muted">
          shortcode_mapping is immutable after start — edit disabled.
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || campaign.status !== 'draft'}
          onClick={() => void submit()}
        >
          Save
        </Button>
      </div>
      <Toast toast={registry.toast} />
    </div>
  )
}
