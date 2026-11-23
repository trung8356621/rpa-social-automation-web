import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import type {
  AddVariantInput,
  CreateVariantGroupInput,
  PersistedVariantGroup,
  UpdateVariantInput,
} from '../api/variant-groups-api'
import type { ScriptDetail, ScriptListItem, ScriptSharingMode } from '../types'
import { partitionScriptsIntoVariantGroups } from '../variant-groups'
import { CreateVariantGroupModal } from './CreateVariantGroupModal'
import { PersistedVariantGroupCard } from './PersistedVariantGroupCard'
import { RemoveScriptDialog } from './RemoveScriptDialog'
import { ScriptCard } from './ScriptCard'
import { ScriptDetailsDrawer } from './ScriptDetailsDrawer'
import { ScriptVariantGroupCard } from './ScriptVariantGroupCard'
import {
  VideoPlayerModal,
  videoTargetFromScript,
  type VideoPlayerTarget,
} from './VideoPlayerModal'

type VariantGroupsController = {
  groups: PersistedVariantGroup[]
  loading: boolean
  error: string | null
  unavailable: boolean
  unavailableReason: string | null
  createGroup: (input: CreateVariantGroupInput) => Promise<unknown>
  addVariant: (groupId: string, input: AddVariantInput) => Promise<unknown>
  updateVariant: (
    groupId: string,
    variantId: string,
    input: UpdateVariantInput,
  ) => Promise<unknown>
  removeVariant: (groupId: string, variantId: string) => Promise<unknown>
  reorderVariants: (groupId: string, variantIds: string[]) => Promise<unknown>
}

type ScriptsScreenProps = {
  scripts: ScriptListItem[]
  getDetail: (packageKey: string) => ScriptDetail | null
  detailLoading?: boolean
  detailError?: string | null
  mutationsEnabled?: boolean
  mode?: 'mock' | 'live'
  onRemoveScript: (packageKey: string) => Promise<void>
  onUpdateSharing?: (
    packageKey: string,
    sharingMode: ScriptSharingMode,
  ) => Promise<void>
  variantGroups?: VariantGroupsController
}

