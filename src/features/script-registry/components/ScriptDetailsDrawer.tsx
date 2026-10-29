import { useEffect } from 'react'
import { Play, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { ScriptDetail, ScriptReleaseDetail } from '../types'
import { displayScriptTitle } from '../types'
import type { VideoPlayerTarget } from './VideoPlayerModal'

type ScriptDetailsDrawerProps = {
  open: boolean
  detail: ScriptDetail | null
  onClose: () => void
  onPlayRelease: (target: VideoPlayerTarget) => void
}

function videoLabel(release: ScriptReleaseDetail): string {
  switch (release.video_demo_status) {
    case 'ready':
      return 'Ready'
    case 'missing':
      return 'Missing demo'
    case 'thumbnail_unavailable':
      return 'Thumbnail unavailable'
    case 'processing':
      return 'Processing'
    case 'error':
      return 'Error'
    default:
      return release.video_demo_status
  }
}

export function ScriptDetailsDrawer({
  open,
  detail,
  onClose,
  onPlayRelease,
}: ScriptDetailsDrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !detail) return null

  const title = displayScriptTitle(detail)

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
        aria-labelledby="script-detail-title"
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-border bg-surface"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="script-detail-title"
                className="text-base font-semibold break-all"
              >
                {title}
              </h2>
              {detail.is_authentication ? (
                <Badge variant="primary">Authentication</Badge>
              ) : null}
            </div>
            <p className="mt-0.5 break-all font-mono text-xs text-muted">
              {detail.package_key}
            </p>
            {detail.action_tag_key &&
            detail.name !== detail.action_tag_key ? (
              <p className="mt-1 text-xs text-muted">
                Script: <span className="text-foreground">{detail.name}</span>
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Description
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-foreground">
              {detail.description?.trim() || '—'}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Release history
            </h3>
            <ul className="mt-2 space-y-3">
              {detail.releases.map((release) => (
                <li
                  key={release.id}
                  className="rounded-[var(--radius-control)] border border-border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      Release {release.version}
                      <span className="ml-2 text-xs font-normal text-muted">
                        {release.published_at
                          ? new Date(release.published_at).toLocaleString()
                          : '—'}
                      </span>
                    </p>
                    <Badge
                      variant={
                        release.status === 'yanked' ? 'neutral' : 'success'
                      }
                    >
                      {release.status}
                    </Badge>
                  </div>
                  <p className="mt-1 break-all font-mono text-[11px] text-muted">
                    digest {release.content_digest}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">
                      Video demo: {videoLabel(release)}
                    </span>
                    {release.video_demo_status === 'ready' &&
                    (release.video_url || release.video_media_id) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onPlayRelease({
                            title: `${title} · v${release.version}`,
                            video_demo_status: release.video_demo_status,
                            video_url: release.video_url,
                            thumbnail_url: release.thumbnail_url,
                            has_playable_video: Boolean(
                              release.video_url || release.video_media_id,
                            ),
                          })
                        }
                      >
                        <Play className="size-3.5" />
                        Play
                      </Button>
                    ) : null}
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-primary">
                      Variables / Steps / Assets
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-[var(--radius-control)] bg-surface-muted p-2 font-mono text-[11px] leading-relaxed text-foreground">
                      {JSON.stringify(
                        {
                          variables: release.variables,
                          steps: release.steps,
                          assets: release.assets,
                          runtime_requirements: release.runtime_requirements,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted">
            Updated by {detail.updated_by_label || '—'}
          </p>
        </div>
      </aside>
    </div>
  )
}
