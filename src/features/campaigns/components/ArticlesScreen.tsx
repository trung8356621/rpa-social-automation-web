import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'

import type { Site } from '@/features/action-tags/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import { toSafeApiMessage } from '@/lib/api/errors'

import {
  formatDiscardedInputWarning,
  mapDraftToAllowedScriptInput,
} from '../api/build-content-payload'
import { resolveArticlesListState } from '../articles-list-state'
import { checkContentLength, siteContentPolicy } from '../content-limit'
import {
  formatCampaignV2ApiError,
  matchesArticleSiteFilter,
  scriptTargetKey,
  type ScriptSchemaLookup,
} from '../multi-tag-plan'
import { buildAutoShortcodeMapping } from '../shortcode-mapping'
import { contentListPreview } from '../shortcode-source'
import { contentStatusBadge } from '../status-labels'
import {
  isCampaignV2,
  isContentEditable,
  validateManualContent,
  validateShortcodeContent,
} from '../validation'
import type {
  Campaign,
  CampaignContent,
  ManualContentDraft,
  MockPreviewResult,
  MockSaveResult,
  ScriptInputSchema,
  TipTapDocJson,
} from '../types'
import { ManualArticleEditor } from './ManualArticleEditor'
import { MockArticleGenerator } from './MockArticleGenerator'
import { ShortcodeArticleEditor } from './ShortcodeArticleEditor'
import { V2BulkMockGenerator, type V2MockTagOption } from './V2BulkMockGenerator'

type ContentSaveOpts = {
  schema: ScriptInputSchema
  allowDiscard?: boolean
  preferShortcode?: boolean
}

type Props = {
  campaigns: Campaign[]
  contents: CampaignContent[]
  sites: Site[]
  /** Controlled Campaign filter — parent owns LIVE Content fetch. */
  campaignId: string
  onCampaignChange: (campaignId: string) => void
  getSchema: (packageKey: string) => ScriptInputSchema
  onCreate: (draft: ManualContentDraft, opts: ContentSaveOpts) => Promise<void>
  onUpdate: (
    id: string,
    draft: ManualContentDraft,
    opts: ContentSaveOpts,
  ) => Promise<void>
  onRemoveDraft: (id: string) => Promise<void>
  onMockPreview: (campaignId: string, count: number) => Promise<MockPreviewResult>
  onMockSave: (
    campaignId: string,
    count: number,
    idempotencyKey: string,
  ) => Promise<MockSaveResult>
  mode: 'mock' | 'live'
  contentsLoading?: boolean
  contentsError?: string | null
  schemaLoading?: boolean
  schemaError?: string | null
  v2TagOptions?: V2MockTagOption[]
  v2SchemaLookup?: ScriptSchemaLookup
  onV2BulkMockSave?: (count: number, actionTagKey: string) => Promise<void>
  onV2ClearMocks?: () => Promise<void>
  onV2SaveContent?: (draft: {
    editingId: string | null
    externalRef: string
    rawSource: string
    targetTagKeys: string[]
  }) => Promise<void>
  onV2DeleteContent?: (contentId: string) => Promise<void>
  onReloadCampaign?: () => Promise<void>
}

const EMPTY_SCHEMA: ScriptInputSchema = {
  fields: [],
  test_mode_compatible: null,
  title_required: false,
  body_required: false,
  schema_available: false,
  title_supported: false,
  body_supported: false,
  unavailable_reason: null,
}

