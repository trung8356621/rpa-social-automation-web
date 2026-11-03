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

export type LiveCampaignRow = {
  id?: string | number
  name?: string
  site_key?: string
  platform?: string
  site_name?: string
  script_package_key?: string
  script_id?: string
  script_name?: string
  execution_mode?: string
  run_mode?: string
  status?: string
  schedule?: LiveCampaignSchedule
  summary?: LiveCampaignSummary
  allowed_actions?: string[]
  created_at?: string
  updated_at?: string
}

export type LiveCampaignListResponse = {
  data?: LiveCampaignRow[]
  campaigns?: LiveCampaignRow[]
}

export type LiveCampaignDetailResponse = {
  data?: LiveCampaignRow
  campaign?: LiveCampaignRow
}

export type LiveCampaignMutationResponse = {
  data?: LiveCampaignRow
  campaign?: LiveCampaignRow
}

export type LiveContentRow = {
  id?: string | number
  campaign_id?: string | number
  external_ref?: string
  source?: string
  status?: string
  input?: {
    title?: string | null
    body?: string | null
    variables?: Record<string, string | null>
  }
  assigned_account_id?: string | null
  assigned_account_label?: string | null
  current_job_id?: string | null
  last_result?: string | null
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
