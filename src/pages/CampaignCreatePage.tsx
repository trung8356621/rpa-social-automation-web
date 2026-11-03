import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { useAccountSites } from '@/features/accounts/use-account-sites'
import { CampaignFormFields } from '@/features/campaigns/components/CampaignFormFields'
import { emptyScheduleForm } from '@/features/campaigns/schedule'
import { useCampaigns } from '@/features/campaigns/use-campaigns'
import {
  validateCampaignForm,
  type CampaignFormValues,
} from '@/features/campaigns/validation'
import { useScriptRegistry } from '@/features/script-registry/use-script-registry'

export function CampaignCreatePage() {
  const navigate = useNavigate()
  const registry = useCampaigns()
  const sites = useAccountSites()
  const scripts = useScriptRegistry()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<CampaignFormValues>({
    name: '',
    site_key: '',
    script_package_key: '',
    execution_mode: 'one_account_one_job',
    run_mode: 'live',
    schedule: emptyScheduleForm(),
  })

  const testCompatible = useMemo(() => {
    if (!form.script_package_key) return null
    return registry.getScriptInputSchema(form.script_package_key)
      .test_mode_compatible
  }, [form.script_package_key, registry])

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
      const created = await registry.createCampaign(validated.value, {
        site_name: site?.name,
        script_name: script?.name,
      })
      navigate(`/social-automation/campaigns/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageHeader
        title="Create Campaign"
        description="Configure Campaign — add Content before Start."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/social-automation/campaigns')}
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
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void submit()}>
          Create Campaign
        </Button>
      </div>
      <Toast toast={registry.toast} />
    </div>
  )
}
