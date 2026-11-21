import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  createPlannedContentItem,
  type BackendPersistenceSupport,
  type PlannedContentItem,
  type ResolvedActionTagPlan,
  type SchemaMappingGroup,
  type V2CampaignDraftPlanPayload,
} from '../multi-tag-plan'
import type { ShortcodeMappingFormEntry } from '../shortcode-mapping'
import type { CampaignRunMode, CampaignShortcodeMapping } from '../types'
import { ShortcodeArticleEditor } from './ShortcodeArticleEditor'
import { ShortcodeMappingFields } from './ShortcodeMappingFields'

type Props = {
  name: string
  runMode: CampaignRunMode
  resolvedTags: ResolvedActionTagPlan[]
  groups: SchemaMappingGroup[]
  mappingsByGroupKey: Record<string, ShortcodeMappingFormEntry[]>
  onMappingChange: (groupKey: string, next: ShortcodeMappingFormEntry[]) => void
  contents: PlannedContentItem[]
  onContentsChange: (next: PlannedContentItem[]) => void
  persistenceSupport: BackendPersistenceSupport
  draftPreviewPayload: V2CampaignDraftPlanPayload | null
  disabled?: boolean
}

function toCampaignShortcodeMapping(
  entries: ShortcodeMappingFormEntry[],
): CampaignShortcodeMapping {
  return {
    entries: entries
      .map((e) => ({
        shortcode: e.shortcode.trim(),
        variable: e.variable.trim(),
      }))
      .filter((e) => e.shortcode && e.variable),
  }
}

