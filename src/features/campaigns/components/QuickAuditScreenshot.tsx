import { useEffect, useRef, useState } from 'react'
import { ImageIcon } from 'lucide-react'

import { getRpaApiBaseUrl } from '@/lib/api/config'

import { fetchArtifactImageBlob } from '../api/artifact-client'
import {
  resolveArtifactFetchUrl,
  resolveScreenshotOutcome,
  resolveScreenshotVariant,
} from '../campaign-artifacts'
import type { CampaignArtifact } from '../types'
import type { ScreenshotPreviewData } from './ScreenshotPreviewModal'

const frameClass = 'flex h-20 w-36 items-center justify-center overflow-hidden rounded border border-border bg-surface-muted/40 text-xs text-muted'

async function makeThumbnail(url: string, signal: AbortSignal): Promise<Blob | null> {
  const source = url.startsWith('data:image/')
    ? await (await fetch(url, { signal })).blob()
    : await fetchArtifactImageBlob(url, signal)
  const image = await createImageBitmap(source)
  try {
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 288 / image.width, 160 / image.height)
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8))
  } finally {
    image.close()
  }
}

export function QuickAuditScreenshot({ artifact, onPreview }: {
  artifact?: CampaignArtifact
  onPreview: (preview: ScreenshotPreviewData) => void
}) {
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [generated, setGenerated] = useState<{ source: string; url: string } | null>(null)
  const fetchUrl = artifact && resolveArtifactFetchUrl(artifact)
  const thumbnail = artifact?.thumbnail_url
  const thumbnailSrc = thumbnail?.startsWith('/social-automation/api/')
    ? getRpaApiBaseUrl() + thumbnail
    : thumbnail?.startsWith('data:image/') ? thumbnail : null
  const providedThumbnail = thumbnailSrc !== failedThumbnail ? thumbnailSrc : null

  useEffect(() => {
    const button = buttonRef.current
    if (!button || !fetchUrl || providedThumbnail) return

    const controller = new AbortController()
    let objectUrl: string | undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || controller.signal.aborted) return
      observer.disconnect()
      void makeThumbnail(fetchUrl, controller.signal).then((thumbnail) => {
        if (!thumbnail || controller.signal.aborted) return
        objectUrl = URL.createObjectURL(thumbnail)
        setGenerated({ source: fetchUrl, url: objectUrl })
      }).catch(() => {
        // The viewer still lets the user open the original and see any API error.
      })
    }, { rootMargin: '120px' })
    observer.observe(button)
    return () => {
      observer.disconnect()
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fetchUrl, providedThumbnail])

  const imageSrc = providedThumbnail ?? (generated?.source === fetchUrl ? generated?.url : null)

  if (!artifact || !fetchUrl) {
    return <div className={frameClass}>No screenshot</div>
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`${frameClass} gap-1.5 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary`}
      aria-label={`Preview screenshot ${artifact.label}`}
      onClick={() => onPreview({
        ...(fetchUrl.startsWith('data:image/') ? { imageUrl: fetchUrl } : { fetchUrl }),
        title: artifact.label,
        outcome: resolveScreenshotOutcome(artifact),
        variantLabel: resolveScreenshotVariant(artifact),
        artifactUuid: artifact.artifact_uuid ?? null,
      })}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailedThumbnail(thumbnailSrc)}
        />
      ) : (
        <><ImageIcon className="size-4" aria-hidden="true" /> View screenshot</>
      )}
    </button>
  )
}
