import { RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { OwnerClientConnectionsController } from '../use-owner-client-connections'

type OwnerClientConnectionsSectionProps = {
  controller: OwnerClientConnectionsController
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function statusBadge(status: string, isActive: boolean) {
  if (isActive && status === 'connected') {
    return { label: 'Connected', variant: 'success' as const }
  }
  if (!isActive || status === 'disconnected') {
    return { label: 'Disconnected', variant: 'neutral' as const }
  }
  return { label: status, variant: 'warning' as const }
}

export function OwnerClientConnectionsSection({
  controller,
}: OwnerClientConnectionsSectionProps) {
  const {
    mode,
    visible,
    loading,
    error,
    authRequired,
    forbidden,
    rows,
    summary,
    notes,
    reload,
  } = controller

  if (!visible) return null

  if (loading) {
    return (
      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Owner — Client Connections
        </h2>
        <div className="h-20 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-muted" />
      </section>
    )
  }

  if (authRequired) {
    return (
      <section className="mt-6 rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">
          Owner — Client Connections
        </h2>
        <p className="mt-1 text-xs text-muted">{error}</p>
      </section>
    )
  }

  if (forbidden || error) {
    return (
      <section className="mt-6 rounded-[var(--radius-card)] border border-danger/30 bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Owner — Client Connections
            </h2>
            <p className="mt-1 text-xs text-muted">
              {forbidden
                ? `Authorization error — ${error ?? 'Forbidden'}`
                : error}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="size-3.5" aria-hidden />
            Retry
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="mt-6 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold text-foreground">
            Owner — Client Connections
          </h2>
          <p className="text-xs text-muted">
            Successful registrations only
            {summary
              ? ` · ${summary.total} total · ${summary.active} active · ${summary.disconnected} disconnected`
              : ''}
            {mode === 'mock' ? ' · MOCK layout' : ''}
          </p>
          {notes ? <p className="text-[11px] text-muted">{notes}</p> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw className="size-3.5" aria-hidden />
          Refresh
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-4 text-xs text-muted">
          Chưa có Staff nào kết nối RPA Client thành công.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-[52rem] border-collapse text-left text-xs">
            <thead className="bg-surface-muted text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Staff</th>
                <th className="px-3 py-2 font-medium">Machine</th>
                <th className="px-3 py-2 font-medium">Key prefix</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Connected</th>
                <th className="px-3 py-2 font-medium">Disconnected</th>
                <th className="px-3 py-2 font-medium">Last heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const badge = statusBadge(row.connection_status, row.is_active)
                return (
                  <tr
                    key={row.client_api_key_id}
                    className="border-t border-border"
                  >
                    <td className="px-3 py-2 text-foreground">
                      <div className="font-medium">
                        {row.staff_name || '—'}
                      </div>
                      <div className="text-muted">
                        {row.staff_user_id != null
                          ? `#${row.staff_user_id}`
                          : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {row.machine_name || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-foreground">
                      {row.key_prefix}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {formatWhen(row.connected_at)}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {formatWhen(row.disconnected_at)}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {formatWhen(row.last_heartbeat_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
