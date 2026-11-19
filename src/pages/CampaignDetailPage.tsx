import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { useAccounts } from '@/features/accounts/use-accounts'
import { CampaignDetailScreen } from '@/features/campaigns/components/CampaignDetailScreen'
import { resolveTestModeCompatibility } from '@/features/campaigns/script-compat'
import { useCampaigns } from '@/features/campaigns/use-campaigns'
import { useScriptRegistry } from '@/features/script-registry/use-script-registry'
import { toSafeApiMessage } from '@/lib/api/errors'

export function CampaignDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const registry = useCampaigns()
  const scripts = useScriptRegistry()
  const accounts = useAccounts()
  const [detailLoading, setDetailLoading] = useState(registry.mode === 'live')
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    if (registry.mode !== 'live') {
      setDetailLoading(false)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    void registry
      .loadCampaignDetail(id)
      .then(() => {
        if (!cancelled) setDetailLoading(false)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDetailError(toSafeApiMessage(err))
          setDetailLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, registry.mode, registry.reload])

  const campaign = registry.campaigns.find((c) => c.id === id) ?? null
  const contents = useMemo(
    () => registry.contents.filter((c) => c.campaign_id === id),
    [registry.contents, id],
  )

  const detail = campaign
    ? scripts.data.details[campaign.script_package_key]
    : null
  const testCompatible = campaign
    ? resolveTestModeCompatibility(
        detail,
        registry.getScriptInputSchema(campaign.script_package_key)
          .test_mode_compatible,
      )
    : null

  const lookupLoading =
    accounts.loading || scripts.loading || Boolean(scripts.detailLoading)

  if (registry.loading || detailLoading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm">Loading campaign…</p>
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

  return (
    <>
      <CampaignDetailScreen
        campaign={campaign}
        contents={contents}
        testCompatible={testCompatible}
        mode={registry.mode}
        liveBlockedReason={registry.liveMutationsBlockedReason}
        accounts={accounts.data.accounts}
        accountsLoading={accounts.loading}
        scripts={scripts.data.scripts}
        scriptsLoading={lookupLoading}
        scriptDetail={detail}
        onStart={registry.startCampaign}
        onPause={registry.pauseCampaign}
        onResume={registry.resumeCampaign}
        onCancel={registry.cancelCampaign}
        onRetry={registry.retryContent}
        onSkip={registry.skipContent}
        onCancelContent={registry.cancelContent}
        loadAttempts={registry.listJobAttempts}
      />
      <Toast toast={registry.toast} />
    </>
  )
}
