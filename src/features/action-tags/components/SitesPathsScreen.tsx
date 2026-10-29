import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import type { PathItem, Site } from '../types'
import { parseInputsFromPattern, resolveUrl } from '../utils'

type SitesPathsScreenProps = {
  sites: Site[]
  paths: PathItem[]
  /** False when live mutations are intentionally gated */
  mutationsEnabled?: boolean
  onBackToTags: () => void
  onSaveSite: (siteData: {
    id?: number
    name: string
    base_url?: string
    base_url_mode?: 'fixed' | 'dynamic'
    test_base_url?: string
    description?: string
  }) => Promise<void>
  onSavePath: (pathData: {
    id?: number
    site_id: number
    name: string
    url_pattern: string
    description?: string
  }) => Promise<void>
}

export function SitesPathsScreen({
  sites,
  paths,
  mutationsEnabled = true,
  onBackToTags,
  onSaveSite,
  onSavePath,
}: SitesPathsScreenProps) {
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id ?? 0)
  const [siteSearch, setSiteSearch] = useState('')
  const [selectedPathId, setSelectedPathId] = useState<number | 'new' | null>(
    null,
  )
  const [pathNameInput, setPathNameInput] = useState('')
  const [pathPatternInput, setPathPatternInput] = useState('/')
  const [testValues, setTestValues] = useState<Record<string, string>>({})
  const [isSavingPath, setIsSavingPath] = useState(false)
  const [pathError, setPathError] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [currentTestBaseUrl, setCurrentTestBaseUrl] = useState('')

  const [siteModalOpen, setSiteModalOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [siteBaseUrlMode, setSiteBaseUrlMode] = useState<'fixed' | 'dynamic'>(
    'fixed',
  )
  const [siteNameInput, setSiteNameInput] = useState('')
  const [siteBaseUrlInput, setSiteBaseUrlInput] = useState('')
  const [siteTestBaseUrlInput, setSiteTestBaseUrlInput] = useState('')
  const [siteDescInput, setSiteDescInput] = useState('')
  const [isSavingSite, setIsSavingSite] = useState(false)
  const [siteError, setSiteError] = useState('')

  const activeSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || sites[0] || null,
    [sites, selectedSiteId],
  )
  const isDynamicSite = activeSite?.base_url_mode === 'dynamic'
  const activeSitePaths = useMemo(() => {
    if (!activeSite) return []
    return paths.filter((p) => p.site_id === activeSite.id)
  }, [paths, activeSite])

  useEffect(() => {
    if (!activeSite) {
      setCurrentTestBaseUrl('')
      return
    }
    if (activeSite.base_url_mode === 'dynamic') {
      const stored = localStorage.getItem(`sa_test_base_url_${activeSite.id}`)
      setCurrentTestBaseUrl(
        stored ?? (activeSite.test_base_url || 'https://example.test/blog/'),
      )
    } else {
      setCurrentTestBaseUrl(activeSite.base_url || '')
    }
  }, [activeSite])

  const selectPath = (p: PathItem) => {
    setSelectedPathId(p.id)
    setPathNameInput(p.name)
    setPathPatternInput(p.url_pattern)
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
    if (activeSitePaths.length > 0) {
      const current = activeSitePaths.find((p) => p.id === selectedPathId)
      if (!current && selectedPathId !== 'new') {
        const first = activeSitePaths[0]
        setSelectedPathId(first.id)
        setPathNameInput(first.name)
        setPathPatternInput(first.url_pattern)
        setPathError('')
        const initialTests: Record<string, string> = {}
        for (const input of first.path_inputs ?? []) {
          if (input.key === 'group_id') initialTests[input.key] = '123456789'
          else if (input.key === 'post_id') initialTests[input.key] = '987654321'
          else if (input.key === 'username') initialTests[input.key] = 'demo_user'
          else initialTests[input.key] = 'sample_value'
        }
        setTestValues(initialTests)
      }
    } else {
      setSelectedPathId('new')
      setPathNameInput('')
      setPathPatternInput('/')
      setTestValues({})
    }
  }, [activeSite?.id, activeSitePaths, selectedPathId])

  const startAddPath = () => {
    if (!activeSite) {
      openAddSiteModal()
      return
    }
    setSelectedPathId('new')
    setPathNameInput('')
    setPathPatternInput('/wp-admin/post-new.php')
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
    const effectiveBase = isDynamicSite
      ? currentTestBaseUrl
      : activeSite.base_url
    return resolveUrl(effectiveBase, pathPatternInput, testValues)
  }, [activeSite, isDynamicSite, currentTestBaseUrl, pathPatternInput, testValues])

  const filteredSites = useMemo(() => {
    if (!siteSearch) return sites
    const q = siteSearch.toLowerCase()
    return sites.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        (s.base_url || '').toLowerCase().includes(q) ||
        (s.test_base_url || '').toLowerCase().includes(q)
      )
    })
  }, [sites, siteSearch])

  const openAddSiteModal = () => {
    setEditingSite(null)
    setSiteBaseUrlMode('fixed')
    setSiteNameInput('')
    setSiteBaseUrlInput('https://')
    setSiteTestBaseUrlInput('')
    setSiteDescInput('')
    setSiteError('')
    setSiteModalOpen(true)
  }

  const openEditSiteModal = (site: Site) => {
    setEditingSite(site)
    setSiteBaseUrlMode(site.base_url_mode ?? 'fixed')
    setSiteNameInput(site.name)
    setSiteBaseUrlInput(site.base_url || '')
    setSiteTestBaseUrlInput(site.test_base_url || '')
    setSiteDescInput(site.description || '')
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
      await onSavePath({
        id: selectedPathId === 'new' ? undefined : (selectedPathId ?? undefined),
        site_id: activeSite.id,
        name: pathNameInput.trim(),
        url_pattern: pathPatternInput.trim(),
      })
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
    if (siteBaseUrlMode === 'fixed' && !siteBaseUrlInput.trim()) {
      setSiteError('Vui lòng nhập Base URL hợp lệ cho Site cố định.')
      return
    }
    setSiteError('')
    setIsSavingSite(true)
    try {
      await onSaveSite({
        id: editingSite?.id,
        name: siteNameInput.trim(),
        base_url: siteBaseUrlMode === 'fixed' ? siteBaseUrlInput.trim() : '',
        base_url_mode: siteBaseUrlMode,
        test_base_url: siteTestBaseUrlInput.trim() || undefined,
        description: siteDescInput.trim() || undefined,
      })
      setSiteModalOpen(false)
    } catch (err) {
      setSiteError(err instanceof Error ? err.message : 'Lỗi khi lưu Site')
    } finally {
      setIsSavingSite(false)
    }
  }

  const handleTestBaseUrlChange = (val: string) => {
    setCurrentTestBaseUrl(val)
    if (activeSite?.base_url_mode === 'dynamic') {
      localStorage.setItem(`sa_test_base_url_${activeSite.id}`, val)
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
              Add Path
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
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {site.name}
                        </span>
                        {isDynamic ? (
                          <Badge variant="primary">Dynamic</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                        {isDynamic
                          ? site.test_base_url
                            ? `Test: ${site.test_base_url}`
                            : 'Dynamic Base URL'
                          : site.base_url}
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
              {isDynamicSite ? <Badge variant="primary">Dynamic CMS</Badge> : null}
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
                      const isSelected = selectedPathId === path.id
                      return (
                        <tr
                          key={path.id}
                          className={cn(
                            'cursor-pointer border-b border-border last:border-b-0',
                            isSelected ? 'bg-primary/5' : 'hover:bg-surface-muted/60',
                          )}
                          onClick={() => selectPath(path)}
                        >
                          <td className="px-3 py-2.5">{path.name}</td>
                          <td className="px-3 py-2.5 font-mono text-xs">
                            {path.url_pattern}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={(e) => {
                                e.stopPropagation()
                                selectPath(path)
                              }}
                              aria-label={`Edit ${path.name}`}
                            >
                              <Pencil className="size-3.5" />
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
              {selectedPathId === 'new' ? 'Add Path' : 'Edit Path'} ·{' '}
              {pathNameInput || 'New Path'}
            </h3>

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

            {isDynamicSite ? (
              <div className="mt-3 rounded-[var(--radius-control)] border border-border bg-surface-muted p-2.5">
                <Label htmlFor="test-base">Test Base URL</Label>
                <Input
                  id="test-base"
                  value={currentTestBaseUrl}
                  onChange={(e) => handleTestBaseUrlChange(e.target.value)}
                  className="font-mono text-xs"
                  placeholder="https://example.test/blog/"
                />
                <p className="mt-1 text-[11px] text-muted">
                  Chỉ dùng preview/test — không dùng làm URL production.
                </p>
              </div>
            ) : null}

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
                    ['dynamic', 'Dynamic', 'WordPress / domain động'],
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
              <Label htmlFor="site-name">Site Name *</Label>
              <Input
                id="site-name"
                value={siteNameInput}
                onChange={(e) => setSiteNameInput(e.target.value)}
                placeholder="e.g. WordPress, Facebook"
              />
            </div>

            {siteBaseUrlMode === 'fixed' ? (
              <div className="mb-3">
                <Label htmlFor="site-base">Base URL *</Label>
                <Input
                  id="site-base"
                  value={siteBaseUrlInput}
                  onChange={(e) => setSiteBaseUrlInput(e.target.value)}
                  className="font-mono"
                  placeholder="https://www.facebook.com"
                />
              </div>
            ) : (
              <div className="mb-3">
                <Label htmlFor="site-test-base">Test Base URL</Label>
                <Input
                  id="site-test-base"
                  value={siteTestBaseUrlInput}
                  onChange={(e) => setSiteTestBaseUrlInput(e.target.value)}
                  className="font-mono"
                  placeholder="https://example.test/blog/"
                />
                <p className="mt-1 text-[11px] text-muted">
                  Không bắt buộc Base URL cố định. Test URL chỉ cho preview.
                </p>
              </div>
            )}

            <div className="mb-4">
              <Label htmlFor="site-desc">Description (Optional)</Label>
              <Textarea
                id="site-desc"
                value={siteDescInput}
                onChange={(e) => setSiteDescInput(e.target.value)}
                placeholder="Mô tả website…"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSiteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleSaveSite()}
                disabled={isSavingSite || !mutationsEnabled}
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
      ) : null}
    </div>
  )
}