export function CampaignContentStep2({
  name,
  runMode,
  resolvedTags,
  groups,
  mappingsByGroupKey,
  onMappingChange,
  contents,
  onContentsChange,
  persistenceSupport,
  draftPreviewPayload,
  disabled = false,
}: Props) {
  const [showPayload, setShowPayload] = useState(false)

  const tagToGroup = useMemo(() => {
    const map = new Map<string, SchemaMappingGroup>()
    for (const g of groups) {
      for (const tk of g.tag_keys) map.set(tk, g)
    }
    return map
  }, [groups])

  const runnableTags = useMemo(
    () => resolvedTags.filter((t) => t.is_runnable),
    [resolvedTags],
  )

  const addContent = () => {
    const defaultTag = runnableTags[0]?.tag_key
    onContentsChange([
      ...contents,
      createPlannedContentItem({
        external_ref: `post-${contents.length + 1}`,
        target_tag_keys: defaultTag ? [defaultTag] : [],
      }),
    ])
  }

  const removeContent = (id: string) => {
    onContentsChange(contents.filter((c) => c.id !== id))
  }

  const patchContent = (id: string, partial: Partial<PlannedContentItem>) => {
    onContentsChange(
      contents.map((c) => (c.id === id ? { ...c, ...partial } : c)),
    )
  }

  const toggleContentTag = (item: PlannedContentItem, tagKey: string) => {
    const exists = item.target_tag_keys.includes(tagKey)
    const next = exists
      ? item.target_tag_keys.filter((k) => k !== tagKey)
      : [...item.target_tag_keys, tagKey]
    patchContent(item.id, { target_tag_keys: next })
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Step 2 — Shortcode Mapping by Script Schema
          </h2>
          <p className="text-xs text-muted">
            Tags with compatible published Script schemas share a single mapping
            configuration. Tags with different schemas are configured
            separately.
          </p>
        </div>

        <div className="space-y-4">
          {groups.map((group) => (
            <div
              key={group.group_key}
              className="rounded-[var(--radius-control)] border border-border p-3 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      {group.script_name}
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      {group.script_package_key} · v{group.script_version}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[11px] text-muted">Tags:</span>
                    {group.tag_keys.map((tk) => (
                      <Badge key={tk} variant="neutral">
                        {tk}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <ShortcodeMappingFields
                value={mappingsByGroupKey[group.group_key] ?? []}
                onChange={(next) => onMappingChange(group.group_key, next)}
                schema={group.schema}
                schemaLoading={group.loading}
                schemaError={group.error}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Content Items ({contents.length})
            </h3>
            <p className="text-xs text-muted">
              Add one or more Content items and assign each to specific Action
              Tags. Zero Contents is also allowed for Draft creation.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || runnableTags.length === 0}
            onClick={addContent}
          >
            <Plus className="size-3.5" />
            Add Content
          </Button>
        </div>

        {contents.length === 0 ? (
          <p className="text-xs text-muted">
            No Content items added yet. You can save as a Draft with zero
            Contents or click &ldquo;Add Content&rdquo; to plan Content now.
          </p>
        ) : (
          <div className="space-y-4">
            {contents.map((item, idx) => {
              const targetGroups = Array.from(
                new Set(
                  item.target_tag_keys
                    .map((tk) => tagToGroup.get(tk))
                    .filter((g): g is SchemaMappingGroup => Boolean(g)),
                ),
              )
              const hasMixedSchemas = targetGroups.length > 1
              const activeGroup = targetGroups[0] ?? groups[0]
              const activeMapping = activeGroup
                ? toCampaignShortcodeMapping(
                    mappingsByGroupKey[activeGroup.group_key] ?? [],
                  )
                : { entries: [] }

              return (
                <div
                  key={item.id}
                  className="rounded-[var(--radius-control)] border border-border p-3 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Content #{idx + 1}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      disabled={disabled}
                      onClick={() => removeContent(item.id)}
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`cref_${item.id}`}>
                      External Ref / Label
                    </Label>
                    <Input
                      id={`cref_${item.id}`}
                      disabled={disabled}
                      placeholder={`post-${idx + 1}`}
                      value={item.external_ref}
                      onChange={(e) =>
                        patchContent(item.id, { external_ref: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Target Action Tags</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {runnableTags.map((t) => {
                        const checked = item.target_tag_keys.includes(
                          t.tag_key,
                        )
                        return (
                          <button
                            key={t.tag_key}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleContentTag(item, t.tag_key)}
                            className={`rounded-[var(--radius-control)] border px-2.5 py-1 text-xs transition ${
                              checked
                                ? 'border-primary bg-primary/10 font-medium text-primary'
                                : 'border-border bg-surface text-muted hover:text-foreground'
                            }`}
                          >
                            <span className="font-mono">{t.tag_key}</span>
                            {t.effective_script ? (
                              <span className="ml-1 text-[10px] opacity-80">
                                ({t.effective_script.package_key} v
                                {t.effective_script.version})
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                    {item.target_tag_keys.length === 0 ? (
                      <p className="text-[11px] text-warning">
                        Select at least one target Action Tag for this Content.
                      </p>
                    ) : hasMixedSchemas ? (
                      <p className="text-[11px] text-danger">
                        Selected Tags have different Script schemas. Split into
                        separate Content items per compatible schema group.
                      </p>
                    ) : null}
                  </div>

                  {activeMapping.entries.length > 0 ? (
                    <ShortcodeArticleEditor
                      key={`${item.id}-${activeGroup?.group_key ?? 'none'}`}
                      rawSource={item.raw_source}
                      mapping={activeMapping}
                      disabled={disabled}
                      onChange={(raw_source) =>
                        patchContent(item.id, { raw_source })
                      }
                    />
                  ) : (
                    <p className="text-xs text-warning">
                      Configure at least one Shortcode Mapping entry above
                      before editing Content source.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Review &amp; Draft Persistence
        </h3>
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted">Campaign Name:</span>{' '}
            <span className="font-medium text-foreground">{name || '—'}</span>
          </div>
          <div>
            <span className="text-muted">Initial State:</span>{' '}
            <Badge variant="neutral">draft (no auto-Start)</Badge>
          </div>
          <div>
            <span className="text-muted">Run Mode:</span>{' '}
            <span className="font-mono text-foreground">{runMode}</span>
          </div>
          <div>
            <span className="text-muted">Action Tags:</span>{' '}
            <span className="font-medium text-foreground">
              {runnableTags.length} runnable
            </span>
          </div>
        </div>

        <p className="text-[11px] text-muted">
          Saves as Draft only. Does not Start Campaign, create execution claims,
          or reserve Clients, Accounts, or Browser Profiles.
        </p>

            {!persistenceSupport.supported ? (
          <div className="rounded-[var(--radius-control)] border border-warning/50 bg-warning/10 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-foreground">
                  Plan Cannot Be Saved Yet
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-muted">
                  {persistenceSupport.blockers.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : draftPreviewPayload ? (
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowPayload((v) => !v)}
            >
              {showPayload
                ? 'Hide V2 Draft Payload'
                : 'Inspect V2 Draft Payload'}
            </Button>
            {showPayload ? (
              <pre className="mt-2 max-h-60 overflow-auto rounded-[var(--radius-control)] border border-border bg-surface p-2 font-mono text-[11px] text-foreground">
                {JSON.stringify(draftPreviewPayload, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
