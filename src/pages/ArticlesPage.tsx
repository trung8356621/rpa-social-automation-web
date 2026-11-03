import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { useAccountSites } from '@/features/accounts/use-account-sites'
import { ArticlesScreen } from '@/features/campaigns/components/ArticlesScreen'
import { useCampaigns } from '@/features/campaigns/use-campaigns'

export function ArticlesPage() {
  const [params] = useSearchParams()
  const registry = useCampaigns()
  const sites = useAccountSites()
  const initialCampaignId = params.get('campaign') ?? undefined

  if (registry.loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm">Loading articles…</p>
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

  return (
    <>
      <ArticlesScreen
        campaigns={registry.campaigns}
        contents={registry.contents}
        sites={sites.sites}
        initialCampaignId={initialCampaignId}
        getSchema={registry.getScriptInputSchema}
        onCreate={async (draft) => {
          await registry.createManualContent(draft)
        }}
        onUpdate={async (id, draft) => {
          await registry.updateManualContent(id, draft)
        }}
        onRemoveDraft={registry.removeDraftContent}
        mode={registry.mode}
      />
      <Toast toast={registry.toast} />
    </>
  )
}
