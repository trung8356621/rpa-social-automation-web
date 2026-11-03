import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { useAccountSites } from '@/features/accounts/use-account-sites'
import { CampaignsScreen } from '@/features/campaigns/components/CampaignsScreen'
import { useCampaigns } from '@/features/campaigns/use-campaigns'

export function CampaignsPage() {
  const registry = useCampaigns()
  const sites = useAccountSites()

  if (registry.loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium">Loading Campaigns…</p>
        <div className="mt-4 h-24 animate-pulse rounded bg-surface-muted" />
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

  if (registry.error) {
    return (
      <div className="rounded-[var(--radius-card)] border border-danger/30 bg-surface p-6">
        <p className="text-sm font-medium text-danger">Không tải được Campaigns</p>
        <p className="mt-1 text-sm text-muted">{registry.error}</p>
        <Button className="mt-4" onClick={() => void registry.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <>
      <CampaignsScreen
        campaigns={registry.campaigns}
        sites={sites.sites}
        mode={registry.mode}
        onPause={registry.pauseCampaign}
        onResume={registry.resumeCampaign}
        onCancel={registry.cancelCampaign}
      />
      <Toast toast={registry.toast} />
    </>
  )
}
