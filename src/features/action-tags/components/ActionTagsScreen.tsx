import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FolderTree, Layers, Pencil, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { findCmsGlobalScriptForActionTag } from '@/features/script-registry/sharing'
import type { ScriptListItem } from '@/features/script-registry/types'
import type { RpaApiMode } from '@/lib/api/config'

import { resolveTagPublishedScriptStatus } from '../auto-tag-lifecycle'
import { groupActionTagsBySite, isSiteGroupExpanded } from '../group-tags'
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
  scripts?: ScriptListItem[]
  /** mock | live — drives Auth drawer labels and mutation copy */
  dataMode?: RpaApiMode
  /** False when live mutations are intentionally gated */
  mutationsEnabled?: boolean
  onOpenSitesPaths: () => void
  onOpenCmsManager?: () => void
  onToggleTagEnabled: (tagId: number, enabled: boolean) => Promise<void>
  onUpdateTagAuthScript: (
    tagId: number,
    authScriptId: string | null,
  ) => Promise<void>
}

export function ActionTagsScreen({
  sites,
  paths,
  tags,
  authScripts,
  scripts,
  dataMode = 'mock',
  mutationsEnabled = true,
  onOpenSitesPaths,
  onOpenCmsManager,
  onToggleTagEnabled,
  onUpdateTagAuthScript,
}: ActionTagsScreenProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('all')
  const [pathFilter, setPathFilter] = useState('all')
  const [togglingTagId, setTogglingTagId] = useState<number | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({})
  const drawerParam = searchParams.get('drawer')
  const editTagId = Number(searchParams.get('tagId') || 0)
  const isEditAuthDrawer = drawerParam === 'edit-auth'
  const editingTag =
    isEditAuthDrawer && editTagId
      ? (tags.find((t) => t.id === editTagId) ?? null)
      : null
  const isDrawerOpen = isEditAuthDrawer && editingTag !== null
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const setDrawerOpen = (open: boolean, tagId?: number) => {
    const next = new URLSearchParams(searchParams)
    if (open && tagId) {
      next.set('drawer', 'edit-auth')
      next.set('tagId', String(tagId))
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

  const groupedTags = useMemo(
    () => groupActionTagsBySite(filteredTags, sites),
    [filteredTags, sites],
  )

  const toggleGroupExpanded = (groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }))
  }

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
        description="Action Tags được tự động tạo từ Site & Path (kèm trạng thái bật/tắt và Published Script)"
        actions={
          <>
            {onOpenCmsManager ? (
              <Button variant="outline" onClick={onOpenCmsManager}>
                <Layers className="size-3.5" />
                CMS Manager
              </Button>
            ) : null}
            <Button variant="outline" onClick={onOpenSitesPaths}>
              <FolderTree className="size-3.5" />
              Manage Sites & Paths
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
                <th className="px-3 py-2 font-medium">Tag Status</th>
                <th className="px-3 py-2 font-medium">Published Script</th>
                <th className="px-3 py-2 font-medium">Auth Script</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <p className="font-medium text-foreground">
                      Chưa có Site / Path nào trong hệ thống
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                      Action Tag được tự động tạo khi Site có CMS Type hoặc Path.
                      Vui lòng cấu hình Site và Path để bắt đầu.
                    </p>
                    <Button className="mt-4" onClick={onOpenSitesPaths}>
                      Manage Sites & Paths
                    </Button>
                  </td>
                </tr>
              ) : tags.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <p className="font-medium text-foreground">
                      Chưa có Action Tag nào
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                      Action Tag sẽ tự động xuất hiện khi Site được gắn CMS Type
                      (như WordPress) hoặc có Path hiệu lực.
                    </p>
                    <Button className="mt-4" onClick={onOpenSitesPaths}>
                      <FolderTree className="size-3.5" />
                      Manage Sites & Paths
                    </Button>
                  </td>
                </tr>
              ) : filteredTags.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
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
                groupedTags.map((group) => {
                  const isExpanded = isSiteGroupExpanded(
                    group.groupKey,
                    collapsedGroups,
                    hasActiveFilters,
                  )
                  return (
                    <Fragment key={group.groupKey}>
                      <tr className="border-b border-border bg-surface-muted/60">
                        <td colSpan={7} className="px-3 py-2">
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => toggleGroupExpanded(group.groupKey)}
                            className="flex w-full items-center justify-between gap-2 text-left"
                          >
                            <span className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="size-4 text-muted" />
                              ) : (
                                <ChevronRight className="size-4 text-muted" />
                              )}
                              <span className="font-semibold text-foreground">
                                {group.siteName}
                              </span>
                              <code className="font-mono text-xs text-muted">
                                {group.siteKey}
                              </code>
                            </span>
                            <Badge variant="neutral">
                              {group.tags.length} tag
                              {group.tags.length === 1 ? '' : 's'}
                            </Badge>
                          </button>
                        </td>
                      </tr>
                      {isExpanded
                        ? group.tags.map((tag) => {
                            const isCopied = copiedKey === tag.tag_key
                            const isEnabled = tag.enabled ?? true
                            const scriptStatus = resolveTagPublishedScriptStatus(
                              tag,
                              scripts,
                            )
                            const tagSite = sites.find(
                              (s) =>
                                s.id === tag.site_id || s.key === tag.site_key,
                            )
                            const globalScript = findCmsGlobalScriptForActionTag(
                              tag,
                              tagSite?.cms_type,
                              scripts,
                            )
                            const isToggling = togglingTagId === tag.id
                            return (
                              <tr
                                key={tag.id}
                                className={
                                  isEnabled
                                    ? 'border-b border-border last:border-b-0'
                                    : 'border-b border-border bg-surface-muted/40 opacity-75 last:border-b-0'
                                }
                              >
                                <td className="px-3 py-2.5 pl-8 text-muted">
                                  {tag.site_name}
                                </td>
                                <td className="px-3 py-2.5 text-foreground">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span>{tag.path_name}</span>
                                    {tag.action_name ? (
                                      <Badge variant="neutral">
                                        {tag.action_name}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <code className="font-mono text-xs text-foreground">
                                    {tag.tag_key}
                                  </code>
                                </td>
                                <td className="px-3 py-2.5">
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isEnabled}
                                    aria-label={`Toggle ${tag.tag_key}`}
                                    disabled={!mutationsEnabled || isToggling}
                                    onClick={() => {
                                      setTogglingTagId(tag.id)
                                      void onToggleTagEnabled(
                                        tag.id,
                                        !isEnabled,
                                      ).finally(() => setTogglingTagId(null))
                                    }}
                                    className="inline-flex items-center gap-2 text-xs font-medium disabled:opacity-50"
                                  >
                                    <Badge
                                      variant={isEnabled ? 'success' : 'neutral'}
                                    >
                                      {isEnabled ? 'Enabled' : 'Disabled'}
                                    </Badge>
                                  </button>
                                </td>
                                <td className="px-3 py-2.5">
                                  {scriptStatus.hasPublishedScript ? (
                                    <div className="flex flex-wrap items-center gap-1">
                                      <Badge variant="primary">
                                        Published
                                        {scriptStatus.matchedScript?.version
                                          ? ` · v${scriptStatus.matchedScript.version}`
                                          : ''}
                                      </Badge>
                                      {scriptStatus.matchedScript
                                        ?.sharing_mode === 'cms_global' ? (
                                        <Badge variant="success">
                                          CMS Global
                                        </Badge>
                                      ) : null}
                                    </div>
                                  ) : globalScript ? (
                                    <div
                                      className="flex flex-wrap items-center gap-1"
                                      title={`Resolves via CMS Global Script: ${globalScript.name} (${globalScript.global_scope ?? 'cms_global'})`}
                                    >
                                      <Badge variant="success">
                                        via CMS Global
                                      </Badge>
                                    </div>
                                  ) : (
                                    <Badge variant="warning">
                                      Missing Script
                                    </Badge>
                                  )}
                                </td>
                                <td className="max-w-[14rem] px-3 py-2.5">
                                  {tag.auth_script ? (
                                    <span
                                      className="block truncate text-xs text-foreground"
                                      title={formatAuthScriptLabel(
                                        tag.auth_script,
                                      )}
                                    >
                                      {formatAuthScriptLabel(tag.auth_script)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        void handleCopyTagKey(tag.tag_key)
                                      }
                                    >
                                      {isCopied ? 'Copied' : 'Copy Key'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setDrawerOpen(true, tag.id)}
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
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        : null}
                    </Fragment>
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
          mode="edit-auth"
          dataMode={dataMode}
          editingTag={editingTag}
          sites={sites}
          paths={paths}
          tags={tags}
          authScripts={authScripts}
          onClose={() => setDrawerOpen(false)}
          onOpenSitesPaths={onOpenSitesPaths}
          onEditExistingTag={(id) => setDrawerOpen(true, id)}
          onCreate={async () => {}}
          onUpdateAuthScript={onUpdateTagAuthScript}
        />
      ) : null}
    </div>
  )
}
