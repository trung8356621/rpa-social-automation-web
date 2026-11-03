/**
 * Campaign Management UI models (CP19E).
 * Transport shapes stay separate from view helpers when they diverge.
 */

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'

export type CampaignExecutionMode =
  | 'one_account_one_job'
  | 'one_account_many_jobs'

export type CampaignRunMode = 'test' | 'live'

export type CampaignScheduleType =
  | 'immediate'
  | 'scheduled'
  | 'time_window'

export type CampaignDailyWindow = {
  from: string
  to: string
}

export type CampaignSchedule = {
  type: CampaignScheduleType
  timezone: string
  start_at: string | null
  daily_window: CampaignDailyWindow | null
  /** API seconds; UI edits minutes */
  min_interval_seconds: number | null
  /** Default resource recheck — not Job retry */
  resource_recheck_seconds: number
}

export type CampaignSummary = {
  total: number
  pending: number
  waiting_resources: number
  running: number
  success: number
  failed_locked: number
  unknown: number
  skipped: number
  cancelled: number
  completed: number
  failed: number
  waiting: number
}

export type Campaign = {
  id: string
  name: string
  site_key: string
  site_name: string
  script_package_key: string
  script_name: string
  execution_mode: CampaignExecutionMode
  run_mode: CampaignRunMode
  status: CampaignStatus
  schedule: CampaignSchedule
  summary: CampaignSummary
  created_at: string
  updated_at: string
  /** Allowed transitions for current status (mock + live when known) */
  allowed_actions: CampaignAction[]
}

export type CampaignAction =
  | 'start'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'edit'

export type CampaignContentStatus =
  | 'draft'
  | 'pending'
  | 'waiting_resources'
  | 'running'
  | 'success'
  | 'failed_locked'
  | 'unknown'
  | 'skipped'
  | 'cancelled'

export type CampaignContentSource = 'manual'

export type ScriptInputValueMap = Record<string, string | null>

export type CampaignContentInput = {
  title: string | null
  body: string | null
  /** Extra script variables keyed by schema field */
  variables: ScriptInputValueMap
}

/** Editor-side document; not assumed stored by backend unless contract says so */
export type TipTapDocJson = {
  type: 'doc'
  content?: unknown[]
}

export type CampaignContent = {
  id: string
  campaign_id: string
  external_ref: string
  source: CampaignContentSource
  status: CampaignContentStatus
  input: CampaignContentInput
  /** Local editor document — mock only until CP19C confirms storage */
  editor_doc: TipTapDocJson | null
  assigned_account_id: string | null
  assigned_account_label: string | null
  current_job_id: string | null
  last_result: string | null
  created_at: string
  updated_at: string
}

export type CampaignArtifact = {
  id: string
  kind: 'screenshot' | 'log' | 'other'
  label: string
  url: string | null
}

export type CampaignJobAttempt = {
  id: string
  content_id: string
  campaign_id: string
  attempt: number
  status: CampaignContentStatus
  agent_label: string | null
  browser_label: string | null
  started_at: string | null
  ended_at: string | null
  error: string | null
  artifacts: CampaignArtifact[]
}

export type ScriptInputFieldType =
  | 'string'
  | 'text'
  | 'secret'
  | 'number'
  | 'boolean'

export type ScriptInputField = {
  key: string
  type: ScriptInputFieldType
  required: boolean
  label?: string
}

export type ScriptInputSchema = {
  fields: ScriptInputField[]
  /** Explicit Test Mode compatibility from contract; null = unknown */
  test_mode_compatible: boolean | null
  title_required: boolean
  body_required: boolean
}

export type SiteContentPolicy = {
  site_key: string
  /** null = Site has no configured limit — do not invent */
  content_max_length: number | null
  field_source: 'site.content_max_length' | 'unavailable'
}

export type CreateCampaignInput = {
  name: string
  site_key: string
  script_package_key: string
  execution_mode: CampaignExecutionMode
  run_mode: CampaignRunMode
  schedule: CampaignSchedule
}

export type UpdateCampaignInput = CreateCampaignInput & {
  id: string
}

export type ManualContentDraft = {
  campaign_id: string
  external_ref?: string
  title: string | null
  body: string | null
  variables: ScriptInputValueMap
  editor_doc: TipTapDocJson | null
}

export type CampaignListFilters = {
  search: string
  site_key: string
  run_mode: string
  execution_mode: string
  status: string
}

export type CampaignStoreSnapshot = {
  campaigns: Campaign[]
  contents: CampaignContent[]
  job_attempts: CampaignJobAttempt[]
}

export type DemoScenario =
  | 'default'
  | 'loading'
  | 'empty'
  | 'error'
