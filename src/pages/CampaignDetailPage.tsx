import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { CampaignDetailScreen } from '@/features/campaigns/components/CampaignDetailScreen'
import { useCampaigns } from '@/features/campaigns/use-campaigns'

export function CampaignDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const registry = useCampaigns()

  const campaign = registry.campaigns.find((c) => c.id === id) ?? null
  const contents = useMemo(
    () => registry.contents.filter((c) => c.campaign_id === id),
    [registry.contents, id],
  )
  const testCompatible = campaign
    ? registry.getScriptInputSchema(campaign.script_package_key)
        .test_mode_compatible
    : null

  if (registry.loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm">Loading campaign…</p>
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