export function ArticlesScreen({
  campaigns,
  contents,
  sites,
  campaignId,
  onCampaignChange,
  getSchema,
  onCreate,
  onUpdate,
  onRemoveDraft,
  onMockPreview,
  onMockSave,
  mode,
  contentsLoading = false,
  contentsError = null,
  schemaLoading = false,
  schemaError = null,
  v2TagOptions = [],
  v2SchemaLookup = {},
  onV2BulkMockSave,
  onV2ClearMocks,
  onV2SaveContent,
  onV2DeleteContent,
  onReloadCampaign,
}: Props) {
  const [siteFilter, setSiteFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [externalRef, setExternalRef] = useState('')
  const [v2TargetTag, setV2TargetTag] = useState<string>('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [rawSource, setRawSource] = useState('')
  const [editorDoc, setEditorDoc] = useState<TipTapDocJson | null>(null)
  const [variables, setVariables] = useState<Record<string, string | null>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const campaign = campaigns.find((c) => c.id === campaignId) ?? null
  const isV2Campaign = campaign ? isCampaignV2(campaign) : false
  const site = sites.find((s) => s.key === campaign?.site_key) ?? null
  const schema = campaign
    ? getSchema(campaign.script_package_key)
    : EMPTY_SCHEMA
  const hasShortcodeMapping = Boolean(
    campaign?.shortcode_mapping?.entries?.length,
  )
  const editingRow =
    editingId != null
      ? (contents.find((c) => c.id === editingId) ?? null)
      : null
  /**
   * V2 with mapping → ShortcodeArticleEditor for create + shortcode rows.
   * Legacy_input rows stay on ManualArticleEditor (no auto-migrate).
   * Campaigns without mapping → explicit legacy compatibility mode.
   * Never fall back to Title+Body when mapping exists but schema load fails.
   */
  const editorMode: 'shortcode' | 'legacy' | null = (() => {
    if (!campaign) return null
    if (editingRow?.source_format === 'legacy_input') return 'legacy'
    if (hasShortcodeMapping) return 'shortcode'
    return 'legacy'
  })()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contents.filter((c) => {
      if (campaignId && c.campaign_id !== campaignId) return false
      const camp = campaigns.find((x) => x.id === c.campaign_id)
      if (!matchesArticleSiteFilter(c, camp, siteFilter)) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!q) return true
      const hay = [
        c.external_ref,
        c.raw_source ?? '',
        c.source_format,
        c.mapping_version == null ? '' : String(c.mapping_version),
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
    setExternalRef('')
    setV2TargetTag('')
    setTitle('')
    setBody('')
    setRawSource('')
    setEditorDoc(null)
    setVariables({})
    setFormError(null)
    setEditingId(null)
    setCreating(false)
  }

  const openCreate = () => {
    resetForm()
    if (isV2Campaign) {
      const firstTag = v2TagOptions[0]?.tag.action_tag_key ?? ''
      setV2TargetTag(firstTag)
      setExternalRef(`post-${filtered.length + 1}`)
      setCreating(true)
      return
    }
    if (hasShortcodeMapping && campaign?.shortcode_mapping) {
      const first = campaign.shortcode_mapping.entries[0]?.shortcode ?? 'body'
      setRawSource(`[${first}][/${first}]`)
    }
    setCreating(true)
  }

  const openEdit = (row: CampaignContent) => {
    if (!isContentEditable(row)) {
      setFormError(
        'Content is not editable (only pending / waiting_resources without a job).',
      )
      return
    }
    setCreating(false)
    setEditingId(row.id)
    setExternalRef(row.external_ref)
    if (isV2Campaign) {
      setV2TargetTag(row.assignments?.[0]?.action_tag_key ?? '')
      setRawSource(row.raw_source ?? '')
      setFormError(null)
      onCampaignChange(row.campaign_id)
      return
    }
    setTitle(row.input.title ?? '')
    setBody(row.input.body ?? '')
    setRawSource(row.raw_source ?? '')
    setEditorDoc(row.editor_doc)
    setVariables({ ...row.input.variables })
    setFormError(null)
    onCampaignChange(row.campaign_id)
  }

  const submit = async () => {
    if (!campaign) {
      setFormError('Select a Campaign.')
      return
    }
    if (isV2Campaign) {
      if (!onV2SaveContent) return
      if (!v2TargetTag) {
        setFormError('Select a target Site / Action Tag.')
        return
      }
      if (!rawSource.trim()) {
        setFormError('Shortcode source is required.')
        return
      }
      setBusy(true)
      setFormError(null)
      try {
        await onV2SaveContent({
          editingId,
          externalRef,
          rawSource,
          targetTagKeys: [v2TargetTag],
        })
        resetForm()
      } catch (err) {
        setFormError(formatCampaignV2ApiError(err).message)
      } finally {
        setBusy(false)
      }
      return
    }
    if (schemaLoading) {
      setFormError('Loading Script input schema…')
      return
    }

    if (editorMode === 'shortcode') {
      if (!hasShortcodeMapping || !campaign.shortcode_mapping) {
        setFormError(
          'Campaign shortcode_mapping is required for Shortcode editor. Refusing Title+Body fallback.',
        )
        return
      }
      const shortcodes = campaign.shortcode_mapping.entries.map(
        (e) => e.shortcode,
      )
      const validated = validateShortcodeContent(rawSource, shortcodes)
      if (!validated.ok) {
        setFormError(validated.message)
        return
      }
      const draft: ManualContentDraft = {
        campaign_id: campaign.id,
        title: null,
        body: null,
        variables: {},
        raw_source: rawSource,
        editor_doc: null,
      }
      setBusy(true)
      setFormError(null)
      try {
        const opts: ContentSaveOpts = {
          schema,
          preferShortcode: true,
        }
        if (editingId) await onUpdate(editingId, draft, opts)
        else await onCreate(draft, opts)
        resetForm()
      } catch (err) {
        setFormError(toSafeApiMessage(err))
      } finally {
        setBusy(false)
      }
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

    const mapped = mapDraftToAllowedScriptInput(draft, schema)
    if (!mapped.ok) {
      setFormError(mapped.message)
      return
    }

    let allowDiscard = false
    if (mapped.discarded.length > 0) {
      const warning = formatDiscardedInputWarning(
        mapped.discarded,
        Object.keys(mapped.input),
      )
      setFormError(warning.replace(/\n/g, ' '))
      if (!window.confirm(warning)) {
        return
      }
      allowDiscard = true
    }

    setBusy(true)
    setFormError(null)
    try {
      const opts: ContentSaveOpts = { schema, allowDiscard }
      if (editingId) await onUpdate(editingId, draft, opts)
      else await onCreate(draft, opts)
      resetForm()
    } catch (err) {
      setFormError(toSafeApiMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const preview = contents.find((c) => c.id === previewId) ?? null
  const showEditor = creating || editingId != null
  const listState = resolveArticlesListState({
    loading: contentsLoading,
    error: contentsError,
    rowCount: filtered.length,
  })

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-4">
      <PageHeader
        title="Bài viết"
        description={
          mode === 'mock'
            ? 'Campaign Content — MOCK Shortcode V2. Không phải WordPress/SEO Articles.'
            : 'Campaign Content — LIVE Staff API (raw_source shortcode / legacy input).'
        }
        actions={
          <Button
            size="sm"
            disabled={
              !campaignId || (isV2Campaign && campaign?.status !== 'draft')
            }
            title={
              isV2Campaign && campaign?.status !== 'draft'
                ? 'Only Draft V2 Campaigns can add Articles.'
                : undefined
            }
            onClick={openCreate}
          >
            <Plus className="size-3.5" />
            Add Article
          </Button>
        }
      />

      {schemaError ? (
        <div className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          <span className="font-medium">Script schema warning:</span>{' '}
          {schemaError}. Existing Content rows are still shown below.
        </div>
      ) : null}

      {isV2Campaign && campaign ? (
        <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-2 text-xs text-muted">
          Plan V2 Campaign ({campaign.status}): displaying persisted Content
          items and per-Tag assignments. Changes save via V2 Draft PUT.
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted">Campaign</span>
          <Select
            className="w-64"
            value={campaignId}
            onChange={(e) => {
              onCampaignChange(e.target.value)
              resetForm()
            }}
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
          onChange={(e) => {
            setSiteFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Platform filter"
        >
          <option value="all">All sites</option>
          {(() => {
            const siteMap = new Map(sites.map((s) => [s.key, s.name]))
            if (isV2Campaign && campaign?.action_tags) {
              for (const t of campaign.action_tags) {
                if (!siteMap.has(t.site_key)) {
                  siteMap.set(t.site_key, t.site_name || t.site_key)
                }
              }
            }
            return Array.from(siteMap.entries()).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))
          })()}
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

      {campaignId && !isV2Campaign && !hasShortcodeMapping ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface-muted px-3 py-2 text-xs text-muted">
          Legacy Campaign compatibility: this Campaign has no{' '}
          <code className="font-mono">shortcode_mapping</code>
          {campaign?.shortcode_mapping_version != null
            ? ` (mapping_version=${campaign.shortcode_mapping_version})`
            : ''}
          . Existing <code className="font-mono">legacy_input</code> Articles
          stay readable/editable under safe rules. Shortcode editor is not used.
          Create a new Campaign with Shortcode Mapping for V2.
        </div>
      ) : null}

      {campaignId &&
      isV2Campaign &&
      campaign?.status === 'draft' &&
      onV2BulkMockSave ? (
        <V2BulkMockGenerator
          tagOptions={v2TagOptions}
          mockCount={
            contents.filter(
              (c) =>
                c.campaign_id === campaignId &&
                c.external_ref.trim().startsWith('mock-'),
            ).length
          }
          disabled={busy}
          onGenerateAndSave={onV2BulkMockSave}
          onClearMocks={onV2ClearMocks}
          onReloadCampaign={onReloadCampaign}
        />
      ) : null}

      {campaignId && !isV2Campaign && hasShortcodeMapping ? (
        <MockArticleGenerator
          disabled={!campaignId || busy}
          onPreview={(count) => onMockPreview(campaignId, count)}
          onSave={(count, key) => onMockSave(campaignId, count, key)}
        />
      ) : null}

      {contentsLoading ? (
        <p className="text-xs text-muted">Loading campaign contents…</p>
      ) : null}
      {contentsError ? (
        <p className="text-xs text-danger">{contentsError}</p>
      ) : null}

      {showEditor ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3 space-y-3">
          <h2 className="text-sm font-semibold">
            {editingId ? 'Edit Article' : 'Add Article'}
          </h2>
          {isV2Campaign && campaign ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-xs text-muted">External Ref</span>
                <Input
                  disabled={busy}
                  value={externalRef}
                  placeholder="post-1"
                  onChange={(e) => setExternalRef(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted">
                  Target Site / Action Tag
                </span>
                <Select
                  disabled={busy}
                  value={v2TargetTag}
                  onChange={(e) => setV2TargetTag(e.target.value)}
                >
                  <option value="">Select target Action Tag…</option>
                  {(campaign.action_tags ?? []).map((t) => (
                    <option key={t.action_tag_key} value={t.action_tag_key}>
                      {t.site_name} · {t.action_tag_key} ({t.script_name} v
                      {t.script_version})
                    </option>
                  ))}
                </Select>
              </div>
              {(() => {
                const selectedPlanTag = (campaign.action_tags ?? []).find(
                  (t) => t.action_tag_key === v2TargetTag,
                )
                const tKey = selectedPlanTag
                  ? scriptTargetKey(
                      selectedPlanTag.script_package_key,
                      selectedPlanTag.script_version,
                    )
                  : ''
                const schemaEntry = tKey ? v2SchemaLookup[tKey] : undefined
                const auto =
                  schemaEntry?.schema?.schema_available
                    ? buildAutoShortcodeMapping(schemaEntry.schema)
                    : null
                const mapping =
                  auto && auto.ok
                    ? auto.mapping
                    : (selectedPlanTag?.shortcode_mapping ?? { entries: [] })
                return (
                  <ShortcodeArticleEditor
                    key={`${editingId ?? 'v2-new'}-${v2TargetTag}`}
                    rawSource={rawSource}
                    mapping={mapping}
                    disabled={busy}
                    onChange={setRawSource}
                  />
                )
              })()}
            </div>
          ) : editorMode === 'shortcode' && campaign?.shortcode_mapping ? (
            <ShortcodeArticleEditor
              rawSource={rawSource}
              mapping={campaign.shortcode_mapping}
              disabled={busy}
              onChange={setRawSource}
            />
          ) : editorMode === 'legacy' ? (
            <>
              {editingRow?.source_format === 'legacy_input' &&
              hasShortcodeMapping ? (
                <p className="text-xs text-muted">
                  Editing preserved <code className="font-mono">legacy_input</code>{' '}
                  row — not auto-migrated to shortcode.
                </p>
              ) : null}
              <ManualArticleEditor
                title={title}
                bodyPlain={body}
                variables={variables}
                editorDoc={editorDoc}
                schema={schema}
                site={site}
                disabled={busy || schemaLoading}
                onTitleChange={setTitle}
                onBodyChange={(plain, doc) => {
                  setBody(plain)
                  setEditorDoc(doc)
                }}
                onVariablesChange={setVariables}
              />
            </>
          ) : (
            <p className="text-xs text-danger">
              Editor blocked — select a Campaign first.
            </p>
          )}
          {schemaLoading && editorMode === 'legacy' ? (
            <p className="text-xs text-muted">Loading Script input schema…</p>
          ) : null}
          {editorMode === 'legacy' &&
          !schemaLoading &&
          !schema.schema_available ? (
            <p className="text-xs text-danger">
              Script input schema unavailable. Cannot save legacy Title/Body
              until Script Registry variables are loaded. Fail-closed.
            </p>
          ) : null}
          {formError ? (
            <p className="text-xs text-danger whitespace-pre-wrap">{formError}</p>
          ) : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                busy ||
                (!isV2Campaign &&
                  (editorMode == null ||
                    (editorMode === 'legacy' &&
                      (schemaLoading || !schema.schema_available)) ||
                    (editorMode === 'shortcode' && !hasShortcodeMapping)))
              }
              onClick={() => void submit()}
            >
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
          <p className="mt-1 text-xs text-muted">
            format={preview.source_format}
            {preview.mapping_version != null
              ? ` · mapping_version=${preview.mapping_version}`
              : ''}
          </p>
          <pre className="mt-2 whitespace-pre-wrap text-xs">
            {contentListPreview(preview) || '(empty)'}
          </pre>
        </div>
      ) : null}

      {(() => {
        const PAGE_SIZE = 25
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
        const safePage = Math.min(page, totalPages)
        const pageRows = filtered.slice(
          (safePage - 1) * PAGE_SIZE,
          safePage * PAGE_SIZE,
        )
        return (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="border-b border-border bg-surface-muted text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2">Ref</th>
                    <th className="px-3 py-2">Campaign</th>
                    <th className="px-3 py-2">
                      {isV2Campaign ? 'Tags' : 'Format'}
                    </th>
                    <th className="px-3 py-2">Content</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listState === 'loading' ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-muted"
                      >
                        Loading campaign contents…
                      </td>
                    </tr>
                  ) : listState === 'error' ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-danger"
                      >
                        Failed to load articles. {contentsError}
                      </td>
                    </tr>
                  ) : listState === 'empty' ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-muted"
                      >
                        No articles. Shortcode V2 Campaigns start with zero
                        Content — add Articles or Generate Mock before Start.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const cs = contentStatusBadge(row.status)
                      const camp = campaigns.find(
                        (c) => c.id === row.campaign_id,
                      )
                      const rowV2 = camp ? isCampaignV2(camp) : isV2Campaign
                      const tagCount = row.assignments?.length ?? 0
                      const tagTitle = (row.assignments ?? [])
                        .map((a) => a.action_tag_key)
                        .join(', ')
                      return (
                        <tr key={row.id} className="border-b border-border">
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.external_ref}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {camp?.name ?? row.campaign_id}
                          </td>
                          <td
                            className="px-3 py-2 font-mono text-[11px]"
                            title={tagTitle || undefined}
                          >
                            {rowV2 ? (
                              tagCount === 1 ? (
                                <Badge variant="neutral">
                                  {row.assignments![0]!.action_tag_key}
                                </Badge>
                              ) : (
                                <Badge variant="neutral">
                                  {tagCount} tag{tagCount === 1 ? '' : 's'}
                                </Badge>
                              )
                            ) : (
                              <>
                                {row.source_format}
                                {row.mapping_version != null
                                  ? ` · v${row.mapping_version}`
                                  : ''}
                              </>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="line-clamp-2 font-mono text-xs">
                              {contentListPreview(row) || '(empty)'}
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
                              {isContentEditable(row) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEdit(row)}
                                >
                                  Edit
                                </Button>
                              ) : null}
                              {rowV2 &&
                              camp?.status === 'draft' &&
                              onV2DeleteContent ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-danger"
                                  disabled={busy}
                                  onClick={() => {
                                    if (!window.confirm('Delete this article?'))
                                      return
                                    void onV2DeleteContent(row.id)
                                  }}
                                >
                                  Delete
                                </Button>
                              ) : mode === 'mock' && row.status === 'draft' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-danger"
                                  onClick={() => {
                                    if (
                                      !window.confirm('Remove draft article?')
                                    )
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
            {filtered.length > PAGE_SIZE ? (
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filtered.length)} of{' '}
                  {filtered.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )
      })()}
    </div>
  )
}
