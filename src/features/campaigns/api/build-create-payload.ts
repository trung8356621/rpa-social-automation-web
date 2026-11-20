import type {
  CampaignShortcodeMapping,
  CreateCampaignInput,
} from '../types.ts'

/**
 * Staff OpenAPI `CampaignCreateRequest` (addon af4a652 — Shortcode V2).
 * Required: name, platform, execution_mode, script_id.
 * Optional: shortcode_mapping, contents (minItems 0), run_mode, script_version, account_id.
 */
export type LiveCampaignCreateBody = {
  name: string
  platform: string
  run_mode: 'test' | 'live'
  execution_mode: 'one_account_one_job' | 'one_account_many_jobs'
  script_id: string
  script_version: string
  account_id?: string
  resource_recheck_seconds: number
  shortcode_mapping?: CampaignShortcodeMapping
  contents: Array<{
    external_ref?: string
    input?: Record<string, string | number | boolean | null>
    raw_source?: string
  }>
}

/** Flatten UI content draft into placeholder-safe Script input object. */
export function contentDraftToLiveInput(row: {
  title?: string | null
  body?: string | null
  variables?: Record<string, string | null>
}): Record<string, string | number | boolean | null> {
  const input: Record<string, string | number | boolean | null> = {}
  if (row.title?.trim()) input.title = row.title.trim()
  if (row.body?.trim()) input.body = row.body.trim()
  for (const [key, value] of Object.entries(row.variables ?? {})) {
    if (!key.trim()) continue
    if (value == null || !String(value).trim()) continue
    if (/password|secret|token|api[_-]?key/i.test(key)) continue
    input[key] = String(value).trim()
  }
  return input
}

/**
 * Map CreateCampaignInput → OpenAPI create body.
 * Zero contents allowed. shortcode_mapping sent when present.
 */
export function buildLiveCampaignCreateBody(
  input: CreateCampaignInput,
): LiveCampaignCreateBody {
  const contents = (input.contents ?? []).map((row, index) => {
    const external = row.external_ref?.trim()
    const body: LiveCampaignCreateBody['contents'][number] = {}
    if (external) body.external_ref = external
    else if (!row.raw_source?.trim()) body.external_ref = `poc-${index + 1}`

    if (row.raw_source?.trim()) {
      body.raw_source = row.raw_source.trim()
    } else {
      body.input = contentDraftToLiveInput(row)
    }
    return body
  })

  const accountId = String(input.account_id ?? '').trim()
  const body: LiveCampaignCreateBody = {
    name: input.name.trim(),
    platform: input.site_key.trim(),
    run_mode: input.run_mode,
    execution_mode: input.execution_mode,
    script_id: input.script_package_key.trim(),
    script_version: String(input.script_version ?? '').trim(),
    resource_recheck_seconds:
      input.schedule.resource_recheck_seconds > 0
        ? input.schedule.resource_recheck_seconds
        : 3600,
    contents,
  }
  if (accountId) body.account_id = accountId
  if (input.shortcode_mapping?.entries?.length) {
    body.shortcode_mapping = {
      entries: input.shortcode_mapping.entries.map((e) => ({
        shortcode: e.shortcode.trim(),
        variable: e.variable.trim(),
      })),
    }
  }
  return body
}
