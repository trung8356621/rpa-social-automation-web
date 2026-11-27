import { useState } from 'react'
import { ImageIcon } from 'lucide-react'

import { getRpaApiBaseUrl } from '@/lib/api/config'

import {
  resolveArtifactFetchUrl,
  resolveScreenshotOutcome,
  resolveScreenshotVariant,
} from '../campaign-artifacts'
import type { CampaignArtifact } from '../types'
import type { ScreenshotPreviewData } from './ScreenshotPreviewModal'

const frameClass = 'flex h-20 w-36 items-center justify-center overflow-hidden rounded border border-border bg-surface-muted/40 text-xs text-muted'

export function QuickAuditScreenshot({ artifact, onPreview }: {
  artifact?: CampaignArtifact
  onPreview: (preview: ScreenshotPreviewData) => void
}) {
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null)
  const fetchUrl = artifact && resolveArtifactFetchUrl(artifact)
  const thumbnail = artifact?.thumbnail_url
  const thumbnailSrc = thumbnail?.startsWith('/social-automation/api/')
    ? getRpaApiBaseUrl() + thumbnail
    : thumbnail?.startsWith('data:image/') ? thumbnail : null

  if (!artifact || !fetchUrl) {
    return <div className={frameClass}>No screenshot</div>
  }

  return (
    <button
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
      {thumbnailSrc && thumbnailSrc !== failedThumbnail ? (
        <img
          src={thumbnailSrc}
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
