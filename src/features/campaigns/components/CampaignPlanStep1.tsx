import { useMemo, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type {
  ActionTagItem,
  CmsTypeItem,
  PathItem,
  Site,
} from '@/features/action-tags/types'
import type { ScriptListItem } from '@/features/script-registry/types'

import {
  filterSelectableCampaignTags,
  type ResolvedActionTagPlan,
} from '../multi-tag-plan'
import type { CampaignRunMode } from '../types'

type Props = {
  name: string
  onNameChange: (name: string) => void
  runMode: CampaignRunMode
  onRunModeChange: (mode: CampaignRunMode) => void
  selectedTagKeys: string[]
  onSelectedTagKeysChange: (keys: string[]) => void
  tags: ActionTagItem[]
  sites: Site[]
  paths: PathItem[]
  cmsTypes: CmsTypeItem[]
  scripts: ScriptListItem[]
  resolvedTags: ResolvedActionTagPlan[]
  loading?: boolean
  disabled?: boolean
}

function resolutionBadge(source: ResolvedActionTagPlan['resolution_source']) {
  switch (source) {
    case 'site_specific':
      return <Badge variant="primary">site_specific</Badge>
    case 'cms_global':
      return <Badge variant="success">cms_global</Badge>
    case 'missing':
      return <Badge variant="warning">missing</Badge>
  }
}

export function CampaignPlanStep1({
  name,
  onNameChange,
  runMode,
  onRunModeChange,
  selectedTagKeys,
  onSelectedTagKeysChange,
  tags,
  sites,
  paths,
  cmsTypes,
  scripts,
  resolvedTags,
  loading = false,
  disabled = false,
}: Props) {
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('')

  const selectedSet = useMemo(
    () => new Set(selectedTagKeys),
    [selectedTagKeys],
  )

  const filteredCatalog = useMemo(
    () =>
      filterSelectableCampaignTags({
        tags,
        sites,
        paths,
        cmsTypes,
        scripts,
        search,
        siteFilter,
      }),
    [tags, sites, paths, cmsTypes, scripts, search, siteFilter],
  )

  const toggleTag = (tagKey: string) => {
    if (selectedSet.has(tagKey)) {
      onSelectedTagKeysChange(selectedTagKeys.filter((k) => k !== tagKey))
    } else {
      onSelectedTagKeysChange([...selectedTagKeys, tagKey])
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Step 1 — Campaign Plan
          </h2>
          <p className="text-xs text-muted">
            Plan your Campaign across one or more Action Tags. Resource
            allocation (Clients, Accounts, Browser Profiles) happens later
            during Run.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
          <div className="space-y-1.5">
            <Label htmlFor="v2_campaign_name">Campaign Name</Label>
            <Input
              id="v2_campaign_name"
              disabled={disabled}
              placeholder="e.g. Multi-site WordPress Launch"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v2_run_mode">Run Mode</Label>
            <Select
              id="v2_run_mode"
              disabled={disabled}
              value={runMode}
              onChange={(e) =>
                onRunModeChange(e.target.value === 'test' ? 'test' : 'live')
              }
            >
              <option value="live">Live (Production)</option>
              <option value="test">Test Mode</option>
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Action Tags ({selectedTagKeys.length} selected)
            </h3>
            <p className="text-xs text-muted">
              Select Tags across different Sites and CMS platforms. Script
              resolution follows{' '}
              <code className="font-mono">site_specific &gt; cms_global &gt; missing</code>.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted" />
            <Input
              className="pl-8"
              disabled={disabled}
              placeholder="Search tags by key, site, CMS, or script…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            disabled={disabled}
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
          >
            <option value="">All Sites</option>
            {sites.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name} ({s.key})
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <p className="text-xs text-muted">Loading Action Tags &amp; Scripts…</p>
        ) : filteredCatalog.length === 0 ? (
          <p className="text-xs text-muted">
            No Action Tags match the current filter.
          </p>
        ) : (
          <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-[var(--radius-control)] border border-border">
            {filteredCatalog.map(({ tag, resolved }) => {
              const isSelected = selectedSet.has(tag.tag_key)
              return (
                <div
                  key={tag.tag_key}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-surface-muted/50"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono font-medium text-foreground">
                        {tag.tag_key}
                      </span>
                      <Badge variant={tag.enabled ? 'success' : 'neutral'}>
                        {tag.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      {resolutionBadge(resolved.resolution_source)}
                    </div>
                    <p className="text-[11px] text-muted">
                      {resolved.site_name} ({resolved.site_key}) ·{' '}
                      {resolved.cms_type ? `CMS: ${resolved.cms_type}` : 'Custom / Non-CMS'}
                      {resolved.effective_script
                        ? ` · Script: ${resolved.effective_script.name} v${resolved.effective_script.version}`
                        : ' · No published Script'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    disabled={disabled}
                    onClick={() => toggleTag(tag.tag_key)}
                  >
                    {isSelected ? (
                      'Selected'
                    ) : (
                      <>
                        <Plus className="size-3.5" />
                        Select
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Script Resolution Preview ({resolvedTags.length})
        </h3>
        {resolvedTags.length === 0 ? (
          <p className="text-xs text-muted">
            No Action Tags selected yet. Select one or more Tags above to
            preview resolved Script Releases.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-control)] border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-muted/60 text-[11px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Site</th>
                  <th className="px-3 py-2 font-medium">CMS / Platform</th>
                  <th className="px-3 py-2 font-medium">Action Tag</th>
                  <th className="px-3 py-2 font-medium">Effective Script</th>
                  <th className="px-3 py-2 font-medium">Release / Version</th>
                  <th className="px-3 py-2 font-medium">Resolution</th>
                  <th className="px-3 py-2 font-medium text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {resolvedTags.map((row) => (
                  <tr key={row.tag_key}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">
                        {row.site_name}
                      </div>
                      <div className="font-mono text-[11px] text-muted">
                        {row.site_key}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {row.cms_type ?? 'Custom'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-mono text-foreground">
                          {row.tag_key}
                        </span>
                        {!row.tag_enabled ? (
                          <Badge variant="neutral">Disabled</Badge>
                        ) : null}
                      </div>
                      {row.status_reason ? (
                        <p className="mt-0.5 text-[11px] text-warning">
                          {row.status_reason}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {row.effective_script ? (
                        <div>
                          <div className="font-medium text-foreground">
                            {row.effective_script.name}
                          </div>
                          <div className="font-mono text-[11px] text-muted">
                            {row.effective_script.package_key}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {row.effective_script ? (
                        <span>
                          v{row.effective_script.version}
                          {row.effective_script.release_id
                            ? ` (#${row.effective_script.release_id})`
                            : ''}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {resolutionBadge(row.resolution_source)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        disabled={disabled}
                        aria-label={`Remove ${row.tag_key}`}
                        onClick={() => toggleTag(row.tag_key)}
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
      </section>
    </div>
  )
}
