import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { AccountsScreen } from '@/features/accounts/components/AccountsScreen'
import { useAccounts } from '@/features/accounts/use-accounts'

export function AccountsPage() {
  const registry = useAccounts()
  const isLive = registry.mode === 'live'

  if (registry.loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium">Loading Accounts…</p>
        <p className="mt-1 text-sm text-muted">
          {isLive
            ? 'LIVE — fetching staff Accounts inventory…'
            : 'MOCK — simulating list fetch.'}
        </p>
        <div className="mt-4 space-y-2">
          <div className="h-8 animate-pulse rounded bg-surface-muted" />
          <div className="h-24 animate-pulse rounded bg-surface-muted" />
        </div>
      </div>
    )
  }

  if (registry.authRequired) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium text-foreground">
          Authentication required
        </p>
        <p className="mt-1 text-sm text-muted">{registry.error}</p>
        <p className="mt-2 text-sm text-muted">
          Sign in at{' '}
          <a className="text-primary underline" href="/login">
            /login
          </a>{' '}
          (DEV / LIVE staff session), then Retry.
        </p>
        <Button className="mt-4" onClick={() => void registry.reload()}>
          Retry
        </Button>
        <Toast toast={registry.toast} />
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
      {isLive ? (
        <p className="mb-3 rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-2 text-xs text-muted">
          LIVE — Staff session Accounts inventory (read-only). No password.
          Create/Edit/Delete disabled.
        </p>
      ) : null}
      <AccountsScreen
        accounts={registry.data.accounts}
        mutationsEnabled={registry.mutationsEnabled}
        mode={registry.mode}
        onDelete={registry.deleteAccount}
      />
      <Toast toast={registry.toast} />
    </>
  )
}
