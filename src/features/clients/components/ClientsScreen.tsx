import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import type {
  BrowserInventoryItem,
  ClientsInventoryData,
  OnlineClientNoBrowser,
} from '../types'
import { BrowserCard } from './BrowserCard'
import { BrowserDetailsDrawer } from './BrowserDetailsDrawer'
import {
  connectionLabel,
  formatWhen,
} from './status-labels'

type ClientsScreenProps = {
  data: ClientsInventoryData
  onCopyAccountId: (accountUuid: string) => void
}

function matchesSearch(browser: BrowserInventoryItem, q: string): boolean {
  if (!q) return true
  return [
    browser.username ?? '',
    browser.account_uuid,
    browser.account_name,
    browser.browser_id,
    String(browser.client_api_key_id),
    browser.device_hostname ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(q)
}

function matchesClientSearch(
  client: OnlineClientNoBrowser,
  q: string,
): boolean {
  if (!q) return true
  return [
    client.client_label,
    String(client.client_api_key_id),
    client.device_hostname ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(q)
}

export function ClientsScreen({ data, onCopyAccountId }: ClientsScreenProps) {
  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState('all')
  const [browserState, setBrowserState] = useState('all')
  const [connection, setConnection] = useState('all')
  const [selected, setSelected] = useState<BrowserInventoryItem | null>(null)

  const platforms = useMemo(() => {
    return [...new Set(data.browsers.map((b) => b.platform))].sort()
  }, [data.browsers])

  const filteredBrowsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.browsers.filter((b) => {
      if (platform !== 'all' && b.platform !== platform) return false
      if (browserState !== 'all' && b.browser_state !== browserState) return false
      if (connection !== 'all' && b.connection !== connection) return false
      return matchesSearch(b, q)
    })
  }, [data.browsers, search, platform, browserState, connection])

  const running = useMemo(
    () => filteredBrowsers.filter((b) => b.browser_state === 'running'),
    [filteredBrowsers],
  )
  const runningStaleCount = useMemo(
    () => running.filter((b) => b.heartbeat_stale).length,
    [running],
  )
  const stopped = useMemo(
    () => filteredBrowsers.filter((b) => b.browser_state === 'stopped'),
    [filteredBrowsers],
  )

  const filteredIdleClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    // Platform / browser-state filters do not apply to clients without browsers.
    if (browserState === 'running' || browserState === 'stopped') return []
    if (platform !== 'all') return []
    return data.online_clients_no_browser.filter((c) => {
      if (connection === 'offline') return false
      if (connection === 'online' && c.connection !== 'online') return false
      return matchesClientSearch(c, q)
    })
  }, [
    data.online_clients_no_browser,
    search,
    platform,
    browserState,
    connection,
  ])

  const hasAny =
    running.length > 0 ||
    stopped.length > 0 ||
    filteredIdleClients.length > 0
  const inventoryEmpty =
    data.browsers.length === 0 && data.online_clients_no_browser.length === 0
  const filtersActive =
    search.trim() !== '' ||
    platform !== 'all' ||
    browserState !== 'all' ||
    connection !== 'all'

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-4">
      <PageHeader
        title="Clients"
        description="Browser-first operational inventory."
      />

      <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-2 text-xs leading-relaxed text-muted">
        Browser title = Username. Account Name = secondary. Client/PC =
        metadata. Signals tách riêng: Client Connection ≠ Browser Runtime ≠
        Session Signal ≠ Execution. Counts are MOCK reported runtime — not
        confirmed-active. Heartbeat Stale ≠ offline. Lease/execution = MOCK
        until staff inventory API is confirmed.
      </div>

      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 w-full flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            className="w-full min-w-0 pl-8"
            placeholder="Search Username / Account ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search Username or Account ID"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <Select
            className="w-full min-w-0 sm:w-40"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            aria-label="Filter by platform"
          >
            <option value="all">All platforms</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Select
            className="w-full min-w-0 sm:w-44"
            value={browserState}
            onChange={(e) => setBrowserState(e.target.value)}
            aria-label="Filter by browser state"
          >
            <option value="all">All browser states</option>
            <option value="running">Browser Running</option>
            <option value="stopped">Browser Stopped</option>
          </Select>
          <Select
            className="w-full min-w-0 sm:w-44"
            value={connection}
            onChange={(e) => setConnection(e.target.value)}
            aria-label="Filter by client connection"
          >
            <option value="all">All connections</option>
            <option value="online">Client Online</option>
            <option value="offline">Client Offline</option>
          </Select>
        </div>
      </div>

      {inventoryEmpty ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No Clients connected
          </p>
          <p className="mt-1 text-sm text-muted">
            MOCK empty inventory — không có logical Client online và không có
            Browser.
          </p>
        </div>
      ) : !hasAny ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No search results
          </p>
          <p className="mt-1 text-sm text-muted">
            Không có Browser/Client khớp filter hiện tại.
          </p>
          {filtersActive ? (
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('')
                setPlatform('all')
                setBrowserState('all')
                setConnection('all')
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          <section aria-labelledby="running-browsers-heading">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="running-browsers-heading"
                className="text-sm font-semibold text-foreground"
              >
                Running Browsers
              </h2>
              <span className="text-xs text-muted">
                {running.length} reported running
                {runningStaleCount > 0
                  ? ` · ${runningStaleCount} heartbeat stale`
                  : ''}
                {' · '}
                MOCK
              </span>
            </div>
            {running.length === 0 ? (
              <div className="rounded-[var(--radius-control)] border border-dashed border-border bg-surface px-3 py-4 text-sm text-muted">
                Không có Browser Running trong kết quả lọc.
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {running.map((b) => (
                  <li key={b.id}>
                    <BrowserCard
                      browser={b}
                      emphasis="running"
                      onDetails={setSelected}
                      onCopyAccountId={onCopyAccountId}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="idle-clients-heading">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="idle-clients-heading"
                className="text-sm font-semibold text-foreground"
              >
                Online Clients — no Browser Running
              </h2>
              <span className="text-xs text-muted">
                {filteredIdleClients.length}
              </span>
            </div>
            {filteredIdleClients.length === 0 ? (
              <div className="rounded-[var(--radius-control)] border border-dashed border-border bg-surface px-3 py-3 text-sm text-muted">
                Không có Client online idle trong kết quả lọc.
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredIdleClients.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Logical Client #{c.client_api_key_id}
                      </p>
                      <p className="text-xs text-muted break-words">
                        {c.client_label}
                        {c.device_hostname ? ` · ${c.device_hostname}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Heartbeat {formatWhen(c.heartbeat_at)}
                        {c.heartbeat_stale ? ' · STALE' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="primary">
                        {connectionLabel(c.connection)}
                      </Badge>
                      <Badge variant="neutral">No Browser Running</Badge>
                      <Badge variant="neutral">Lease {c.lease_status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="stopped-browsers-heading">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="stopped-browsers-heading"
                className="text-sm font-semibold text-muted"
              >
                Known / Stopped Browsers
              </h2>
              <span className="text-xs text-muted">
                {stopped.length} reported stopped · MOCK
              </span>
            </div>
            {stopped.length === 0 ? (
              <div className="rounded-[var(--radius-control)] border border-dashed border-border bg-surface-muted/40 px-3 py-3 text-sm text-muted">
                Không có Browser Stopped trong kết quả lọc.
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {stopped.map((b) => (
                  <li key={b.id}>
                    <BrowserCard
                      browser={b}
                      emphasis="stopped"
                      onDetails={setSelected}
                      onCopyAccountId={onCopyAccountId}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <BrowserDetailsDrawer
        open={selected !== null}
        browser={selected}
        onClose={() => setSelected(null)}
        onCopyAccountId={onCopyAccountId}
      />
    </div>
  )
}
