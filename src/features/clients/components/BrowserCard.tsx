import { Copy, PanelRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RpaApiMode } from '@/lib/api/config'
import { cn } from '@/lib/utils'

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

type BrowserCardProps = {
  browser: BrowserInventoryItem
  emphasis: 'running' | 'stopped' | 'unknown'
  mode?: RpaApiMode
  onDetails: (browser: BrowserInventoryItem) => void
  onCopyAccountId: (accountUuid: string) => void
}

export function BrowserCard({
  browser,
  emphasis,
  mode = 'mock',
  onDetails,
  onCopyAccountId,
}: BrowserCardProps) {
  const title = browserTitle(browser.username, browser.account_name)
  const isRunning = emphasis === 'running'
  const isLive = mode === 'live'
  const machineTag = browser.machine_name ?? browser.device_hostname
  const accountSecondary = browser.account_name.trim() || '—'

  return (
    <article
      className={cn(
        'rounded-[var(--radius-card)] border bg-surface p-3',
        isRunning
          ? 'border-border'
          : 'border-border/80 bg-surface-muted/40',
        browser.heartbeat_stale && isRunning ? 'border-warning/40' : null,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h3
              className={cn(
                'text-sm font-semibold break-all',
                isRunning ? 'text-foreground' : 'text-muted',
              )}
            >
              {title}
            </h3>
            {machineTag ? (
              <span className="max-w-full truncate rounded-[var(--radius-control)] border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase">
                {machineTag}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted break-words">
            {accountSecondary}
            <span className="text-border"> · </span>
            <span className="capitalize">{browser.platform}</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Copy Account ID ${browser.account_uuid || 'missing'}`}
            disabled={!browser.account_uuid}
            onClick={() => onCopyAccountId(browser.account_uuid)}
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDetails(browser)}
          >
            <PanelRight className="size-3.5" />
            Details
          </Button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
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

      <dl className="mt-2.5 grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="inline text-muted">Client </dt>
          <dd className="inline break-all text-foreground">
            {browser.client_api_key_id != null
              ? `#${browser.client_api_key_id}`
              : '—'}
            {machineTag ? ` · ${machineTag}` : ''}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="inline text-muted">
            {isLive ? 'Last seen ' : 'Heartbeat '}
          </dt>
          <dd className="inline text-foreground">
            {formatWhen(isLive ? browser.last_seen_at : browser.heartbeat_at)}
          </dd>
        </div>
      </dl>
    </article>
  )
}
