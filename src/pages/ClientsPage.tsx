import { RouteSkeleton } from '@/components/shared/RouteSkeleton'

export function ClientsPage() {
  return (
    <RouteSkeleton
      title="Clients"
      description="Browser-first operational view. Username is the card title; Account Name is secondary; PC/Client is small metadata."
      layoutHint="Planned composition for the next checkpoint (mock only):"
      plannedSections={[
        'Status strip — realtime indicator + Refresh (no fake KPIs)',
        'Online Browser cards — Username title, Account Name, Client tag, Session Signal',
        'Offline totals separate; Client connection details in side drawer',
      ]}
    />
  )
}
