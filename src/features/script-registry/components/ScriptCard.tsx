import { useState } from 'react'
import { Film, Play, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { PersistedVariantGroup } from '../api/variant-groups-contract'
import { formatLanguageBadge } from '../languages'
import { resolveEffectiveSharingForScript } from '../operational-settings'
import { formatGlobalConflictLabel } from '../sharing'
import type { ScriptListItem, ScriptSharingMode } from '../types'
import { displayScriptTitle, scriptStatusBadge } from '../types'

type ScriptCardProps = {
  script: ScriptListItem
  persistedGroups?: PersistedVariantGroup[]
  removeEnabled?: boolean
  onOpenDetails: (packageKey: string) => void
  onPlayVideo: (script: ScriptListItem) => void
  onRemove: (packageKey: string) => void
  onUpdateSharing?: (
    packageKey: string,
    sharingMode: ScriptSharingMode,
  ) => Promise<void>
}

export function ScriptCard({
  script,
  persistedGroups = [],
  removeEnabled = true,
  onOpenDetails,
  onPlayVideo,
  onRemove,
  onUpdateSharing,
}: ScriptCardProps) {
  const [updatingSharing, setUpdatingSharing] = useState(false)
  const [sharingError, setSharingError] = useState<string | null>(null)

  const badge = scriptStatusBadge(script)
  const title = displayScriptTitle(script)
  const canPlay =
    script.has_playable_video && script.video_demo_status === 'ready'
  const isPublished = script.status === 'published'
  const effectiveSharing = resolveEffectiveSharingForScript(
    script,
    persistedGroups,
  )
  const isGlobal = effectiveSharing.effectiveSharingMode === 'cms_global'
  const isDisabled = script.is_enabled === false
  const isPrimary = !isDisabled && script.is_primary === true
  const langBadge = formatLanguageBadge(script.language_code)
  const isIneligible = script.global_eligible === false
  const scopeLabel =
    script.global_scope || script.eligible_global_scope?.scope || null
  const conflictLabel = formatGlobalConflictLabel(script.global_conflict)

  const handleToggleSharing = async (checked: boolean) => {
    if (!onUpdateSharing) return
    setSharingError(null)
    setUpdatingSharing(true)
    try {
      await onUpdateSharing(
        script.package_key,
        checked ? 'cms_global' : 'site_specific',
      )
    } catch (err) {
      setSharingError(
        err instanceof Error ? err.message : 'Failed to update sharing mode.',
      )
    } finally {
      setUpdatingSharing(false)
    }
  }

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
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {isPrimary ? <Badge variant="primary">Primary</Badge> : null}
            {langBadge ? <Badge variant="neutral">{langBadge}</Badge> : null}
            {isDisabled ? <Badge variant="warning">Disabled</Badge> : null}
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {isGlobal ? <Badge variant="primary">CMS Global</Badge> : null}
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

        {isPublished && onUpdateSharing ? (
          <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted/40 px-2.5 py-2 text-xs">
            <label
              htmlFor={`card-share-${script.package_key}`}
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                id={`card-share-${script.package_key}`}
                type="checkbox"
                className="size-3.5 rounded border-border"
                checked={isGlobal}
                disabled={updatingSharing || isIneligible}
                onChange={(e) => void handleToggleSharing(e.target.checked)}
              />
              <span className="font-medium text-foreground">
                Share across CMS Sites
              </span>
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
              <span className="font-mono">
                {script.sharing_mode ?? 'site_specific'}
              </span>
              {scopeLabel ? (
                <span className="font-mono text-foreground">{scopeLabel}</span>
              ) : null}
            </div>
            {isIneligible && script.global_ineligible_reason ? (
              <p className="mt-1 text-[11px] text-danger">
                {script.global_ineligible_reason}
              </p>
            ) : null}
            {conflictLabel ? (
              <p className="mt-1 text-[11px] text-danger">
                Conflict: {conflictLabel}
              </p>
            ) : null}
            {sharingError ? (
              <p className="mt-1 text-[11px] text-danger">{sharingError}</p>
            ) : null}
          </div>
        ) : null}

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
