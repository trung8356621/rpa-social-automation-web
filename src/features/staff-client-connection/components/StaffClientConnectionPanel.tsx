import { useState } from 'react'
import { Copy, Film, RefreshCw, Unplug } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import type { RpaApiMode } from '@/lib/api/config'

import type { StaffClientConnectionController } from '../use-staff-client-connection'

type StaffClientConnectionPanelProps = {
  controller: StaffClientConnectionController
  /** `page` = Staff landing (no outer margin); default keeps compact embedded spacing. */
  variant?: 'embedded' | 'page'
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function formatExpiry(expiresAt: number, expiresAtIso: string): string {
  try {
    const ms = expiresAt > 1_000_000_000_000 ? expiresAt : expiresAt * 1000
    return new Date(ms).toLocaleString()
  } catch {
    return expiresAtIso || '—'
  }
}

function connectionStatusBadge(status: string, isActive: boolean) {
  if (isActive && status === 'connected') {
    return { label: 'Connected', variant: 'success' as const }
  }
  if (!isActive || status === 'disconnected') {
    return { label: 'Disconnected', variant: 'neutral' as const }
  }
  return { label: status, variant: 'warning' as const }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function StaffClientConnectionPanel({
  controller,
  variant = 'embedded',
}: StaffClientConnectionPanelProps) {
  const {
    mode,
    loading,
    error,
    authRequired,
    forbidden,
    view,
    busy,
    toast,
    reload,
    disconnect,
  } = controller
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [copyOk, setCopyOk] = useState(false)
  const sectionClass =
    variant === 'page'
      ? 'rounded-[var(--radius-card)] border border-border bg-surface p-4'
      : 'mb-4 rounded-[var(--radius-card)] border border-border bg-surface p-4'

  if (forbidden) return null

  if (loading && !view) {
    return (
      <section
        aria-busy="true"
        className={sectionClass}
      >
        <p className="text-sm font-medium text-foreground">
          Đang kiểm tra kết nối Client…
        </p>
        <p className="mt-1 text-xs text-muted">
          {mode === 'live'
            ? 'LIVE — GET /staff/client-connection'
            : 'MOCK — simulating connection check'}
        </p>
        <div className="mt-3 h-16 animate-pulse rounded bg-surface-muted" />
      </section>
    )
  }

  if (authRequired) {
    return (
      <section className={sectionClass}>
        <p className="text-sm font-medium text-foreground">
          Cần đăng nhập Staff Session
        </p>
        <p className="mt-1 text-xs text-muted">{error}</p>
        <p className="mt-2 text-xs text-muted">
          Đăng nhập tại{' '}
          <a className="text-primary underline" href="/login">
            /login
          </a>
          , rồi Retry. Không hiển thị Key từ cache trước khi xác minh session.
        </p>
        <Button className="mt-3" size="sm" onClick={() => void reload()}>
          Retry
        </Button>
        <Toast toast={toast} />
      </section>
    )
  }

  if (error && !view) {
    return (
      <section className={`${sectionClass} border-danger/30`}>
        <p className="text-sm font-medium text-danger">
          Không tải được Staff Client Connection
        </p>
        <p className="mt-1 text-xs text-muted">{error}</p>
        <Button className="mt-3" size="sm" onClick={() => void reload()}>
          Retry
        </Button>
        <Toast toast={toast} />
      </section>
    )
  }

  if (!view) return null

  if (view.kind === 'connected') {
    const c = view.connection
    const badge = connectionStatusBadge(c.connection_status, c.is_active)

    return (
      <section className={sectionClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              Máy tính của bạn
            </h2>
            <p className="text-xs text-muted">
              Staff Client đã kết nối. Bootstrap Key đã ẩn.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void reload()}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmDisconnect(true)}
            >
              <Unplug className="size-3.5" aria-hidden />
              Disconnect
            </Button>
          </div>
        </div>

        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted">Machine</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {c.machine_name || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Status</dt>
            <dd className="mt-0.5">
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Key prefix</dt>
            <dd className="mt-0.5 font-mono text-foreground">{c.key_prefix}</dd>
          </div>
          <div>
            <dt className="text-muted">Last heartbeat</dt>
            <dd className="mt-0.5 text-foreground">
              {formatWhen(c.last_heartbeat_at)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Connected</dt>
            <dd className="mt-0.5 text-foreground">
              {formatWhen(c.connected_at)}
            </dd>
          </div>
        </dl>

        {confirmDisconnect ? (
          <div
            role="alertdialog"
            aria-labelledby="staff-disconnect-title"
            className="mt-4 rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-3"
          >
            <p
              id="staff-disconnect-title"
              className="text-sm font-medium text-foreground"
            >
              Ngắt kết nối Client?
            </p>
            <p className="mt-1 text-xs text-muted">
              Server sẽ revoke credential và giải phóng lease — không cần
              Electron online.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  void disconnect()
                    .then(() => setConfirmDisconnect(false))
                    .catch(() => {
                      /* toast already shown; keep confirm open or close */
                      setConfirmDisconnect(false)
                    })
                }}
              >
                Confirm Disconnect
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmDisconnect(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <Toast toast={toast} />
      </section>
    )
  }

  const b = view.bootstrap
  const tutorialMessage =
    b.tutorial_video?.message ||
    'Video hướng dẫn kết nối sẽ được bổ sung sau.'

  return (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold text-foreground">
            Kết nối máy tính của bạn
          </h2>
          <p className="text-xs text-muted">
            Sử dụng mã bên dưới để kết nối RPA Client.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void reload()}
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Refresh
        </Button>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)]">
        <div className="min-w-0 space-y-3">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted">
                Bootstrap Key
              </span>
              <Button
                size="sm"
                onClick={() => {
                  void copyText(b.raw_key).then((ok) => {
                    setCopyOk(ok)
                    window.setTimeout(() => setCopyOk(false), 2000)
                  })
                }}
              >
                <Copy className="size-3.5" aria-hidden />
                {copyOk ? 'Copied' : 'Copy Key'}
              </Button>
            </div>
            <code className="mt-2 block break-all rounded-[var(--radius-control)] border border-border bg-surface-muted px-2.5 py-2 font-mono text-xs text-foreground">
              {b.raw_key}
            </code>
          </div>

          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted">Expires</dt>
              <dd className="mt-0.5 text-foreground">
                {formatExpiry(b.expires_at, b.expires_at_iso)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Key prefix</dt>
              <dd className="mt-0.5 font-mono text-foreground">
                {b.key_prefix}
              </dd>
            </div>
          </dl>

          <p className="text-[11px] text-muted">
            Key tạm thời — không lưu DB khi chưa enroll. Cache:{' '}
            <span className="font-mono">{view.localstorageKey}</span>
            {modeLabel(mode)}
          </p>
        </div>

        <div
          className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface-muted"
          aria-label="Tutorial video placeholder"
        >
          <div className="flex size-full flex-col items-center justify-center gap-2 px-3 text-center">
            <Film className="size-7 text-muted" aria-hidden />
            <p className="text-xs text-muted">
              {b.tutorial_video?.placeholder
                ? 'Video hướng dẫn kết nối sẽ được bổ sung sau.'
                : tutorialMessage}
            </p>
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </section>
  )
}

function modeLabel(mode: RpaApiMode): string {
  return mode === 'live' ? ' · LIVE' : ' · MOCK'
}
