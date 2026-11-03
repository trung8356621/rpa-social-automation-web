import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { useAccountSites } from '@/features/accounts/use-account-sites'
import { CampaignFormFields } from '@/features/campaigns/components/CampaignFormFields'
import { scheduleApiToForm } from '@/features/campaigns/schedule'
import { useCampaigns } from '@/features/campaigns/use-campaigns'
import {
  validateCampaignForm,
  type CampaignFormValues,
} from '@/features/campaigns/validation'
import { useScriptRegistry } from '@/features/script-registry/use-script-registry'

export function CampaignEditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const registry = useCampaigns()
  const sites = useAccountSites()
  const scripts = useScriptRegistry()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<CampaignFormValues | null>(null)

  const campaign = registry.campaigns.find((c) => c.id === id) ?? null

  useEffect(() => {
    if (!campaign) return
    setForm({
      name: campaign.name,
      site_key: campaign.site_key,
      script_package_key: campaign.script_package_key,
      execution_mode: campaign.execution_mode,
      run_mode: campaign.run_mode,
      schedule: scheduleApiToForm(campaign.schedule),
    })
  }, [campaign])

  const testCompatible = useMemo(() => {
    if (!form?.script_package_key) return null
    return registry.getScriptInputSchema(form.script_package_key)
      .test_mode_compatible
  }, [form?.script_package_key, registry])

  if (registry.loading || !form) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm">Loading…</p>
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
        disabled={busy}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button size="sm" disabled={busy} onClick={() => void submit()}>
        Save Campaign
      </Button>
      <Toast toast={registry.toast} />
    </div>
  )
}
