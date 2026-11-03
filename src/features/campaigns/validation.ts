import {
  scheduleFormToApi,
  validateScheduleForm,
  type ScheduleFormValues,
} from './schedule.ts'
import { canStartWithRunMode } from './script-compat.ts'
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
  execution_mode: CampaignExecutionMode
  run_mode: CampaignRunMode
  schedule: ScheduleFormValues
}

export type ValidationOk<T> = { ok: true; value: T }
export type ValidationErr = { ok: false; message: string }

export function validateCampaignForm(
  form: CampaignFormValues,
): ValidationOk<CreateCampaignInput> | ValidationErr {
  const name = form.name.trim()
  if (!name) return { ok: false, message: 'Campaign Name is required.' }
  if (!form.site_key.trim()) {
    return { ok: false, message: 'Platform/Site is required (Site Registry).' }
  }
  if (!form.script_package_key.trim()) {
    return { ok: false, message: 'Script is required (Script Registry).' }
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

  return {
    ok: true,
    value: {
      name,
      site_key: form.site_key.trim(),
      script_package_key: form.script_package_key.trim(),
      execution_mode: form.execution_mode,
      run_mode: form.run_mode,
      schedule: scheduleFormToApi(form.schedule),
    },
  }
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
  if (validContents.length === 0) {
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
