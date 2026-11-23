import { CAMPAIGN_PATHS } from './api/paths.ts'
import type { CampaignArtifact } from './types.ts'

type OutcomeBadge = {
  label: string
  variant: 'success' | 'danger' | 'neutral'
}

/**
 * Resolves the authenticated Staff API URL for a Campaign Artifact.
 * Never fabricates URLs from local Client filesystem paths.
 * Returns null when has_binary is false or no valid Staff endpoint exists.
 */
export function resolveArtifactFetchUrl(
  artifact: Pick<
    CampaignArtifact,
    'artifact_uuid' | 'has_binary' | 'download_url' | 'url'
  >,
): string | null {
  if (artifact.has_binary === false) return null

  const uuid = artifact.artifact_uuid?.trim()
  if (uuid) {
    return CAMPAIGN_PATHS.artifact(uuid)
  }

  const downloadUrl = artifact.download_url?.trim()
  if (downloadUrl && downloadUrl.startsWith('/social-automation/api/')) {
    return downloadUrl
  }

  const url = artifact.url?.trim()
  if (url && (url.startsWith('/social-automation/api/') || url.startsWith('data:image/'))) {
    return url
  }

  return null
}

/**
 * Resolves screenshot outcome/role label strictly from artifact metadata.
 * Never infers success merely because a screenshot exists.
 */
export function resolveScreenshotOutcome(
  artifact: Pick<CampaignArtifact, 'outcome' | 'role'>,
): OutcomeBadge | null {
  const raw = (artifact.outcome ?? artifact.role ?? '').trim().toLowerCase()
  if (!raw) return null
  if (raw === 'success' || raw === 'completed' || raw.includes('success')) {
    return { label: 'Success', variant: 'success' }
  }
  if (
    raw === 'failure' ||
    raw === 'failed' ||
    raw === 'error' ||
    raw.includes('fail') ||
    raw.includes('error')
  ) {
    return { label: 'Failure', variant: 'danger' }
  }
  return { label: artifact.role?.trim() || artifact.outcome?.trim() || raw, variant: 'neutral' }
}

export function resolveScreenshotVariant(
  artifact: Pick<CampaignArtifact, 'language_label' | 'variant'>,
): string | null {
  return artifact.language_label?.trim() || artifact.variant?.trim() || null
}

export function isScreenshotArtifact(
  artifact: Pick<CampaignArtifact, 'kind' | 'mime_type' | 'role' | 'outcome'>,
): boolean {
  if (artifact.kind === 'screenshot') return true
  if (artifact.mime_type?.toLowerCase().startsWith('image/')) return true
  const role = (artifact.role ?? '').toLowerCase()
  if (role.includes('screenshot')) return true
  return false
}
