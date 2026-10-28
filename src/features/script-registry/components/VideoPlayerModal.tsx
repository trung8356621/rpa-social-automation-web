import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { MOCK_PLAYBACK_NOTE } from '../mock-thumbnails'
import type { ScriptListItem, VideoDemoStatus } from '../types'

export type VideoPlayerTarget = {
  title: string
  video_demo_status: VideoDemoStatus
  video_url: string | null
  thumbnail_url: string | null
  has_playable_video: boolean
}

type VideoPlayerModalProps = {
  open: boolean
  target: VideoPlayerTarget | null
  onClose: () => void
}

export function videoTargetFromScript(script: ScriptListItem): VideoPlayerTarget {
  return {
    title: script.action_tag_key || script.name,
    video_demo_status: script.video_demo_status,
    video_url: script.video_url,
    thumbnail_url: script.thumbnail_url,
    has_playable_video: script.has_playable_video,
  }
}

export function VideoPlayerModal({
  open,
  target,
  onClose,
}: VideoPlayerModalProps) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!open || !target) return
    setPhase('loading')
    const t = window.setTimeout(() => {
      if (target.video_demo_status === 'error') {
        setPhase('error')
        return
      }
      if (target.video_demo_status === 'ready' && target.has_playable_video) {
        setPhase('ready')
        return
      }
      if (
        target.video_demo_status === 'missing' ||
        target.video_demo_status === 'processing'
      ) {
        setPhase('error')
        return
      }
      setPhase('error')
    }, 180)
    return () => window.clearTimeout(t)
  }, [open, target])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !target) return null

  const missing =
    target.video_demo_status === 'missing' ||
    target.video_demo_status === 'processing'
  const thumbUnavailable = target.video_demo_status === 'thumbnail_unavailable'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close video overlay"
        className="absolute inset-0 bg-foreground/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-player-title"
        className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="video-player-title" className="text-sm font-semibold">
              Play demo — {target.title}
            </h2>
            <p className="mt-0.5 text-[11px] text-warning">
              MOCK player — không phát binary production
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        <div className="aspect-video w-full bg-foreground">
          {phase === 'loading' ? (
            <div className="flex size-full items-center justify-center text-sm text-primary-foreground">
              Loading demo…
            </div>
          ) : missing ? (
            <div className="flex size-full flex-col items-center justify-center gap-1 px-4 text-center text-sm text-primary-foreground">
              <span>No video demo</span>
              <span className="text-xs opacity-80">
                Release chưa có media demo (MOCK).
              </span>
            </div>
          ) : phase === 'error' ? (
            <div className="flex size-full flex-col items-center justify-center gap-1 px-4 text-center text-sm text-primary-foreground">
              <span>Playback error</span>
              <span className="text-xs opacity-80">
                {thumbUnavailable
                  ? 'Thumbnail unavailable — không phát được preview ổn định.'
                  : 'Không phát được demo (MOCK).'}
              </span>
            </div>
          ) : target.video_url ? (
            <video
              className="size-full object-contain"
              controls
              poster={target.thumbnail_url ?? undefined}
              src={target.video_url}
              onError={() => setPhase('error')}
            >
              Trình duyệt không hỗ trợ video.
            </video>
          ) : (
            <div className="relative flex size-full flex-col items-center justify-center gap-2">
              {target.thumbnail_url ? (
                <img
                  src={target.thumbnail_url}
                  alt=""
                  className="absolute inset-0 size-full object-cover opacity-40"
                />
              ) : null}
              <div className="relative z-10 max-w-sm px-4 text-center text-sm text-primary-foreground">
                <p className="font-medium">MOCK demo playing</p>
                <p className="mt-1 text-xs opacity-90">{MOCK_PLAYBACK_NOTE}</p>
              </div>
            </div>
          )}
        </div>

        <footer className="flex justify-end border-t border-border px-4 py-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </footer>
      </div>
    </div>
  )
}
