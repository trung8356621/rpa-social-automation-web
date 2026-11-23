import { useState } from 'react'

import { Badge } from '@/components/ui/badge'

import { formatGlobalConflictLabel } from '../sharing'
import type {
  ScriptGlobalConflict,
  ScriptSharingMode,
  ScriptSharingScope,
} from '../types'

type ScriptSharingPanelProps = {
  packageKey: string
  sharingMode?: ScriptSharingMode
  effectiveSharingMode?: ScriptSharingMode
  sharingManagedAutomatically?: boolean
  globalScope?: string | null
  globalEligible?: boolean
  globalIneligibleReason?: string | null
  eligibleGlobalScope?: ScriptSharingScope | null
  globalConflict?: ScriptGlobalConflict
  onUpdateSharing?: (
    packageKey: string,
    sharingMode: ScriptSharingMode,
  ) => Promise<void>
}

export function ScriptSharingPanel({
  packageKey,
  sharingMode = 'site_specific',
  effectiveSharingMode,
  sharingManagedAutomatically = false,
  globalScope,
  globalEligible,
  globalIneligibleReason,
  eligibleGlobalScope,
  globalConflict,
  onUpdateSharing,
}: ScriptSharingPanelProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displaySharingMode = effectiveSharingMode ?? sharingMode
  const isGlobal = displaySharingMode === 'cms_global'
  const isIneligible = globalEligible === false
  const effectiveScope = globalScope || eligibleGlobalScope?.scope || null
  const cmsType = eligibleGlobalScope?.cms_type || null
  const pathTemplate = eligibleGlobalScope?.path_template || null
  const conflictLabel = formatGlobalConflictLabel(globalConflict)

  const handleChange = async (nextChecked: boolean) => {
    if (!onUpdateSharing) return
    setError(null)
    setIsUpdating(true)
    try {
      await onUpdateSharing(
        packageKey,
        nextChecked ? 'cms_global' : 'site_specific',
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật chế độ chia sẻ CMS Global.',
      )
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
          CMS Global Sharing
        </h3>
        <Badge variant={isGlobal ? 'primary' : 'neutral'}>
          {displaySharingMode}
        </Badge>
      </div>

      <label
        htmlFor={`share-global-${packageKey}`}
        className="mt-2.5 flex cursor-pointer items-start gap-2.5"
      >
        <input
          id={`share-global-${packageKey}`}
          type="checkbox"
          className="mt-0.5 size-4 rounded border-border"
          checked={isGlobal}
          disabled={
            sharingManagedAutomatically ||
            !onUpdateSharing ||
            isUpdating ||
            isIneligible
          }
          onChange={(e) => void handleChange(e.target.checked)}
        />
        <span className="text-sm font-medium text-foreground">
          Share across CMS Sites
          {isUpdating ? (
            <span className="ml-2 text-xs font-normal text-muted">
              Updating…
            </span>
          ) : null}
        </span>
      </label>

      {sharingManagedAutomatically ? (
        <p className="mt-1.5 text-xs font-medium text-primary">
          Managed automatically by SEO-OPS.
        </p>
      ) : null}

      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        {cmsType && pathTemplate
          ? `Các Site dùng CMS Type "${cmsType}" có Path Template "${pathTemplate}" có thể kế thừa Script này khi bật CMS Global (không copy Script hay đổi Tag Key gốc).`
          : 'Cho phép các Site cùng CMS Type và Path Template kế thừa Script này mà không cần tạo lại Script cho từng domain.'}
      </p>

      <dl className="mt-2.5 space-y-1 border-t border-border pt-2 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Sharing Mode</dt>
          <dd className="font-mono text-foreground">{displaySharingMode}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Eligible CMS Type</dt>
          <dd className="font-mono text-foreground">{cmsType || '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Eligible Path Template</dt>
          <dd className="font-mono text-foreground">{pathTemplate || '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Global Scope</dt>
          <dd className="font-mono text-foreground">{effectiveScope || '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Global Eligibility</dt>
          <dd className="text-foreground">
            {globalEligible === undefined ? (
              '—'
            ) : globalEligible ? (
              <span className="font-medium text-success">Eligible</span>
            ) : (
              <span className="font-medium text-danger">Ineligible</span>
            )}
          </dd>
        </div>
      </dl>

      {isIneligible && globalIneligibleReason ? (
        <div className="mt-2 rounded-[var(--radius-control)] border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-foreground">
          <span className="font-medium">Ineligible reason:</span>{' '}
          {globalIneligibleReason}
        </div>
      ) : null}

      {conflictLabel ? (
        <div className="mt-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-xs text-danger">
          <span className="font-medium">Existing Global conflict:</span>{' '}
          {conflictLabel}
        </div>
      ) : null}

      {error ? (
        <div className="mt-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-xs text-danger">
          {error}
        </div>
      ) : null}
    </div>
  )
}
