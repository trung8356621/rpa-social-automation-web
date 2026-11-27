import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { ApiError } from '@/lib/api/errors'

import { fetchArtifactImageBlob } from '../api/artifact-client'
import {
  resolveArtifactFetchUrl,
  resolveScreenshotOutcome,
  resolveScreenshotVariant,
} from '../campaign-artifacts'
import type { CampaignArtifact } from '../types'
import type { ScreenshotPreviewData } from './ScreenshotPreviewModal'

type AttemptScreenshotProps = {
  failedAttempt: boolean
  artifact: CampaignArtifact
  onPreview: (preview: ScreenshotPreviewData) => void
}

export function AttemptScreenshot({
  artifact,
  failedAttempt,
  onPreview,
}: AttemptScreenshotProps) {
  const fetchUrl = resolveArtifactFetchUrl(artifact)
  const outcome = resolveScreenshotOutcome(artifact)
  const variantLabel = resolveScreenshotVariant(artifact)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(fetchUrl))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!fetchUrl) {
      setObjectUrl(null)
      setLoading(false)
      setError(null)
      return
    }

    if (fetchUrl.startsWith('data:image/')) {
      setObjectUrl(fetchUrl)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    let activeUrl: string | null = null
    let cancelled = false

    setLoading(true)
    setError(null)
    setObjectUrl(null)

    void (async () => {
      try {
        const blob = await fetchArtifactImageBlob(fetchUrl, controller.signal)
        if (cancelled) return
        activeUrl = URL.createObjectURL(blob)
        setObjectUrl(activeUrl)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.kind === 'abort') return
        setError(
          err instanceof ApiError
            ? err.message
            : 'Screenshot binary unavailable.',
        )
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl)
      }
    }
  }, [fetchUrl])

  const headerBadges = (
    <div className="flex flex-wrap items-center gap-1.5">
      {outcome ? (
        <Badge variant={outcome.variant}>{outcome.label}</Badge>
      ) : null}
      {variantLabel ? <Badge variant="neutral">{variantLabel}</Badge> : null}
      <span className="truncate font-mono text-[11px] text-muted">
        {artifact.label}
      </span>
    </div>
  )

  if (!fetchUrl) {
    return (
      <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted/40 p-2 text-[11px]">
        {headerBadges}
        <p className="mt-1 text-muted">
          Screenshot unavailable (metadata only)
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted/40 p-2 text-[11px]">
        {headerBadges}
        <div className="mt-1.5 flex h-20 w-32 animate-pulse items-center justify-center rounded border border-border bg-surface text-muted">
          Loading…
        </div>
      </div>
    )
  }

  if (error || !objectUrl) {
    return (
      <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted/40 p-2 text-[11px]">
        {headerBadges}
        <p className="mt-1 text-danger">
          {error ?? 'Screenshot unavailable.'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted/30 p-2 text-[11px]">
      {headerBadges}
      <button
        type="button"
        className="mt-1.5 block overflow-hidden rounded border border-border transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label={`Preview screenshot ${artifact.label}`}
        onClick={() =>
          onPreview({
            imageUrl: objectUrl,
            title: artifact.label,
            outcome,
            variantLabel,
            artifactUuid: artifact.artifact_uuid ?? null,
            failedAttempt,
          })
        }
      >
        <img
          src={objectUrl}
          alt={artifact.label}
          className="h-24 w-40 object-cover"
        />
      </button>
    </div>
  )
}
