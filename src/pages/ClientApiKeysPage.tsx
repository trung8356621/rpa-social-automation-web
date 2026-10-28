import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { ClientApiKeysScreen } from '@/features/client-api-keys/components/ClientApiKeysScreen'
import { useClientApiKeysMock } from '@/features/client-api-keys/use-client-api-keys-mock'

export function ClientApiKeysPage() {
  const registry = useClientApiKeysMock()

  if (registry.loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium">Loading Client API Keys…</p>
        <p className="mt-1 text-sm text-muted">MOCK — simulating list fetch.</p>
        <div className="mt-4 h-24 animate-pulse rounded bg-surface-muted" />
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
      <ClientApiKeysScreen
        keys={registry.data.keys}
        oneTimeRawKey={registry.oneTimeRawKey}
        oneTimeKeyName={registry.oneTimeKeyName}
        onDismissOneTime={registry.dismissOneTime}
        onCreate={registry.createKey}
        onRevoke={registry.revokeKey}
      />
      <Toast toast={registry.toast} />
    </>
  )
}
