import { useMemo, useState } from 'react'
import { Sparkles, X } from 'lucide-react'

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
import {
  resolveActionTagWithPin,
  scriptTargetKey,
} from '@/features/campaigns/multi-tag-plan'
import { unavailableScriptInputSchema } from '@/features/campaigns/script-compat'
import type { ScriptInputSchema } from '@/features/campaigns/types'
import { useMultiScriptSchemas } from '@/features/campaigns/use-multi-script-schemas'
import type { ScriptDetail, ScriptListItem } from '@/features/script-registry/types'

import {
  buildBulkMockArticleDrafts,
  runBulkMockCreate,
  type BulkMockDraftItem,
} from '../bulk-mock'
import type { SaveLibraryArticleInput } from '../types'

const PRESET_COUNTS = [5, 10, 20, 50] as const

type Props = {
  open: boolean
  onClose: () => void
  sites: Site[]
  paths: PathItem[]
  selectableTags: ActionTagItem[]
  cmsTypes: CmsTypeItem[]
  scripts: ScriptListItem[]
  scriptDetails: Record<string, ScriptDetail>
  getMockSchema: (packageKey: string) => ScriptInputSchema
  existingRefs: string[]
  onCreateArticle: (input: SaveLibraryArticleInput) => Promise<unknown>
}

