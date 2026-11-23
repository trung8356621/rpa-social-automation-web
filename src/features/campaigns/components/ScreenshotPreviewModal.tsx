import { useEffect } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export type ScreenshotPreviewData = {
  imageUrl: string
  title: string
  outcome: { label: string; variant: 'success' | 'danger' | 'neutral' } | null
  variantLabel: string | null
  artifactUuid: string | null
}

type ScreenshotPreviewModalProps = {
  preview: ScreenshotPreviewData | null
  onClose: () => void
}

export function ScreenshotPreviewModal({
  preview,
  onClose,
}: ScreenshotPreviewModalProps) {
  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview, onClose])

  if (!preview) return null

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
              {preview.title}
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
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex-1 overflow-auto bg-surface-muted/40 p-4">
          <img
            src={preview.imageUrl}
            alt={preview.title}
            className="mx-auto max-h-[72vh] w-auto rounded-[var(--radius-control)] border border-border object-contain"
          />
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
