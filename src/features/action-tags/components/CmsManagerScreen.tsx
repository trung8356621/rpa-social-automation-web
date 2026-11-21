import { useMemo, useState } from 'react'
import { ArrowLeft, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toSafeApiMessage } from '@/lib/api/errors'
import { cn } from '@/lib/utils'

import type { CmsPathTemplate, CmsTypeItem, Site } from '../types'
import { normalizeTagSegment } from '../utils'

type CmsManagerScreenProps = {
  cmsTypes: CmsTypeItem[]
  sites: Site[]
  mutationsEnabled?: boolean
  onBackToTags: () => void
  onOpenSitesPaths: () => void
  onSaveCmsType: (cmsData: {
    id?: number
    key?: string
    name: string
    description?: string | null
    is_enabled?: boolean
  }) => Promise<{ id: number; key: string } | void>
  onToggleCmsTypeEnabled: (cmsId: number, enabled: boolean) => Promise<void>
  onSaveCmsPathTemplate: (
    cmsTypeId: number,
    tplData: {
      id?: number
      key?: string
      name: string
      url_pattern: string
      description?: string | null
      is_authentication?: boolean
    },
  ) => Promise<void>
  onDeleteCmsPathTemplate: (
    cmsTypeId: number,
    templateId: number,
  ) => Promise<void>
}

