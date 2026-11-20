import type { Campaign } from './types.ts'

/**
 * Resolve which Campaign ID should drive Articles LIVE Content fetch.
 * Prefer URL / explicit selection; otherwise first loaded Campaign.
 */
export function resolveArticlesCampaignId(options: {
  selectedId: string
  urlCampaignId?: string | null
  campaigns: Campaign[]
}): string {
  const selected = options.selectedId.trim()
  if (selected && options.campaigns.some((c) => c.id === selected)) {
    return selected
  }
  const fromUrl = (options.urlCampaignId ?? '').trim()
  if (fromUrl && options.campaigns.some((c) => c.id === fromUrl)) {
    return fromUrl
  }
  return options.campaigns[0]?.id ?? ''
}
