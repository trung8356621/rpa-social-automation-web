import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import type { ClientApiKeyItem } from '../types'
import { maskKeyPrefix } from '../types'

type ClientApiKeysScreenProps = {
  keys: ClientApiKeyItem[]
  oneTimeRawKey: string | null
  oneTimeKeyName: string | null
  onDismissOneTime: () => void
  onCreate: (name: string) => Promise<void>
  onRevoke: (id: number) => Promise<void>
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function ClientApiKeysScreen({
  keys,
  oneTimeRawKey,
  oneTimeKeyName,
  onDismissOneTime,
  onCreate,
  onRevoke,
}: ClientApiKeysScreenProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [revokeId, setRevokeId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return keys.filter((k) => {
      if (filter === 'active' && !k.is_active) return false
      if (filter === 'revoked' && k.is_active) return false
      if (filter === 'online' && k.mock_lease?.connection !== 'online') return false
      if (filter === 'stale' && !k.mock_lease?.heartbeat_stale) return false
      if (!q) return true
      return [k.name, k.key_prefix, String(k.id), k.mock_lease?.device_hostname ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [keys, search, filter])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Client API Keys"
        description="Logical Client = client_api_key_id. Device hostname chỉ metadata. MOCK local — không lưu raw secret."
        actions={
          <Button
            size="sm"
            onClick={() => setCreating((v) => !v)}
            aria-expanded={creating}
          >
            <Plus className="size-3.5" />
            Create Key
          </Button>
        }
      />

      <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-2 text-xs text-muted">
        Phân biệt riêng: Key active/revoked · Client online/offline · Lease
        valid/expired · Heartbeat stale. Lease/connection cột là MOCK
        presentation — list API hiện chỉ trả key metadata.
      </div>

      {oneTimeRawKey ? (
        <div className="rounded-[var(--radius-card)] border border-warning/40 bg-warning/10 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                One-time secret — {oneTimeKeyName}
              </p>
              <p className="mt-1 text-xs text-warning">
                Sao chép ngay. Frontend không giữ raw key sau khi đóng banner.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onDismissOneTime}>
              Dismiss
            </Button>
          </div>
          <code className="mt-2 block break-all rounded-[var(--radius-control)] border border-border bg-surface px-2.5 py-2 font-mono text-xs">
            {oneTimeRawKey}
          </code>
        </div>
      ) : null}

      {creating ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="text-xs font-medium text-muted" htmlFor="new-key-name">
              Client label
            </label>
            <Input
              id="new-key-name"
              className="mt-1"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Office Desktop"
            />
          </div>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void onCreate(newName)
                .then(() => {
                  setNewName('')
                  setCreating(false)
                })
                .finally(() => setBusy(false))
            }}
          >
            {busy ? 'Creating…' : 'Create (MOCK)'}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            className="pl-8"
            placeholder="Search label, key prefix, hostname…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search client API keys"
          />
        </div>
        <Select
          className="w-full sm:w-48"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter keys"
        >
          <option value="all">All keys</option>
          <option value="active">Key active</option>
          <option value="revoked">Key revoked</option>
          <option value="online">Connection online (MOCK)</option>
          <option value="stale">Heartbeat stale (MOCK)</option>
        </Select>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-4 py-10 text-center">
          <p className="text-sm font-medium">No Client API Keys</p>
          <p className="mt-1 text-sm text-muted">Tạo Key để Electron Client kết nối.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-10 text-center">
          <p className="text-sm font-medium">No matches</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => {
              setSearch('')
              setFilter('all')
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Key ID</th>
                <th className="px-3 py-2 font-medium">Client Label</th>
                <th className="px-3 py-2 font-medium">Masked Key</th>
                <th className="px-3 py-2 font-medium">Key</th>
                <th className="px-3 py-2 font-medium">Lease (MOCK)</th>
                <th className="px-3 py-2 font-medium">Connection (MOCK)</th>
                <th className="px-3 py-2 font-medium">Last Heartbeat</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((k) => {
                const lease = k.mock_lease
                return (
                  <tr key={k.id} className="align-top">
                    <td className="px-3 py-2.5 font-mono text-xs">{k.id}</td>
                    <td className="max-w-[14rem] px-3 py-2.5">
                      <div className="font-medium break-words">{k.name}</div>
                      {lease?.device_hostname ? (
                        <div className="mt-0.5 text-[11px] text-muted">
                          PC: {lease.device_hostname}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted">
                      {maskKeyPrefix(k.key_prefix)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={k.is_active ? 'success' : 'danger'}>
                        {k.is_active ? 'Active' : 'Revoked'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={
                          lease?.status === 'valid'
                            ? 'success'
                            : lease?.status === 'expired'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        Lease {lease?.status ?? 'none'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={
                            lease?.connection === 'online' ? 'success' : 'neutral'
                          }
                        >
                          {lease?.connection === 'online' ? 'Online' : 'Offline'}
                        </Badge>
                        {lease?.heartbeat_stale ? (
                          <Badge variant="warning">Heartbeat stale</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">
                      {formatWhen(lease?.heartbeat_at ?? k.last_used_at)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-danger/30 text-danger hover:bg-danger/5"
                        disabled={!k.is_active || busy}
                        onClick={() => setRevokeId(k.id)}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {revokeId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40"
            aria-label="Close revoke overlay"
            onClick={() => setRevokeId(null)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="revoke-title"
            className="relative z-10 w-full max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-4"
          >
            <h2 id="revoke-title" className="text-base font-semibold">
              Revoke Client API Key
            </h2>
            <p className="mt-2 text-sm text-muted">
              Key #{revokeId} sẽ bị revoke trên mock local. Client dùng key này
              không thể mở request mới theo contract backend. Không có Force
              Disconnect / Release Lease trên UI này (chưa có staff API).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRevokeId(null)}>
                Cancel
              </Button>
              <Button
                className="bg-danger text-primary-foreground hover:bg-danger/90"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void onRevoke(revokeId)
                    .then(() => setRevokeId(null))
                    .finally(() => setBusy(false))
                }}
              >
                {busy ? 'Revoking…' : 'Revoke'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
