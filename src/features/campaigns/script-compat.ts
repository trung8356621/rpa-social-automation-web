import type {
  ScriptDetail,
  ScriptListItem,
  ScriptReleaseDetail,
} from '../script-registry/types.ts'

import type { ScriptInputField, ScriptInputSchema } from './types.ts'

/**
 * Filter Script Registry items compatible with a Site Registry key.
 * Uses package_key / script_id / action_tag_key prefixes — does not invent IDs.
 */
export function filterScriptsForSite(
  scripts: ScriptListItem[],
  siteKey: string,
): ScriptListItem[] {
  const key = siteKey.trim().toLowerCase()
  if (!key) return []
  return scripts.filter((s) => {
    if (s.is_authentication) return false
    if (s.status === 'yanked') return false
    const hay = [
      s.package_key,
      s.script_id,
      s.action_tag_key ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(key) || hay.startsWith(`script.${key}`)
  })
}

function asFieldType(raw: unknown): ScriptInputField['type'] {
  const t = String(raw ?? 'string').toLowerCase()
  if (t === 'text' || t === 'textarea') return 'text'
  if (t === 'secret' || t === 'password') return 'secret'
  if (t === 'number' || t === 'int' || t === 'integer') return 'number'
  if (t === 'boolean' || t === 'bool') return 'boolean'
  return 'string'
}

/** Fail-closed placeholder when Script Registry variables cannot be read. */
export function unavailableScriptInputSchema(
  testModeCompatible: boolean | null = null,
): ScriptInputSchema {
  return {
    fields: [],
    test_mode_compatible: testModeCompatible,
    title_required: false,
    body_required: false,
    schema_available: false,
    title_supported: false,
    body_supported: false,
  }
}

/**
 * Authoritative published release for Campaign pin.
 * Prefer exact version match; otherwise first published release.
 * Fail-closed (null) when pin misses or no published release exists.
 */
export function selectPublishedRelease(
  detail: ScriptDetail | null | undefined,
  scriptVersion?: string | null,
): ScriptReleaseDetail | null {
  if (!detail || !Array.isArray(detail.releases) || detail.releases.length === 0) {
    return null
  }
  const version = scriptVersion?.trim() || ''
  if (version) {
    const exactPublished = detail.releases.find(
      (r) => r.version === version && r.status === 'published',
    )
    if (exactPublished) return exactPublished
    // Pinned version exists but is not published — do not fall back to another release.
    const exactAny = detail.releases.find((r) => r.version === version)
    if (exactAny) return null
    return null
  }
  return (
    detail.releases.find((r) => r.status === 'published') ?? null
  )
}

function variableKeyFromRow(row: Record<string, unknown>): string {
  if (typeof row.key === 'string' && row.key.trim()) return row.key.trim()
  // Some release manifests use `name` as the variable identity.
  if (typeof row.name === 'string' && row.name.trim()) return row.name.trim()
  return ''
}

/**
 * Parse Script release variables into an input schema.
 * Unknown variable shapes are skipped — never invent keys.
 */
export function parseScriptInputSchema(
  detail: ScriptDetail | null | undefined,
  options?: {
    testModeCompatible?: boolean | null
    scriptVersion?: string | null
  },
): ScriptInputSchema {
  const testMode =
    options?.testModeCompatible === undefined
      ? null
      : options.testModeCompatible

  if (!detail) return unavailableScriptInputSchema(testMode)
  const release = selectPublishedRelease(detail, options?.scriptVersion)
  if (!release || !Array.isArray(release.variables)) {
    return unavailableScriptInputSchema(testMode)
  }

  // Empty array is still an authoritative schema (Script may have zero vars).
  const variables = release.variables
  const fields: ScriptInputField[] = []

  for (const raw of variables) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const key = variableKeyFromRow(row)
    if (!key) continue
    // Credentials must never be collected as Campaign Content
    if (key === 'password' || asFieldType(row.type) === 'secret') continue
    if (key === 'account_id' || key === 'username') continue

    fields.push({
      key,
      type: asFieldType(row.type),
      required: Boolean(row.required),
      label: typeof row.label === 'string' ? row.label : key,
    })
  }

  const keys = new Set(fields.map((f) => f.key))
  const hasTitle = keys.has('title')
  const hasBody = keys.has('body')
  const title_required = hasTitle
    ? Boolean(fields.find((f) => f.key === 'title')?.required)
    : false
  const body_required = hasBody
    ? Boolean(fields.find((f) => f.key === 'body')?.required)
    : false

  return {
    fields: fields.filter((f) => f.key !== 'title' && f.key !== 'body'),
    test_mode_compatible: testMode,
    title_required,
    body_required,
    schema_available: true,
    title_supported: hasTitle,
    body_supported: hasBody,
  }
}

/**
 * Mock/local Test Mode flag. Live: null until backend contract exposes it.
 */
export function resolveTestModeCompatibility(
  detail: ScriptDetail | null | undefined,
  mockFlag: boolean | null | undefined,
): boolean | null {
  if (mockFlag !== undefined && mockFlag !== null) return mockFlag
  const release = detail?.releases?.[0] as
    | (ScriptDetail['releases'][number] & {
        test_mode_compatible?: boolean
      })
    | undefined
  if (
    release &&
    typeof (release as { test_mode_compatible?: unknown })
      .test_mode_compatible === 'boolean'
  ) {
    return (release as { test_mode_compatible: boolean }).test_mode_compatible
  }
  return null
}

export function canStartWithRunMode(
  runMode: 'test' | 'live',
  testCompatible: boolean | null,
): { ok: boolean; reason: string | null } {
  if (runMode === 'live') return { ok: true, reason: null }
  if (testCompatible === true) return { ok: true, reason: null }
  if (testCompatible === false) {
    return {
      ok: false,
      reason:
        'Script này không được đánh dấu tương thích Test Mode. Không thể Start ở Test Mode.',
    }
  }
  return {
    ok: false,
    reason:
      'Không xác định được tương thích Test Mode từ contract. Start bị vô hiệu hóa.',
  }
}
