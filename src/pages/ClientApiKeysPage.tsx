import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { ClientApiKeysScreen } from '@/features/client-api-keys/components/ClientApiKeysScreen'
import { useClientApiKeys } from '@/features/client-api-keys/use-client-api-keys'

export function ClientApiKeysPage() {
  const registry = useClientApiKeys()
  const isLive = registry.mode === 'live'

  if (registry.loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium">Loading Client API Keys…</p>
        <p className="mt-1 text-sm text-muted">
          {isLive
            ? 'LIVE — fetching staff Client API Keys list…'
            : 'MOCK — simulating list fetch.'}
        </p>
        <div className="mt-4 h-24 animate-pulse rounded bg-surface-muted" />
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
          LIVE — Staff session Client API Keys (read-only). Prefix only — no
          raw secret. Create/Revoke disabled. Lease/connection columns stay
          MOCK presentation (API không trả lease).
        </p>
      ) : null}
      <ClientApiKeysScreen
        keys={registry.data.keys}
        oneTimeRawKey={registry.oneTimeRawKey}
        oneTimeKeyName={registry.oneTimeKeyName}
        onDismissOneTime={registry.dismissOneTime}
        onCreate={registry.createKey}
        onRevoke={registry.revokeKey}
        mutationsEnabled={registry.mutationsEnabled}
        mode={registry.mode}
      />
      <Toast toast={registry.toast} />
    </>
  )
}
