import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import {
  formatVariantGroupApiError,
  type AddVariantInput,
  type PersistedVariantGroup,
  type UpdateVariantInput,
} from '../api/variant-groups-api'
import type { ScriptListItem } from '../types'
import { inferLanguageLabelFromScript } from '../variant-groups'

type Props = {
  group: PersistedVariantGroup
  scripts: ScriptListItem[]
  mutationsDisabled?: boolean
  onOpenDetails: (packageKey: string) => void
  onAddVariant: (groupId: string, input: AddVariantInput) => Promise<unknown>
  onUpdateVariant: (
    groupId: string,
    variantId: string,
    input: UpdateVariantInput,
  ) => Promise<unknown>
  onRemoveVariant: (groupId: string, variantId: string) => Promise<unknown>
  onReorderVariants: (groupId: string, variantIds: string[]) => Promise<unknown>
}

export function PersistedVariantGroupCard({
  group,
  scripts,
  mutationsDisabled = false,
  onOpenDetails,
  onAddVariant,
  onUpdateVariant,
  onRemoveVariant,
  onReorderVariants,
}: Props) {
  const [expanded, setExpanded] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingLabels, setEditingLabels] = useState<Record<string, string>>({})
  const [addingScriptKey, setAddingScriptKey] = useState('')
  const [addingLabel, setAddingLabel] = useState('')

  const compatibleAddableScripts = useMemo(() => {
    const existingPkgKeys = new Set(group.variants.map((v) => v.package_key))
    return scripts.filter((s) => {
      if (s.status !== 'published' || s.is_authentication) return false
      if (existingPkgKeys.has(s.package_key)) return false
      if (group.scope_type === 'cms_global') {
        const scope = s.global_scope || s.eligible_global_scope?.scope
        return (
          Boolean(scope) &&
          scope!.toLowerCase() === (group.global_scope_key ?? '').toLowerCase()
        )
      }
      return (
        Boolean(s.action_tag_key) &&
        s.action_tag_key!.toLowerCase() ===
          (group.action_tag_key ?? '').toLowerCase()
      )
    })
  }, [group, scripts])

  const effectiveAddKey = compatibleAddableScripts.some(
    (s) => s.package_key === addingScriptKey,
  )
    ? addingScriptKey
    : (compatibleAddableScripts[0]?.package_key ?? '')

  const runMutation = async (fn: () => Promise<unknown>) => {
    if (busy || mutationsDisabled) return
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err: unknown) {
      setError(formatVariantGroupApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleReorder = (variantId: string, direction: 'up' | 'down') => {
    const ids = group.variants.map((v) => v.id)
    const idx = ids.indexOf(variantId)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx === -1 || targetIdx < 0 || targetIdx >= ids.length) return
    const next = [...ids]
    const cur = next[idx]!
    next[idx] = next[targetIdx]!
    next[targetIdx] = cur
    void runMutation(() => onReorderVariants(group.id, next))
  }

  const handleSaveLabel = (variantId: string, currentLabel: string) => {
    const nextLabel = (editingLabels[variantId] ?? currentLabel)
      .trim()
      .toUpperCase()
    if (!nextLabel) {
      setError('Language label is required.')
      return
    }
    void runMutation(async () => {
      await onUpdateVariant(group.id, variantId, { language_label: nextLabel })
      setEditingLabels((prev) => {
        const copy = { ...prev }
        delete copy[variantId]
        return copy
      })
    })
  }

  const handleAddVariant = () => {
    const script = compatibleAddableScripts.find(
      (s) => s.package_key === effectiveAddKey,
    )
    if (!script) return
    const label = (addingLabel || inferLanguageLabelFromScript(script))
      .trim()
      .toUpperCase()
    if (!label) {
      setError('Language label is required.')
      return
    }
    void runMutation(async () => {
      await onAddVariant(group.id, {
        package_key: script.package_key,
        ...(script.release_id != null ? { release_id: script.release_id } : {}),
        script_version: script.version,
        language_label: label,
      })
      setAddingLabel('')
    })
  }

  const scopeLabel =
    group.scope_type === 'cms_global'
      ? group.global_scope_key || 'CMS Global'
      : group.action_tag_key || 'Site Action'

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
              <span>{group.name}</span>
            </button>
            <Badge
              variant={
                group.scope_type === 'cms_global' ? 'primary' : 'neutral'
              }
            >
              {group.scope_type === 'cms_global' ? 'CMS Global' : 'Site Action'}
            </Badge>
            <Badge variant="neutral">{group.variants.length} variants</Badge>
          </div>
          <p className="text-xs text-muted">
            Scope: <span className="font-medium text-foreground">{scopeLabel}</span>
            {group.variants.length > 0
              ? ` · Fallback: ${group.variants.map((v) => v.language_label).join(' → ')}`
              : ''}
          </p>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {error}
        </div>
      ) : null}

      {expanded ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-[var(--radius-control)] border border-border">
            <table className="w-full min-w-[44rem] text-left text-xs">
              <thead className="border-b border-border bg-surface-muted/60 text-[11px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Language</th>
                  <th className="px-3 py-2 font-medium">Script</th>
                  <th className="px-3 py-2 font-medium">Pinned Release</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {group.variants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-muted">
                      No variants in this group yet.
                    </td>
                  </tr>
                ) : (
                  group.variants.map((v, idx) => {
                    const draftLabel = editingLabels[v.id] ?? v.language_label
                    const labelDirty =
                      v.id in editingLabels &&
                      draftLabel.trim().toUpperCase() !== v.language_label
                    return (
                      <tr key={v.id}>
                        <td className="px-3 py-2 font-mono font-semibold">
                          #{v.priority}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Input
                              aria-label={`Language label for ${v.script_name || v.package_key}`}
                              className="h-7 w-20 font-mono text-xs uppercase"
                              disabled={busy || mutationsDisabled}
                              value={draftLabel}
                              onChange={(e) =>
                                setEditingLabels((prev) => ({
                                  ...prev,
                                  [v.id]: e.target.value,
                                }))
                              }
                            />
                            {labelDirty ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy || mutationsDisabled}
                                aria-label={`Save language label for ${v.script_name || v.package_key}`}
                                onClick={() =>
                                  handleSaveLabel(v.id, v.language_label)
                                }
                              >
                                <Check className="size-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-medium text-foreground">
                          {v.script_name || v.package_key}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          v{v.script_version || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy || mutationsDisabled || idx === 0}
                              aria-label={`Move ${v.language_label} up`}
                              onClick={() => handleReorder(v.id, 'up')}
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                busy ||
                                mutationsDisabled ||
                                idx === group.variants.length - 1
                              }
                              aria-label={`Move ${v.language_label} down`}
                              onClick={() => handleReorder(v.id, 'down')}
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-danger"
                              disabled={busy || mutationsDisabled}
                              aria-label={`Remove ${v.language_label}`}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `Remove variant "${v.language_label}" (${v.script_name || v.package_key}) from "${group.name}"?`,
                                  )
                                ) {
                                  return
                                }
                                void runMutation(() =>
                                  onRemoveVariant(group.id, v.id),
                                )
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
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
                  })
                )}
              </tbody>
            </table>
          </div>

          {!mutationsDisabled && compatibleAddableScripts.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius-control)] border border-border bg-surface-muted/30 p-2.5">
              <div className="min-w-[14rem] flex-1">
                <Select
                  aria-label="Add compatible script variant"
                  disabled={busy}
                  value={effectiveAddKey}
                  onChange={(e) => setAddingScriptKey(e.target.value)}
                >
                  {compatibleAddableScripts.map((s) => (
                    <option key={s.package_key} value={s.package_key}>
                      {s.name} (v{s.version})
                    </option>
                  ))}
                </Select>
              </div>
              <Input
                aria-label="New variant language label"
                className="h-8 w-28 font-mono text-xs uppercase"
                placeholder="EN / JA"
                disabled={busy}
                value={addingLabel}
                onChange={(e) => setAddingLabel(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !effectiveAddKey}
                onClick={handleAddVariant}
              >
                <Plus className="size-3.5" />
                Add Variant
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
