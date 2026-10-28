import { useMemo, useState } from 'react'
import { Search, Trash2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import type { AccountItem } from '../types'

type AccountsScreenProps = {
  accounts: AccountItem[]
  onDelete: (id: number, accountUuid: string) => Promise<void>
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function AccountsScreen({ accounts, onDelete }: AccountsScreenProps) {
  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState('all')
  const [busyId, setBusyId] = useState<number | null>(null)

  const platforms = useMemo(() => {
    return [...new Set(accounts.map((a) => a.platform))].sort()
  }, [accounts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return accounts.filter((a) => {
      if (platform !== 'all' && a.platform !== platform) return false
      if (!q) return true
      const hay = [
        a.account_uuid,
        a.account_name,
        a.username ?? '',
        a.email ?? '',
        a.platform,
        a.note ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [accounts, search, platform])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounts"
        description="Inventory Account theo Account ID. Username phục vụ debug; không dùng Name/Username làm khóa. MOCK local."
      />

      <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-2 text-xs text-muted">
        Account Binding ≠ Session Signal ≠ Execution Confirmation. Có credential
        flag không chứng minh đã đăng nhập.
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            className="pl-8"
            placeholder="Search Account ID, name, username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search accounts"
          />
        </div>
        <Select
          className="w-full sm:w-44"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          aria-label="Filter by platform"
        >
          <option value="all">Platform: All</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-4 py-10 text-center">
          <p className="text-sm font-medium">No accounts</p>
          <p className="mt-1 text-sm text-muted">
            Installation chưa có Account (MOCK empty).
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-10 text-center">
          <p className="text-sm font-medium">No matches</p>
          <p className="mt-1 text-sm text-muted">Không có Account khớp bộ lọc.</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => {
              setSearch('')
              setPlatform('all')
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
                <th className="px-3 py-2 font-medium">Account ID</th>
                <th className="px-3 py-2 font-medium">Account Name</th>
                <th className="px-3 py-2 font-medium">Username</th>
                <th className="px-3 py-2 font-medium">Platform</th>
                <th className="px-3 py-2 font-medium">Browser</th>
                <th className="px-3 py-2 font-medium">Last Interaction</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((a) => (
                <tr key={a.account_uuid} className="align-top">
                  <td className="max-w-[12rem] px-3 py-2.5">
                    <code className="break-all font-mono text-xs text-foreground">
                      {a.account_uuid}
                    </code>
                  </td>
                  <td className="max-w-[10rem] px-3 py-2.5 font-medium break-words text-foreground">
                    {a.account_name || '—'}
                  </td>
                  <td className="max-w-[12rem] px-3 py-2.5">
                    <span className="break-all font-mono text-xs text-muted">
                      {a.username || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="neutral">{a.platform}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted" title="List API không trả Browser binding">
                    —
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">
                    {formatWhen(a.last_interaction_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <Badge variant={a.verified ? 'success' : 'warning'}>
                        {a.verified ? 'Verified' : 'Unverified'}
                      </Badge>
                      <span className="text-[11px] text-muted">
                        {a.has_password ? 'Has credential flag' : 'No credential flag'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-danger/30 text-danger hover:bg-danger/5"
                      disabled={busyId === a.id}
                      aria-label={`Delete ${a.account_uuid}`}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Xóa Account ${a.account_uuid} trên mock local?`,
                          )
                        ) {
                          return
                        }
                        setBusyId(a.id)
                        void onDelete(a.id, a.account_uuid).finally(() =>
                          setBusyId(null),
                        )
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
