import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'

import type { Site } from '@/features/action-tags/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import { checkContentLength, siteContentPolicy } from '../content-limit'
import { contentStatusBadge } from '../status-labels'
import { validateManualContent } from '../validation'
import type {
  Campaign,
  CampaignContent,
  ManualContentDraft,
  ScriptInputSchema,
  TipTapDocJson,
} from '../types'
import { ManualArticleEditor } from './ManualArticleEditor'

type Props = {
  campaigns: Campaign[]
  contents: CampaignContent[]
  sites: Site[]
  initialCampaignId?: string
  getSchema: (packageKey: string) => ScriptInputSchema
  onCreate: (draft: ManualContentDraft) => Promise<void>
  onUpdate: (id: string, draft: ManualContentDraft) => Promise<void>
  onRemoveDraft: (id: string) => Promise<void>
  mode: 'mock' | 'live'
}

export function ArticlesScreen({
  campaigns,
  contents,
  sites,
  initialCampaignId,
  getSchema,
  onCreate,
  onUpdate,
  onRemoveDraft,
  mode,
}: Props) {
  const [campaignId, setCampaignId] = useState(
    initialCampaignId ?? campaigns[0]?.id ?? '',
  )
  const [siteFilter, setSiteFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editorDoc, setEditorDoc] = useState<TipTapDocJson | null>(null)
  const [variables, setVariables] = useState<Record<string, string | null>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const campaign = campaigns.find((c) => c.id === campaignId) ?? null
  const site = sites.find((s) => s.key === campaign?.site_key) ?? null
  const schema = campaign
    ? getSchema(campaign.script_package_key)
    : {
        fields: [],
        test_mode_compatible: null,
        title_required: false,
        body_required: false,
      }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contents.filter((c) => {
      if (campaignId && c.campaign_id !== campaignId) return false
      const camp = campaigns.find((x) => x.id === c.campaign_id)
      if (siteFilter !== 'all' && camp?.site_key !== siteFilter) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!q) return true
      const hay = [
        c.external_ref,
        c.input.title ?? '',
        c.input.body ?? '',
        c.id,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [contents, campaignId, campaigns, siteFilter, statusFilter, search])

  const resetForm = () => {
    setTitle('')
    setBody('')
    setEditorDoc(null)
    setVariables({})
    setFormError(null)
    setEditingId(null)
    setCreating(false)
  }

  const openCreate = () => {
    resetForm()
    setCreating(true)
  }

  const openEdit = (row: CampaignContent) => {
    setCreating(false)
    setEditingId(row.id)
    setTitle(row.input.title ?? '')
    setBody(row.input.body ?? '')
    setEditorDoc(row.editor_doc)
    setVariables({ ...row.input.variables })
    setFormError(null)
    setCampaignId(row.campaign_id)
  }

  const submit = async () => {
    if (!campaign) {
      setFormError('Select a Campaign.')
      return
    }
    const policy = siteContentPolicy(site)
    const length = checkContentLength(body, policy)
    const validated = validateManualContent(
      {
        title: title.trim() ? title : null,
        body: body.trim() ? body : null,
        variables,
      },
      schema,
      length.ok,
      length.ok ? undefined : length.message,
    )
    if (!validated.ok) {
      setFormError(validated.message)
      return
    }

    const draft: ManualContentDraft = {
      campaign_id: campaign.id,
      title: title.trim() ? title.trim() : null,
      body: body.trim() ? body.trim() : null,
      variables,
      editor_doc: editorDoc,
    }

    setBusy(true)
    setFormError(null)
    try {
      if (editingId) await onUpdate(editingId, draft)
      else await onCreate(draft)
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const preview = contents.find((c) => c.id === previewId) ?? null
  const showEditor = creating || editingId != null

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-4">
      <PageHeader
        title="Bài viết"
        description={
          mode === 'mock'
            ? 'Campaign Content (manual) — MOCK. Không phải WordPress/SEO Articles.'
            : 'Campaign Content — LIVE Manual CRUD chờ CP19C OpenAPI.'
        }
        actions={
          <Button size="sm" disabled={!campaignId} onClick={openCreate}>
            <Plus className="size-3.5" />
            Add Article
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted">Campaign</span>
          <Select
            className="w-64"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            aria-label="Campaign selector"
          >
            <option value="">Select campaign…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Select
          className="w-40"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          aria-label="Platform filter"
        >
          <option value="all">All platforms</option>
          {sites.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          className="w-44"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Status filter"
        >
          <option value="all">All status</option>
          <option value="draft">draft</option>
          <option value="pending">pending</option>
          <option value="waiting_resources">waiting_resources</option>
          <option value="running">running</option>
          <option value="success">success</option>
          <option value="failed_locked">failed_locked</option>
          <option value="unknown">unknown</option>
          <option value="skipped">skipped</option>
          <option value="cancelled">cancelled</option>
        </Select>
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted" />
          <Input
            className="pl-8"
            placeholder="Search articles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {showEditor ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3 space-y-3">
          <h2 className="text-sm font-semibold">
            {editingId ? 'Edit Article' : 'Add Article'}
          </h2>
          <ManualArticleEditor
            title={title}
            bodyPlain={body}
            variables={variables}
            editorDoc={editorDoc}
            schema={schema}
            site={site}
            disabled={busy}
            onTitleChange={setTitle}
            onBodyChange={(plain, doc) => {
              setBody(plain)
              setEditorDoc(doc)
            }}
            onVariablesChange={setVariables}
          />
          {formError ? (
            <p className="text-xs text-danger">{formError}</p>
          ) : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void submit()}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={resetForm}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface-muted p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Preview</h2>
            <Button size="sm" variant="ghost" onClick={() => setPreviewId(null)}>
              Close
            </Button>
          </div>
          <p className="mt-2 font-medium">{preview.input.title || '(no title)'}</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-muted">
            {preview.input.body}
          </pre>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Ref</th>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Content</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  No articles. Manual Campaign starts with zero Content — add at
                  least one before Start.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const cs = contentStatusBadge(row.status)
                const camp = campaigns.find((c) => c.id === row.campaign_id)
                return (
                  <tr key={row.id} className="border-b border-border">
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.external_ref}
                    </td>
                    <td className="px-3 py-2 text-xs">{camp?.name ?? row.campaign_id}</td>
                    <td className="px-3 py-2">
                      <div className="line-clamp-2 text-xs">
                        {row.input.title ? (
                          <span className="font-medium">{row.input.title} — </span>
                        ) : null}
                        {row.input.body}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={cs.variant}>{cs.label}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewId(row.id)}
                        >
                          Preview
                        </Button>
                        {row.status === 'draft' || row.status === 'pending' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(row)}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {row.status === 'draft' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-danger"
                            onClick={() => {
                              if (!window.confirm('Remove draft article?'))
                                return
                              void onRemoveDraft(row.id)
                            }}
                          >
                            Remove draft
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
