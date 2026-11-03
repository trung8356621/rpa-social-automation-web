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
} as const

/** Admin Content actions (CP19A/B). Manual CRUD awaits CP19C OpenAPI. */
export const CAMPAIGN_CONTENT_PATHS = {
  retry: (id: string) => `${CONTENTS_BASE}/${encodeURIComponent(id)}/retry`,
  skip: (id: string) => `${CONTENTS_BASE}/${encodeURIComponent(id)}/skip`,
  cancel: (id: string) => `${CONTENTS_BASE}/${encodeURIComponent(id)}/cancel`,
} as const
