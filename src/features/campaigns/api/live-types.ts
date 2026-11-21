/** Loose live transport shapes — map defensively; do not invent fields. */

export type LiveCampaignSchedule = {
  type?: string
  timezone?: string
  start_at?: string | null
  daily_window?: { from?: string; to?: string } | null
  min_interval_seconds?: number | null
  resource_recheck_seconds?: number | null
}

export type LiveCampaignSummary = {
  total?: number
  pending?: number
  waiting_resources?: number
  running?: number
  success?: number
  failed_locked?: number
  unknown?: number
  skipped?: number
  cancelled?: number
  completed?: number
  failed?: number
  waiting?: number
}

export type LiveCampaignActionTagRow = {
  id?: string | number
  action_tag_id?: number | null
  action_tag_key?: string
  tag_key?: string
  site_key?: string
  platform?: string
  site_name?: string
  cms_type?: string | null
  script_package_key?: string
  script_id?: string
  script_name?: string
  script_version?: string
  release_id?: number | null
  script_release_id?: number | null
  resolution_source?: string
  shortcode_mapping?: {
    entries?: Array<{ shortcode?: string; variable?: string }>
  } | null
}

export type LiveContentAssignmentRow = {
  id?: string | number
  action_tag_id?: number | null
  action_tag_key?: string
  tag_key?: string
  script_package_key?: string
  script_id?: string
  script_version?: string
  release_id?: number | null
  script_release_id?: number | null
  status?: string
  raw_source?: string | null
  shortcode_mapping?: {
    entries?: Array<{ shortcode?: string; variable?: string }>
  } | null
}

/** CampaignSummary / CampaignDetail from OpenAPI CP19A/B + Campaign V2. */
export type LiveCampaignRow = {
  id?: string | number
  plan_version?: number
  name?: string
  site_key?: string
  platform?: string
  site_name?: string
  script_package_key?: string
  script_id?: string
  script_version?: string
  script_name?: string
  script_content_digest?: string | null
  /** Hard Account UUID pin from detail (campaign.meta.pinned_account_id) */
  account_id?: string | null
  execution_mode?: string
  run_mode?: string
  status?: string
  schedule?: LiveCampaignSchedule
  summary?: LiveCampaignSummary
  /** Flat list counters (CampaignSummary schema) */
  total_contents?: number
  completed_contents?: number
  failed_contents?: number
  waiting_contents?: number
  resource_recheck_seconds?: number
  next_recheck_at?: string | null
  contents?: LiveContentRow[]
  allowed_actions?: string[]
  shortcode_mapping?: {
    entries?: Array<{ shortcode?: string; variable?: string }>
  } | null
  shortcode_mapping_version?: number | null
  action_tags?: LiveCampaignActionTagRow[]
  created_at?: string
  updated_at?: string
}

export type LiveCampaignListResponse = {
  ok?: boolean
  data?: LiveCampaignRow[]
  campaigns?: LiveCampaignRow[]
  pending?: string
}

export type LiveCampaignDetailResponse = {
  ok?: boolean
  data?: LiveCampaignRow
  campaign?: LiveCampaignRow
}

export type LiveCampaignMutationResponse = {
  ok?: boolean
  data?: LiveCampaignRow
  campaign?: LiveCampaignRow
  errors?: string[]
}

export type LiveContentRow = {
  id?: string | number
  campaign_id?: string | number
  external_ref?: string
  source?: string
  status?: string
  /** Flat Script input object from server (title/body/…); not nested UI shape */
  input?: Record<string, unknown> | {
    title?: string | null
    body?: string | null
    variables?: Record<string, string | null>
  }
  source_format?: string
  raw_source?: string | null
  mapping_version?: number | null
  assigned_account_id?: string | number | null
  assigned_account_label?: string | null
  current_job_id?: string | number | null
  last_result?: string | null
  last_error_code?: string | null
  last_error_message?: string | null
  assignments?: LiveContentAssignmentRow[]
  created_at?: string
  updated_at?: string
}

export type LiveJobAttemptRow = {
  id?: string | number
  content_id?: string | number
  campaign_id?: string | number
  attempt?: number
  status?: string
  agent_label?: string | null
  browser_label?: string | null
  started_at?: string | null
  ended_at?: string | null
  error?: string | null
  artifacts?: Array<{
    id?: string
    kind?: string
    label?: string
    url?: string | null
  }>
}
