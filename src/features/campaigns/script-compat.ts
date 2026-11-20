import type {
  ScriptDetail,
  ScriptListItem,
  ScriptReleaseDetail,
} from '../script-registry/types.ts'

import type { ScriptInputField, ScriptInputSchema } from './types.ts'

/**
 * Filter Script Registry items compatible with a Site Registry key.
 * Uses package_key / script_id / action_tag_key prefixes — do not invent IDs.
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
  if (t === 'enum' || t === 'select') return 'string'
  if (t === 'url') return 'string'
  return 'string'
}

/** Fail-closed placeholder when Script Registry variables cannot be read. */
export function unavailableScriptInputSchema(
  testModeCompatible: boolean | null = null,
  reason: string | null = null,
): ScriptInputSchema {
  return {
    fields: [],
    test_mode_compatible: testModeCompatible,
    title_required: false,
    body_required: false,
    schema_available: false,
    title_supported: false,
    body_supported: false,
    unavailable_reason: reason,
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
    // Pinned version exists but is not published — do not fall back.
    const exactAny = detail.releases.find((r) => r.version === version)
    if (exactAny) return null
    return null
  }
  return detail.releases.find((r) => r.status === 'published') ?? null
}

/**
 * Align with Backend CampaignScriptVariableSchema::fromManifest:
 * key from `key` | `name`, or bare string entries.
 */
export function variableKeyFromRow(row: unknown): string {
  if (typeof row === 'string') return row.trim()
  if (!row || typeof row !== 'object') return ''
  const obj = row as Record<string, unknown>
  if (typeof obj.key === 'string' && obj.key.trim()) return obj.key.trim()
  if (typeof obj.name === 'string' && obj.name.trim()) return obj.name.trim()
  return ''
}

/**
 * Staff Script Registry detail (addon af4a652) strips `releases[].variables`
 * and only projects `variable_count`. Detect that gap — do not treat as empty.
 */
export function diagnoseReleaseVariableProjection(
  release: ScriptReleaseDetail,
):
  | { ok: true; variables: unknown[] }
  | { ok: false; reason: string } {
  if (Array.isArray(release.variables)) {
    return { ok: true, variables: release.variables }
  }

  const count = release.variable_count
  if (typeof count === 'number' && count > 0) {
    return {
      ok: false,
      reason: [
        'CONTRACT GAP: Staff Script Registry detail omits releases[].variables',
        `but reports variable_count=${count} for published release v${release.version}.`,
        'Endpoint: GET /social-automation/api/script-registry/{package_key}.',
        'Backend StaffScriptRegistryController::mapRelease projects variable_count only.',
        'Campaign mapping requires the same manifest variables used by CampaignScriptVariableSchema::fromManifest.',
        'Do not invent client-side variables.',
      ].join(' '),
    }
  }

  if (typeof count === 'number' && count === 0) {
    return { ok: true, variables: [] }
  }

  return {
    ok: false,
    reason: [
      'CONTRACT GAP: Staff Script Registry detail did not project releases[].variables',
      `(release v${release.version}; variable_count missing).`,
      'Endpoint: GET /social-automation/api/script-registry/{package_key}.',
      'Fail-closed — variables are not invented.',
    ].join(' '),
  }
}

/**
 * Parse Script release variables into an input schema.
 * Mirrors Backend CampaignScriptVariableSchema key/required defaults.
 * Never invents keys.
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

  if (!detail) {
    return unavailableScriptInputSchema(
      testMode,
      'Script detail unavailable.',
    )
  }
  const release = selectPublishedRelease(detail, options?.scriptVersion)
  if (!release) {
    return unavailableScriptInputSchema(
      testMode,
      options?.scriptVersion?.trim()
        ? `Published release v${options.scriptVersion.trim()} not found for package ${detail.package_key}.`
        : `No published release found for package ${detail.package_key}.`,
    )
  }

  const projected = diagnoseReleaseVariableProjection(release)
  if (!projected.ok) {
    return unavailableScriptInputSchema(testMode, projected.reason)
  }

  const variables = projected.variables
  const fields: ScriptInputField[] = []

  for (const raw of variables) {
    // Bare string entries — Backend fromManifest accepts these as required string.
    if (typeof raw === 'string') {
      const key = raw.trim()
      if (!key) continue
      if (key === 'password' || key === 'account_id' || key === 'username') {
        continue
      }
      fields.push({
        key,
        type: 'string',
        required: true,
        label: key,
      })
      continue
    }
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const key = variableKeyFromRow(row)
    if (!key) continue
    if (key === 'password' || asFieldType(row.type) === 'secret') continue
    if (key === 'account_id' || key === 'username') continue

    // Backend defaults required=true when key absent.
    const required = Object.prototype.hasOwnProperty.call(row, 'required')
      ? Boolean(row.required)
      : true

    fields.push({
      key,
      type: asFieldType(row.type),
      required,
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
    unavailable_reason: null,
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
  const release = selectPublishedRelease(detail, null) as
    | (ScriptReleaseDetail & { test_mode_compatible?: boolean })
    | null
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
