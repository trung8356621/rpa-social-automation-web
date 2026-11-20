import { tipTapDocToPlainText } from '../content-adapters.ts'
import { assertPlainShortcodeSource } from '../shortcode-source.ts'
import type { ManualContentDraft, ScriptInputSchema } from '../types.ts'

/**
 * OpenAPI CampaignContentCreateRequest / CampaignContentUpdateRequest.
 * Shortcode V2: prefer `raw_source` plain text. Legacy: `input`.
 */
export type LiveCampaignContentBody = {
  external_ref?: string | null
  account_id?: string
  input?: Record<string, string | number | boolean | null>
  raw_source?: string
}

export type DiscardedScriptInput = {
  key: string
  label: string
  value: string
}

export type MapDraftInputResult =
  | {
      ok: true
      input: Record<string, string | number | boolean | null>
      discarded: DiscardedScriptInput[]
    }
  | { ok: false; message: string }

/**
 * Map Article draft → Script input keys allowed by published schema only.
 * Never invents variables. Never sends unsupported keys.
 */
export function mapDraftToAllowedScriptInput(
  draft: ManualContentDraft,
  schema: ScriptInputSchema,
): MapDraftInputResult {
  if (!schema.schema_available) {
    return {
      ok: false,
      message:
        'Script input schema unavailable. Load Script Registry detail before saving Content. Do not guess variables.',
    }
  }

  const bodyPlain =
    draft.body ??
    (draft.editor_doc ? tipTapDocToPlainText(draft.editor_doc) : null)
  const title = draft.title?.trim() ? draft.title.trim() : ''
  const body = bodyPlain?.trim() ? bodyPlain.trim() : ''
  const discarded: DiscardedScriptInput[] = []
  const input: Record<string, string | number | boolean | null> = {}

  if (title) {
    if (schema.title_supported) input.title = title
    else discarded.push({ key: 'title', label: 'Title', value: title })
  }
  if (body) {
    if (schema.body_supported) input.body = body
    else discarded.push({ key: 'body', label: 'Body', value: body })
  }

  const allowedExtra = new Set(schema.fields.map((f) => f.key))
  for (const [key, value] of Object.entries(draft.variables ?? {})) {
    const k = key.trim()
    if (!k) continue
    if (value == null || !String(value).trim()) continue
    if (/password|secret|token|api[_-]?key/i.test(k)) continue
    const trimmed = String(value).trim()
    if (allowedExtra.has(k)) {
      input[k] = trimmed
    } else {
      const field = schema.fields.find((f) => f.key === k)
      discarded.push({
        key: k,
        label: field?.label ?? k,
        value: trimmed,
      })
    }
  }

  return { ok: true, input, discarded }
}

export function buildLiveCampaignContentBody(
  draft: ManualContentDraft,
  options: {
    schema: ScriptInputSchema
    accountId?: string | null
    /** When true, discarded values are allowed (user confirmed). */
    allowDiscard?: boolean
    /** Prefer shortcode raw_source when Campaign has mapping. */
    preferShortcode?: boolean
  },
): LiveCampaignContentBody {
  const raw = draft.raw_source?.trim() ?? ''
  if (options.preferShortcode || raw) {
    if (!raw) {
      throw new Error('raw_source is required for shortcode Content.')
    }
    assertPlainShortcodeSource(raw)
    const body: LiveCampaignContentBody = { raw_source: raw }
    const external = draft.external_ref?.trim()
    if (external) body.external_ref = external
    const accountId = options.accountId?.trim()
    if (accountId) body.account_id = accountId
    return body
  }

  const mapped = mapDraftToAllowedScriptInput(draft, options.schema)
  if (!mapped.ok) {
    throw new Error(mapped.message)
  }
  if (mapped.discarded.length > 0 && !options.allowDiscard) {
    const names = mapped.discarded.map((d) => d.label).join(', ')
    throw new Error(
      `Script does not support: ${names}. Confirm before saving supported fields only.`,
    )
  }

  const body: LiveCampaignContentBody = { input: mapped.input }
  const external = draft.external_ref?.trim()
  if (external) body.external_ref = external
  const accountId = options.accountId?.trim()
  if (accountId) body.account_id = accountId
  return body
}

export function formatDiscardedInputWarning(
  discarded: DiscardedScriptInput[],
  keptKeys: string[],
): string {
  const drop = discarded.map((d) => d.label).join(', ')
  const keep =
    keptKeys.length > 0 ? keptKeys.join(', ') : '(no supported fields with values)'
  return [
    `Script schema does not support: ${drop}.`,
    `Those values will NOT be saved.`,
    `Save will only send: ${keep}.`,
    'Continue?',
  ].join('\n')
}
