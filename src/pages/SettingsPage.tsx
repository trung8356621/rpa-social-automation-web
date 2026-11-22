import { PageHeader } from '@/components/layout/PageHeader'
import { useSessionIdentity } from '@/features/session-identity/use-session-identity'
import { CampaignSchedulerSettingsCard } from '@/features/settings/components/CampaignSchedulerSettingsCard'
import { useSchedulerSettings } from '@/features/settings/use-scheduler-settings'

export function SettingsPage() {
  const scheduler = useSchedulerSettings()
  const identity = useSessionIdentity()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Global operational settings for RPA Social Automation."
      />
      <CampaignSchedulerSettingsCard
        scheduler={scheduler}
        identity={{
          roleResolved: identity.roleResolved,
          isOwnerOrAdmin: identity.isOwnerOrAdmin,
          isStaff: identity.isStaff,
        }}
      />
    </div>
  )
}
