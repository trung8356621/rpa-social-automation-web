import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import {
  type BackendPersistenceSupport,
  type PlannedContentItem,
  type ResolvedActionTagPlan,
  type SchemaMappingGroup,
  type V2CampaignDraftPlanPayload,
} from '../multi-tag-plan'
import {
  allScriptVariables,
  buildAutoShortcodeMapping,
  type ShortcodeMappingFormEntry,
} from '../shortcode-mapping'
import type { CampaignRunMode } from '../types'

type Props = {
  name: string
  runMode: CampaignRunMode
  resolvedTags: ResolvedActionTagPlan[]
  groups: SchemaMappingGroup[]
  historicalMappingsByTagKey?: Record<string, ShortcodeMappingFormEntry[]>
  contents: PlannedContentItem[]
  persistenceSupport: BackendPersistenceSupport
  draftPreviewPayload: V2CampaignDraftPlanPayload | null
}

export function CampaignContentStep2({
  name,
  runMode,
  resolvedTags,
  groups,
  historicalMappingsByTagKey,
  contents,
  persistenceSupport,
  draftPreviewPayload,
}: Props) {
  const [showPayload, setShowPayload] = useState(false)
  const runnableTags = resolvedTags.filter((t) => t.is_runnable)

  return (
    <div className="space-y-5">
      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Step 2 — Automatic Script Variable Mapping
          </h2>
          <p className="text-xs text-muted">
            All declared variables from each pinned Script Release are mapped
            automatically (<code className="font-mono">[variable]</code> &rarr;{' '}
            <code className="font-mono">variable</code>). Tags sharing a
            compatible schema reuse one mapping group.
          </p>
        </div>

        <div className="space-y-3">
          {groups.map((group) => {
            const auto = buildAutoShortcodeMapping(group.schema)
            const vars = allScriptVariables(group.schema)
            const hasHistoricalMismatch =
              historicalMappingsByTagKey &&
              auto.ok &&
              group.tag_keys.some((tk) => {
                const hist = historicalMappingsByTagKey[tk]
                if (!hist?.length) return false
                return hist.some(
                  (h) => h.shortcode.trim() !== h.variable.trim(),
                )
              })

            return (
              <div
                key={group.group_key}
                className="rounded-[var(--radius-control)] border border-border p-3 space-y-2"
              >
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

                {group.loading ? (
                  <p className="text-xs text-muted">
                    Loading published Script variables…
                  </p>
                ) : !auto.ok ? (
                  <p className="text-xs text-danger whitespace-pre-wrap">
                    {group.error || auto.error}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {vars.map((v) => (
                      <Badge key={v.key} variant="neutral">
                        <span className="font-mono">[{v.key}]</span>
                        <span className="ml-1 opacity-75">
                          ({v.type}
                          {v.required ? ', required' : ''})
                        </span>
                      </Badge>
                    ))}
                  </div>
                )}

                {hasHistoricalMismatch ? (
                  <p className="text-[11px] text-warning">
                    Existing manual mapping detected on this Draft. Existing
                    Content text is preserved; saving uses name-based{' '}
                    <code className="font-mono">[variable]</code> mappings.
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
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
          <div className="sm:col-span-2">
            <span className="text-muted">Preserved Contents:</span>{' '}
            <span className="font-medium text-foreground">
              {contents.length} item(s)
            </span>{' '}
            <span className="text-muted">
              (Add, edit, or bulk-generate mock Articles on the Articles page.)
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
