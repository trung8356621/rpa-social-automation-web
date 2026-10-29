import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import type { ScriptDetail, ScriptListItem } from '../types'
import { RemoveScriptDialog } from './RemoveScriptDialog'
import { ScriptCard } from './ScriptCard'
import { ScriptDetailsDrawer } from './ScriptDetailsDrawer'
import {
  VideoPlayerModal,
  videoTargetFromScript,
  type VideoPlayerTarget,
} from './VideoPlayerModal'

type ScriptsScreenProps = {
  scripts: ScriptListItem[]
  getDetail: (packageKey: string) => ScriptDetail | null
  detailLoading?: boolean
  detailError?: string | null
  mutationsEnabled?: boolean
  mode?: 'mock' | 'live'
  onRemoveScript: (packageKey: string) => Promise<void>
}

export function ScriptsScreen({
  scripts,
  getDetail,
  detailLoading = false,
  detailError = null,
  mutationsEnabled = true,
  mode = 'mock',
  onRemoveScript,
}: ScriptsScreenProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [removing, setRemoving] = useState(false)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const [videoTarget, setVideoTarget] = useState<VideoPlayerTarget | null>(null)

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Script Registry"
        description={
          isLive
            ? 'Catalog Script dạng card 16:9 + video demo (Staff Session LIVE).'
            : 'Catalog Script dạng card 16:9 + video demo. MOCK local — không gọi API production.'
        }
      />

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
        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2 min-[1400px]:grid-cols-3">
          {filtered.map((script) => (
            <ScriptCard
              key={script.package_key}
              script={script}
              removeEnabled={mutationsEnabled}
              onOpenDetails={setDetail}
              onPlayVideo={openVideo}
              onRemove={setConfirmKey}
            />
          ))}
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
      />

      <VideoPlayerModal
        open={Boolean(videoTarget)}
        target={videoTarget}
        onClose={() => setVideoTarget(null)}
      />

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
