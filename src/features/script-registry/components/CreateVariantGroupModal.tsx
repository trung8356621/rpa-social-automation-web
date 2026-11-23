import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

import {
  formatVariantGroupApiError,
  type CreateVariantGroupInput,
  type VariantGroupScopeType,
} from '../api/variant-groups-api'
import type { ScriptListItem } from '../types'
import { inferLanguageLabelFromScript } from '../variant-groups'

type Props = {
  open: boolean
  onClose: () => void
  scripts: ScriptListItem[]
  disabled?: boolean
  onCreate: (input: CreateVariantGroupInput) => Promise<unknown>
}

export function CreateVariantGroupModal({
  open,
  onClose,
  scripts,
  disabled = false,
  onCreate,
}: Props) {
  const publishedScripts = useMemo(
    () => scripts.filter((s) => s.status === 'published' && !s.is_authentication),
    [scripts],
  )

  const globalScopes = useMemo(() => {
    const map = new Map<string, { scope: string; cms_type?: string; path_key?: string }>()
    for (const s of publishedScripts) {
      const scope = s.global_scope || s.eligible_global_scope?.scope
      if (scope && !map.has(scope)) {
        map.set(scope, {
          scope,
          cms_type: s.eligible_global_scope?.cms_type ?? undefined,
          path_key: s.eligible_global_scope?.path_template ?? undefined,
        })
      }
    }
    return Array.from(map.values())
  }, [publishedScripts])

  const actionTagKeys = useMemo(() => {
    const set = new Set<string>()
    for (const s of publishedScripts) {
      if (s.action_tag_key) set.add(s.action_tag_key)
    }
    return Array.from(set)
  }, [publishedScripts])

  const [name, setName] = useState('')
  const [scopeType, setScopeType] = useState<VariantGroupScopeType>('cms_global')
  const [globalScopeKey, setGlobalScopeKey] = useState(
    globalScopes[0]?.scope ?? '',
  )
  const [actionTagKey, setActionTagKey] = useState(actionTagKeys[0] ?? '')
  const [selectedPackages, setSelectedPackages] = useState<
    Record<string, string>
  >({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveGlobalScope = globalScopes.some((g) => g.scope === globalScopeKey)
    ? globalScopeKey
    : (globalScopes[0]?.scope ?? '')

  const effectiveActionTag = actionTagKeys.includes(actionTagKey)
    ? actionTagKey
    : (actionTagKeys[0] ?? '')

  const compatibleScripts = useMemo(() => {
    if (scopeType === 'cms_global') {
      if (!effectiveGlobalScope) return []
      return publishedScripts.filter(
        (s) =>
          (s.global_scope || s.eligible_global_scope?.scope)?.toLowerCase() ===
          effectiveGlobalScope.toLowerCase(),
      )
    }
    if (!effectiveActionTag) return []
    return publishedScripts.filter(
      (s) => s.action_tag_key?.toLowerCase() === effectiveActionTag.toLowerCase(),
    )
  }, [publishedScripts, scopeType, effectiveGlobalScope, effectiveActionTag])

  if (!open) return null

  const toggleScript = (s: ScriptListItem) => {
    setSelectedPackages((prev) => {
      const next = { ...prev }
      if (s.package_key in next) {
        delete next[s.package_key]
      } else {
        next[s.package_key] = inferLanguageLabelFromScript(s)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    if (busy || disabled) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Group name is required.')
      return
    }

    const selectedList = compatibleScripts.filter(
      (s) => s.package_key in selectedPackages,
    )
    if (selectedList.length === 0) {
      setError('Select at least one compatible published Script.')
      return
    }

    const seenLabels = new Set<string>()
    const variants: CreateVariantGroupInput['variants'] = []
    for (let i = 0; i < selectedList.length; i++) {
      const s = selectedList[i]!
      const label = (selectedPackages[s.package_key] ?? '').trim().toUpperCase()
      if (!label) {
        setError(`Language label is required for ${s.name}.`)
        return
      }
      if (seenLabels.has(label)) {
        setError(
          `Duplicate language label "${label}". Each variant must have a unique language label.`,
        )
        return
      }
      seenLabels.add(label)
      variants.push({
        package_key: s.package_key,
        ...(s.release_id != null ? { release_id: s.release_id } : {}),
        script_version: s.version,
        language_label: label,
        priority: i + 1,
      })
    }

    const scopeInfo = globalScopes.find((g) => g.scope === effectiveGlobalScope)
    setBusy(true)
    setError(null)
    try {
      await onCreate({
        name: trimmedName,
        scope_type: scopeType,
        ...(scopeType === 'cms_global'
          ? {
              global_scope_key: effectiveGlobalScope,
              cms_type: scopeInfo?.cms_type,
              cms_path_key: scopeInfo?.path_key,
            }
          : {
              action_tag_key: effectiveActionTag,
            }),
        variants,
      })
      setName('')
      setSelectedPackages({})
      onClose()
    } catch (err: unknown) {
      setError(formatVariantGroupApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[var(--radius-card)] border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Create Variant Group</h2>
            <p className="text-xs text-muted">
              Group compatible published Scripts by language with explicit
              fallback priority.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {error ? (
            <div
              role="alert"
              className="rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="vg-name">Group Name</Label>
            <Input
              id="vg-name"
              placeholder="e.g. WordPress Create Post (Multi-Language)"
              disabled={busy}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vg-scope-type">Scope Type</Label>
              <Select
                id="vg-scope-type"
                disabled={busy}
                value={scopeType}
                onChange={(e) => {
                  setScopeType(e.target.value as VariantGroupScopeType)
                  setSelectedPackages({})
                  setError(null)
                }}
              >
                <option value="cms_global">CMS Global Scope</option>
                <option value="site_action">Site Action Tag</option>
              </Select>
            </div>

            {scopeType === 'cms_global' ? (
              <div className="space-y-1.5">
                <Label htmlFor="vg-global-scope">Global Action Scope</Label>
                <Select
                  id="vg-global-scope"
                  disabled={busy || globalScopes.length === 0}
                  value={effectiveGlobalScope}
                  onChange={(e) => {
                    setGlobalScopeKey(e.target.value)
                    setSelectedPackages({})
                    setError(null)
                  }}
                >
                  {globalScopes.length === 0 ? (
                    <option value="">No CMS Global eligible scripts</option>
                  ) : null}
                  {globalScopes.map((g) => (
                    <option key={g.scope} value={g.scope}>
                      {g.scope}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="vg-action-tag">Action Tag</Label>
                <Select
                  id="vg-action-tag"
                  disabled={busy || actionTagKeys.length === 0}
                  value={effectiveActionTag}
                  onChange={(e) => {
                    setActionTagKey(e.target.value)
                    setSelectedPackages({})
                    setError(null)
                  }}
                >
                  {actionTagKeys.length === 0 ? (
                    <option value="">No Action Tag scripts</option>
                  ) : null}
                  {actionTagKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Compatible Published Scripts &amp; Language Labels</Label>
            {compatibleScripts.length === 0 ? (
              <p className="rounded-[var(--radius-control)] border border-border p-3 text-xs text-muted">
                No compatible published Scripts found for the selected scope.
              </p>
            ) : (
              <div className="divide-y divide-border rounded-[var(--radius-control)] border border-border">
                {compatibleScripts.map((s) => {
                  const checked = s.package_key in selectedPackages
                  return (
                    <div
                      key={s.package_key}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                    >
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy}
                          onChange={() => toggleScript(s)}
                        />
                        <span className="font-medium text-foreground">
                          {s.name}
                        </span>
                        <span className="text-muted">v{s.version}</span>
                      </label>
                      {checked ? (
                        <Input
                          aria-label={`Language for ${s.name}`}
                          className="h-7 w-24 font-mono text-xs uppercase"
                          placeholder="VI / EN"
                          disabled={busy}
                          value={selectedPackages[s.package_key] ?? ''}
                          onChange={(e) =>
                            setSelectedPackages((prev) => ({
                              ...prev,
                              [s.package_key]: e.target.value,
                            }))
                          }
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || disabled}
            onClick={() => void handleSubmit()}
          >
            <Plus className="size-3.5" />
            {busy ? 'Creating…' : 'Create Group'}
          </Button>
        </div>
      </div>
    </div>
  )
}
