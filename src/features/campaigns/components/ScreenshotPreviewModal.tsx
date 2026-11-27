import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorTagEditor } from '@/features/error-recovery/ErrorTagEditor'

import { fetchArtifactImageBlob } from '../api/artifact-client'

export type ScreenshotPreviewData = (
  | { imageUrl: string; fetchUrl?: never }
  | { imageUrl?: never; fetchUrl: string }
) & {
  title: string
  outcome: { label: string; variant: 'success' | 'danger' | 'neutral' } | null
  variantLabel: string | null
  artifactUuid: string | null
  attemptUuid: string | null
  failedAttempt: boolean
}

type ScreenshotPreviewModalProps = {
  preview: ScreenshotPreviewData | null
  onClose: () => void
}

export function ScreenshotPreviewModal({
  preview,
  onClose,
}: ScreenshotPreviewModalProps) {
  const fetchUrl = preview?.fetchUrl
  const [decodedUrl, setDecodedUrl] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [loaded, setLoaded] = useState<{ image?: string; error?: string } | null>(null)

  useEffect(() => {
    if (!fetchUrl) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    void fetchArtifactImageBlob(fetchUrl, controller.signal).then((blob) => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setLoaded({ image: objectUrl })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setLoaded({ error: error instanceof Error ? error.message : 'Screenshot unavailable.' })
      }
    })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fetchUrl])

  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) setEditing(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview, onClose, editing])

  if (!preview) return null
  const imageUrl = preview.imageUrl ?? loaded?.image

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close screenshot preview"
        className="absolute inset-0 bg-foreground/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="screenshot-preview-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="screenshot-preview-title"
              className="text-sm font-semibold text-foreground"
            >
              {editing ? 'Add Error Tag' : preview.title}
            </h2>
            {preview.outcome ? (
              <Badge variant={preview.outcome.variant}>
                {preview.outcome.label}
              </Badge>
            ) : null}
            {preview.variantLabel ? (
              <Badge variant="neutral">{preview.variantLabel}</Badge>
            ) : null}
          </div>
          <div className="flex gap-2">
            {preview.failedAttempt && preview.attemptUuid && preview.artifactUuid && imageUrl && imageUrl === decodedUrl && !editing && (
              <Button size="sm" onClick={() => setEditing(true)}>Add Error Tag</Button>
            )}
            <Button size="sm" variant="outline" onClick={editing ? () => setEditing(false) : onClose}>
              {editing ? 'Back to screenshot' : 'Close'}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-surface-muted/40 p-4">
          {editing && imageUrl && preview.attemptUuid && preview.artifactUuid ? (
            <ErrorTagEditor imageUrl={imageUrl} title={preview.title} attemptUuid={preview.attemptUuid} artifactUuid={preview.artifactUuid} />
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={preview.title}
              onLoad={() => setDecodedUrl(imageUrl)}
              onError={() => setDecodedUrl(null)}
              className="mx-auto max-h-[72vh] w-auto rounded-[var(--radius-control)] border border-border object-contain"
            />
          ) : (
            <p role="status" className="text-center text-sm text-muted">
              {loaded?.error ?? 'Loading screenshot…'}
            </p>
          )}
        </div>

        {preview.artifactUuid ? (
          <div className="border-t border-border px-4 py-2 font-mono text-[11px] text-muted">
            Artifact UUID: {preview.artifactUuid}
          </div>
        ) : null}
      </div>
    </div>
  )
}
