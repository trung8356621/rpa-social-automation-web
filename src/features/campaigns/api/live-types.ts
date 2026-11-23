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
  plan_tag_uuid?: string | null
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

export type LiveEligibilityError = {
  site_key?: string
  site_name?: string
  action_tag_key?: string
  code?: string
  error_code?: string
  message?: string
  reason?: string
  client_id?: string | number | null
  account_id?: string | number | null
  browser_id?: string | null
  agent_uuid?: string | null
  browser_uuid?: string | null
}

export type LiveResourceDiagnostics = {
  last_checked_at?: string | null
  last_recheck_at?: string | null
  next_recheck_at?: string | null
  eligible_clients_count?: number | null
  eligible_clients?: number | null
  evaluation_source?: string | null
  summary_message?: string | null
  eligibility_errors?: LiveEligibilityError[]
  errors?: LiveEligibilityError[]
}

/** CampaignSummary / CampaignDetail from OpenAPI CP19A/B + Campaign V2. */
export type LiveCampaignRow = {
  id?: string | number
  plan_version?: number
  revision?: number | null
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
  last_recheck_at?: string | null
  last_resource_check_at?: string | null
  scheduler_last_checked_at?: string | null
  next_recheck_at?: string | null
  eligible_clients_count?: number | null
  eligible_clients?: number | null
  status_message?: string | null
  eligibility_errors?: LiveEligibilityError[]
  resource_diagnostics?: LiveResourceDiagnostics | null
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
  content_uuid?: string | null
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
  attempts?: LiveJobAttemptRow[]
  job_attempts?: LiveJobAttemptRow[]
  execution_history?: LiveJobAttemptRow[]
  created_at?: string
  updated_at?: string
}

export type LiveJobAttemptRow = {
  id?: string | number
  attempt_uuid?: string | null
  job_id?: string | number | null
  job_uuid?: string | null
  content_id?: string | number
  content_uuid?: string | null
  campaign_id?: string | number
  attempt?: number
  attempt_number?: number
  status?: string
  step?: string | number | null
  step_name?: string | null
  failed_step?: string | number | null
  error_code?: string | null
  error_message?: string | null
  agent_uuid?: string | null
  agent_label?: string | null
  browser_uuid?: string | null
  browser_label?: string | null
  started_at?: string | null
  ended_at?: string | null
  error?: string | null
  artifacts?: Array<{
    id?: string | number
    artifact_uuid?: string | null
    uuid?: string | null
    kind?: string
    type?: string
    label?: string
    name?: string
    url?: string | null
    download_url?: string | null
    has_binary?: boolean | null
    role?: string | null
    screenshot_role?: string | null
    outcome?: string | null
    status?: string | null
    language_label?: string | null
    language?: string | null
    variant?: string | null
    locale?: string | null
    mime_type?: string | null
  }>
}
