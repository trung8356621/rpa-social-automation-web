import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Layers, Pencil, Plus, Trash2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toSafeApiMessage } from '@/lib/api/errors'
import { cn } from '@/lib/utils'

import {
  computeSiteDeleteSummary,
  formatCmsTypeLabel,
  getCmsPathTemplates,
  resolveEffectivePathsForSite,
} from '../cms-templates'
import type { ActionTagItem, CmsType, CmsTypeItem, PathItem, Site } from '../types'
import { parseInputsFromPattern, resolveUrl } from '../utils'

type SitesPathsScreenProps = {
  sites: Site[]
  paths: PathItem[]
  tags?: ActionTagItem[]
  cmsTypes?: CmsTypeItem[]
  /** False when live mutations are intentionally gated */
  mutationsEnabled?: boolean
  onBackToTags: () => void
  onOpenCmsManager?: () => void
  onSaveSite: (siteData: {
    id?: number
    name: string
    base_url?: string
    base_url_mode?: 'fixed' | 'dynamic'
    cms_type?: CmsType | null
    description?: string
  }) => Promise<{ id?: number } | void>
  onDeleteSite: (siteId: number, siteName: string) => Promise<void>
  onSavePath: (pathData: {
    id?: number
    site_id: number
    key?: string
    name: string
    url_pattern: string
    description?: string
    is_authentication?: boolean
    template_key?: string | null
  }) => Promise<{ id: number; is_authentication: boolean } | void>
}

