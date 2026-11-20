import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { useAccounts } from '@/features/accounts/use-accounts'
import { useAccountSites } from '@/features/accounts/use-account-sites'
import { buildLiveCampaignCreateBody } from '@/features/campaigns/api/build-create-payload'
import { CampaignFormFields } from '@/features/campaigns/components/CampaignFormFields'
import { emptyScheduleForm } from '@/features/campaigns/schedule'
import {
  canStartWithRunMode,
  parseScriptInputSchema,
  resolveTestModeCompatibility,
  unavailableScriptInputSchema,
} from '@/features/campaigns/script-compat'
import {
  defaultShortcodeMappingForm,
  preferredDefaultVariable,
} from '@/features/campaigns/shortcode-mapping'
import { useCampaigns } from '@/features/campaigns/use-campaigns'
import {
  validateCampaignForm,
  type CampaignFormValues,
} from '@/features/campaigns/validation'
import { useScriptRegistry } from '@/features/script-registry/use-script-registry'
import { toSafeApiMessage } from '@/lib/api/errors'

export function CampaignCreatePage() {
  const navigate = useNavigate()
  const registry = useCampaigns()
  const sites = useAccountSites()
  const scripts = useScriptRegistry()
  const accounts = useAccounts()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<CampaignFormValues>({
    name: '',
    site_key: '',
    script_package_key: '',
    script_version: '',
    execution_mode: 'one_account_one_job',
    run_mode: 'live',
    schedule: emptyScheduleForm(),
    account_id: '',
    shortcode_mapping: defaultShortcodeMappingForm(),
  })

  const selectedDetail = form.script_package_key
    ? scripts.data.details[form.script_package_key]
    : null

  const scriptSchema = useMemo(() => {
    if (!form.script_package_key) return unavailableScriptInputSchema(null)
    const mockSchema = registry.getScriptInputSchema(form.script_package_key)
    if (registry.mode === 'mock') return mockSchema
    if (selectedDetail) {
      return parseScriptInputSchema(selectedDetail, {
        testModeCompatible: resolveTestModeCompatibility(
          selectedDetail,
          mockSchema.test_mode_compatible,
        ),
      })
    }
    return unavailableScriptInputSchema(null)
  }, [form.script_package_key, registry, selectedDetail])

  const testCompatible = useMemo(() => {
    if (!form.script_package_key) return null
    const mockFlag = registry.getScriptInputSchema(form.script_package_key)
      .test_mode_compatible
    return resolveTestModeCompatibility(selectedDetail, mockFlag)
  }, [form.script_package_key, registry, selectedDetail])

  useEffect(() => {
    if (!scriptSchema.schema_available) return
    const preferred = preferredDefaultVariable(scriptSchema)
    setForm((prev) => {
      const onlyDefault =
        prev.shortcode_mapping.length === 1 &&
        prev.shortcode_mapping[0]?.shortcode === 'body' &&
        !prev.shortcode_mapping[0]?.variable
      if (!onlyDefault) return prev
      return {
        ...prev,
        shortcode_mapping: defaultShortcodeMappingForm(preferred),
      }
    })
  }, [scriptSchema])

  const submit = async () => {
    const validated = validateCampaignForm(form, {
      requireAccountPin: true,
      schema: scriptSchema,
    })
    if (!validated.ok) {
      setError(validated.message)
      return
    }
    const runGate = canStartWithRunMode(
      validated.value.run_mode,
      testCompatible,
    )
    if (validated.value.run_mode === 'test' && !runGate.ok) {
      setError(
        runGate.reason ??
          'Test Mode requires an explicitly compatible Script. Do not force compatibility.',
      )
      return
    }

    const site = sites.sites.find((s) => s.key === validated.value.site_key)
    const script = scripts.data.scripts.find(
      (s) => s.package_key === validated.value.script_package_key,
    )
    setBusy(true)
    setError(null)
    try {
      if (import.meta.env.DEV && registry.mode === 'live') {
        // eslint-disable-next-line no-console
        console.info(
          '[Campaign LIVE create body]',
          buildLiveCampaignCreateBody(validated.value),
        )
      }
      const created = await registry.createCampaign(validated.value, {
        site_name: site?.name,
        script_name: script?.name,
      })
      navigate(`/social-automation/campaigns/${created.id}`)
    } catch (err) {
      setError(toSafeApiMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageHeader
        title="Create Campaign"
        description="Shortcode V2: zero Contents + shortcode_mapping. No auto-Start."
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
        accounts={accounts.data.accounts}
        testCompatible={testCompatible}
        scriptSchema={scriptSchema}
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
