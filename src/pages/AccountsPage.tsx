import { RouteSkeleton } from '@/components/shared/RouteSkeleton'

export function AccountsPage() {
  return (
    <RouteSkeleton
      title="Accounts"
      description="Account inventory. Business identity is Account ID — not display name or username."
      layoutHint="Planned composition for the next checkpoint (mock only):"
      plannedSections={[
        'Search / filter toolbar',
        'Compact table — Account ID, Account Name, Username, Platform/Site, Browser, status',
        'Empty / no-match / error states',
      ]}
    />
  )
}
