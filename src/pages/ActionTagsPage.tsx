import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { ActionTagsScreen } from '@/features/action-tags/components/ActionTagsScreen'
import { SitesPathsScreen } from '@/features/action-tags/components/SitesPathsScreen'
import { useActionRegistry } from '@/features/action-tags/use-action-registry'

export function ActionTagsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const registry = useActionRegistry()
  const view =
    searchParams.get('view') === 'sites_paths' ? 'sites_paths' : 'tags'
  const isLive = registry.mode === 'live'
  const mutationsEnabled = registry.mutationsEnabled

  const openSitesPaths = () => {
    const next = new URLSearchParams(searchParams)
    next.set('view', 'sites_paths')
    next.delete('drawer')
    setSearchParams(next, { replace: true })
  }

  const backToTags = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('view')
    setSearchParams(next, { replace: true })
  }

  if (registry.loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm font-medium text-foreground">Loading Action Tags…</p>
        <p className="mt-1 text-sm text-muted">
          {isLive
            ? 'LIVE — fetching staff Action Registry…'
            : 'MOCK — simulating registry fetch. No live API.'}
        </p>
        <div className="mt-4 space-y-2">
          <div className="h-8 animate-pulse rounded-[var(--radius-control)] bg-surface-muted" />
          <div className="h-8 animate-pulse rounded-[var(--radius-control)] bg-surface-muted" />
          <div className="h-24 animate-pulse rounded-[var(--radius-control)] bg-surface-muted" />
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
        <p className="mt-1 text-sm text-muted">
          Staff Action Registry needs an active SEO-OPS session (same-origin
          cookie). Sign in on SEO-OPS, then open this app from the same origin
          or retry after session is available.
        </p>
        <p className="mt-2 text-xs text-muted">{registry.error}</p>
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
        <div className="mb-3 rounded-[var(--radius-control)] border border-border bg-surface-muted/60 px-3 py-2 text-xs text-muted">
          LIVE — Staff session + CSRF. Action Tags mutations call verified
          registry endpoints. Other menus remain MOCK. No Client API Key.
        </div>
      ) : null}
      {view === 'tags' ? (
        <ActionTagsScreen
          sites={registry.data.sites}
          paths={registry.data.paths}
          actions={registry.data.actions}
          tags={registry.data.tags}
          authScripts={registry.data.auth_scripts}
          mutationsEnabled={mutationsEnabled}
          onOpenSitesPaths={openSitesPaths}
          onCreateTag={registry.createTag}
          onUpdateTagAuthScript={registry.updateTagAuthScript}
          onDeleteTag={registry.deleteTag}
        />
      ) : (
        <SitesPathsScreen
          sites={registry.data.sites}
          paths={registry.data.paths}
          mutationsEnabled={mutationsEnabled}
          onBackToTags={backToTags}
          onSaveSite={registry.saveSite}
          onSavePath={registry.savePath}
        />
      )}
      <Toast toast={registry.toast} />
    </>
  )
}
