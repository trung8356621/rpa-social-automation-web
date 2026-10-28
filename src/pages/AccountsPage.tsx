import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { AccountsScreen } from '@/features/accounts/components/AccountsScreen'
import { useAccountsMock } from '@/features/accounts/use-accounts-mock'

export function AccountsPage() {
  const registry = useAccountsMock()

  if (registry.loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium">Loading Accounts…</p>
        <p className="mt-1 text-sm text-muted">MOCK — simulating list fetch.</p>
        <div className="mt-4 space-y-2">
          <div className="h-8 animate-pulse rounded bg-surface-muted" />
          <div className="h-24 animate-pulse rounded bg-surface-muted" />
        </div>
      </div>
    )
  }

  if (registry.error) {
    return (
      <div className="rounded-[var(--radius-card)] border border-danger/30 bg-surface p-6">
        <p className="text-sm font-medium text-danger">Không tải được dữ liệu</p>
        <p className="mt-1 text-sm text-muted">{registry.error}</p>
        <Button className="mt-4" onClick={() => void registry.reload()}>
          Retry
        </Button>
        <Toast toast={registry.toast} />
      </div>
    )
  }

  return (
    <>
      <AccountsScreen
        accounts={registry.data.accounts}
        onDelete={registry.deleteAccount}
      />
      <Toast toast={registry.toast} />
    </>
  )
}
