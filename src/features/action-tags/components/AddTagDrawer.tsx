import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type {
  ActionItem,
  ActionTagItem,
  AuthScriptOption,
  PathItem,
  Site,
} from '../types'
import { formatAuthScriptLabel } from '../types'

type AddTagDrawerProps = {
  open: boolean
  mode?: 'create' | 'edit-auth'
  editingTag?: ActionTagItem | null
  sites: Site[]
  paths: PathItem[]
  actions: ActionItem[]
  authScripts: AuthScriptOption[]
  onClose: () => void
  onOpenSitesPaths: () => void
  onCreate: (data: {
    site_id: number
    path_id: number
    action_key: string
    auth_script_id?: string | null
  }) => Promise<void>
  onUpdateAuthScript?: (
    tagId: number,
    authScriptId: string | null,
  ) => Promise<void>
}

export function AddTagDrawer({
  open,
  mode = 'create',
  editingTag = null,
  sites,
  paths,
  actions,
  authScripts,
  onClose,
  onOpenSitesPaths,
  onCreate,
  onUpdateAuthScript,
}: AddTagDrawerProps) {
  const isEditAuth = mode === 'edit-auth' && editingTag

  const displayActions =
    actions.length > 0
      ? actions
      : [
          { id: 1, key: 'post', name: 'Post' },
          { id: 2, key: 'comment', name: 'Comment' },
          { id: 3, key: 'collect', name: 'Collect' },
        ]

  const [selectedSiteId, setSelectedSiteId] = useState<number | ''>(
    sites[0]?.id ?? '',
  )
  const [selectedPathId, setSelectedPathId] = useState<number | ''>('')
  const [selectedActionKey, setSelectedActionKey] = useState('post')
  const [selectedAuthScriptId, setSelectedAuthScriptId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [drawerError, setDrawerError] = useState('')

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === Number(selectedSiteId)),
    [sites, selectedSiteId],
  )

  const drawerSitePaths = useMemo(() => {
    if (!selectedSiteId) return []
    return paths.filter((p) => p.site_id === Number(selectedSiteId))
  }, [paths, selectedSiteId])

  useEffect(() => {
    if (!open) return
    setDrawerError('')
    if (isEditAuth && editingTag) {
      setSelectedSiteId(editingTag.site_id ?? '')
      setSelectedPathId(editingTag.path_id ?? '')
      setSelectedActionKey(editingTag.action_key)
      setSelectedAuthScriptId(editingTag.auth_script?.script_id ?? '')
      return
    }
    setSelectedSiteId(sites[0]?.id ?? '')
    setSelectedActionKey(actions[0]?.key ?? 'post')
    setSelectedAuthScriptId('')
  }, [open, sites, actions, isEditAuth, editingTag])

  useEffect(() => {
    if (isEditAuth) return
    if (drawerSitePaths.length > 0) {
      if (!drawerSitePaths.some((p) => p.id === selectedPathId)) {
        setSelectedPathId(drawerSitePaths[0].id)
      }
    } else {
      setSelectedPathId('')
    }
  }, [drawerSitePaths, selectedPathId, isEditAuth])

  const previewTagKey = useMemo(() => {
    if (isEditAuth && editingTag) return editingTag.tag_key
    const s = selectedSite
    const p = paths.find((x) => x.id === Number(selectedPathId))
    if (!s || !p || !selectedActionKey) return ''
    return `${s.key}.${p.key}.${selectedActionKey}`
  }, [
    isEditAuth,
    editingTag,
    selectedSite,
    paths,
    selectedPathId,
    selectedActionKey,
  ])

  /**
   * MOCK presentation filter only when seed has compatible_site_keys.
   * Unknown compatibility (null/omitted) stays visible with unverified label — no backend rule.
   */
  const selectableAuthScripts = useMemo(() => {
    const siteKey = selectedSite?.key
    return authScripts.filter((s) => {
      if (!s.is_authentication) return false
      if (!s.compatible_site_keys || s.compatible_site_keys.length === 0) {
        return true
      }
      if (!siteKey) return true
      return s.compatible_site_keys.includes(siteKey)
    })
  }, [authScripts, selectedSite?.key])

  useEffect(() => {
    if (!selectedAuthScriptId) return
    const stillValid = selectableAuthScripts.some(
      (s) => s.script_id === selectedAuthScriptId,
    )
    if (!stillValid) {
      setSelectedAuthScriptId('')
    }
  }, [selectableAuthScripts, selectedAuthScriptId])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = async () => {
    setDrawerError('')
    setIsSubmitting(true)
    try {
      if (isEditAuth && editingTag && onUpdateAuthScript) {
        await onUpdateAuthScript(
          editingTag.id,
          selectedAuthScriptId ? selectedAuthScriptId : null,
        )
        onClose()
        return
      }

      if (!selectedSiteId || !selectedPathId || !selectedActionKey) {
        setDrawerError('Vui lòng chọn đầy đủ Site, Path và Action.')
        return
      }
      await onCreate({
        site_id: Number(selectedSiteId),
        path_id: Number(selectedPathId),
        action_key: selectedActionKey,
        auth_script_id: selectedAuthScriptId || null,
      })
      onClose()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Lỗi khi lưu Action Tag'
      setDrawerError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer overlay"
        className="absolute inset-0 bg-foreground/20"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tag-title"
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-surface"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 id="add-tag-title" className="text-base font-semibold">
              {isEditAuth ? 'Edit Auth Script' : 'Add Action Tag'}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {isEditAuth
                ? 'MOCK — chỉnh liên kết Auth Script trên dữ liệu local'
                : 'Liên kết Site, Path và Action (tự động tạo Script Request)'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {isEditAuth ? (
            <div className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
              Backend chưa có endpoint update Action Tag / Auth Script đã xác minh.
              Thay đổi chỉ lưu mock local — không gọi API.
            </div>
          ) : null}

          {drawerError ? (
            <div className="rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {drawerError}
            </div>
          ) : null}

          <div>
            <Label htmlFor="drawer-site">Site</Label>
            <Select
              id="drawer-site"
              value={selectedSiteId === '' ? '' : String(selectedSiteId)}
              onChange={(e) =>
                setSelectedSiteId(e.target.value ? Number(e.target.value) : '')
              }
              disabled={Boolean(isEditAuth)}
            >
              {sites.length === 0 ? (
                <option value="">(Chưa có Site nào)</option>
              ) : (
                sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </Select>
            {!isEditAuth && sites.length === 0 ? (
              <p className="mt-1.5 text-xs text-warning">
                Chưa có website nào trong hệ thống.{' '}
                <button
                  type="button"
                  className="font-medium underline"
                  onClick={() => {
                    onClose()
                    onOpenSitesPaths()
                  }}
                >
                  Tạo Site →
                </button>
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="drawer-path">Path</Label>
            <Select
              id="drawer-path"
              value={selectedPathId === '' ? '' : String(selectedPathId)}
              onChange={(e) =>
                setSelectedPathId(e.target.value ? Number(e.target.value) : '')
              }
              disabled={Boolean(isEditAuth) || drawerSitePaths.length === 0}
            >
              {drawerSitePaths.length === 0 ? (
                <option value="">(Chưa có Path nào cho Site này)</option>
              ) : (
                drawerSitePaths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.url_pattern})
                  </option>
                ))
              )}
            </Select>
          </div>

          <div>
            <Label>Available Actions</Label>
            <div className="space-y-2">
              {displayActions.map((act) => {
                const isSelected = selectedActionKey === act.key
                return (
                  <button
                    key={act.key}
                    type="button"
                    disabled={Boolean(isEditAuth)}
                    onClick={() => setSelectedActionKey(act.key)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[var(--radius-control)] border px-3 py-2.5 text-left text-sm transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5 font-medium text-primary'
                        : 'border-border bg-surface text-foreground hover:bg-surface-muted',
                      isEditAuth && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded-full border',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border',
                      )}
                      aria-hidden
                    >
                      {isSelected ? '•' : null}
                    </span>
                    {act.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label>Tag Key Preview</Label>
            <code className="block break-all rounded-[var(--radius-control)] border border-border bg-surface-muted px-2.5 py-2 font-mono text-xs text-foreground">
              {previewTagKey || '—'}
            </code>
          </div>

          <div className="min-w-0">
            <Label htmlFor="drawer-auth-script">Authentication Script (Optional)</Label>
            <Select
              id="drawer-auth-script"
              className="max-w-full"
              value={selectedAuthScriptId}
              onChange={(e) => setSelectedAuthScriptId(e.target.value)}
              aria-describedby="auth-script-help"
            >
              <option value="">Không sử dụng</option>
              {selectableAuthScripts.length === 0 ? (
                <option value="" disabled>
                  (Không có Auth Script tương thích Site này — MOCK)
                </option>
              ) : (
                selectableAuthScripts.map((script) => {
                  const disabled = script.status !== 'published'
                  const label = formatAuthScriptLabel(script)
                  const statusSuffix =
                    script.status === 'published' ? '' : ` — ${script.status}`
                  const unverifiedSite =
                    !script.compatible_site_keys ||
                    script.compatible_site_keys.length === 0
                      ? ' — site chưa xác minh'
                      : ''
                  return (
                    <option
                      key={script.script_id}
                      value={script.script_id}
                      disabled={disabled}
                    >
                      {label}
                      {statusSuffix}
                      {unverifiedSite}
                    </option>
                  )
                })
              )}
            </Select>
            <p
              id="auth-script-help"
              className="mt-1.5 text-xs leading-relaxed text-muted"
            >
              Script này được chạy trước Checkpoint khi Client mở Browser.
              Catalog MOCK: lọc theo `compatible_site_keys` seed local nếu có;
              chưa có contract backend cho flag Authentication hay Site↔Auth
              compatibility. Đổi Site sẽ bỏ chọn Auth Script không còn trong
              danh sách.
            </p>
          </div>

          {!isEditAuth ? (
            <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-2 text-xs text-muted">
              Tự động tạo Script Request: sau khi tạo Tag, hệ thống sẽ kích hoạt
              Script Request (loại create) để kỹ thuật viên RPA nhận việc.
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : isEditAuth
                ? 'Save Auth Script (MOCK)'
                : 'Create Tag'}
          </Button>
        </footer>
      </aside>
    </div>
  )
}
