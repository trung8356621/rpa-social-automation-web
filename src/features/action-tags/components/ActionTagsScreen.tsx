import { useMemo, useState } from 'react'
import { FolderTree, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import type {
  ActionItem,
  ActionTagItem,
  AuthScriptOption,
  PathItem,
  Site,
} from '../types'
import { formatAuthScriptLabel } from '../types'
import { AddTagDrawer } from './AddTagDrawer'

type ActionTagsScreenProps = {
  sites: Site[]
  paths: PathItem[]
  actions?: ActionItem[]
  tags: ActionTagItem[]
  authScripts: AuthScriptOption[]
  /** False when live mutations are intentionally gated */
  mutationsEnabled?: boolean
  onOpenSitesPaths: () => void
  onCreateTag: (data: {
    site_id: number
    path_id: number
    action_key?: string | null
    auth_script_id?: string | null
  }) => Promise<void>
  onUpdateTagAuthScript: (
    tagId: number,
    authScriptId: string | null,
  ) => Promise<void>
  onDeleteTag: (tagId: number, tagKey: string) => Promise<void>
}

export function ActionTagsScreen({
  sites,
  paths,
  tags,
  authScripts,
  mutationsEnabled = true,
  onOpenSitesPaths,
  onCreateTag,
  onUpdateTagAuthScript,
  onDeleteTag,
}: ActionTagsScreenProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('all')
  const [pathFilter, setPathFilter] = useState('all')
  const drawerParam = searchParams.get('drawer')
  const editTagId = Number(searchParams.get('tagId') || 0)
  const isCreateDrawer = drawerParam === 'add'
  const isEditAuthDrawer = drawerParam === 'edit-auth'
  const isDrawerOpen = isCreateDrawer || isEditAuthDrawer
  const editingTag =
    isEditAuthDrawer && editTagId
      ? (tags.find((t) => t.id === editTagId) ?? null)
      : null
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const setDrawerOpen = (open: boolean, mode: 'add' | 'edit-auth' = 'add', tagId?: number) => {
    const next = new URLSearchParams(searchParams)
    if (open) {
      next.set('drawer', mode)
      if (mode === 'edit-auth' && tagId) next.set('tagId', String(tagId))
      else next.delete('tagId')
    } else {
      next.delete('drawer')
      next.delete('tagId')
    }
    setSearchParams(next, { replace: true })
  }

  const toolbarPaths = useMemo(() => {
    if (siteFilter === 'all') return paths
    const selectedSite = sites.find((s) => s.key === siteFilter)
    if (!selectedSite) return paths
    return paths.filter((p) => p.site_id === selectedSite.id)
  }, [paths, sites, siteFilter])

  const hasActiveFilters =
    search !== '' ||
    siteFilter !== 'all' ||
    pathFilter !== 'all'

  const clearAllFilters = () => {
    setSearch('')
    setSiteFilter('all')
    setPathFilter('all')
  }

  const filteredTags = useMemo(() => {
    return tags.filter((t) => {
      if (search) {
        const q = search.toLowerCase()
        const matches =
          t.tag_key.toLowerCase().includes(q) ||
          t.site_name.toLowerCase().includes(q) ||
          t.path_name.toLowerCase().includes(q) ||
          (t.action_name ?? '').toLowerCase().includes(q)
        if (!matches) return false
      }
      if (siteFilter !== 'all' && t.site_key !== siteFilter) return false
      if (pathFilter !== 'all' && t.path_key !== pathFilter) return false
      return true
    })
  }, [tags, search, siteFilter, pathFilter])

  const handleCopyTagKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      setCopiedKey(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Action Tags"
        description="Danh sách Action Tags (liên kết Site và Path)"
        actions={
          <>
            <Button variant="outline" onClick={onOpenSitesPaths}>
              <FolderTree className="size-3.5" />
              Manage Sites & Paths
            </Button>
            <Button
              type="button"
              onClick={() => setDrawerOpen(true, 'add')}
              disabled={!mutationsEnabled}
              title={
                mutationsEnabled
                  ? undefined
                  : 'Live editing not enabled yet'
              }
            >
              <Plus className="size-3.5" />
              Add Tag
            </Button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-12">
        <div className="relative md:col-span-5">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tag key, site, path…"
            className="pl-8"
            aria-label="Search action tags"
          />
        </div>
        <div className="md:col-span-3">
          <Select
            aria-label="Filter by site"
            value={siteFilter}
            onChange={(e) => {
              setSiteFilter(e.target.value)
              setPathFilter('all')
            }}
          >
            <option value="all">Site: All</option>
            {sites.map((s) => (
              <option key={s.id} value={s.key}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="md:col-span-2">
          <Select
            aria-label="Filter by path"
            value={pathFilter}
            onChange={(e) => setPathFilter(e.target.value)}
          >
            <option value="all">Path: All</option>
            {toolbarPaths.map((p) => (
              <option key={p.id} value={p.key}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="md:col-span-2">
          {hasActiveFilters ? (
            <Button variant="ghost" className="w-full" onClick={clearAllFilters}>
              Clear Filters
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted/70 text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Site</th>
                <th className="px-3 py-2 font-medium">Path</th>
                <th className="px-3 py-2 font-medium">Tag Key</th>
                <th className="px-3 py-2 font-medium">Auth Script</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <p className="font-medium text-foreground">
                      Chưa có Site / Path nào trong hệ thống
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                      Action Tag là liên kết giữa Site và Path. Vui lòng tạo
                      Website và định nghĩa URL Pattern trước khi bắt đầu.
                    </p>
                    <Button className="mt-4" onClick={onOpenSitesPaths}>
                      Manage Sites & Paths
                    </Button>
                  </td>
                </tr>
              ) : tags.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <p className="font-medium text-foreground">
                      Chưa có Action Tag nào
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                      Tạo Action Tag đầu tiên. Hệ thống sẽ tự động tạo Script
                      Request để kỹ thuật viên RPA nhận việc.
                    </p>
                    <Button
                      className="mt-4"
                      type="button"
                      onClick={() => setDrawerOpen(true, 'add')}
                      disabled={!mutationsEnabled}
                      title={
                        mutationsEnabled
                          ? undefined
                          : 'Live editing not enabled yet'
                      }
                    >
                      <Plus className="size-3.5" />
                      Add First Tag
                    </Button>
                    {!mutationsEnabled ? (
                      <p className="mt-2 text-xs text-muted">
                        Live editing not enabled yet
                      </p>
                    ) : null}
                  </td>
                </tr>
              ) : filteredTags.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <p className="font-medium text-foreground">
                      Không tìm thấy Action Tag nào phù hợp
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Thử thay đổi từ khóa tìm kiếm hoặc các dropdown bộ lọc.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={clearAllFilters}
                    >
                      Clear Filters
                    </Button>
                  </td>
                </tr>
              ) : (
                filteredTags.map((tag) => {
                  const isCopied = copiedKey === tag.tag_key
                  return (
                    <tr
                      key={tag.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-3 py-2.5 text-foreground">
                        {tag.site_name}
                      </td>
                      <td className="px-3 py-2.5 text-foreground">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{tag.path_name}</span>
                          {tag.action_name ? (
                            <Badge variant="neutral">{tag.action_name}</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <code className="font-mono text-xs text-foreground">
                          {tag.tag_key}
                        </code>
                      </td>
                      <td className="max-w-[14rem] px-3 py-2.5">
                        {tag.auth_script ? (
                          <span
                            className="block truncate text-xs text-foreground"
                            title={formatAuthScriptLabel(tag.auth_script)}
                          >
                            {formatAuthScriptLabel(tag.auth_script)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleCopyTagKey(tag.tag_key)}
                          >
                            {isCopied ? 'Copied' : 'Copy Key'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setDrawerOpen(true, 'edit-auth', tag.id)
                            }
                            disabled={!mutationsEnabled}
                            aria-label={`Edit Auth Script for ${tag.tag_key}`}
                            title={
                              mutationsEnabled
                                ? 'Edit Auth Script'
                                : 'Live editing not enabled yet'
                            }
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-danger/30 text-danger hover:bg-danger/5"
                            onClick={() => void onDeleteTag(tag.id, tag.tag_key)}
                            disabled={!mutationsEnabled}
                            aria-label={`Delete ${tag.tag_key}`}
                            title={
                              mutationsEnabled
                                ? undefined
                                : 'Live editing not enabled yet'
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {mutationsEnabled ? (
        <AddTagDrawer
          open={isDrawerOpen}
          mode={isEditAuthDrawer ? 'edit-auth' : 'create'}
          editingTag={editingTag}
          sites={sites}
          paths={paths}
          tags={tags}
          authScripts={authScripts}
          onClose={() => setDrawerOpen(false)}
          onOpenSitesPaths={onOpenSitesPaths}
          onEditExistingTag={(id) => setDrawerOpen(true, 'edit-auth', id)}
          onCreate={onCreateTag}
          onUpdateAuthScript={onUpdateTagAuthScript}
        />
      ) : null}
    </div>
  )
}