export function ScriptsScreen({
  scripts,
  getDetail,
  detailLoading = false,
  detailError = null,
  mutationsEnabled = true,
  mode = 'mock',
  onRemoveScript,
  onUpdateSharing,
  variantGroups,
}: ScriptsScreenProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [removing, setRemoving] = useState(false)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const [videoTarget, setVideoTarget] = useState<VideoPlayerTarget | null>(null)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)

  const selectedKey = searchParams.get('detail')
  const playKey = searchParams.get('play')
  const detail = selectedKey ? getDetail(selectedKey) : null

  const setDetail = (packageKey: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (packageKey) next.set('detail', packageKey)
    else next.delete('detail')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (!playKey) return
    const script = scripts.find((s) => s.package_key === playKey)
    if (script) setVideoTarget(videoTargetFromScript(script))
  }, [playKey, scripts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scripts.filter((s) => {
      if (statusFilter === 'auth' && !s.is_authentication) return false
      if (statusFilter === 'published' && s.status !== 'published') return false
      if (statusFilter === 'review' && s.assets_complete) return false
      if (statusFilter === 'disabled' && s.status !== 'yanked') return false
      if (statusFilter === 'missing-video' && s.video_demo_status !== 'missing')
        return false
      if (!q) return true
      const hay = [
        s.name,
        s.script_id,
        s.package_key,
        s.action_tag_key ?? '',
        s.version,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [scripts, search, statusFilter])

  const openVideo = (script: ScriptListItem) => {
    setVideoTarget({
      ...videoTargetFromScript(script),
      playbackMode: mode === 'live' ? 'live' : 'mock',
    })
  }

  const isLive = mode === 'live'
  const persistedGroups = variantGroups?.groups ?? []
  const persistedPkgKeys = useMemo(() => {
    const set = new Set<string>()
    for (const g of persistedGroups) {
      for (const v of g.variants) set.add(v.package_key)
    }
    return set
  }, [persistedGroups])

  const ungroupedCandidates = useMemo(
    () => filtered.filter((s) => !persistedPkgKeys.has(s.package_key)),
    [filtered, persistedPkgKeys],
  )

  const partitioned = useMemo(
    () =>
      partitionScriptsIntoVariantGroups(ungroupedCandidates, {
        backendSupported: false,
      }),
    [ungroupedCandidates],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Script Registry"
        description={
          isLive
            ? 'Catalog Script dạng card 16:9 + video demo (Staff Session LIVE).'
            : 'Catalog Script dạng card 16:9 + video demo. MOCK local — không gọi API production.'
        }
        actions={
          variantGroups ? (
            <Button
              size="sm"
              disabled={variantGroups.unavailable}
              onClick={() => setCreateGroupOpen(true)}
            >
              <Plus className="size-3.5" />
              Create Variant Group
            </Button>
          ) : undefined
        }
      />

      {variantGroups?.unavailable ? (
        <div
          role="alert"
          className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          <span className="font-medium">Variant Groups API unavailable:</span>{' '}
          {variantGroups.unavailableReason ||
            'The Backend Variant Groups endpoint or schema is not available on this server. LIVE variant group mutations are disabled.'}
        </div>
      ) : null}

      {variantGroups?.error ? (
        <div
          role="alert"
          className="rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {variantGroups.error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            className="pl-8"
            placeholder="Search name, script id, action tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search scripts"
          />
        </div>
        <Select
          className="w-full sm:w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter scripts"
        >
          <option value="all">All scripts</option>
          <option value="published">Published</option>
          <option value="review">Review (assets)</option>
          <option value="disabled">Disabled</option>
          <option value="missing-video">Missing video</option>
          <option value="auth">
            {isLive ? 'Authentication' : 'Authentication (MOCK)'}
          </option>
        </Select>
      </div>

      {scripts.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No scripts</p>
          <p className="mt-1 text-sm text-muted">
            {isLive
              ? 'Chưa có Script published trong Staff Registry.'
              : 'Script Registry trống (MOCK empty demo).'}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No matches</p>
          <p className="mt-1 text-sm text-muted">
            Không có Script khớp bộ lọc hiện tại.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => {
              setSearch('')
              setStatusFilter('all')
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {persistedGroups.length > 0 ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Variant Groups ({persistedGroups.length})
                </h2>
                <p className="text-xs text-muted">
                  Logical Action groups with explicit language fallback priority.
                </p>
              </div>
              <div className="space-y-3">
                {persistedGroups.map((group) => (
                  <PersistedVariantGroupCard
                    key={group.id}
                    group={group}
                    scripts={scripts}
                    mutationsDisabled={Boolean(variantGroups?.unavailable)}
                    onOpenDetails={setDetail}
                    onAddVariant={variantGroups!.addVariant}
                    onUpdateVariant={variantGroups!.updateVariant}
                    onRemoveVariant={variantGroups!.removeVariant}
                    onReorderVariants={variantGroups!.reorderVariants}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {partitioned.groups.length > 0 ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Action Variant Groups ({partitioned.groups.length})
                  </h2>
                  <p className="text-xs text-muted">
                    {isLive
                      ? 'Read-only preview: Backend variant group & fallback priority persistence API is not available yet.'
                      : 'MOCK preview: configure language labels and fallback priority order per logical Action.'}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {partitioned.groups.map((group) => (
                  <ScriptVariantGroupCard
                    key={group.group_key}
                    group={group}
                    mode={mode}
                    onOpenDetails={setDetail}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {partitioned.ungrouped.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2 min-[1400px]:grid-cols-3">
              {partitioned.ungrouped.map((script) => (
                <ScriptCard
                  key={script.package_key}
                  script={script}
                  removeEnabled={mutationsEnabled}
                  onOpenDetails={setDetail}
                  onPlayVideo={openVideo}
                  onRemove={setConfirmKey}
                  onUpdateSharing={onUpdateSharing}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}

      {selectedKey && detailLoading && !detail ? (
        <div className="fixed inset-0 z-40 flex items-center justify-end">
          <div className="h-full w-full max-w-lg border-l border-border bg-surface p-4">
            <p className="text-sm font-medium text-foreground">
              Loading script detail…
            </p>
            <p className="mt-1 text-sm text-muted">{selectedKey}</p>
          </div>
        </div>
      ) : null}

      {selectedKey && detailError && !detail ? (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            aria-label="Close detail error overlay"
            className="absolute inset-0 bg-foreground/20"
            onClick={() => setDetail(null)}
          />
          <div className="relative z-10 h-full w-full max-w-lg border-l border-border bg-surface p-4">
            <p className="text-sm font-medium text-danger">
              Không tải được chi tiết Script
            </p>
            <p className="mt-1 text-sm text-muted">{detailError}</p>
            <Button className="mt-3" variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      <ScriptDetailsDrawer
        open={Boolean(selectedKey && detail)}
        detail={detail}
        onClose={() => setDetail(null)}
        onPlayRelease={(target) =>
          setVideoTarget({ ...target, playbackMode: isLive ? 'live' : 'mock' })
        }
        onUpdateSharing={onUpdateSharing}
      />

      <VideoPlayerModal
        open={Boolean(videoTarget)}
        target={videoTarget}
        onClose={() => setVideoTarget(null)}
      />

      {variantGroups ? (
        <CreateVariantGroupModal
          open={createGroupOpen}
          onClose={() => setCreateGroupOpen(false)}
          scripts={scripts}
          disabled={variantGroups.unavailable}
          onCreate={variantGroups.createGroup}
        />
      ) : null}

      {mutationsEnabled ? (
        <RemoveScriptDialog
          open={Boolean(confirmKey)}
          packageKey={confirmKey}
          busy={removing}
          onCancel={() => setConfirmKey(null)}
          onConfirm={() => {
            if (!confirmKey) return
            setRemoving(true)
            void onRemoveScript(confirmKey)
              .then(() => {
                if (selectedKey === confirmKey) setDetail(null)
                setConfirmKey(null)
              })
              .finally(() => setRemoving(false))
          }}
        />
      ) : null}
    </div>
  )
}
