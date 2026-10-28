import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { ClientsScreen } from '@/features/clients/components/ClientsScreen'
import { useClientsMock } from '@/features/clients/use-clients-mock'

export function ClientsPage() {
  const inventory = useClientsMock()

  if (inventory.loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium">Loading Clients…</p>
        <p className="mt-1 text-sm text-muted">
          MOCK — simulating browser inventory fetch.
        </p>
        <div className="mt-4 h-24 animate-pulse rounded bg-surface-muted" />
        <Toast toast={inventory.toast} />
      </div>
    )
  }

  if (inventory.error) {
    return (
      <div className="rounded-[var(--radius-card)] border border-danger/30 bg-surface p-6">
        <p className="text-sm font-medium text-danger">
          Không tải được Clients
        </p>
        <p className="mt-1 text-sm text-muted">{inventory.error}</p>
        <Button className="mt-4" onClick={() => void inventory.reload()}>
          Retry
        </Button>
        <Toast toast={inventory.toast} />
      </div>
    )
  }

  return (
    <>
      <ClientsScreen
        data={inventory.data}
        onCopyAccountId={inventory.copyAccountId}
      />
      <Toast toast={inventory.toast} />
    </>
  )
}
