import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { formatGlobalConflictLabel } from '../sharing'
import {
  removeVariantFromGroup,
  reorderVariantPriority,
  setVariantLanguageLabel,
  validateVariantLanguageLabels,
  type ScriptVariantGroup,
  type ScriptVariantItem,
} from '../variant-groups'

type Props = {
  group: ScriptVariantGroup
  mode: 'mock' | 'live'
  onOpenDetails: (packageKey: string) => void
  onVariantsChange?: (groupKey: string, variants: ScriptVariantItem[]) => void
}

export function ScriptVariantGroupCard({
  group,
  mode,
  onOpenDetails,
  onVariantsChange,
}: Props) {
  const [expanded, setExpanded] = useState(true)
  const [localVariants, setLocalVariants] = useState<ScriptVariantItem[]>(
    group.variants,
  )

  const variants = onVariantsChange ? group.variants : localVariants
  const isReadOnly = mode === 'live' || !group.backend_supported
  const langValidation = validateVariantLanguageLabels(variants)

  const applyUpdate = (next: ScriptVariantItem[]) => {
    if (onVariantsChange) {
      onVariantsChange(group.group_key, next)
    } else {
      setLocalVariants(next)
    }
  }

  return (
    <article className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary"
              aria-expanded={expanded}
              onClick={() => setExpanded((p) => !p)}
            >
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <span>{group.logical_action_label}</span>
            </button>
            <Badge variant="neutral">{variants.length} variants</Badge>
            <Badge
              variant={
                group.sharing_mode === 'cms_global' ? 'primary' : 'neutral'
              }
            >
              {group.sharing_mode === 'cms_global' ? 'CMS Global' : 'Site Specific'}
            </Badge>
            {isReadOnly ? (
              <Badge variant="warning">
                {mode === 'live' ? 'Read-only (LIVE)' : 'Preview'}
              </Badge>
            ) : null}
          </div>
          {group.scope ? (
            <p className="font-mono text-[11px] text-muted">
              scope: {group.scope} · fallback order:{' '}
              {variants.map((v) => v.language_label || '?').join(' → ')}
            </p>
          ) : null}
        </div>
      </div>

      {group.has_sharing_conflict ? (
        <div
          role="alert"
          className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          <span className="font-medium">CMS Global Conflict:</span> Backend
          currently enforces one <code className="font-mono">SaPackage</code>{' '}
          per <code className="font-mono">global_scope_key</code> (
          {group.scope ?? 'scope'}). Multi-language variant group persistence is
          not yet supported on the Backend API.
        </div>
      ) : null}

      {!langValidation.ok ? (
        <div
          role="alert"
          className="rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {langValidation.message}
        </div>
      ) : null}

      {expanded ? (
        <div className="overflow-x-auto rounded-[var(--radius-control)] border border-border">
          <table className="w-full min-w-[44rem] text-left text-xs">
            <thead className="border-b border-border bg-surface-muted/60 text-[11px] text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Language</th>
                <th className="px-3 py-2 font-medium">Script Identity</th>
                <th className="px-3 py-2 font-medium">Pinned Release</th>
                <th className="px-3 py-2 font-medium">Sharing / Conflict</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {variants.map((v, idx) => {
                const conflictLabel = formatGlobalConflictLabel(v.global_conflict)
                return (
                  <tr key={v.package_key}>
                    <td className="px-3 py-2 font-mono font-semibold">
                      #{v.fallback_priority}
                    </td>
                    <td className="px-3 py-2">
                      {mode === 'mock' ? (
                        <Input
                          aria-label={`Language label for ${v.package_key}`}
                          className="h-7 w-24 font-mono text-xs uppercase"
                          value={v.language_label}
                          onChange={(e) => {
                            const res = setVariantLanguageLabel(
                              variants,
                              v.package_key,
                              e.target.value,
                            )
                            applyUpdate(res.variants)
                          }}
                        />
                      ) : (
                        <Badge variant="neutral">{v.language_label}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{v.name}</div>
                      <div className="font-mono text-[11px] text-muted">
                        {v.package_key}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono">
                      v{v.version || '—'}
                      {v.release_id != null ? ` (#${v.release_id})` : ''}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          v.sharing_mode === 'cms_global' ? 'primary' : 'neutral'
                        }
                      >
                        {v.sharing_mode}
                      </Badge>
                      {conflictLabel ? (
                        <div className="mt-1 text-[11px] text-warning">
                          Conflict: {conflictLabel}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {mode === 'mock' ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={idx === 0}
                              aria-label={`Move ${v.language_label} up`}
                              onClick={() =>
                                applyUpdate(
                                  reorderVariantPriority(
                                    variants,
                                    v.package_key,
                                    'up',
                                  ),
                                )
                              }
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={idx === variants.length - 1}
                              aria-label={`Move ${v.language_label} down`}
                              onClick={() =>
                                applyUpdate(
                                  reorderVariantPriority(
                                    variants,
                                    v.package_key,
                                    'down',
                                  ),
                                )
                              }
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-danger"
                              disabled={variants.length <= 1}
                              aria-label={`Remove ${v.language_label} from group`}
                              onClick={() =>
                                applyUpdate(
                                  removeVariantFromGroup(
                                    variants,
                                    v.package_key,
                                  ),
                                )
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenDetails(v.package_key)}
                        >
                          Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  )
}
