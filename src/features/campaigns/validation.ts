import {
  scheduleFormToApi,
  validateScheduleForm,
  type ScheduleFormValues,
} from './schedule.ts'
import { canStartWithRunMode } from './script-compat.ts'
import {
  validateShortcodeMappingForm,
  type ShortcodeMappingFormEntry,
} from './shortcode-mapping.ts'
import type {
  Campaign,
  CampaignContent,
  CampaignExecutionMode,
  CampaignRunMode,
  CreateCampaignInput,
  ScriptInputSchema,
} from './types.ts'

export type CampaignFormValues = {
  name: string
  site_key: string
  script_package_key: string
  script_version: string
  execution_mode: CampaignExecutionMode
  run_mode: CampaignRunMode
  schedule: ScheduleFormValues
  /** Hard Account UUID pin — sent as OpenAPI account_id */
  account_id: string
  /** Shortcode V2 mapping rows (create-time). */
  shortcode_mapping: ShortcodeMappingFormEntry[]
}

export type ValidationOk<T> = { ok: true; value: T }
export type ValidationErr = { ok: false; message: string }

export function validateCampaignForm(
  form: CampaignFormValues,
  options?: {
    requireAccountPin?: boolean
    schema?: ScriptInputSchema
  },
): ValidationOk<CreateCampaignInput> | ValidationErr {
  const requireAccountPin = options?.requireAccountPin === true
  const name = form.name.trim()
  if (!name) return { ok: false, message: 'Campaign Name is required.' }
  if (!form.site_key.trim()) {
    return { ok: false, message: 'Platform/Site is required (Site Registry).' }
  }
  if (!form.script_package_key.trim()) {
    return { ok: false, message: 'Script is required (Script Registry).' }
  }
  if (!form.script_version.trim()) {
    return {
      ok: false,
      message: 'Script version is required (published release pin).',
    }
  }
  if (
    form.execution_mode !== 'one_account_one_job' &&
    form.execution_mode !== 'one_account_many_jobs'
  ) {
    return { ok: false, message: 'Execution Mode is required.' }
  }
  if (form.run_mode !== 'test' && form.run_mode !== 'live') {
    return { ok: false, message: 'Run Mode is required.' }
  }

  const sched = validateScheduleForm(form.schedule)
  if (!sched.ok) return sched

  const accountId = form.account_id.trim()
  if (requireAccountPin && !accountId) {
    return {
      ok: false,
      message:
        'Account pin is required (OpenAPI account_id). Hard pin — no silent fallback.',
    }
  }
  if (
    requireAccountPin &&
    form.execution_mode === 'one_account_one_job' &&
    !accountId
  ) {
    return {
      ok: false,
      message: 'one_account_one_job requires a hard Account UUID pin.',
    }
  }

  let shortcode_mapping: CreateCampaignInput['shortcode_mapping']
  if (options?.schema) {
    const mapped = validateShortcodeMappingForm(
      form.shortcode_mapping,
      options.schema,
    )
    if (!mapped.ok) return mapped
    shortcode_mapping = mapped.mapping
  } else if (form.shortcode_mapping.length > 0) {
    const entries = form.shortcode_mapping
      .map((e) => ({
        shortcode: e.shortcode.trim(),
        variable: e.variable.trim(),
      }))
      .filter((e) => e.shortcode && e.variable)
    if (entries.length > 0) shortcode_mapping = { entries }
  }

  return {
    ok: true,
    value: {
      name,
      site_key: form.site_key.trim(),
      script_package_key: form.script_package_key.trim(),
      script_version: form.script_version.trim(),
      execution_mode: form.execution_mode,
      run_mode: form.run_mode,
      schedule: scheduleFormToApi(form.schedule),
      account_id: accountId || null,
      shortcode_mapping,
      contents: [],
    },
  }
}

/**
 * Safe editable states per OpenAPI update contract:
 * pending / waiting_resources and no attached job.
 * MOCK also allows `draft` for local Articles UX.
 */
export function isContentEditable(content: {
  status: string
  current_job_id?: string | null
}): boolean {
  if (content.current_job_id) return false
  return (
    content.status === 'pending' ||
    content.status === 'waiting_resources' ||
    content.status === 'draft'
  )
}

