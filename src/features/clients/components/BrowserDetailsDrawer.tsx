import { useEffect } from 'react'
import { Copy, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RpaApiMode } from '@/lib/api/config'

import type { BrowserInventoryItem } from '../types'
import {
  browserStateLabel,
  browserStateVariant,
  browserTitle,
  connectionLabel,
  connectionVariant,
  executionLabel,
  executionVariant,
  formatWhen,
  onlinePresenceLabel,
  onlinePresenceVariant,
  runtimeStatusLabel,
  runtimeStatusVariant,
  sessionLabel,
  sessionVariant,
} from './status-labels'

type BrowserDetailsDrawerProps = {
  open: boolean
  browser: BrowserInventoryItem | null
  mode?: RpaApiMode
  onClose: () => void
  onCopyAccountId: (accountUuid: string) => void
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0 max-w-full">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd
        className={
          mono
            ? 'mt-0.5 max-w-full break-all font-mono text-sm text-foreground'
            : 'mt-0.5 max-w-full break-words text-sm text-foreground'
        }
      >
        {value}
      </dd>
    </div>
  )
}

export function BrowserDetailsDrawer({
  open,
  browser,
  mode = 'mock',
  onClose,
  onCopyAccountId,
}: BrowserDetailsDrawerProps) {
  const isLive = mode === 'live'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !browser) return null

  const title = browserTitle(browser.username, browser.account_name)
  const machineTag = browser.machine_name ?? browser.device_hostname

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer overlay"
        className="absolute inset-0 bg-foreground/20"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="browser-detail-title"
        className="relative z-10 flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden border-l border-border bg-surface sm:max-w-md"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Browser Details
            </p>
            <h2
              id="browser-detail-title"
              className="mt-0.5 text-base font-semibold break-all"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-muted break-words">
              {browser.account_name.trim() || '—'}
              {machineTag ? ` · ${machineTag}` : ''}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-4 py-4">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {isLive ? (
              <>
                <Badge variant={onlinePresenceVariant(browser.online_presence)}>
                  {onlinePresenceLabel(browser.online_presence)}
                </Badge>
                <Badge variant={runtimeStatusVariant(browser.runtime_status)}>
                  {runtimeStatusLabel(browser.runtime_status)}
                </Badge>
                <Badge variant={sessionVariant(browser.session_signal)}>
                  {sessionLabel(browser.session_signal)}
                </Badge>
              </>
            ) : (
              <>
                <Badge variant={browserStateVariant(browser.browser_state)}>
                  {browserStateLabel(browser.browser_state)}
                </Badge>
                <Badge variant={connectionVariant(browser.connection)}>
                  {connectionLabel(browser.connection)}
                </Badge>
                <Badge variant={sessionVariant(browser.session_signal)}>
                  {sessionLabel(browser.session_signal)}
                </Badge>
                <Badge variant={executionVariant(browser.execution_state)}>
                  {executionLabel(browser.execution_state)}
                </Badge>
                {browser.heartbeat_stale ? (
                  <Badge variant="warning">Heartbeat Stale</Badge>
                ) : null}
              </>
            )}
          </div>

          <section className="min-w-0">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Identity
            </h3>
            <dl className="mt-2 space-y-2.5">
              <Field
                label={isLive ? 'Username' : 'Username (MOCK title field)'}
                value={browser.username?.trim() || '— unknown —'}
              />
              <Field
                label="Account Name"
                value={browser.account_name.trim() || '—'}
              />
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Field
                    label="Account ID"
                    value={browser.account_uuid || '—'}
                    mono
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 self-start sm:self-auto"
                  disabled={!browser.account_uuid}
                  onClick={() => onCopyAccountId(browser.account_uuid)}
                >
                  <Copy className="size-3.5" />
                  Copy
                </Button>
              </div>
              {isLive ? (
                <Field
                  label="account_id"
                  value={
                    browser.account_id != null ? String(browser.account_id) : '—'
                  }
                  mono
                />
              ) : null}
              <Field label="Platform" value={browser.platform} />
              <Field
                label="Site URL"
                value={browser.site_url ?? '—'}
                mono
              />
            </dl>
          </section>

          <section className="min-w-0">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Browser
            </h3>
            <dl className="mt-2 space-y-2.5">
              <Field label="Browser ID" value={browser.browser_id} mono />
              {isLive ? (
                <>
                  <Field
                    label="Online (is_online)"
                    value={onlinePresenceLabel(browser.online_presence)}
                  />
                  <Field
                    label="runtime_status"
                    value={runtimeStatusLabel(browser.runtime_status)}
                  />
                  <Field
                    label="last_seen_at"
                    value={formatWhen(browser.last_seen_at)}
                  />
                </>
              ) : (
                <>
                  <Field
                    label="Partition (MOCK)"
                    value={browser.partition_ref ?? '—'}
                    mono
                  />
                  <Field
                    label="Runtime state (MOCK reported)"
                    value={browserStateLabel(browser.browser_state)}
                  />
                </>
              )}
            </dl>
          </section>

          <section className="min-w-0">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Client
            </h3>
            <dl className="mt-2 space-y-2.5">
              <Field
                label="Logical Client ID"
                value={
                  browser.client_api_key_id != null
                    ? `#${browser.client_api_key_id} · ${browser.client_label}`
                    : '—'
                }
              />
              <Field
                label={isLive ? 'machine_name (metadata)' : 'Device hostname (metadata)'}
                value={machineTag ?? '—'}
              />
              {isLive ? null : (
                <>
                  <Field
                    label="Lease / connection (MOCK)"
                    value={`${browser.lease_status} · ${connectionLabel(browser.connection)}`}
                  />
                  <Field
                    label="Last heartbeat (MOCK)"
                    value={`${formatWhen(browser.heartbeat_at)}${browser.heartbeat_stale ? ' · STALE' : ''}`}
                  />
                </>
              )}
            </dl>
          </section>

          <section className="min-w-0">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Session
            </h3>
            <dl className="mt-2 space-y-2.5">
              <Field
                label="Session signal"
                value={sessionLabel(browser.session_signal)}
              />
              <Field
                label="Last observed"
                value={formatWhen(browser.signal_checked_at)}
              />
            </dl>
          </section>

          {!isLive ? (
            <section className="min-w-0">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                Execution
              </h3>
              <p className="mt-1 text-xs text-muted">
                Execution status is MOCK / MISSING CONTRACT as first-class
                confirmation.
              </p>
              <dl className="mt-2 space-y-2.5">
                <Field
                  label="Last execution status"
                  value={executionLabel(browser.execution_state)}
                />
                <Field
                  label="Script reference (MOCK)"
                  value={browser.last_script_ref ?? '—'}
                  mono
                />
                <Field
                  label="Last task at"
                  value={formatWhen(browser.last_task_at)}
                />
              </dl>
            </section>
          ) : (
            <section className="min-w-0">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                Execution
              </h3>
              <dl className="mt-2 space-y-2.5">
                <Field
                  label="last_task_at"
                  value={formatWhen(browser.last_task_at)}
                />
              </dl>
            </section>
          )}

          <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-2 text-xs break-words text-muted">
            Disabled (read-only): Register/Unregister Client, Open/Close
            Browser, Start/Stop Job, Assign Account, Force Disconnect, Release
            Lease, Kill Process.
          </div>
        </div>
      </aside>
    </div>
  )
}
