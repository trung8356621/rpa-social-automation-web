import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { ScriptsScreen } from '@/features/script-registry/components/ScriptsScreen'
import { useScriptRegistryMock } from '@/features/script-registry/use-script-registry-mock'

export function ScriptsPage() {
  const registry = useScriptRegistryMock()

  if (registry.loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium text-foreground">
          Loading Script Registry…
        </p>
        <p className="mt-1 text-sm text-muted">
          MOCK — simulating catalog fetch. No live API.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 min-[900px]:grid-cols-2 min-[1400px]:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[var(--radius-card)] border border-border"
            >
              <div className="aspect-video animate-pulse bg-surface-muted" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-surface-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-muted" />
              </div>
            </div>
          ))}
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
      <ScriptsScreen
        scripts={registry.data.scripts}
        getDetail={registry.getDetail}
        onRemoveScript={registry.removeScript}
      />
      <Toast toast={registry.toast} />
    </>
  )
}
