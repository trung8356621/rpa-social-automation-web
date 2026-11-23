const CAMPAIGNS_BASE = '/social-automation/api/campaigns'
const CONTENTS_BASE = '/social-automation/api/campaign-contents'

/** Known Staff Session Campaign routes (OpenAPI af4a652). */
export const CAMPAIGN_PATHS = {
  list: CAMPAIGNS_BASE,
  detail: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}`,
  start: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}/start`,
  pause: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}/pause`,
  resume: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}/resume`,
  cancel: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}/cancel`,
  delete: (id: string) => `${CAMPAIGNS_BASE}/${encodeURIComponent(id)}`,
  contents: (campaignId: string) =>
    `${CAMPAIGNS_BASE}/${encodeURIComponent(campaignId)}/contents`,
  content: (campaignId: string, contentId: string) =>
    `${CAMPAIGNS_BASE}/${encodeURIComponent(campaignId)}/contents/${encodeURIComponent(contentId)}`,
  mockPreview: (campaignId: string) =>
    `${CAMPAIGNS_BASE}/${encodeURIComponent(campaignId)}/contents/mock-preview`,
  mockSave: (campaignId: string) =>
    `${CAMPAIGNS_BASE}/${encodeURIComponent(campaignId)}/contents/mock-save`,
} as const

/**
 * Nested Content CRUD + mock batch + admin terminal actions.
 * Create/Update/mock live under `/campaigns/{id}/contents`.
 * Retry/Skip/Cancel remain under `/campaign-contents/{id}/…`.
 */
export const CAMPAIGN_CONTENT_PATHS = {
  list: (campaignId: string) => CAMPAIGN_PATHS.contents(campaignId),
  create: (campaignId: string) => CAMPAIGN_PATHS.contents(campaignId),
  update: (campaignId: string, contentId: string) =>
    CAMPAIGN_PATHS.content(campaignId, contentId),
  mockPreview: (campaignId: string) => CAMPAIGN_PATHS.mockPreview(campaignId),
  mockSave: (campaignId: string) => CAMPAIGN_PATHS.mockSave(campaignId),
  retry: (id: string) => `${CONTENTS_BASE}/${encodeURIComponent(id)}/retry`,
  skip: (id: string) => `${CONTENTS_BASE}/${encodeURIComponent(id)}/skip`,
  cancel: (id: string) => `${CONTENTS_BASE}/${encodeURIComponent(id)}/cancel`,
} as const
