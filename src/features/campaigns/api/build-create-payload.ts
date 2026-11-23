import { assertValidIntervalMinutes } from '../campaign-interval-edit.ts'
import type {
  CampaignShortcodeMapping,
  CreateCampaignInput,
  CreateCampaignV2Input,
  UpdateCampaignV2Input,
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

export type LiveCampaignV2CreateBody = {
  plan_version: 2
  name: string
  run_mode: 'test' | 'live'
  execution_mode?: 'one_account_one_job' | 'one_account_many_jobs'
  action_tags: Array<{
    action_tag_id?: number
    action_tag_key: string
    site_key: string
    cms_type?: string | null
    script_package_key: string
    script_version: string
    release_id?: number
    resolution_source: 'site_specific' | 'cms_global'
    shortcode_mapping: CampaignShortcodeMapping
    interval_minutes: number
  }>
  contents: Array<{
    external_ref?: string
    raw_source: string
    assignments: Array<{
      action_tag_id?: number
      action_tag_key: string
      script_package_key: string
      script_version: string
      release_id?: number
      raw_source: string
      shortcode_mapping: CampaignShortcodeMapping
    }>
  }>
}

/**
 * Map CreateCampaignV2Input -> Backend Campaign V2 create body.
 * Account-free Draft: omits account_id. Never fabricates IDs.
 */
export function buildLiveCampaignV2CreateBody(
  input: CreateCampaignV2Input,
): LiveCampaignV2CreateBody {
  const action_tags = input.action_tags.map((tag) => {
    const row: LiveCampaignV2CreateBody['action_tags'][number] = {
      action_tag_key: tag.action_tag_key.trim(),
      site_key: tag.site_key.trim(),
      script_package_key: tag.script_package_key.trim(),
      script_version: tag.script_version.trim(),
      resolution_source: tag.resolution_source,
      shortcode_mapping: {
        entries: tag.shortcode_mapping.entries.map((e) => ({
          shortcode: e.shortcode.trim(),
          variable: e.variable.trim(),
        })),
      },
      interval_minutes: assertValidIntervalMinutes(
        tag.interval_minutes,
        tag.action_tag_key,
      ),
    }
    if (tag.action_tag_id != null && tag.action_tag_id > 0) {
      row.action_tag_id = tag.action_tag_id
    }
    if (tag.cms_type !== undefined) {
      row.cms_type = tag.cms_type
    }
    if (tag.release_id != null && tag.release_id > 0) {
      row.release_id = tag.release_id
    }
    return row
  })

  const contents = input.contents.map((c, idx) => {
    const ext = c.external_ref?.trim()
    return {
      external_ref: ext || `content-${idx + 1}`,
      raw_source: c.raw_source.trim(),
      assignments: c.assignments.map((a) => {
        const assignment: LiveCampaignV2CreateBody['contents'][number]['assignments'][number] =
          {
            action_tag_key: a.action_tag_key.trim(),
            script_package_key: a.script_package_key.trim(),
            script_version: a.script_version.trim(),
            raw_source: a.raw_source.trim(),
            shortcode_mapping: {
              entries: a.shortcode_mapping.entries.map((e) => ({
                shortcode: e.shortcode.trim(),
                variable: e.variable.trim(),
              })),
            },
          }
        if (a.action_tag_id != null && a.action_tag_id > 0) {
          assignment.action_tag_id = a.action_tag_id
        }
        if (a.release_id != null && a.release_id > 0) {
          assignment.release_id = a.release_id
        }
        return assignment
      }),
    }
  })

  return {
    plan_version: 2,
    name: input.name.trim(),
    run_mode: input.run_mode,
    ...(input.execution_mode ? { execution_mode: input.execution_mode } : {}),
    action_tags,
    contents,
  }
}

export type LiveCampaignV2UpdateBody = {
  plan_version: 2
  name: string
  revision?: number
  updated_at?: string
  run_mode: 'test' | 'live'
  execution_mode?: 'one_account_one_job' | 'one_account_many_jobs'
  action_tags: Array<{
    plan_tag_uuid?: string
    action_tag_id?: number
    action_tag_key: string
    site_key: string
    cms_type?: string | null
    script_package_key: string
    script_version: string
    release_id?: number
    resolution_source: 'site_specific' | 'cms_global'
    shortcode_mapping: CampaignShortcodeMapping
    interval_minutes: number
  }>
  contents: Array<{
    id?: string
    external_ref?: string
    raw_source: string
    assignments: Array<{
      id?: string
      action_tag_id?: number
      action_tag_key: string
      script_package_key: string
      script_version: string
      release_id?: number
      raw_source: string
      shortcode_mapping: CampaignShortcodeMapping
    }>
  }>
}

/**
 * Map UpdateCampaignV2Input -> Backend Campaign V2 PUT body (full-plan replacement).
 * Preserves existing Tag/Content/Assignment IDs; omits IDs for newly added items.
 */
export function buildLiveCampaignV2UpdateBody(
  input: UpdateCampaignV2Input,
): LiveCampaignV2UpdateBody {
  const createBody = buildLiveCampaignV2CreateBody(input)

  const action_tags: LiveCampaignV2UpdateBody['action_tags'] =
    input.action_tags.map((tag, idx) => {
      const base = createBody.action_tags[idx]!
      return {
        ...(tag.plan_tag_uuid ? { plan_tag_uuid: tag.plan_tag_uuid } : {}),
        ...base,
      }
    })

  const contents: LiveCampaignV2UpdateBody['contents'] = input.contents.map(
    (c, idx) => {
      const base = createBody.contents[idx]!
      return {
        ...(c.id ? { id: c.id } : {}),
        ...base,
        assignments: c.assignments.map((a, aIdx) => {
          const baseAssign = base.assignments[aIdx]!
          return {
            ...(a.id ? { id: a.id } : {}),
            ...baseAssign,
          }
        }),
      }
    },
  )

  return {
    plan_version: 2,
    name: createBody.name,
    ...(input.revision != null ? { revision: input.revision } : {}),
    ...(input.updated_at ? { updated_at: input.updated_at } : {}),
    run_mode: createBody.run_mode,
    ...(createBody.execution_mode
      ? { execution_mode: createBody.execution_mode }
      : {}),
    action_tags,
    contents,
  }
}