export function BulkMockArticleModal({
  open,
  onClose,
  sites,
  paths,
  selectableTags,
  cmsTypes,
  scripts,
  scriptDetails,
  getMockSchema,
  existingRefs,
  onCreateArticle,
}: Props) {
  const [siteKey, setSiteKey] = useState<string>(sites[0]?.key ?? '')
  const [tagKey, setTagKey] = useState<string>(selectableTags[0]?.tag_key ?? '')
  const [count, setCount] = useState<number>(5)
  const [drafts, setDrafts] = useState<BulkMockDraftItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const siteByKey = useMemo(
    () => new Map(sites.map((s) => [s.key, s])),
    [sites],
  )

  const tagsForSite = useMemo(() => {
    if (!siteKey) return selectableTags
    return selectableTags.filter((t) => t.site_key === siteKey)
  }, [selectableTags, siteKey])

  const effectiveTagKey = tagsForSite.some((t) => t.tag_key === tagKey)
    ? tagKey
    : (tagsForSite[0]?.tag_key ?? '')

  const resolvedTag = useMemo(() => {
    const tag = selectableTags.find((t) => t.tag_key === effectiveTagKey)
    if (!tag) return null
    return resolveActionTagWithPin(
      tag,
      undefined,
      siteByKey.get(tag.site_key),
      scripts,
      { paths, cmsTypes },
    )
  }, [selectableTags, effectiveTagKey, siteByKey, scripts, paths, cmsTypes])

  const schemaTargets = useMemo(() => {
    if (!resolvedTag?.effective_script) return []
    return [
      {
        packageKey: resolvedTag.effective_script.package_key,
        scriptVersion: resolvedTag.effective_script.version,
      },
    ]
  }, [resolvedTag])

  const schemaLookup = useMultiScriptSchemas({
    targets: schemaTargets,
    cachedDetails: scriptDetails,
    getMockSchema,
  })

  const schemaEntry = resolvedTag?.effective_script
    ? schemaLookup[
        scriptTargetKey(
          resolvedTag.effective_script.package_key,
          resolvedTag.effective_script.version,
        )
      ] ?? null
    : null

  const activeSchema =
    schemaEntry?.schema ??
    unavailableScriptInputSchema(
      null,
      'Select an Action Tag with a published Script.',
    )

  if (!open) return null

  const handleGeneratePreview = () => {
    setError(null)
    if (!resolvedTag) {
      setError('Select a Site and Action Tag first.')
      return
    }
    if (!resolvedTag.is_runnable || !resolvedTag.effective_script) {
      setError(
        resolvedTag.status_reason ||
          `Action Tag "${resolvedTag.tag_key}" does not have a published Script.`,
      )
      return
    }
    if (schemaEntry?.loading) {
      setError('Script variable schema is still loading. Please wait.')
      return
    }
    if (!activeSchema.schema_available) {
      setError(
        activeSchema.unavailable_reason ||
          'Script variable schema is unavailable for this Action Tag.',
      )
      return
    }

    const result = buildBulkMockArticleDrafts({
      tag: resolvedTag,
      schema: activeSchema,
      count,
      existingRefs,
    })

    if (!result.ok) {
      setError(result.message)
      return
    }
    setDrafts(result.items)
  }

  const handleConfirmSave = async () => {
    if (busy || drafts.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const summary = await runBulkMockCreate(
        drafts,
        onCreateArticle,
        (updated) => setDrafts(updated),
      )
      if (summary.failedCount > 0) {
        setError(
          `Created ${summary.createdCount} article(s), ${summary.failedCount} failed. Click "Retry Failed" to retry only failed items.`,
        )
      }
    } finally {
      setBusy(false)
    }
  }

  const createdCount = drafts.filter((d) => d.status === 'created').length
  const failedCount = drafts.filter((d) => d.status === 'failed').length
  const pendingCount = drafts.filter((d) => d.status === 'pending').length
  const savingIdx = drafts.findIndex((d) => d.status === 'saving')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[var(--radius-card)] border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">
              Bulk Mock Article Generator
            </h2>
            <p className="text-xs text-muted">
              Generate independent mock Articles for a selected Site and Action
              Tag. Does not create or start any Campaign.
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-mock-site">Site</Label>
              <Select
                id="bulk-mock-site"
                disabled={busy}
                value={siteKey}
                onChange={(e) => {
                  const nextSite = e.target.value
                  setSiteKey(nextSite)
                  const firstTag = selectableTags.find(
                    (t) => !nextSite || t.site_key === nextSite,
                  )
                  setTagKey(firstTag?.tag_key ?? '')
                  setDrafts([])
                  setError(null)
                }}
              >
                <option value="">All Sites</option>
                {sites.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulk-mock-tag">Action Tag (1 per Article)</Label>
              <Select
                id="bulk-mock-tag"
                disabled={busy || tagsForSite.length === 0}
                value={effectiveTagKey}
                onChange={(e) => {
                  setTagKey(e.target.value)
                  setDrafts([])
                  setError(null)
                }}
              >
                {tagsForSite.length === 0 ? (
                  <option value="">No Action Tags</option>
                ) : null}
                {tagsForSite.map((t) => (
                  <option key={t.tag_key} value={t.tag_key}>
                    {t.tag_key}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulk-mock-count">Article Count</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="bulk-mock-count"
                  type="number"
                  min={1}
                  max={100}
                  disabled={busy}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {PRESET_COUNTS.map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={count === n ? 'default' : 'outline'}
                    disabled={busy}
                    onClick={() => setCount(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !effectiveTagKey}
              onClick={handleGeneratePreview}
            >
              <Sparkles className="size-3.5" />
              Generate Preview
            </Button>

            {drafts.length > 0 ? (
              <div className="text-xs text-muted">
                {busy && savingIdx >= 0
                  ? `Saving ${savingIdx + 1} / ${drafts.length}…`
                  : `${drafts.length} generated · ${createdCount} created · ${failedCount} failed`}
              </div>
            ) : null}
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {error}
            </div>
          ) : null}

          {drafts.length > 0 ? (
            <div className="max-h-72 overflow-y-auto rounded-[var(--radius-control)] border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-muted/60 text-[11px] text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Title / Preview</th>
                    <th className="px-3 py-2 font-medium">External Ref</th>
                    <th className="px-3 py-2 font-medium">Action Tag</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {drafts.map((item, idx) => (
                    <tr key={item.key}>
                      <td className="px-3 py-2 font-mono text-muted">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">
                          {item.previewTitle}
                        </div>
                        {item.previewBody ? (
                          <div className="line-clamp-1 text-[11px] text-muted">
                            {item.previewBody}
                          </div>
                        ) : null}
                        {item.error ? (
                          <div className="mt-0.5 text-[11px] text-danger">
                            {item.error}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted">
                        {item.payload.external_ref ?? '—'}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {item.payload.action_tag_key}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            item.status === 'created'
                              ? 'success'
                              : item.status === 'failed'
                                ? 'danger'
                                : item.status === 'saving'
                                  ? 'primary'
                                  : 'neutral'
                          }
                        >
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-[var(--radius-control)] border border-border bg-surface-muted/30 p-4 text-center text-xs text-muted">
              Choose Site, Action Tag, and Count, then click &ldquo;Generate
              Preview&rdquo; to inspect mock Articles before saving.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onClose}
          >
            Close
          </Button>
          {failedCount > 0 ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void handleConfirmSave()}
            >
              {busy ? 'Retrying…' : `Retry Failed (${failedCount})`}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={busy || pendingCount === 0}
              onClick={() => void handleConfirmSave()}
            >
              {busy
                ? 'Creating…'
                : `Confirm & Create (${pendingCount})`}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