export function SitesPathsScreen({
  sites,
  paths,
  tags = [],
  cmsTypes = [],
  mutationsEnabled = true,
  onBackToTags,
  onOpenCmsManager,
  onSaveSite,
  onDeleteSite,
  onSavePath,
}: SitesPathsScreenProps) {
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id ?? 0)
  const [siteSearch, setSiteSearch] = useState('')
  const [selectedPathId, setSelectedPathId] = useState<number | 'new' | null>(
    null,
  )
  const [pathNameInput, setPathNameInput] = useState('')
  const [pathPatternInput, setPathPatternInput] = useState('/')
  const [pathIsAuthentication, setPathIsAuthentication] = useState(false)
  const [pathTemplateKey, setPathTemplateKey] = useState<string | null>(null)
  const [pathKeyInput, setPathKeyInput] = useState<string | undefined>(undefined)
  const [testValues, setTestValues] = useState<Record<string, string>>({})
  const [isSavingPath, setIsSavingPath] = useState(false)
  const [pathError, setPathError] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(false)

  const [siteModalOpen, setSiteModalOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [siteBaseUrlMode, setSiteBaseUrlMode] = useState<'fixed' | 'dynamic'>(
    'fixed',
  )
  const [siteCmsType, setSiteCmsType] = useState<CmsType | ''>('')
  const [siteNameInput, setSiteNameInput] = useState('')
  const [siteBaseUrlInput, setSiteBaseUrlInput] = useState('')
  const [siteDescInput, setSiteDescInput] = useState('')
  const [isSavingSite, setIsSavingSite] = useState(false)
  const [isDeletingSite, setIsDeletingSite] = useState(false)
  const [confirmDeleteSite, setConfirmDeleteSite] = useState(false)
  const [siteError, setSiteError] = useState('')
  const prevSiteIdRef = useRef<number | null>(null)

  const modalTemplatePreview = useMemo(
    () => getCmsPathTemplates(siteCmsType || null, cmsTypes),
    [siteCmsType, cmsTypes],
  )

  const selectableCmsTypes = useMemo(() => {
    const enabled = cmsTypes.filter((c) => c.is_enabled)
    if (
      editingSite?.cms_type &&
      !enabled.some((c) => c.key === editingSite.cms_type)
    ) {
      const existing = cmsTypes.find((c) => c.key === editingSite.cms_type)
      if (existing) return [existing, ...enabled]
      return [
        {
          id: -1,
          key: editingSite.cms_type,
          name: editingSite.cms_type,
          is_enabled: false,
          path_templates: [],
        } satisfies CmsTypeItem,
        ...enabled,
      ]
    }
    return enabled
  }, [cmsTypes, editingSite?.cms_type])

  const editingSiteDeleteSummary = useMemo(
    () =>
      editingSite
        ? computeSiteDeleteSummary(editingSite.id, paths, tags)
        : null,
    [editingSite, paths, tags],
  )

  const activeSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || sites[0] || null,
    [sites, selectedSiteId],
  )
  const isDynamicSite = activeSite?.base_url_mode === 'dynamic'
  const activeSitePaths = useMemo(() => {
    if (!activeSite) return []
    return resolveEffectivePathsForSite(activeSite, paths, cmsTypes)
  }, [paths, activeSite, cmsTypes])

  const selectPath = (p: PathItem) => {
    setSelectedPathId(p.source === 'template' ? 'new' : p.id)
    setPathNameInput(p.name)
    setPathPatternInput(p.url_pattern)
    setPathIsAuthentication(Boolean(p.is_authentication))
    setPathTemplateKey(p.template_key ?? null)
    setPathKeyInput(p.key)
    setPathError('')
    const initialTests: Record<string, string> = {}
    for (const input of p.path_inputs ?? []) {
      if (input.key === 'group_id') initialTests[input.key] = '123456789'
      else if (input.key === 'post_id') initialTests[input.key] = '987654321'
      else if (input.key === 'username') initialTests[input.key] = 'demo_user'
      else initialTests[input.key] = 'sample_value'
    }
    setTestValues(initialTests)
  }

  useEffect(() => {
    const currentSiteId = activeSite?.id ?? null
    const siteChanged = prevSiteIdRef.current !== currentSiteId
    prevSiteIdRef.current = currentSiteId

    if (activeSitePaths.length > 0) {
      if (!siteChanged) {
        const current = activeSitePaths.find(
          (p) =>
            p.id === selectedPathId ||
            (p.source === 'template' &&
              selectedPathId === 'new' &&
              pathTemplateKey === p.template_key),
        )
        if (current || selectedPathId === 'new') {
          return
        }
      }
      const first = activeSitePaths[0]
      setSelectedPathId(first.source === 'template' ? 'new' : first.id)
      setPathNameInput(first.name)
      setPathPatternInput(first.url_pattern)
      setPathIsAuthentication(Boolean(first.is_authentication))
      setPathTemplateKey(first.template_key ?? null)
      setPathKeyInput(first.key)
      setPathError('')
      const initialTests: Record<string, string> = {}
      for (const input of first.path_inputs ?? []) {
        if (input.key === 'group_id') initialTests[input.key] = '123456789'
        else if (input.key === 'post_id') initialTests[input.key] = '987654321'
        else if (input.key === 'username') initialTests[input.key] = 'demo_user'
        else initialTests[input.key] = 'sample_value'
      }
      setTestValues(initialTests)
    } else {
      setSelectedPathId('new')
      setPathNameInput('')
      setPathPatternInput('/')
      setPathIsAuthentication(false)
      setPathTemplateKey(null)
      setPathKeyInput(undefined)
      setPathError('')
      setTestValues({})
    }
  }, [activeSite?.id, activeSitePaths, pathTemplateKey, selectedPathId])

  const startAddPath = () => {
    if (!activeSite) {
      openAddSiteModal()
      return
    }
    setSelectedPathId('new')
    setPathNameInput('')
    setPathPatternInput('/')
    setPathIsAuthentication(false)
    setPathTemplateKey(null)
    setPathKeyInput(undefined)
    setPathError('')
    setTestValues({})
  }

  const detectedInputs = useMemo(
    () => parseInputsFromPattern(pathPatternInput),
    [pathPatternInput],
  )

  const resolvedPreview = useMemo(() => {
    if (!activeSite) {
      return {
        url: '',
        missing: ['base_url'],
        valid: false,
        error: 'Chưa chọn Site.',
      }
    }
    // Both Fixed and Dynamic preview from canonical Site.base_url
    return resolveUrl(activeSite.base_url, pathPatternInput, testValues)
  }, [activeSite, pathPatternInput, testValues])

  const filteredSites = useMemo(() => {
    if (!siteSearch) return sites
    const q = siteSearch.toLowerCase()
    return sites.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        (s.base_url || '').toLowerCase().includes(q)
      )
    })
  }, [sites, siteSearch])

  const openAddSiteModal = () => {
    setEditingSite(null)
    setSiteBaseUrlMode('fixed')
    setSiteCmsType('')
    setSiteNameInput('')
    setSiteBaseUrlInput('https://')
    setSiteDescInput('')
    setConfirmDeleteSite(false)
    setSiteError('')
    setSiteModalOpen(true)
  }

  const openEditSiteModal = (site: Site) => {
    setEditingSite(site)
    setSiteBaseUrlMode(site.base_url_mode ?? 'fixed')
    setSiteCmsType(site.cms_type ?? '')
    setSiteNameInput(site.name)
    // Prefer canonical base_url; fall back to legacy test_base_url for edit prefill only
    setSiteBaseUrlInput(site.base_url || site.test_base_url || '')
    setSiteDescInput(site.description || '')
    setConfirmDeleteSite(false)
    setSiteError('')
    setSiteModalOpen(true)
  }

  const handleSavePath = async () => {
    if (!activeSite) return
    if (!pathNameInput.trim() || !pathPatternInput.trim()) {
      setPathError('Vui lòng điền đầy đủ Tên Path và URL Pattern.')
      return
    }
    setPathError('')
    setIsSavingPath(true)
    try {
      const saved = await onSavePath({
        id: selectedPathId === 'new' ? undefined : (selectedPathId ?? undefined),
        site_id: activeSite.id,
        key: pathKeyInput,
        name: pathNameInput.trim(),
        url_pattern: pathPatternInput.trim(),
        is_authentication: pathIsAuthentication,
        template_key: pathTemplateKey,
      })
      if (saved) {
        setSelectedPathId(saved.id)
        setPathIsAuthentication(Boolean(saved.is_authentication))
      }
    } catch (err) {
      setPathError(err instanceof Error ? err.message : 'Lỗi khi lưu Path')
    } finally {
      setIsSavingPath(false)
    }
  }

  const handleSaveSite = async () => {
    if (!siteNameInput.trim()) {
      setSiteError('Vui lòng nhập Tên Site.')
      return
    }
    if (!siteBaseUrlInput.trim()) {
      setSiteError('Vui lòng nhập Base URL.')
      return
    }
    setSiteError('')
    setIsSavingSite(true)
    try {
      const saved = await onSaveSite({
        id: editingSite?.id,
        name: siteNameInput.trim(),
        base_url: siteBaseUrlInput.trim(),
        base_url_mode: siteBaseUrlMode,
        cms_type: siteCmsType || null,
        description: siteDescInput.trim() || undefined,
      })
      if (saved && typeof saved === 'object' && saved.id) {
        setSelectedSiteId(saved.id)
      }
      setSiteModalOpen(false)
    } catch (err) {
      setSiteError(toSafeApiMessage(err))
    } finally {
      setIsSavingSite(false)
    }
  }

  const handleDeleteSite = async () => {
    if (!editingSite) return
    setSiteError('')
    setIsDeletingSite(true)
    try {
      const deletedId = editingSite.id
      await onDeleteSite(deletedId, editingSite.name)
      setConfirmDeleteSite(false)
      setSiteModalOpen(false)
      if (selectedSiteId === deletedId) {
        const remaining = sites.find((s) => s.id !== deletedId)
        setSelectedSiteId(remaining?.id ?? 0)
      }
    } catch (err) {
      setSiteError(toSafeApiMessage(err))
      setConfirmDeleteSite(false)
    } finally {
      setIsDeletingSite(false)
    }
  }

  const copyResolvedUrl = async () => {
    if (!resolvedPreview.url) return
    await navigator.clipboard.writeText(resolvedPreview.url)
    setCopiedUrl(true)
    window.setTimeout(() => setCopiedUrl(false), 2000)
  }

  return (
    <div>
      <PageHeader
        title="Sites & Paths"
        description="Quản lý Base URL, URL Patterns và Path Inputs"
        actions={
          <>
            <Button variant="ghost" onClick={onBackToTags}>
              <ArrowLeft className="size-3.5" />
              Action Tags
            </Button>
            {onOpenCmsManager ? (
              <Button variant="outline" onClick={onOpenCmsManager}>
                <Layers className="size-3.5" />
                CMS Manager
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={openAddSiteModal}
              disabled={!mutationsEnabled}
              title={
                mutationsEnabled ? undefined : 'Live editing not enabled yet'
              }
            >
              <Plus className="size-3.5" />
              Add Site
            </Button>
            <Button
              onClick={startAddPath}
              disabled={!mutationsEnabled}
              title={
                mutationsEnabled ? undefined : 'Live editing not enabled yet'
              }
            >
              <Plus className="size-3.5" />
              Add Custom Path
            </Button>
          </>
        }
      />

      {!mutationsEnabled ? (
        <div className="mb-3 rounded-[var(--radius-control)] border border-border bg-surface-muted/60 px-3 py-2 text-xs text-muted">
          Live editing not enabled yet — Sites/Paths are read-only in CP9A.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-3 xl:col-span-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Sites</h2>
            <span className="text-xs text-muted">{sites.length} site(s)</span>
          </div>
          <Input
            value={siteSearch}
            onChange={(e) => setSiteSearch(e.target.value)}
            placeholder="Search sites…"
            aria-label="Search sites"
            className="mb-2"
          />
          <div className="max-h-[28rem] space-y-1.5 overflow-y-auto">
            {sites.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted">
                <p>Chưa có website nào.</p>
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={openAddSiteModal}
                  disabled={!mutationsEnabled}
                  title={
                    mutationsEnabled
                      ? undefined
                      : 'Live editing not enabled yet'
                  }
                >
                  + Add Site
                </Button>
              </div>
            ) : filteredSites.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted">
                Không tìm thấy website phù hợp.
              </p>
            ) : (
              filteredSites.map((site) => {
                const isActive = activeSite?.id === site.id
                const isDynamic = site.base_url_mode === 'dynamic'
                return (
                  <div
                    key={site.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedSiteId(site.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedSiteId(site.id)
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
                          {site.name}
                        </span>
                        {site.cms_type && site.cms_type !== 'custom' ? (
                          <Badge variant="success">
                            {formatCmsTypeLabel(site.cms_type, cmsTypes)}
                          </Badge>
                        ) : null}
                        {isDynamic ? (
                          <Badge variant="primary">Dynamic</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                        {site.base_url || '—'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditSiteModal(site)
                      }}
                      disabled={!mutationsEnabled}
                      aria-label={`Edit ${site.name}`}
                      title={
                        mutationsEnabled
                          ? undefined
                          : 'Live editing not enabled yet'
                      }
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
          <div className="rounded-[var(--radius-card)] border border-border bg-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <h2 className="text-sm font-semibold">
                Paths · {activeSite?.name || 'Chưa chọn'}
              </h2>
              {activeSite?.cms_type && activeSite.cms_type !== 'custom' ? (
                <Badge variant="success">
                  CMS: {formatCmsTypeLabel(activeSite.cms_type, cmsTypes)}
                </Badge>
              ) : null}
              {isDynamicSite ? <Badge variant="primary">Dynamic URL</Badge> : null}
              <span className="ml-auto text-xs text-muted">
                {activeSitePaths.length} path(s)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-border bg-surface-muted/70 text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Path Name</th>
                    <th className="px-3 py-2 font-medium">URL Pattern</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSitePaths.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-sm text-muted">
                        Site này chưa có URL Path nào.
                        <div>
                          <Button
                            className="mt-3"
                            size="sm"
                            onClick={startAddPath}
                            disabled={!mutationsEnabled}
                            title={
                              mutationsEnabled
                                ? undefined
                                : 'Live editing not enabled yet'
                            }
                          >
                            + Add Path
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    activeSitePaths.map((path) => {
                      const isInherited = path.source === 'template'
                      const isSelected =
                        selectedPathId === path.id ||
                        (isInherited &&
                          selectedPathId === 'new' &&
                          pathTemplateKey === path.template_key)
                      return (
                        <tr
                          key={path.id}
                          className={cn(
                            'cursor-pointer border-b border-border last:border-b-0',
                            isSelected ? 'bg-primary/5' : 'hover:bg-surface-muted/60',
                          )}
                          onClick={() => selectPath(path)}
                        >
                          <td className="px-3 py-2.5">
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              {path.name}
                              {isInherited ? (
                                <Badge variant="neutral" className="text-[10px]">
                                  Inherited
                                </Badge>
                              ) : path.is_override ? (
                                <Badge variant="warning" className="text-[10px]">
                                  Site Override
                                </Badge>
                              ) : null}
                              {path.is_authentication ? (
                                <Badge variant="primary" className="text-[10px]">
                                  Auth Path
                                </Badge>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs">
                            {path.url_pattern}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size={isInherited ? 'sm' : 'icon'}
                              className={isInherited ? 'h-7 px-2 text-xs' : 'size-7'}
                              onClick={(e) => {
                                e.stopPropagation()
                                selectPath(path)
                              }}
                              aria-label={
                                isInherited
                                  ? `Override ${path.name}`
                                  : `Edit ${path.name}`
                              }
                            >
                              {isInherited ? (
                                'Override'
                              ) : (
                                <Pencil className="size-3.5" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3">
            <h3 className="mb-3 text-sm font-semibold">
              {pathTemplateKey && selectedPathId === 'new'
                ? 'Override CMS Path'
                : selectedPathId === 'new'
                  ? 'Add Path'
                  : 'Edit Path'}{' '}
              · {pathNameInput || 'New Path'}
            </h3>

            {pathTemplateKey ? (
              <div className="mb-3 rounded-[var(--radius-control)] border border-border bg-surface-muted/50 px-3 py-2 text-xs text-muted">
                Đang tùy chỉnh / ghi đè mẫu Path <code className="font-mono">{pathTemplateKey}</code> cho riêng Site{' '}
                <span className="font-medium text-foreground">{activeSite?.name}</span>. Mẫu dùng chung của CMS không thay đổi.
              </div>
            ) : null}

            {pathError ? (
              <div className="mb-3 rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {pathError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="path-name">Path Name</Label>
                <Input
                  id="path-name"
                  value={pathNameInput}
                  onChange={(e) => setPathNameInput(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="path-pattern">URL Pattern</Label>
                <Input
                  id="path-pattern"
                  value={pathPatternInput}
                  onChange={(e) => setPathPatternInput(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="mt-3 rounded-[var(--radius-control)] border border-border bg-surface-muted/40 px-3 py-2.5">
              <label
                htmlFor="path-is-authentication"
                className="flex cursor-pointer items-start gap-2.5"
              >
                <input
                  id="path-is-authentication"
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-border"
                  checked={pathIsAuthentication}
                  onChange={(e) => setPathIsAuthentication(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    Authentication Path
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    Đánh dấu Path dùng cho kịch bản đăng nhập. Khi Script của
                    Action Tag gắn Path này được Publish, package nhận{' '}
                    <code className="font-mono">is_authentication=true</code>.
                    Không suy ra từ tên Path/Script. Không đổi Auth pin hiện có.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-3">
              <Label>Detected Path Inputs</Label>
              <div className="overflow-hidden rounded-[var(--radius-control)] border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted text-muted">
                    <tr>
                      <th className="px-2.5 py-1.5 font-medium">Input Name</th>
                      <th className="px-2.5 py-1.5 font-medium">Type</th>
                      <th className="px-2.5 py-1.5 font-medium">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detectedInputs.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-2.5 py-3 text-muted">
                          Không có tham số biến trong URL Pattern.
                        </td>
                      </tr>
                    ) : (
                      detectedInputs.map((inp) => (
                        <tr key={inp.key} className="border-t border-border">
                          <td className="px-2.5 py-1.5 font-mono">{inp.key}</td>
                          <td className="px-2.5 py-1.5">{inp.type}</td>
                          <td className="px-2.5 py-1.5">Required</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {detectedInputs.length > 0 ? (
              <div className="mt-3 space-y-2">
                <Label>Test Path Input Values</Label>
                {detectedInputs.map((inp) => (
                  <div key={inp.key} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 font-mono text-xs text-muted">
                      {inp.key}
                    </span>
                    <Input
                      value={testValues[inp.key] ?? ''}
                      onChange={(e) =>
                        setTestValues({ ...testValues, [inp.key]: e.target.value })
                      }
                      className="font-mono text-xs"
                      placeholder="Test value…"
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Label className="mb-0">Resolved URL</Label>
                <Button variant="outline" size="sm" onClick={() => void copyResolvedUrl()}>
                  {copiedUrl ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <code className="block break-all rounded-[var(--radius-control)] border border-border bg-surface-muted px-2.5 py-2 font-mono text-xs">
                {resolvedPreview.url || '—'}
              </code>
              {resolvedPreview.error ? (
                <p className="mt-1 text-xs text-danger">{resolvedPreview.error}</p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted">
                Path Inputs are inherited by Script Requests
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (activeSitePaths.length > 0) selectPath(activeSitePaths[0])
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleSavePath()}
                  disabled={
                    isSavingPath || !activeSite || !mutationsEnabled
                  }
                  title={
                    mutationsEnabled
                      ? undefined
                      : 'Live editing not enabled yet'
                  }
                >
                  {isSavingPath ? 'Saving...' : 'Save Path'}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {siteModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal overlay"
            className="absolute inset-0 bg-foreground/20"
            onClick={() => setSiteModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="site-modal-title"
            className="relative z-10 w-full max-w-lg rounded-[var(--radius-card)] border border-border bg-surface p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="site-modal-title" className="text-base font-semibold">
                {editingSite ? 'Edit Site' : 'Add Site'}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSiteModalOpen(false)}
              >
                Close
              </Button>
            </div>

            {siteError ? (
              <div className="mb-3 rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {siteError}
              </div>
            ) : null}

            <div className="mb-3">
              <Label>Base URL Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['fixed', 'Fixed', 'Facebook, Reddit, X…'],
                    ['dynamic', 'Dynamic', 'Domain động (tùy chọn CMS Type bên dưới)'],
                  ] as const
                ).map(([mode, title, hint]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSiteBaseUrlMode(mode)}
                    className={cn(
                      'rounded-[var(--radius-control)] border px-3 py-2 text-left text-xs transition-colors',
                      siteBaseUrlMode === mode
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:bg-surface-muted',
                    )}
                  >
                    <div className="font-medium">{title}</div>
                    <div className="mt-0.5 text-muted">{hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="site-cms-type">CMS Type (Optional)</Label>
                {onOpenCmsManager ? (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      setSiteModalOpen(false)
                      onOpenCmsManager()
                    }}
                  >
                    Manage CMS Types
                  </button>
                ) : null}
              </div>
              <Select
                id="site-cms-type"
                value={siteCmsType}
                onChange={(e) => setSiteCmsType(e.target.value || '')}
              >
                <option value="">None / Custom</option>
                {selectableCmsTypes.map((cms) => (
                  <option key={cms.key} value={cms.key}>
                    {cms.name}
                    {!cms.is_enabled ? ' (Disabled)' : ''}
                    {cms.path_templates.length > 0
                      ? ` · ${cms.path_templates.length} template(s)`
                      : ''}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-muted">
                Các Site cùng CMS Type tự động kế thừa Path mẫu và tự tạo Action Tag.
              </p>
              {modalTemplatePreview.length > 0 ? (
                <div className="mt-2 rounded-[var(--radius-control)] border border-border bg-surface-muted/50 p-2.5">
                  <div className="mb-1.5 text-xs font-medium text-foreground">
                    Inherited Path Templates (
                    {formatCmsTypeLabel(siteCmsType, cmsTypes)})
                  </div>
                  <ul className="space-y-1">
                    {modalTemplatePreview.map((tpl) => (
                      <li
                        key={tpl.key}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          {tpl.name}
                          {tpl.is_authentication ? (
                            <Badge variant="primary" className="text-[10px]">
                              Auth Path
                            </Badge>
                          ) : null}
                        </span>
                        <code className="font-mono text-[11px] text-muted">
                          {tpl.url_pattern}
                        </code>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="mb-3">
              <Label htmlFor="site-name">Site Name *</Label>
              <Input
                id="site-name"
                value={siteNameInput}
                onChange={(e) => setSiteNameInput(e.target.value)}
                placeholder="e.g. WordPress, Facebook"
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="site-base">Base URL *</Label>
              <Input
                id="site-base"
                value={siteBaseUrlInput}
                onChange={(e) => setSiteBaseUrlInput(e.target.value)}
                className="font-mono"
                placeholder={
                  siteBaseUrlMode === 'dynamic'
                    ? 'https://example.test/blog/'
                    : 'https://www.facebook.com'
                }
              />
            </div>

            <div className="mb-4">
              <Label htmlFor="site-desc">Description (Optional)</Label>
              <Textarea
                id="site-desc"
                value={siteDescInput}
                onChange={(e) => setSiteDescInput(e.target.value)}
                placeholder="Mô tả website…"
              />
            </div>

            {editingSite && confirmDeleteSite ? (
              <div className="mb-3 rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 p-3">
                <p className="text-xs font-medium text-danger">
                  Xác nhận xóa Site [{editingSite.name}]?
                </p>
                <p className="mt-1 text-xs text-muted">
                  Thao tác này sẽ xóa Site nếu không có dữ liệu chặn phụ thuộc.
                </p>
                {editingSiteDeleteSummary ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-foreground">
                    <li>
                      • Site-specific Paths:{' '}
                      <span className="font-medium">
                        {editingSiteDeleteSummary.sitePathsCount}
                      </span>
                    </li>
                    <li>
                      • Action Tags:{' '}
                      <span className="font-medium">
                        {editingSiteDeleteSummary.tagsCount}
                      </span>
                    </li>
                    <li>
                      • Published Scripts:{' '}
                      <span className="font-medium">
                        {editingSiteDeleteSummary.publishedScriptsCount}
                      </span>
                    </li>
                    <li>
                      • Auth Script Pins:{' '}
                      <span className="font-medium">
                        {editingSiteDeleteSummary.authPinsCount}
                      </span>
                    </li>
                  </ul>
                ) : null}
                <div className="mt-2.5 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDeleteSite(false)}
                    disabled={isDeletingSite}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-danger/40 text-danger hover:bg-danger/10"
                    onClick={() => void handleDeleteSite()}
                    disabled={isDeletingSite}
                  >
                    {isDeletingSite ? 'Deleting...' : 'Confirm Delete'}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <div>
                {editingSite && !confirmDeleteSite ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-danger/30 text-danger hover:bg-danger/5"
                    onClick={() => setConfirmDeleteSite(true)}
                    disabled={isSavingSite || isDeletingSite || !mutationsEnabled}
                  >
                    <Trash2 className="size-3.5" />
                    Delete Site
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSiteModalOpen(false)}
                  disabled={isSavingSite || isDeletingSite}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleSaveSite()}
                  disabled={isSavingSite || isDeletingSite || !mutationsEnabled}
                  title={
                    mutationsEnabled
                      ? undefined
                      : 'Live editing not enabled yet'
                  }
                >
                  {isSavingSite ? 'Saving...' : 'Save Site'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
