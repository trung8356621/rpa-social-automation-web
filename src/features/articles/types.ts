import type { CampaignShortcodeMapping } from '@/features/campaigns/types'

export type ArticleStatus = 'draft' | 'ready' | 'archived'

export type ArticleSourceFormat = 'legacy_input' | 'shortcode' | 'json'

export type LibraryArticle = {
  id: string
  title: string
  external_ref: string | null
  action_tag_id: number
  action_tag_key: string
  site_id: number | null
  site_key: string | null
  status: ArticleStatus
  source_format: ArticleSourceFormat
  raw_source: string | null
  input: Record<string, unknown>
  shortcode_mapping: CampaignShortcodeMapping | null
  mapping_version: number
  meta: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export type SaveLibraryArticleInput = {
  title: string
  external_ref?: string | null
  action_tag_id?: number
  action_tag_key?: string
  status: ArticleStatus
  source_format: ArticleSourceFormat
  raw_source?: string | null
  input?: Record<string, unknown>
  shortcode_mapping?: CampaignShortcodeMapping | null
  mapping_version?: number
}

export type ArticleLibraryFilters = {
  site_id?: number
  site_key?: string
  action_tag_id?: number
  action_tag_key?: string
  status?: ArticleStatus | ''
  search?: string
}

export type CompatibleArticleFilters = ArticleLibraryFilters & {
  campaign_id?: string
  exclude_assigned?: boolean
}

export type CampaignArticleAssignment = {
  content_id: string
  assignment_id: string | null
  article_id: string | null
  article_title: string | null
  external_ref: string | null
  sort_order: number
  status: string
  is_legacy_inline: boolean
  action_tag_id: number | null
  action_tag_key: string | null
  site_id: number | null
  site_key: string | null
  release_id: number | null
  script_id: string
  script_version: string
  input: Record<string, unknown>
  snapshot_at: string | null
}

export type AssignCampaignArticleItem = {
  article_id: string
  sort_order?: number
}
