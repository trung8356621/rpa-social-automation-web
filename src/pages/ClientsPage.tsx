import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { ClientsScreen } from '@/features/clients/components/ClientsScreen'
import { useClients } from '@/features/clients/use-clients'

export function ClientsPage() {
  const inventory = useClients()
  const isLive = inventory.mode === 'live'

  if (inventory.loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium">Loading Clients…</p>
        <p className="mt-1 text-sm text-muted">
          {isLive
            ? 'LIVE — fetching staff Browser inventory…'
            : 'MOCK — simulating browser inventory fetch.'}
        </p>
        <div className="mt-4 h-24 animate-pulse rounded bg-surface-muted" />
        <Toast toast={inventory.toast} />
      </div>
    )
  }

  if (inventory.authRequired) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium text-foreground">
          Authentication required
        </p>
        <p className="mt-1 text-sm text-muted">{inventory.error}</p>
        <p className="mt-2 text-sm text-muted">
          Sign in at{' '}
          <a className="text-primary underline" href="/login">
            /login
          </a>{' '}
          (DEV / LIVE staff session), then Retry.
        </p>
        <Button className="mt-4" onClick={() => void inventory.reload()}>
          Retry
        </Button>
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
      {isLive ? (
        <p className="mb-3 rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-2 text-xs text-muted">
          LIVE — Staff Browser-first inventory (read-only). Online from backend
          is_online. Mutations disabled. Empty inventory is valid.
        </p>
      ) : null}
      <ClientsScreen
        data={inventory.data}
        mode={inventory.mode}
        onCopyAccountId={inventory.copyAccountId}
      />
      <Toast toast={inventory.toast} />
    </>
  )
}
