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

/** OpenAPI CampaignShortcodeMapping — campaign-owned shortcode → Script variable. */
export type CampaignShortcodeMappingEntry = {
  shortcode: string
  variable: string
}

export type CampaignShortcodeMapping = {
  entries: CampaignShortcodeMappingEntry[]
}

export type ContentSourceFormat = 'legacy_input' | 'shortcode'

export type CampaignActionTagPlan = {
  plan_tag_uuid?: string | null
  action_tag_id: number | null
  action_tag_key: string
  site_key: string
  site_name: string
  cms_type: string | null
  script_package_key: string
  script_name: string
  script_version: string
  release_id: number | null
  resolution_source: 'site_specific' | 'cms_global' | 'missing'
  shortcode_mapping: CampaignShortcodeMapping | null
}

export type CampaignContentAssignment = {
  id: string | null
  action_tag_id: number | null
  action_tag_key: string
  script_package_key: string
  script_version: string
  release_id: number | null
  status: CampaignContentStatus | null
  raw_source: string | null
  shortcode_mapping: CampaignShortcodeMapping | null
}

export type Campaign = {
  id: string
  plan_version?: 1 | 2
  revision?: number | null
  name: string
  site_key: string
  site_name: string
  script_package_key: string
  script_name: string
  /** Published release version pinned at create (OpenAPI script_version) */
  script_version: string
  /**
   * Hard Account UUID pin from create (`meta.pinned_account_id` / detail `account_id`).
   * Null when create omitted account_id (auto platform selection) or V2 account-free draft.
   */
  account_id: string | null
  execution_mode: CampaignExecutionMode
  run_mode: CampaignRunMode
  status: CampaignStatus
  schedule: CampaignSchedule
  summary: CampaignSummary
  created_at: string
  updated_at: string
  /** Allowed transitions for current status (mock + live when known) */
  allowed_actions: CampaignAction[]
  /** Nested on detail responses; empty on list rows */
  contents?: CampaignContent[]
  /** Immutable after start (OpenAPI shortcode_mapping) */
  shortcode_mapping: CampaignShortcodeMapping | null
  shortcode_mapping_version: number | null
  /** Campaign V2 resolved Action Tags & pinned Releases */
  action_tags?: CampaignActionTagPlan[]
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
  /** Legacy Script input (source_format=legacy_input). */
  input: CampaignContentInput
  /** OpenAPI source_format — shortcode vs legacy_input. */
  source_format: ContentSourceFormat
  /** Canonical shortcode plain text when source_format=shortcode. */
  raw_source: string | null
  mapping_version: number | null
  /** Local editor document — never sent to Backend. */
  editor_doc: TipTapDocJson | null
  assigned_account_id: string | null
  assigned_account_label: string | null
  current_job_id: string | null
  last_result: string | null
  last_error_code: string | null
  last_error_message: string | null
  created_at: string
  updated_at: string
  /** Campaign V2 per-Tag assignments */
  assignments?: CampaignContentAssignment[]
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
  /** True when Script release variables were read (even if empty). */
  schema_available: boolean
  /** title is listed in Script variables — never invent */
  title_supported: boolean
  /** body is listed in Script variables — never invent */
  body_supported: boolean
  /**
   * When schema_available=false, precise fail-closed reason.
   * Used for Staff projection gaps (variable_count>0 but variables omitted).
   */
  unavailable_reason: string | null
}

export type SiteContentPolicy = {
  site_key: string
  /** null = Site has no configured limit — do not invent */
  content_max_length: number | null
  field_source: 'site.content_max_length' | 'unavailable'
}

/** Optional create-time contents (OpenAPI minItems 0 — Shortcode V2). */
export type CreateCampaignContentDraft = {
  external_ref?: string
  title?: string | null
  body?: string | null
  variables?: ScriptInputValueMap
  raw_source?: string
}

export type CreateCampaignInput = {
  name: string
  site_key: string
  script_package_key: string
  /** Exact published release version — required for LIVE pin */
  script_version: string
  execution_mode: CampaignExecutionMode
  run_mode: CampaignRunMode
  schedule: CampaignSchedule
  /** Zero contents allowed at create (Shortcode V2). */
  contents?: CreateCampaignContentDraft[]
  /** Campaign-owned shortcode → Script variable mapping. */
  shortcode_mapping?: CampaignShortcodeMapping
  /**
   * Hard Account UUID pin (OpenAPI account_id).
   * Required for WordPress Draft POC / one_account_one_job — no silent fallback.
   */
  account_id?: string | null
}

export type CreateCampaignV2ActionTagInput = {
  plan_tag_uuid?: string | null
  action_tag_id?: number | null
  action_tag_key: string
  site_key: string
  site_name?: string
  cms_type?: string | null
  script_package_key: string
  script_name?: string
  script_version: string
  release_id?: number | null
  resolution_source: 'site_specific' | 'cms_global'
  shortcode_mapping: CampaignShortcodeMapping
}

export type CreateCampaignV2AssignmentInput = {
  id?: string | null
  action_tag_id?: number | null
  action_tag_key: string
  script_package_key: string
  script_version: string
  release_id?: number | null
  raw_source: string
  shortcode_mapping: CampaignShortcodeMapping
}

export type CreateCampaignV2ContentInput = {
  id?: string | null
  external_ref?: string
  raw_source: string
  assignments: CreateCampaignV2AssignmentInput[]
}

export type CreateCampaignV2Input = {
  plan_version: 2
  name: string
  run_mode: CampaignRunMode
  execution_mode?: CampaignExecutionMode
  action_tags: CreateCampaignV2ActionTagInput[]
  contents: CreateCampaignV2ContentInput[]
}

export type UpdateCampaignV2Input = CreateCampaignV2Input & {
  id: string
  revision?: number | null
  updated_at?: string | null
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
  /** Canonical shortcode plain text — preferred when Campaign has mapping. */
  raw_source?: string | null
  editor_doc: TipTapDocJson | null
}

export type MockPreviewArticle = {
  external_ref: string
  raw_source: string
  input: Record<string, string | number | boolean | null>
}

export type MockPreviewResult = {
  count: number
  mapping_version: number
  articles: MockPreviewArticle[]
}

export type MockSaveResult = {
  count: number
  mapping_version: number
  idempotent: boolean
  contents: CampaignContent[]
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
