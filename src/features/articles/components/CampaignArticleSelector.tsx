import { useMemo, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { ResolvedActionTagPlan } from '@/features/campaigns/multi-tag-plan'
import type { CampaignStatus } from '@/features/campaigns/types'

import { extractArticlePreview } from '../api/mappers'
import type { CampaignArticleAssignment, LibraryArticle } from '../types'
import { filterSelectableArticlesForCampaign } from '../validation'

type Props = {
  mode: 'create' | 'edit'
  campaignStatus: CampaignStatus
  resolvedTags: ResolvedActionTagPlan[]
  availableArticles: LibraryArticle[]
  loadingArticles?: boolean
  /** In create mode: locally staged Article IDs in order. */
  selectedArticleIds?: string[]
  onChangeSelectedArticleIds?: (ids: string[]) => void
  /** In edit mode: persisted Campaign assignments from GET /campaigns/{id}/articles. */
  assignedRows?: CampaignArticleAssignment[]
  onAssignPersisted?: (articleIds: string[]) => Promise<void>
  onRemovePersisted?: (articleOrContentId: string) => Promise<void>
  busy?: boolean
  error?: string | null
}

export function CampaignArticleSelector({
  mode,
  campaignStatus,
  resolvedTags,
  availableArticles,
  loadingArticles = false,
  selectedArticleIds = [],
  onChangeSelectedArticleIds,
  assignedRows = [],
  onAssignPersisted,
  onRemovePersisted,
  busy = false,
  error = null,
}: Props) {
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  const isDraft = campaignStatus === 'draft'

  const alreadySelectedOrAssigned = useMemo(() => {
    const set = new Set<string>(selectedArticleIds)
    for (const r of assignedRows) {
      if (r.article_id) set.add(r.article_id)
    }
    return set
  }, [selectedArticleIds, assignedRows])

  const campaignTagScope = useMemo(
    () => ({
      site_key: resolvedTags[0]?.site_key ?? '',
      action_tags: resolvedTags.map((t) => ({
        action_tag_id: t.tag_id,
        action_tag_key: t.tag_key,
        site_key: t.site_key,
        site_name: t.site_name,
        cms_type: t.cms_type,
        script_package_key: t.effective_script?.package_key ?? '',
        script_name: t.effective_script?.name ?? '',
        script_version: t.effective_script?.version ?? '',
        release_id: t.effective_script?.release_id ?? null,
        resolution_source: t.resolution_source,
        shortcode_mapping: null,
      })),
    }),
    [resolvedTags],
  )

  const selectable = useMemo(
    () =>
      filterSelectableArticlesForCampaign(
        availableArticles,
        campaignTagScope,
        alreadySelectedOrAssigned,
        {
          site_key: siteFilter === 'all' ? undefined : siteFilter,
          action_tag_key: tagFilter === 'all' ? undefined : tagFilter,
          search,
        },
      ),
    [
      availableArticles,
      campaignTagScope,
      alreadySelectedOrAssigned,
      siteFilter,
      tagFilter,
      search,
    ],
  )

  const selectedArticlesInOrder = useMemo(() => {
    const byId = new Map(availableArticles.map((a) => [a.id, a]))
    return selectedArticleIds
      .map((id) => byId.get(id))
      .filter((a): a is LibraryArticle => Boolean(a))
  }, [availableArticles, selectedArticleIds])

  const siteOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of resolvedTags) {
      if (t.site_key) map.set(t.site_key, t.site_name || t.site_key)
    }
    return Array.from(map.entries())
  }, [resolvedTags])

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAssignChecked = async () => {
    const idsToAdd = selectable
      .filter((a) => checkedIds.has(a.id) && !alreadySelectedOrAssigned.has(a.id))
      .map((a) => a.id)
    if (idsToAdd.length === 0) return

    if (mode === 'create') {
      onChangeSelectedArticleIds?.([...selectedArticleIds, ...idsToAdd])
      setCheckedIds(new Set())
      return
    }

    if (onAssignPersisted) {
      await onAssignPersisted(idsToAdd)
      setCheckedIds(new Set())
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Select Existing Articles
          </h3>
          <p className="text-xs text-muted">
            {isDraft
              ? 'Assign Articles from the Article Library matching this Campaign’s Site and Action Tags. Assigning Articles does not start the Campaign.'
              : 'Campaign is no longer in Draft. Assigned Article snapshots are locked and cannot be modified.'}
          </p>
        </div>
        <Badge variant="neutral">
          {mode === 'create'
            ? `${selectedArticlesInOrder.length} selected`
            : `${assignedRows.length} assigned`}
        </Badge>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {error}
        </div>
      ) : null}

      {isDraft ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted" />
              <Input
                className="pl-8"
                placeholder="Search compatible articles…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              aria-label="Filter compatible articles by Site"
              className="w-40"
              value={siteFilter}
              onChange={(e) => {
                setSiteFilter(e.target.value)
                setTagFilter('all')
              }}
            >
              <option value="all">All Sites</option>
              {siteOptions.map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter compatible articles by Action Tag"
              className="w-48"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
              <option value="all">All Action Tags</option>
              {resolvedTags
                .filter((t) => siteFilter === 'all' || t.site_key === siteFilter)
                .map((t) => (
                  <option key={t.tag_key} value={t.tag_key}>
                    {t.tag_key}
                  </option>
                ))}
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={busy || checkedIds.size === 0}
              onClick={() => void handleAssignChecked()}
            >
              <Plus className="size-3.5" />
              Assign Selected ({checkedIds.size})
            </Button>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-[var(--radius-control)] border border-border">
            {loadingArticles ? (
              <p className="p-3 text-xs text-muted">Loading compatible articles…</p>
            ) : selectable.length === 0 ? (
              <p className="p-3 text-xs text-muted">
                No compatible unassigned articles available for the selected Action Tags.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-muted/60 text-[11px] text-muted">
                  <tr>
                    <th className="w-8 px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="Select all visible compatible articles"
                        checked={
                          selectable.length > 0 &&
                          selectable.every((a) => checkedIds.has(a.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCheckedIds(new Set(selectable.map((a) => a.id)))
                          } else {
                            setCheckedIds(new Set())
                          }
                        }}
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">Article</th>
                    <th className="px-3 py-2 font-medium">Site</th>
                    <th className="px-3 py-2 font-medium">Action Tag</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selectable.map((article) => (
                    <tr key={article.id}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${article.title}`}
                          checked={checkedIds.has(article.id)}
                          onChange={() => toggleCheck(article.id)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">
                          {article.title}
                        </div>
                        <div className="line-clamp-1 text-[11px] text-muted">
                          {extractArticlePreview(article) || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2">{article.site_key ?? '—'}</td>
                      <td className="px-3 py-2 font-mono">
                        {article.action_tag_key}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={article.status === 'ready' ? 'success' : 'neutral'}
                        >
                          {article.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted">
          {mode === 'create' ? 'Selected Articles (Order Preserved)' : 'Assigned Articles'}
        </h4>
        {mode === 'create' ? (
          selectedArticlesInOrder.length === 0 ? (
            <p className="text-xs text-muted">
              No existing articles selected yet.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-[var(--radius-control)] border border-border">
              {selectedArticlesInOrder.map((art, idx) => (
                <li
                  key={art.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="mr-2 font-mono text-muted">#{idx + 1}</span>
                    <span className="font-medium text-foreground">{art.title}</span>
                    <span className="ml-2 font-mono text-[11px] text-muted">
                      {art.action_tag_key}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      onChangeSelectedArticleIds?.(
                        selectedArticleIds.filter((id) => id !== art.id),
                      )
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : assignedRows.length === 0 ? (
          <p className="text-xs text-muted">No articles assigned to this Campaign yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-[var(--radius-control)] border border-border">
            {assignedRows.map((row, idx) => (
              <li
                key={row.content_id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div>
                    <span className="mr-2 font-mono text-muted">
                      #{row.sort_order || idx + 1}
                    </span>
                    <span className="font-medium text-foreground">
                      {row.article_title || row.external_ref || row.content_id}
                    </span>
                    {row.action_tag_key ? (
                      <span className="ml-2 font-mono text-[11px] text-muted">
                        {row.action_tag_key}
                      </span>
                    ) : null}
                  </div>
                  {row.snapshot_at ? (
                    <div className="text-[11px] text-muted">
                      Pinned snapshot ({row.script_id} v{row.script_version})
                    </div>
                  ) : null}
                </div>
                {isDraft && onRemovePersisted ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void onRemovePersisted(row.article_id ?? row.content_id)
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
