const CAMPAIGNS_BASE = '/social-automation/api/campaigns'
const CONTENTS_BASE = '/social-automation/api/campaign-contents'

/** Known CP19A/B Staff Session Campaign routes. */
export const CAMPAIGN_PATHS = {
  list: CAMPAIGNS_BASE,
  detail: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}`,
  start: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}/start`,
  pause: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}/pause`,
  resume: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}/resume`,
  cancel: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}/cancel`,
  contents: (campaignId: string) =>
    `${CAMPAIGNS_BASE}/${encodeURIComponent(campaignId)}/contents`,
  content: (campaignId: string, contentId: string) =>
    `${CAMPAIGNS_BASE}/${encodeURIComponent(campaignId)}/contents/${encodeURIComponent(contentId)}`,
} as const

/**
 * Nested Content CRUD (OpenAPI 9a519ff) + admin terminal actions.
 * Create/Update live under `/campaigns/{id}/contents`.
 * Retry/Skip/Cancel remain under `/campaign-contents/{id}/…`.
 */
export const CAMPAIGN_CONTENT_PATHS = {
  list: (campaignId: string) => CAMPAIGN_PATHS.contents(campaignId),
  create: (campaignId: string) => CAMPAIGN_PATHS.contents(campaignId),
  update: (campaignId: string, contentId: string) =>
    CAMPAIGN_PATHS.content(campaignId, contentId),
  retry: (id: string) => `${CONTENTS_BASE}/${encodeURIComponent(id)}/retry`,
  skip: (id: string) => `${CONTENTS_BASE}/${encodeURIComponent(id)}/skip`,
  cancel: (id: string) => `${CONTENTS_BASE}/${encodeURIComponent(id)}/cancel`,
} as const
