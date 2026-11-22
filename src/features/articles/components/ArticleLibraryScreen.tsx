import { useMemo, useState } from 'react'
import { Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type {
  ActionTagItem,
  CmsTypeItem,
  PathItem,
  Site,
} from '@/features/action-tags/types'
import { formatSchedulerTimestamp } from '@/features/campaigns/campaign-detail-view'
import {
  isSystemAuthenticationTag,
  resolveActionTagWithPin,
  scriptTargetKey,
} from '@/features/campaigns/multi-tag-plan'
import { unavailableScriptInputSchema } from '@/features/campaigns/script-compat'
import type { ScriptInputSchema } from '@/features/campaigns/types'
import { useMultiScriptSchemas } from '@/features/campaigns/use-multi-script-schemas'
import type { ScriptDetail, ScriptListItem } from '@/features/script-registry/types'
import { toSafeApiMessage } from '@/lib/api/errors'

import { extractArticlePreview } from '../api/mappers'
import type {
  ArticleStatus,
  LibraryArticle,
  SaveLibraryArticleInput,
} from '../types'
import { validateSaveLibraryArticle } from '../validation'

type Props = {
  articles: LibraryArticle[]
  loading: boolean
  error: string | null
  mode: 'mock' | 'live'
  sites: Site[]
  paths: PathItem[]
  tags: ActionTagItem[]
  cmsTypes: CmsTypeItem[]
  scripts: ScriptListItem[]
  scriptDetails: Record<string, ScriptDetail>
  getMockSchema: (packageKey: string) => ScriptInputSchema
  onCreate: (input: SaveLibraryArticleInput) => Promise<unknown>
  onUpdate: (id: string, input: SaveLibraryArticleInput) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
  onReload: () => void
}

function articleStatusBadge(status: ArticleStatus) {
  switch (status) {
    case 'ready':
      return { label: 'Ready', variant: 'success' as const }
    case 'draft':
      return { label: 'Draft', variant: 'neutral' as const }
    case 'archived':
      return { label: 'Archived', variant: 'warning' as const }
    default:
      return { label: String(status), variant: 'neutral' as const }
  }
}

export function ArticleLibraryScreen({
  articles,
  loading,
  error,
  mode,
  sites,
  paths,
  tags,
  cmsTypes,
  scripts,
  scriptDetails,
  getMockSchema,
  onCreate,
  onUpdate,
  onDelete,
  onReload,
}: Props) {
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState<LibraryArticle | null>(null)
  const [previewArticle, setPreviewArticle] = useState<LibraryArticle | null>(null)

  const [title, setTitle] = useState('')
  const [externalRef, setExternalRef] = useState('')
  const [status, setStatus] = useState<ArticleStatus>('ready')
  const [selectedSiteKey, setSelectedSiteKey] = useState('')
  const [selectedTagKey, setSelectedTagKey] = useState('')
  const [varValues, setVarValues] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const siteByKey = useMemo(
    () => new Map(sites.map((s) => [s.key, s])),
    [sites],
  )
  const selectableTags = useMemo(
    () =>
      tags.filter(
        (t) =>
          t.enabled !== false &&
          !isSystemAuthenticationTag(t, {
            site: siteByKey.get(t.site_key),
            paths,
            cmsTypes,
          }),
      ),
    [tags, siteByKey, paths, cmsTypes],
  )

  const tagsForSelectedSite = useMemo(() => {
    if (!selectedSiteKey) return selectableTags
    return selectableTags.filter((t) => t.site_key === selectedSiteKey)
  }, [selectableTags, selectedSiteKey])

  const resolvedSelectedTag = useMemo(() => {
    const tag = selectableTags.find((t) => t.tag_key === selectedTagKey)
    if (!tag) return null
    return resolveActionTagWithPin(
      tag,
      undefined,
      siteByKey.get(tag.site_key),
      scripts,
      { paths, cmsTypes },
    )
  }, [selectableTags, selectedTagKey, siteByKey, scripts, paths, cmsTypes])

  const schemaTargets = useMemo(() => {
    if (!resolvedSelectedTag?.effective_script) return []
    return [
      {
        packageKey: resolvedSelectedTag.effective_script.package_key,
        scriptVersion: resolvedSelectedTag.effective_script.version,
      },
    ]
  }, [resolvedSelectedTag])

  const schemaLookup = useMultiScriptSchemas({
    targets: schemaTargets,
    cachedDetails: scriptDetails,
    getMockSchema,
  })

  const activeSchemaEntry = resolvedSelectedTag?.effective_script
    ? schemaLookup[
        scriptTargetKey(
          resolvedSelectedTag.effective_script.package_key,
          resolvedSelectedTag.effective_script.version,
        )
      ] ?? null
    : null

  const activeSchema =
    activeSchemaEntry?.schema ??
    unavailableScriptInputSchema(
      null,
      'Select an Action Tag to load Script variables.',
    )

  const filteredArticles = useMemo(() => {
    const q = search.trim().toLowerCase()
    return articles.filter((a) => {
      if (siteFilter !== 'all' && a.site_key !== siteFilter) return false
      if (tagFilter !== 'all' && a.action_tag_key !== tagFilter) return false
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (q) {
        const preview = extractArticlePreview(a)
        const hay = [
          a.title,
          a.external_ref ?? '',
          a.action_tag_key,
          a.site_key ?? '',
          preview,
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [articles, search, siteFilter, tagFilter, statusFilter])

  const openCreate = () => {
    const firstTag = selectableTags[0]
    setEditingArticle(null)
    setTitle('')
    setExternalRef('')
    setStatus('ready')
    setSelectedSiteKey(firstTag?.site_key ?? sites[0]?.key ?? '')
    setSelectedTagKey(firstTag?.tag_key ?? '')
    setVarValues({})
    setFormError(null)
    setEditorOpen(true)
  }

  const openEdit = (article: LibraryArticle) => {
    setEditingArticle(article)
    setTitle(article.title)
    setExternalRef(article.external_ref ?? '')
    setStatus(article.status)
    setSelectedSiteKey(article.site_key ?? '')
    setSelectedTagKey(article.action_tag_key)
    const initialVars: Record<string, string> = {}
    for (const [k, v] of Object.entries(article.input ?? {})) {
      if (v != null) initialVars[k] = String(v)
    }
    setVarValues(initialVars)
    setFormError(null)
    setEditorOpen(true)
  }

  const handleSave = async () => {
    const tagObj = selectableTags.find((t) => t.tag_key === selectedTagKey)
    const cleanVars: Record<string, unknown> = {}
    if (activeSchema.schema_available && activeSchema.fields.length > 0) {
      for (const field of activeSchema.fields) {
        const raw = varValues[field.key]
        if (raw !== undefined && raw !== '') {
          cleanVars[field.key] =
            field.type === 'number'
              ? Number(raw)
              : field.type === 'boolean'
                ? raw === 'true'
                : raw
        }
      }
    } else {
      for (const [k, v] of Object.entries(varValues)) {
        if (v !== '') cleanVars[k] = v
      }
    }

    const validation = validateSaveLibraryArticle(
      {
        title,
        external_ref: externalRef || null,
        action_tag_id: tagObj?.id ? Number(tagObj.id) : editingArticle?.action_tag_id,
        action_tag_key: selectedTagKey,
        status,
        source_format: 'legacy_input',
        input: cleanVars,
      },
      activeSchema,
    )

    if (!validation.ok) {
      setFormError(validation.message)
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      if (editingArticle) {
        await onUpdate(editingArticle.id, validation.payload)
      } else {
        await onCreate(validation.payload)
      }
      setEditorOpen(false)
    } catch (err: unknown) {
      setFormError(toSafeApiMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-4">
      <PageHeader
        title="Article Library"
        description={
          mode === 'mock'
            ? 'MOCK — Independent Article Library (not tied to any Campaign).'
            : 'Create and manage reusable Articles independently of Campaigns.'
        }
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-3.5" />
            New Article
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted" />
          <Input
            className="pl-8"
            placeholder="Search articles by title or content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          aria-label="Filter by Site"
          className="w-40"
          value={siteFilter}
          onChange={(e) => {
            setSiteFilter(e.target.value)
            setTagFilter('all')
          }}
        >
          <option value="all">All Sites</option>
          {sites.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by Action Tag"
          className="w-52"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="all">All Action Tags</option>
          {selectableTags
            .filter((t) => siteFilter === 'all' || t.site_key === siteFilter)
            .map((t) => (
              <option key={t.tag_key} value={t.tag_key}>
                {t.tag_key}
              </option>
            ))}
        </Select>
        <Select
          aria-label="Filter by Status"
          className="w-36"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="ready">Ready</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between rounded-[var(--radius-card)] border border-danger/40 bg-danger/10 px-4 py-3 text-xs text-danger"
        >
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={onReload}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted/60 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Article</th>
              <th className="px-3 py-2 font-medium">Site</th>
              <th className="px-3 py-2 font-medium">Action Tag / Script</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Last Updated</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  Loading articles…
                </td>
              </tr>
            ) : filteredArticles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  No articles found. Click &ldquo;New Article&rdquo; to create one independently.
                </td>
              </tr>
            ) : (
              filteredArticles.map((article) => {
                const st = articleStatusBadge(article.status)
                const siteObj = article.site_key
                  ? siteByKey.get(article.site_key) ?? undefined
                  : undefined
                const tagObj = tags.find((t) => t.tag_key === article.action_tag_key)
                const resolved = tagObj
                  ? resolveActionTagWithPin(tagObj, undefined, siteObj, scripts, {
                      paths,
                      cmsTypes,
                    })
                  : null
                const preview = extractArticlePreview(article)
                return (
                  <tr key={article.id}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-foreground">{article.title}</div>
                      {preview ? (
                        <div className="line-clamp-1 text-xs text-muted">{preview}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {siteObj?.name ?? article.site_key ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <div className="font-mono">{article.action_tag_key}</div>
                      {resolved?.effective_script ? (
                        <div className="text-[11px] text-muted">
                          {resolved.effective_script.name}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">
                      {formatSchedulerTimestamp(article.updated_at, '—')}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewArticle(article)}
                        >
                          <Eye className="size-3.5" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(article)}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-danger"
                          onClick={() => {
                            if (!window.confirm(`Delete article "${article.title}"?`)) {
                              return
                            }
                            void onDelete(article.id).catch((err: unknown) => {
                              window.alert(toSafeApiMessage(err))
                            })
                          }}
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

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40">
          <div className="flex h-full w-full max-w-xl flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">
                {editingArticle ? 'Edit Article' : 'Create Article'}
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditorOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {formError ? (
                <div
                  role="alert"
                  className="rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
                >
                  {formError}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="article-title">Title</Label>
                <Input
                  id="article-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter article title"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="article-status">Status</Label>
                  <Select
                    id="article-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ArticleStatus)}
                  >
                    <option value="ready">Ready</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="article-extref">External Ref (optional)</Label>
                  <Input
                    id="article-extref"
                    value={externalRef}
                    onChange={(e) => setExternalRef(e.target.value)}
                    placeholder="e.g. seo-post-01"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="article-site">Site</Label>
                  <Select
                    id="article-site"
                    value={selectedSiteKey}
                    onChange={(e) => {
                      const nextSite = e.target.value
                      setSelectedSiteKey(nextSite)
                      const nextTag = selectableTags.find(
                        (t) => !nextSite || t.site_key === nextSite,
                      )
                      setSelectedTagKey(nextTag?.tag_key ?? '')
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
                  <Label htmlFor="article-tag">Action Tag (1 per Article)</Label>
                  <Select
                    id="article-tag"
                    value={selectedTagKey}
                    onChange={(e) => setSelectedTagKey(e.target.value)}
                  >
                    <option value="">Select Action Tag…</option>
                    {tagsForSelectedSite.map((t) => (
                      <option key={t.tag_key} value={t.tag_key}>
                        {t.tag_key}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {resolvedSelectedTag && !resolvedSelectedTag.is_runnable ? (
                <p className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                  {resolvedSelectedTag.status_reason ||
                    'This Action Tag does not have a published Script.'}
                </p>
              ) : null}

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Script Variables
                  </h3>
                  {resolvedSelectedTag?.effective_script ? (
                    <span className="text-xs text-muted">
                      {resolvedSelectedTag.effective_script.name}
                    </span>
                  ) : null}
                </div>

                {activeSchemaEntry?.loading ? (
                  <p className="text-xs text-muted">Loading Script variables…</p>
                ) : !activeSchema.schema_available ? (
                  <p className="text-xs text-muted">
                    {activeSchema.unavailable_reason ||
                      'Select an Action Tag with a published Script to populate variables.'}
                  </p>
                ) : activeSchema.fields.length === 0 ? (
                  <p className="text-xs text-muted">
                    This Script does not declare any input variables.
                  </p>
                ) : (
                  activeSchema.fields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={`var-${field.key}`}>
                        {field.label || field.key}
                        {field.required ? ' *' : ''}
                      </Label>
                      {field.type === 'text' ? (
                        <Textarea
                          id={`var-${field.key}`}
                          rows={4}
                          value={varValues[field.key] ?? ''}
                          onChange={(e) =>
                            setVarValues((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                        />
                      ) : field.type === 'boolean' ? (
                        <Select
                          id={`var-${field.key}`}
                          value={varValues[field.key] ?? 'false'}
                          onChange={(e) =>
                            setVarValues((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                        >
                          <option value="false">false</option>
                          <option value="true">true</option>
                        </Select>
                      ) : (
                        <Input
                          id={`var-${field.key}`}
                          type={
                            field.type === 'number'
                              ? 'number'
                              : field.type === 'secret'
                                ? 'password'
                                : 'text'
                          }
                          value={varValues[field.key] ?? ''}
                          onChange={(e) =>
                            setVarValues((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => setEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
                {saving
                  ? 'Saving…'
                  : editingArticle
                    ? 'Save Changes'
                    : 'Create Article'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {previewArticle ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">{previewArticle.title}</h2>
                <p className="text-xs text-muted">
                  {previewArticle.site_key ?? '—'} ·{' '}
                  <span className="font-mono">{previewArticle.action_tag_key}</span>
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewArticle(null)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-2 rounded-[var(--radius-control)] border border-border bg-surface-muted/40 p-3 text-xs">
              {Object.entries(previewArticle.input ?? {}).length === 0 ? (
                <p className="text-muted">No variable values stored.</p>
              ) : (
                Object.entries(previewArticle.input ?? {}).map(([k, v]) => (
                  <div key={k} className="space-y-0.5">
                    <div className="font-mono text-[11px] text-muted">{k}</div>
                    <div className="whitespace-pre-wrap text-foreground">
                      {v == null ? '—' : String(v)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const target = previewArticle
                  setPreviewArticle(null)
                  openEdit(target)
                }}
              >
                Edit
              </Button>
              <Button size="sm" onClick={() => setPreviewArticle(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
