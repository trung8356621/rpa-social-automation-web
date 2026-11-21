import type {
  CampaignShortcodeMapping,
  CampaignShortcodeMappingEntry,
  ScriptInputField,
  ScriptInputSchema,
} from './types.ts'

/** OpenAPI CampaignShortcodeMapping.entries[].shortcode pattern */
export const SHORTCODE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/

/** Default editor shortcode name — NOT assumed to exist as a Script variable. */
export const DEFAULT_SHORTCODE_NAME = 'body'

export type ShortcodeMappingFormEntry = {
  id: string
  shortcode: string
  variable: string
}

export function emptyShortcodeMappingEntry(
  overrides?: Partial<ShortcodeMappingFormEntry>,
): ShortcodeMappingFormEntry {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    shortcode: DEFAULT_SHORTCODE_NAME,
    variable: '',
    ...overrides,
  }
}

/** Default create-time mapping: one `[body]` row waiting for a Script variable. */
export function defaultShortcodeMappingForm(
  preferredVariable?: string | null,
): ShortcodeMappingFormEntry[] {
  return [
    emptyShortcodeMappingEntry({
      shortcode: DEFAULT_SHORTCODE_NAME,
      variable: preferredVariable?.trim() || '',
    }),
  ]
}

/**
 * Schema-aware default shortcode mapping for Campaign V2:
 * - Suggests `[body] -> body` only when the published schema declares `body`.
 * - Never silently maps `[body] -> title` when `body` is absent.
 */
export function defaultShortcodeMappingForSchema(
  schema: ScriptInputSchema,
): ShortcodeMappingFormEntry[] {
  const bodyVar = findCompatibleBodyVariable(schema)
  return defaultShortcodeMappingForm(bodyVar)
}

/**
 * All Script variables eligible for shortcode binding (includes title/body).
 * Does not invent keys — only schema-supported variables.
 */
export function allScriptVariables(
  schema: ScriptInputSchema,
): ScriptInputField[] {
  if (!schema.schema_available) return []
  const out: ScriptInputField[] = []
  if (schema.title_supported) {
    out.push({
      key: 'title',
      type: 'string',
      required: schema.title_required,
      label: 'title',
    })
  }
  if (schema.body_supported) {
    out.push({
      key: 'body',
      type: 'text',
      required: schema.body_required,
      label: 'body',
    })
  }
  for (const field of schema.fields) {
    if (field.key === 'title' || field.key === 'body') continue
    out.push(field)
  }
  return out
}

/**
 * Returns `'body'` only if the published Script schema actually declares a `body`
 * variable. Never fabricates `body` for schemas that do not support it.
 */
export function findCompatibleBodyVariable(
  schema: ScriptInputSchema,
): string | null {
  if (!schema.schema_available) return null
  const vars = allScriptVariables(schema)
  return vars.some((v) => v.key === 'body') ? 'body' : null
}

export function validateBodyShortcodeSupport(
  schema: ScriptInputSchema,
): { supported: true; variable: 'body' } | { supported: false; reason: string } {
  if (!schema.schema_available) {
    return {
      supported: false,
      reason:
        schema.unavailable_reason ||
        'Script input schema unavailable — cannot verify whether [body] is supported.',
    }
  }
  const bodyVar = findCompatibleBodyVariable(schema)
  if (!bodyVar) {
    const available = allScriptVariables(schema)
      .map((v) => v.key)
      .join(', ')
    return {
      supported: false,
      reason: available
        ? `This Script schema does not declare a "body" variable (available: ${available}). Map [body] to an actual variable or use another shortcode.`
        : 'This Script schema declares no input variables.',
    }
  }
  return { supported: true, variable: 'body' }
}

export function preferredDefaultVariable(
  schema: ScriptInputSchema,
): string | null {
  const bodyVar = findCompatibleBodyVariable(schema)
  if (bodyVar) return bodyVar
  const vars = allScriptVariables(schema)
  const required = vars.find((v) => v.required)
  if (required) return required.key
  return vars[0]?.key ?? null
}

export type ShortcodeMappingValidation =
  | { ok: true; mapping: CampaignShortcodeMapping }
  | { ok: false; message: string }

export function validateShortcodeMappingForm(
  entries: ShortcodeMappingFormEntry[],
  schema: ScriptInputSchema,
): ShortcodeMappingValidation {
  if (!schema.schema_available) {
    return {
      ok: false,
      message:
        'Script input schema unavailable. Load Script Registry detail before configuring shortcode mapping.',
    }
  }

  const variables = allScriptVariables(schema)
  const variableKeys = new Set(variables.map((v) => v.key))
  const cleaned: CampaignShortcodeMappingEntry[] = []
  const seenShortcodes = new Set<string>()
  const seenVariables = new Set<string>()

  for (const row of entries) {
    const shortcode = row.shortcode.trim()
    const variable = row.variable.trim()
    if (!shortcode && !variable) continue
    if (!shortcode) {
      return { ok: false, message: 'Shortcode name is required.' }
    }
    if (!SHORTCODE_NAME_PATTERN.test(shortcode)) {
      return {
        ok: false,
        message: `Invalid shortcode "${shortcode}". Use pattern ^[a-z][a-z0-9_]*$ (e.g. body).`,
      }
    }
    if (!variable) {
      return {
        ok: false,
        message: `Shortcode [${shortcode}] must bind to a Script variable.`,
      }
    }
    if (!variableKeys.has(variable)) {
      return {
        ok: false,
        message: `Variable "${variable}" is not in the pinned Script schema.`,
      }
    }
    if (seenShortcodes.has(shortcode)) {
      return {
        ok: false,
        message: `Duplicate shortcode name "${shortcode}".`,
      }
    }
    if (seenVariables.has(variable)) {
      return {
        ok: false,
        message: `Duplicate variable target "${variable}".`,
      }
    }
    seenShortcodes.add(shortcode)
    seenVariables.add(variable)
    cleaned.push({ shortcode, variable })
  }

  if (cleaned.length === 0) {
    return {
      ok: false,
      message: 'At least one shortcode mapping entry is required.',
    }
  }

  const required = variables.filter((v) => v.required)
  for (const field of required) {
    if (!seenVariables.has(field.key)) {
      return {
        ok: false,
        message: `Required Script variable "${field.label ?? field.key}" is unmapped.`,
      }
    }
  }

  return { ok: true, mapping: { entries: cleaned } }
}

export function mappingFromApi(
  raw: unknown,
): CampaignShortcodeMapping | null {
  if (!raw || typeof raw !== 'object') return null
  const entriesRaw = (raw as { entries?: unknown }).entries
  if (!Array.isArray(entriesRaw) || entriesRaw.length === 0) return null
  const entries: CampaignShortcodeMappingEntry[] = []
  for (const item of entriesRaw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const shortcode =
      typeof row.shortcode === 'string' ? row.shortcode.trim() : ''
    const variable =
      typeof row.variable === 'string' ? row.variable.trim() : ''
    if (!shortcode || !variable) continue
    entries.push({ shortcode, variable })
  }
  return entries.length > 0 ? { entries } : null
}