export function CmsManagerScreen({
  cmsTypes,
  sites,
  mutationsEnabled = true,
  onBackToTags,
  onOpenSitesPaths,
  onSaveCmsType,
  onToggleCmsTypeEnabled,
  onSaveCmsPathTemplate,
  onDeleteCmsPathTemplate,
}: CmsManagerScreenProps) {
  const [selectedCmsId, setSelectedCmsId] = useState<number>(
    cmsTypes[0]?.id ?? 0,
  )
  const [search, setSearch] = useState('')
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const [cmsModalOpen, setCmsModalOpen] = useState(false)
  const [editingCms, setEditingCms] = useState<CmsTypeItem | null>(null)
  const [cmsKeyInput, setCmsKeyInput] = useState('')
  const [cmsNameInput, setCmsNameInput] = useState('')
  const [cmsDescInput, setCmsDescInput] = useState('')
  const [cmsEnabledInput, setCmsEnabledInput] = useState(true)
  const [isSavingCms, setIsSavingCms] = useState(false)
  const [cmsError, setCmsError] = useState('')

  const [tplEditingId, setTplEditingId] = useState<number | 'new' | null>(null)
  const [tplKeyInput, setTplKeyInput] = useState('')
  const [tplNameInput, setTplNameInput] = useState('')
  const [tplPatternInput, setTplPatternInput] = useState('/')
  const [tplIsAuth, setTplIsAuth] = useState(false)
  const [tplDescInput, setTplDescInput] = useState('')
  const [isSavingTpl, setIsSavingTpl] = useState(false)
  const [tplError, setTplError] = useState('')

  const activeCms = useMemo(
    () => cmsTypes.find((c) => c.id === selectedCmsId) || cmsTypes[0] || null,
    [cmsTypes, selectedCmsId],
  )

  const filteredCmsTypes = useMemo(() => {
    if (!search.trim()) return cmsTypes
    const q = search.trim().toLowerCase()
    return cmsTypes.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.key.toLowerCase().includes(q),
    )
  }, [cmsTypes, search])

  const sitesByCmsKey = useMemo(() => {
    const map = new Map<string, Site[]>()
    for (const s of sites) {
      if (!s.cms_type) continue
      const list = map.get(s.cms_type) ?? []
      list.push(s)
      map.set(s.cms_type, list)
    }
    return map
  }, [sites])

  const activeCmsSites = useMemo(
    () => (activeCms ? (sitesByCmsKey.get(activeCms.key) ?? []) : []),
    [activeCms, sitesByCmsKey],
  )

  const openAddCmsModal = () => {
    setEditingCms(null)
    setCmsKeyInput('')
    setCmsNameInput('')
    setCmsDescInput('')
    setCmsEnabledInput(true)
    setCmsError('')
    setCmsModalOpen(true)
  }

  const openEditCmsModal = (cms: CmsTypeItem) => {
    setEditingCms(cms)
    setCmsKeyInput(cms.key)
    setCmsNameInput(cms.name)
    setCmsDescInput(cms.description ?? '')
    setCmsEnabledInput(cms.is_enabled)
    setCmsError('')
    setCmsModalOpen(true)
  }

  const handleSaveCms = async () => {
    if (!cmsNameInput.trim()) {
      setCmsError('Vui lòng nhập Tên CMS Type.')
      return
    }
    const key = editingCms
      ? editingCms.key
      : normalizeTagSegment(cmsKeyInput || cmsNameInput)
    if (!key) {
      setCmsError('Key CMS Type không hợp lệ.')
      return
    }
    setCmsError('')
    setIsSavingCms(true)
    try {
      const saved = await onSaveCmsType({
        id: editingCms?.id,
        key,
        name: cmsNameInput.trim(),
        description: cmsDescInput.trim() || null,
        is_enabled: cmsEnabledInput,
      })
      if (saved && typeof saved === 'object' && saved.id) {
        setSelectedCmsId(saved.id)
      }
      setCmsModalOpen(false)
    } catch (err) {
      setCmsError(toSafeApiMessage(err))
    } finally {
      setIsSavingCms(false)
    }
  }

  const startNewTemplate = () => {
    setTplEditingId('new')
    setTplKeyInput('')
    setTplNameInput('')
    setTplPatternInput('/')
    setTplIsAuth(false)
    setTplDescInput('')
    setTplError('')
  }

  const startEditTemplate = (tpl: CmsPathTemplate) => {
    setTplEditingId(tpl.id ?? 'new')
    setTplKeyInput(tpl.key)
    setTplNameInput(tpl.name)
    setTplPatternInput(tpl.url_pattern)
    setTplIsAuth(Boolean(tpl.is_authentication))
    setTplDescInput(tpl.description ?? '')
    setTplError('')
  }

  const handleSaveTemplate = async () => {
    if (!activeCms) return
    if (!tplNameInput.trim() || !tplPatternInput.trim()) {
      setTplError('Vui lòng nhập đầy đủ Tên Template và URL Pattern.')
      return
    }
    setTplError('')
    setIsSavingTpl(true)
    try {
      await onSaveCmsPathTemplate(activeCms.id, {
        id: tplEditingId === 'new' ? undefined : (tplEditingId ?? undefined),
        key: tplKeyInput.trim() || undefined,
        name: tplNameInput.trim(),
        url_pattern: tplPatternInput.trim(),
        description: tplDescInput.trim() || null,
        is_authentication: tplIsAuth,
      })
      setTplEditingId(null)
    } catch (err) {
      setTplError(toSafeApiMessage(err))
    } finally {
      setIsSavingTpl(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="CMS Manager"
        description="Quản lý CMS Types và Path Templates dùng chung cho nhiều Site"
        actions={
          <>
            <Button variant="ghost" onClick={onBackToTags}>
              <ArrowLeft className="size-3.5" />
              Action Tags
            </Button>
            <Button variant="outline" onClick={onOpenSitesPaths}>
              <FolderTree className="size-3.5" />
              Manage Sites & Paths
            </Button>
            <Button
              onClick={openAddCmsModal}
              disabled={!mutationsEnabled}
              title={
                mutationsEnabled ? undefined : 'Live editing not enabled yet'
              }
            >
              <Plus className="size-3.5" />
              Add CMS Type
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-3 xl:col-span-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">CMS Types</h2>
            <span className="text-xs text-muted">{cmsTypes.length} type(s)</span>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search CMS types…"
            aria-label="Search CMS types"
            className="mb-2"
          />
          <div className="max-h-[28rem] space-y-1.5 overflow-y-auto">
            {cmsTypes.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted">
                <p>Chưa có CMS Type nào.</p>
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={openAddCmsModal}
                  disabled={!mutationsEnabled}
                >
                  + Add CMS Type
                </Button>
              </div>
            ) : filteredCmsTypes.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted">
                Không tìm thấy CMS Type phù hợp.
              </p>
            ) : (
              filteredCmsTypes.map((cms) => {
                const isActive = activeCms?.id === cms.id
                const siteCount =
                  (sitesByCmsKey.get(cms.key) ?? []).length ||
                  cms.sites_count ||
                  0
                return (
                  <div
                    key={cms.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedCmsId(cms.id)
                      setTplEditingId(null)
                      setTplError('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedCmsId(cms.id)
                        setTplEditingId(null)
                        setTplError('')
                      }
                    }}
                    className={cn(
                      'flex cursor-pointer items-start justify-between gap-2 rounded-[var(--radius-control)] border px-2.5 py-2 transition-colors',
                      isActive
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border hover:bg-surface-muted',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {cms.name}
                        </span>
                        <Badge variant={cms.is_enabled ? 'success' : 'neutral'}>
                          {cms.is_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        <code className="font-mono">{cms.key}</code> ·{' '}
                        {cms.path_templates.length} template(s) · {siteCount}{' '}
                        site(s)
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditCmsModal(cms)
                      }}
                      disabled={!mutationsEnabled}
                      aria-label={`Edit ${cms.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="space-y-3 xl:col-span-8">
          {!activeCms ? (
            <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6 text-center text-sm text-muted">
              Chọn hoặc tạo một CMS Type để quản lý Path Templates dùng chung.
            </div>
          ) : (
            <>
              <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">{activeCms.name}</h2>
                      <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-muted">
                        {activeCms.key}
                      </code>
                      <Badge
                        variant={activeCms.is_enabled ? 'success' : 'neutral'}
                      >
                        {activeCms.is_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    {activeCms.description ? (
                      <p className="mt-1 text-xs text-muted">
                        {activeCms.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!mutationsEnabled || togglingId === activeCms.id}
                      onClick={() => {
                        setTogglingId(activeCms.id)
                        void onToggleCmsTypeEnabled(
                          activeCms.id,
                          !activeCms.is_enabled,
                        ).finally(() => setTogglingId(null))
                      }}
                    >
                      {activeCms.is_enabled ? 'Disable CMS' : 'Enable CMS'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!mutationsEnabled}
                      onClick={() => openEditCmsModal(activeCms)}
                    >
                      <Pencil className="size-3.5" />
                      Edit Settings
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-[var(--radius-card)] border border-border bg-surface">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <h3 className="text-sm font-semibold">
                    Shared Path Templates ({activeCms.path_templates.length})
                  </h3>
                  <Button
                    size="sm"
                    onClick={startNewTemplate}
                    disabled={!mutationsEnabled}
                  >
                    <Plus className="size-3.5" />
                    Add Template
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted/70 text-xs text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Name / Key</th>
                        <th className="px-3 py-2 font-medium">URL Pattern</th>
                        <th className="px-3 py-2 font-medium text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCms.path_templates.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-3 py-6 text-center text-sm text-muted"
                          >
                            CMS Type này chưa có Path Template nào.
                          </td>
                        </tr>
                      ) : (
                        activeCms.path_templates.map((tpl) => (
                          <tr
                            key={tpl.id ?? tpl.key}
                            className="border-b border-border last:border-b-0"
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-foreground">
                                  {tpl.name}
                                </span>
                                <code className="font-mono text-xs text-muted">
                                  {tpl.key}
                                </code>
                                {tpl.is_authentication ? (
                                  <Badge variant="primary" className="text-[10px]">
                                    Auth Path
                                  </Badge>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs">
                              {tpl.url_pattern}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => startEditTemplate(tpl)}
                                  disabled={!mutationsEnabled}
                                  aria-label={`Edit template ${tpl.name}`}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                {tpl.id ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-danger hover:bg-danger/5"
                                    onClick={() =>
                                      void onDeleteCmsPathTemplate(
                                        activeCms.id,
                                        tpl.id!,
                                      )
                                    }
                                    disabled={!mutationsEnabled}
                                    aria-label={`Delete template ${tpl.name}`}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {tplEditingId !== null ? (
                <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3">
                  <h3 className="mb-3 text-sm font-semibold">
                    {tplEditingId === 'new'
                      ? 'Add Path Template'
                      : 'Edit Path Template'}
                  </h3>
                  {tplError ? (
                    <div className="mb-3 rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                      {tplError}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <Label htmlFor="tpl-name">Template Name *</Label>
                      <Input
                        id="tpl-name"
                        value={tplNameInput}
                        onChange={(e) => setTplNameInput(e.target.value)}
                        placeholder="e.g. Create Post"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tpl-key">Template Key</Label>
                      <Input
                        id="tpl-key"
                        value={tplKeyInput}
                        onChange={(e) => setTplKeyInput(e.target.value)}
                        disabled={tplEditingId !== 'new'}
                        placeholder="e.g. create_post"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tpl-pattern">URL Pattern *</Label>
                      <Input
                        id="tpl-pattern"
                        value={tplPatternInput}
                        onChange={(e) => setTplPatternInput(e.target.value)}
                        placeholder="/wp-admin/post-new.php"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label
                      htmlFor="tpl-is-auth"
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        id="tpl-is-auth"
                        type="checkbox"
                        checked={tplIsAuth}
                        onChange={(e) => setTplIsAuth(e.target.checked)}
                        className="size-4 rounded border-border"
                      />
                      <span>Authentication Path (login script intent)</span>
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setTplEditingId(null)}
                      disabled={isSavingTpl}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => void handleSaveTemplate()}
                      disabled={isSavingTpl || !mutationsEnabled}
                    >
                      {isSavingTpl ? 'Saving...' : 'Save Template'}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    Sites Using {activeCms.name} ({activeCmsSites.length})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenSitesPaths}
                  >
                    Open Sites & Paths
                  </Button>
                </div>
                {activeCmsSites.length === 0 ? (
                  <p className="text-xs text-muted">
                    Chưa có Site nào sử dụng CMS Type này.
                  </p>
                ) : (
                  <ul className="divide-y divide-border text-xs">
                    {activeCmsSites.map((site) => (
                      <li
                        key={site.id}
                        className="flex items-center justify-between gap-2 py-2"
                      >
                        <div>
                          <span className="font-medium text-foreground">
                            {site.name}
                          </span>{' '}
                          <code className="font-mono text-muted">
                            ({site.key})
                          </code>
                        </div>
                        <span className="font-mono text-muted">
                          {site.base_url}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {cmsModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal overlay"
            className="absolute inset-0 bg-foreground/20"
            onClick={() => setCmsModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cms-modal-title"
            className="relative z-10 w-full max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="cms-modal-title" className="text-base font-semibold">
                {editingCms ? 'Edit CMS Type' : 'Add CMS Type'}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCmsModalOpen(false)}
              >
                Close
              </Button>
            </div>
            {cmsError ? (
              <div className="mb-3 rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {cmsError}
              </div>
            ) : null}
            <div className="mb-3">
              <Label htmlFor="cms-name">CMS Name *</Label>
              <Input
                id="cms-name"
                value={cmsNameInput}
                onChange={(e) => setCmsNameInput(e.target.value)}
                placeholder="e.g. WordPress, Shopify, Ghost"
              />
            </div>
            <div className="mb-3">
              <Label htmlFor="cms-key">CMS Key</Label>
              <Input
                id="cms-key"
                value={cmsKeyInput}
                onChange={(e) => setCmsKeyInput(e.target.value)}
                disabled={editingCms !== null}
                placeholder="e.g. wordpress (auto from name if empty)"
                className="font-mono"
              />
            </div>
            <div className="mb-3">
              <Label htmlFor="cms-desc">Description</Label>
              <Textarea
                id="cms-desc"
                value={cmsDescInput}
                onChange={(e) => setCmsDescInput(e.target.value)}
                placeholder="Mô tả CMS Type…"
              />
            </div>
            <div className="mb-4">
              <label
                htmlFor="cms-enabled"
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  id="cms-enabled"
                  type="checkbox"
                  checked={cmsEnabledInput}
                  onChange={(e) => setCmsEnabledInput(e.target.checked)}
                  className="size-4 rounded border-border"
                />
                <span>Enabled for new Sites</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCmsModalOpen(false)}
                disabled={isSavingCms}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleSaveCms()}
                disabled={isSavingCms || !mutationsEnabled}
              >
                {isSavingCms ? 'Saving...' : 'Save CMS Type'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
