const ARTICLES_BASE = '/social-automation/api/articles'
const CAMPAIGNS_BASE = '/social-automation/api/campaigns'

export const ARTICLE_PATHS = {
  list: ARTICLES_BASE,
  compatible: `${ARTICLES_BASE}/compatible`,
  detail: (id: string) => `${ARTICLES_BASE}/${encodeURIComponent(id)}`,
} as const

export const CAMPAIGN_ARTICLE_PATHS = {
  list: (campaignId: string) =>
    `${CAMPAIGNS_BASE}/${encodeURIComponent(campaignId)}/articles`,
  assign: (campaignId: string) =>
    `${CAMPAIGNS_BASE}/${encodeURIComponent(campaignId)}/articles`,
  remove: (campaignId: string, articleOrContentId: string) =>
    `${CAMPAIGNS_BASE}/${encodeURIComponent(campaignId)}/articles/${encodeURIComponent(articleOrContentId)}`,
} as const
