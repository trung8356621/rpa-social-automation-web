import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { RpaApiMode } from '@/lib/api/config'

import {
  authAvailabilityLabel,
  describeAuthCatalogEmpty,
  filterSelectableAuthScripts,
  getAuthScriptAvailability,
} from '../auth-script-availability'
import type {
  ActionTagItem,
  AuthScriptOption,
  PathItem,
  Site,
} from '../types'
import { formatAuthScriptLabel } from '../types'
import { buildTagKey, findExistingSitePathTag } from '../utils'

type AddTagDrawerProps = {
  open: boolean
  mode?: 'create' | 'edit-auth'
  /** mock = local seed; live = staff registry + auth-pin mutations */
  dataMode?: RpaApiMode
  editingTag?: ActionTagItem | null
  sites: Site[]
  paths: PathItem[]
  tags?: ActionTagItem[]
  authScripts: AuthScriptOption[]
  onClose: () => void
  onOpenSitesPaths: () => void
  onEditExistingTag?: (tagId: number) => void
  onCreate: (data: {
    site_id: number
    path_id: number
    action_key?: string | null
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
  dataMode = 'mock',
  editingTag = null,
  sites,
  paths,
  tags = [],
  authScripts,
  onClose,
  onOpenSitesPaths,
  onEditExistingTag,
  onCreate,
  onUpdateAuthScript,
}: AddTagDrawerProps) {
  const isEditAuth = mode === 'edit-auth' && editingTag
  const isLive = dataMode === 'live'

  const [selectedSiteId, setSelectedSiteId] = useState<number | ''>(
    sites[0]?.id ?? '',
  )
  const [selectedPathId, setSelectedPathId] = useState<number | ''>('')
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

  const selectedPath = useMemo(
    () => paths.find((p) => p.id === Number(selectedPathId)),
    [paths, selectedPathId],
  )

  useEffect(() => {
    if (!open) return
    setDrawerError('')
    if (isEditAuth && editingTag) {
      setSelectedSiteId(editingTag.site_id ?? '')
      setSelectedPathId(editingTag.path_id ?? '')
      setSelectedAuthScriptId(editingTag.auth_script?.script_id ?? '')
      return
    }
    setSelectedSiteId(sites[0]?.id ?? '')
    setSelectedAuthScriptId('')
  }, [open, sites, isEditAuth, editingTag])

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
    if (!selectedSite || !selectedPath) return ''
    return buildTagKey(selectedSite.key, selectedPath.key)
  }, [isEditAuth, editingTag, selectedSite, selectedPath])

  const existingTagForSelection = useMemo(() => {
    if (isEditAuth) return null
    return findExistingSitePathTag(tags, selectedSite, selectedPath)
  }, [isEditAuth, tags, selectedSite, selectedPath])

  const selectableAuthScripts = useMemo(() => {
    const filtered = filterSelectableAuthScripts(
      authScripts,
      selectedSite?.key,
    )
    // Keep currently pinned Auth visible when reopening drawer even if catalog
    // temporarily omits it (e.g. flag cleared server-side) — mark unavailable.
    const pinned = isEditAuth ? editingTag?.auth_script : null
    if (
      pinned?.script_id &&
      !filtered.some((s) => s.script_id === pinned.script_id)
    ) {
      filtered.push({
        script_id: pinned.script_id,
        package_id: pinned.package_id,
        name: pinned.name,
        version: pinned.version,
        status: pinned.status === 'published' ? 'published' : 'unavailable',
        is_authentication: true,
        compatible_site_keys: null,
        releases:
          pinned.release_id != null
            ? [
                {
                  release_id: pinned.release_id,
                  version: pinned.version ?? '',
                  status: pinned.status === 'published' ? 'published' : 'unavailable',
                },
              ]
            : [],
      })
    }
    return filtered
  }, [
    authScripts,
    selectedSite?.key,
    isEditAuth,
    editingTag?.auth_script,
  ])

  const catalogEmpty = useMemo(
    () =>
      describeAuthCatalogEmpty(
        authScripts,
        selectableAuthScripts,
        selectedSite?.key,
      ),
    [authScripts, selectableAuthScripts, selectedSite?.key],
  )

  useEffect(() => {
    if (!selectedAuthScriptId) return
    const stillValid = selectableAuthScripts.some(
      (s) =>
        s.script_id === selectedAuthScriptId &&
        getAuthScriptAvailability(s) === 'available',
    )
    if (!stillValid) {
      // Keep pinned value visible when editing even if catalog temporarily empty;
      // clear only when switching site filter drops a non-pinned create selection.
      if (isEditAuth && editingTag?.auth_script?.script_id === selectedAuthScriptId) {
        return
      }
      setSelectedAuthScriptId('')
    }
  }, [
    selectableAuthScripts,
    selectedAuthScriptId,
    isEditAuth,
    editingTag?.auth_script?.script_id,
  ])

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

      if (!selectedSiteId || !selectedPathId) {
        setDrawerError('Vui lòng chọn đầy đủ Site và Path.')
        return
      }
      if (existingTagForSelection) {
        setDrawerError(
          `Action Tag [${existingTagForSelection.tag_key}] đã tồn tại cho Site và Path này.`,
        )
        return
      }
      await onCreate({
        site_id: Number(selectedSiteId),
        path_id: Number(selectedPathId),
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

  const editSubtitle = isLive
    ? 'LIVE — PUT /action-registry/tags/{id}/auth-pin (staff session)'
    : 'MOCK — chỉnh liên kết Auth Script trên dữ liệu local'

  const editBanner = isLive
    ? 'Save gọi API auth-pin đã xác minh, rồi reload registry. Gỡ pin = clear: true. Không lưu Client API Key trong web.'
    : 'Backend mock local — thay đổi chỉ lưu trên trình duyệt, không gọi API production.'

  const authHelp = isLive
    ? 'Script chạy trước Checkpoint khi Client mở Browser (có Action Tag context). Catalog LIVE chỉ gồm package is_authentication=true + published release. Không suy ra Authentication từ tên script/tag. Đổi Site sẽ bỏ chọn Auth không còn trong danh sách.'
    : 'Script chạy trước Checkpoint khi Client mở Browser. Catalog MOCK: lọc theo compatible_site_keys seed nếu có. Không suy ra Authentication từ tên. Đổi Site sẽ bỏ chọn Auth không còn trong danh sách.'

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
                ? editSubtitle
                : 'Liên kết Site và Path (tự động tạo Script Request)'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {isEditAuth ? (
            <div
              className={`rounded-[var(--radius-control)] border px-3 py-2 text-xs text-foreground ${
                isLive
                  ? 'border-border bg-surface-muted'
                  : 'border-warning/40 bg-warning/10'
              }`}
            >
              {editBanner}
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
            <Label>Tag Key Preview</Label>
            <code className="block break-all rounded-[var(--radius-control)] border border-border bg-surface-muted px-2.5 py-2 font-mono text-xs text-foreground">
              {previewTagKey || '—'}
            </code>
          </div>

          {!isEditAuth && existingTagForSelection ? (
            <div className="space-y-1.5 rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
              <p className="font-medium text-warning">
                Site + Path này đã có Action Tag
              </p>
              <p>
                Tag hiện tại:{' '}
                <code className="font-mono font-semibold">
                  {existingTagForSelection.tag_key}
                </code>{' '}
                ({existingTagForSelection.site_name} ·{' '}
                {existingTagForSelection.path_name}
                {existingTagForSelection.action_name
                  ? ` · ${existingTagForSelection.action_name}`
                  : ''}
                )
              </p>
              {onEditExistingTag ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() => onEditExistingTag(existingTagForSelection.id)}
                >
                  Xem / Chỉnh sửa Tag hiện tại
                </Button>
              ) : null}
            </div>
          ) : null}

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
                  (Không có Authentication Script khả dụng)
                </option>
              ) : (
                selectableAuthScripts.map((script) => {
                  const availability = getAuthScriptAvailability(script)
                  const disabled = availability !== 'available'
                  const label = formatAuthScriptLabel(script)
                  const availSuffix = authAvailabilityLabel(availability)
                  const unverifiedSite =
                    !isLive &&
                    (!script.compatible_site_keys ||
                      script.compatible_site_keys.length === 0)
                      ? ' — site chưa xác minh'
                      : ''
                  return (
                    <option
                      key={script.script_id}
                      value={script.script_id}
                      disabled={disabled}
                    >
                      {label}
                      {availSuffix ? ` — ${availSuffix}` : ''}
                      {unverifiedSite}
                    </option>
                  )
                })
              )}
            </Select>
            {catalogEmpty ? (
              <p className="mt-1.5 text-xs leading-relaxed text-warning">
                {catalogEmpty.message}
              </p>
            ) : null}
            <p
              id="auth-script-help"
              className="mt-1.5 text-xs leading-relaxed text-muted"
            >
              {authHelp}
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
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || Boolean(!isEditAuth && existingTagForSelection)}
          >
            {isSubmitting
              ? 'Saving...'
              : isEditAuth
                ? isLive
                  ? 'Save Auth Script'
                  : 'Save Auth Script (MOCK)'
                : 'Create Tag'}
          </Button>
        </footer>
      </aside>
    </div>
  )
}
