import { Film, Play, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { ScriptListItem } from '../types'
import { displayScriptTitle, scriptStatusBadge } from '../types'

type ScriptCardProps = {
  script: ScriptListItem
  removeEnabled?: boolean
  onOpenDetails: (packageKey: string) => void
  onPlayVideo: (script: ScriptListItem) => void
  onRemove: (packageKey: string) => void
}

export function ScriptCard({
  script,
  removeEnabled = true,
  onOpenDetails,
  onPlayVideo,
  onRemove,
}: ScriptCardProps) {
  const badge = scriptStatusBadge(script)
  const title = displayScriptTitle(script)
  const canPlay =
    script.has_playable_video && script.video_demo_status === 'ready'

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="relative aspect-video w-full shrink-0 bg-surface-muted">
        {script.has_thumbnail && script.thumbnail_url ? (
          <img
            src={script.thumbnail_url}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 px-3 text-center">
            <Film className="size-6 text-muted" aria-hidden />
            <span className="text-xs text-muted">
              {script.video_demo_status === 'thumbnail_unavailable'
                ? 'Thumbnail unavailable'
                : script.video_demo_status === 'processing'
                  ? 'Video processing…'
                  : 'No video demo'}
            </span>
          </div>
        )}

        {canPlay ? (
          <button
            type="button"
            onClick={() => onPlayVideo(script)}
            className="absolute inset-0 flex items-center justify-center bg-foreground/25 transition-colors hover:bg-foreground/35"
            aria-label={`Play demo for ${title}`}
          >
            <span className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-primary shadow-sm">
              <Play className="size-5 fill-current" aria-hidden />
            </span>
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
            <span className="line-clamp-2 break-all">{title}</span>
          </h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {script.is_authentication ? (
              <Badge variant="primary">Authentication</Badge>
            ) : null}
          </div>
        </div>

        <dl className="space-y-1 text-xs text-muted">
          <div className="flex gap-2">
            <dt className="shrink-0">ID</dt>
            <dd className="min-w-0 break-all font-mono text-foreground">
              {script.script_id}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0">Version</dt>
            <dd className="text-foreground">v{script.version}</dd>
          </div>
          {script.action_tag_key && script.action_tag_key !== script.name ? (
            <div className="flex gap-2">
              <dt className="shrink-0">Tag</dt>
              <dd className="min-w-0 break-all font-mono text-foreground">
                {script.action_tag_key}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="text-[11px] text-muted">{script.last_sync_label}</span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={() => onOpenDetails(script.package_key)}
            >
              Details
            </Button>
            {removeEnabled ? (
              <Button
                variant="outline"
                size="sm"
                className={cn('border-danger/30 text-danger hover:bg-danger/5')}
                onClick={() => onRemove(script.package_key)}
                aria-label={`Remove ${title}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
