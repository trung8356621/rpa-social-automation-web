import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import type { Site } from '@/features/action-tags/types'

import type {
  CreateAccountInput,
  UpdateAccountInput,
} from '../api/create-account'
import type { AccountItem } from '../types'
import { CreateAccountDrawer } from './CreateAccountDrawer'
import { EditAccountDrawer } from './EditAccountDrawer'

type AccountsScreenProps = {
  accounts: AccountItem[]
  createEnabled?: boolean
  createSubmitEnabled?: boolean
  createBlockedReason?: string | null
  updateEnabled?: boolean
  mutationsEnabled?: boolean
  mode?: 'mock' | 'live'
  sites: Site[]
  sitesLoading?: boolean
  sitesError?: string | null
  onReloadSites: () => void
  onCreate: (data: CreateAccountInput) => Promise<void>
  onUpdate: (data: UpdateAccountInput) => Promise<void>
  onDelete: (id: number, accountUuid: string) => Promise<void>
}

function siteLabel(sites: Site[], platform: string): string {
  const match = sites.find((s) => s.key === platform)
  return match ? match.name : platform || '—'
}

function loginLabel(account: AccountItem): string {
  return account.username || account.email || '—'
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function DeleteAccountButton({
  account,
  onDelete,
}: {
  account: AccountItem
  onDelete: (id: number, accountUuid: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-danger/30 text-danger hover:bg-danger/5"
      disabled={busy}
      aria-label={`Delete ${account.account_uuid}`}
      onClick={() => {
        if (
          !window.confirm(
            `Xóa Account ${account.account_uuid} trên mock local?`,
          )
        ) {
          return
        }
        setBusy(true)
        void onDelete(account.id, account.account_uuid).finally(() =>
          setBusy(false),
        )
      }}
    >
      <Trash2 className="size-3.5" />
      <span className="md:hidden">Delete</span>
    </Button>
  )
}

export function AccountsScreen({
  accounts,
  createEnabled = false,
  createSubmitEnabled = true,
  createBlockedReason = null,
  updateEnabled = false,
  mutationsEnabled = true,
  mode = 'mock',
  sites,
  sitesLoading = false,
  sitesError = null,
  onReloadSites,
  onCreate,
  onUpdate,
  onDelete,
}: AccountsScreenProps) {
  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<AccountItem | null>(null)
  const isLive = mode === 'live'
  const showActions = updateEnabled || mutationsEnabled

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return accounts.filter((a) => {
      if (platform !== 'all' && a.platform !== platform) return false
      if (!q) return true
      const label = siteLabel(sites, a.platform)
      const hay = [
        a.account_uuid,
        a.account_name,
        a.username ?? '',
        a.email ?? '',
        a.platform,
        label,
        a.note ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [accounts, search, platform, sites])

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-4">
      <PageHeader
        title="Accounts"
        description={
          isLive
            ? 'Inventory Account theo Account ID. Password không bao giờ hiển thị.'
            : 'Inventory Account theo Account ID. MOCK local — password không lưu trong state.'
        }
        actions={
          createEnabled ? (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              aria-label="Create Account"
            >
              <Plus className="size-3.5" aria-hidden />
              Create Account
            </Button>
          ) : null
        }
      />

      <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-2 text-xs leading-relaxed text-muted">
        Account Binding ≠ Session Signal ≠ Execution Confirmation. Có credential
        flag không chứng minh đã đăng nhập. Không hiển thị password.
      </div>

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 w-full flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            className="w-full min-w-0 pl-8"
            placeholder="Search Account ID, name, username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search accounts"
          />
        </div>
        <Select
          className="w-full min-w-0 sm:w-44 sm:shrink-0"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          aria-label="Filter by Site"
          disabled={sitesLoading}
        >
          <option value="all">Site: All</option>
          {sites.map((s) => (
            <option key={s.id} value={s.key}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      {sitesError ? (
        <p className="text-xs text-danger" role="alert">
          Site Registry filter unavailable: {sitesError}{' '}
          <button
            type="button"
            className="underline"
            onClick={() => onReloadSites()}
          >
            Retry
          </button>
        </p>
      ) : null}
      {!sitesLoading && !sitesError && sites.length === 0 ? (
        <p className="text-xs text-muted" role="status">
          Chưa có Site. Vui lòng tạo Site trong Action Tags.
        </p>
      ) : null}

      {accounts.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-4 py-10 text-center">
          <p className="text-sm font-medium">No accounts</p>
          <p className="mt-1 text-sm text-muted">
            {isLive
              ? 'Installation chưa có Account trên Staff API.'
              : 'Installation chưa có Account (MOCK empty).'}
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
        <>
          <ul className="space-y-3 md:hidden" aria-label="Accounts list">
            {filtered.map((a) => (
              <li
                key={a.account_uuid}
                className="rounded-[var(--radius-card)] border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold break-words text-foreground">
                      {a.account_name || '—'}
                    </p>
                    <code className="mt-1 block break-all font-mono text-[11px] text-muted">
                      {a.account_uuid}
                    </code>
                  </div>
                  <Badge variant="neutral" title={a.platform || undefined}>
                    {siteLabel(sites, a.platform)}
                  </Badge>
                </div>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-muted">Username</dt>
                    <dd className="min-w-0 break-all font-mono text-foreground">
                      {loginLabel(a)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-muted">Last</dt>
                    <dd className="text-foreground">
                      {formatWhen(a.last_interaction_at)}
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {typeof a.verified === 'boolean' ? (
                      <Badge variant={a.verified ? 'success' : 'warning'}>
                        {a.verified ? 'Verified' : 'Unverified'}
                      </Badge>
                    ) : null}
                    <Badge variant={a.has_password ? 'success' : 'neutral'}>
                      {a.has_password ? 'Has password' : 'No password'}
                    </Badge>
                  </div>
                </dl>
                {showActions ? (
                  <div className="mt-3 flex justify-end gap-2 border-t border-border pt-2">
                    {updateEnabled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Edit ${a.account_uuid}`}
                        onClick={() => setEditing(a)}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                    ) : null}
                    {mutationsEnabled ? (
                      <DeleteAccountButton account={a} onDelete={onDelete} />
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="hidden max-w-full overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface md:block">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b border-border bg-surface-muted text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Account ID</th>
                  <th className="px-3 py-2 font-medium">Account Name</th>
                  <th className="px-3 py-2 font-medium">Username</th>
                  <th className="px-3 py-2 font-medium">Site</th>
                  <th className="px-3 py-2 font-medium">Last Interaction</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  {showActions ? (
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  ) : null}
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
                    <td className="max-w-[14rem] px-3 py-2.5">
                      <span className="break-all font-mono text-xs text-muted">
                        {loginLabel(a)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="neutral" title={a.platform || undefined}>
                        {siteLabel(sites, a.platform)}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">
                      {formatWhen(a.last_interaction_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1">
                        {typeof a.verified === 'boolean' ? (
                          <Badge variant={a.verified ? 'success' : 'warning'}>
                            {a.verified ? 'Verified' : 'Unverified'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                        <Badge variant={a.has_password ? 'success' : 'neutral'}>
                          {a.has_password ? 'Has password' : 'No password'}
                        </Badge>
                      </div>
                    </td>
                    {showActions ? (
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex gap-2">
                          {updateEnabled ? (
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`Edit ${a.account_uuid}`}
                              onClick={() => setEditing(a)}
                            >
                              <Pencil className="size-3.5" />
                              Edit
                            </Button>
                          ) : null}
                          {mutationsEnabled ? (
                            <DeleteAccountButton
                              account={a}
                              onDelete={onDelete}
                            />
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CreateAccountDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={onCreate}
        sites={sites}
        sitesLoading={sitesLoading}
        sitesError={sitesError}
        onReloadSites={onReloadSites}
        submitEnabled={createSubmitEnabled}
        submitBlockedReason={createBlockedReason}
      />
      <EditAccountDrawer
        open={editing != null}
        account={editing}
        onClose={() => setEditing(null)}
        onUpdate={onUpdate}
        sites={sites}
        sitesLoading={sitesLoading}
        sitesError={sitesError}
        onReloadSites={onReloadSites}
        submitEnabled={updateEnabled}
      />
    </div>
  )
}