/** True when content is waiting because the hard-pinned Account is unavailable. */
export function isPinnedAccountUnavailable(content: {
  status: string
  last_error_code?: string | null
  last_error_message?: string | null
  last_result?: string | null
}): boolean {
  if (content.last_error_code === 'pinned_account_unavailable') return true
  const hay = [
    content.last_error_code,
    content.last_error_message,
    content.last_result,
  ]
    .filter(Boolean)
    .join(' ')
  return /pinned_account_unavailable/i.test(hay)
}

export function validateManualContent(
  draft: {
    title: string | null
    body: string | null
    variables: Record<string, string | null>
  },
  schema: ScriptInputSchema,
  lengthOk: boolean,
  lengthMessage?: string,
): ValidationOk<true> | ValidationErr {
  if (!schema.schema_available) {
    return {
      ok: false,
      message:
        'Script input schema unavailable. Load Script Registry detail before saving Content. Do not guess variables.',
    }
  }
  if (!lengthOk) {
    return {
      ok: false,
      message: lengthMessage ?? 'Content exceeds Site length limit.',
    }
  }
  if (schema.title_required && !draft.title?.trim()) {
    return { ok: false, message: 'Title is required by Script input schema.' }
  }
  if (schema.body_required && !draft.body?.trim()) {
    return { ok: false, message: 'Body is required by Script input schema.' }
  }
  for (const field of schema.fields) {
    if (!field.required) continue
    const v = draft.variables[field.key]
    if (v == null || !String(v).trim()) {
      return {
        ok: false,
        message: `Field "${field.label ?? field.key}" is required by Script schema.`,
      }
    }
  }
  return { ok: true, value: true }
}

export function validateShortcodeContent(
  rawSource: string,
  mappingShortcodes: string[],
): ValidationOk<true> | ValidationErr {
  const raw = rawSource.trim()
  if (!raw) {
    return { ok: false, message: 'Shortcode source is required.' }
  }
  try {
    // reuse assert via dynamic import avoidance — inline check
    if (/<\s*\/?\s*[a-zA-Z][^>]*>/.test(rawSource)) {
      return {
        ok: false,
        message:
          'richtext_format_unsupported: Backend accepts plain text shortcode only.',
      }
    }
  } catch {
    /* ignore */
  }
  if (mappingShortcodes.length === 0) {
    return {
      ok: false,
      message: 'Campaign shortcode_mapping is required before saving Articles.',
    }
  }
  return { ok: true, value: true }
}

export function canStartCampaign(
  campaign: Campaign,
  contents: CampaignContent[],
  testCompatible: boolean | null,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []

  if (campaign.status !== 'draft' && campaign.status !== 'scheduled' && campaign.status !== 'paused') {
    if (!campaign.allowed_actions.includes('start')) {
      reasons.push(`Campaign status "${campaign.status}" cannot Start.`)
    }
  }

  const validContents = contents.filter(
    (c) =>
      c.campaign_id === campaign.id &&
      c.status !== 'cancelled' &&
      c.status !== 'skipped',
  )
  // Authoritative zero-content gate: summary.total. Contents list is a
  // secondary signal when detail rows are already hydrated.
  if (campaign.summary.total === 0 && validContents.length === 0) {
    reasons.push('Campaign has zero Content. Add at least one Article before Start.')
  }

  const runCheck = canStartWithRunMode(campaign.run_mode, testCompatible)
  if (!runCheck.ok && runCheck.reason) reasons.push(runCheck.reason)

  if (
    campaign.status === 'draft' ||
    campaign.status === 'scheduled' ||
    campaign.status === 'paused'
  ) {
    // start allowed structurally
  } else if (!campaign.allowed_actions.includes('start')) {
    if (!reasons.some((r) => r.includes('cannot Start'))) {
      reasons.push(`Start not allowed for status "${campaign.status}".`)
    }
  }

  return { ok: reasons.length === 0, reasons }
}

export const RETRY_WARNING =
  'Job có thể đã thực hiện một phần. Chạy lại có nguy cơ tạo nội dung trùng.'

export const UNKNOWN_RETRY_WARNING =
  'Kết quả hiện tại là unknown — không chắc Job đã hoàn tất hay chưa. Không tự chuyển unknown thành failed/pending. Retry có thể tạo nội dung trùng.'
