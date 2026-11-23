import { ApiError, toSafeApiMessage } from '../../lib/api/errors.ts'
import { normalizeLanguageCode } from './languages.ts'
import type {
  ScriptDetail,
  ScriptListItem,
  ScriptOperationalSettingsInput,
} from './types.ts'

export type ScriptConfigActionScope = 'auto' | 'cms_global' | 'site_action'

export type ScriptConfigRequestBody = {
  language_label: string
  is_enabled: boolean
  is_primary: boolean
  action_scope?: ScriptConfigActionScope
}

export function buildScriptConfigRequestBody(
  input: ScriptOperationalSettingsInput,
  actionScope?: ScriptConfigActionScope,
): ScriptConfigRequestBody {
  const normalized = normalizeLanguageCode(input.language_code)
  return {
    language_label: normalized ?? 'DEFAULT',
    is_enabled: Boolean(input.is_enabled),
    is_primary: Boolean(input.is_primary),
    ...(actionScope && actionScope !== 'auto'
      ? { action_scope: actionScope }
      : {}),
  }
}

export function isScriptConfigUnavailableError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  return (
    err.status === 404 ||
    err.status === 503 ||
    err.kind === 'not_found' ||
    err.code === 'schema_unavailable'
  )
}

export function formatScriptConfigErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (
      err.status === 404 ||
      err.status === 503 ||
      err.code === 'schema_unavailable'
    ) {
      return 'Operational Settings API unavailable on this server (404 / schema not migrated).'
    }
    if (err.code === 'duplicate_language_label') {
      return 'Another enabled Script in this Action scope already uses this language label. Choose a different language or disable the conflicting Script.'
    }
    if (err.code === 'disabled_script_cannot_be_primary') {
      return 'A disabled Script cannot be set as Primary. Enable the Script first.'
    }
    if (
      err.code === 'incompatible_variant_scope' ||
      err.code === 'invalid_action_scope' ||
      err.code === 'ineligible_for_global' ||
      err.code === 'source_action_tag_not_found'
    ) {
      return `Action scope conflict (${err.code}): this Script is not compatible with the requested Action scope.`
    }
    if (err.status === 409 || err.code === 'global_scope_conflict') {
      const conflict = err.details?.conflict as
        | { name?: string; package_key?: string }
        | undefined
      const who = conflict?.name || conflict?.package_key
      return who
        ? `CMS Global conflict (409): "${who}" already owns this global scope.`
        : 'CMS Global conflict (409): another Script already owns this global scope.'
    }
    if (err.code === 'published_release_required') {
      return 'A published Script Release is required before configuring operational settings.'
    }
    if (err.status === 401 || err.status === 403 || err.isAuthRequired) {
      return err.message
    }
  }
  return toSafeApiMessage(err)
}

export type CompatibleActionScriptRow = {
  package_key: string
  name: string
  language_code: string | null
  is_enabled: boolean
  is_primary: boolean
  priority_label: string
}

export function resolveActionScopeKey(script: {
  global_scope?: string | null
  eligible_global_scope?: { scope?: string | null } | null
  action_tag_key?: string | null
}): string | null {
  const scope =
    script.global_scope?.trim() ||
    script.eligible_global_scope?.scope?.trim() ||
    script.action_tag_key?.trim() ||
    null
  return scope ? scope.toLowerCase() : null
}

/**
 * Find compatible Scripts sharing the same logical Action scope, ordered by
 * Primary -> Enabled Fallbacks -> Disabled, with human-readable execution priority.
 */
export function findCompatibleScriptsForAction(
  target: Pick<
    ScriptDetail,
    'package_key' | 'global_scope' | 'eligible_global_scope' | 'action_tag_key'
  >,
  allScripts: ScriptListItem[],
): CompatibleActionScriptRow[] {
  const targetScope = resolveActionScopeKey(target)
  const matching = allScripts.filter((s) => {
    if (s.is_authentication) return false
    if (!targetScope) return s.package_key === target.package_key
    return resolveActionScopeKey(s) === targetScope
  })

  const sorted = [...matching].sort((a, b) => {
    const aPrimary = a.is_primary === true ? 0 : 1
    const bPrimary = b.is_primary === true ? 0 : 1
    if (aPrimary !== bPrimary) return aPrimary - bPrimary

    const aEnabled = a.is_enabled !== false && a.status !== 'yanked' ? 0 : 1
    const bEnabled = b.is_enabled !== false && b.status !== 'yanked' ? 0 : 1
    if (aEnabled !== bEnabled) return aEnabled - bEnabled

    const aPrio = a.fallback_priority ?? Number.MAX_SAFE_INTEGER
    const bPrio = b.fallback_priority ?? Number.MAX_SAFE_INTEGER
    if (aPrio !== bPrio) return aPrio - bPrio

    return a.name.localeCompare(b.name)
  })

  let fallbackIdx = 1
  return sorted.map((s) => {
    const enabled = s.is_enabled !== false && s.status !== 'yanked'
    const primary = s.is_primary === true
    let priority_label = 'Disabled'
    if (enabled) {
      if (primary) {
        priority_label = 'Primary'
      } else {
        priority_label = `Fallback #${fallbackIdx++}`
      }
    }
    return {
      package_key: s.package_key,
      name: s.name,
      language_code: normalizeLanguageCode(s.language_code),
      is_enabled: enabled,
      is_primary: primary,
      priority_label,
    }
  })
}

/**
 * MOCK-ONLY state updater: updates operational settings for one Script and
 * enforces at most one Primary Script per Action scope.
 */
export function applyMockOperationalSettings(
  scripts: ScriptListItem[],
  details: Record<string, ScriptDetail>,
  packageKey: string,
  input: ScriptOperationalSettingsInput,
): { scripts: ScriptListItem[]; details: Record<string, ScriptDetail> } {
  const normLang = normalizeLanguageCode(input.language_code)
  const target = scripts.find((s) => s.package_key === packageKey)
  const targetScope = target ? resolveActionScopeKey(target) : null

  const nextScripts = scripts.map((s) => {
    if (s.package_key === packageKey) {
      return {
        ...s,
        is_enabled: input.is_enabled,
        language_code: normLang,
        is_primary: input.is_primary,
      }
    }
    if (
      input.is_primary &&
      targetScope &&
      resolveActionScopeKey(s) === targetScope
    ) {
      return { ...s, is_primary: false }
    }
    return s
  })

  const nextDetails = { ...details }
  for (const [k, d] of Object.entries(nextDetails)) {
    if (k === packageKey) {
      nextDetails[k] = {
        ...d,
        is_enabled: input.is_enabled,
        language_code: normLang,
        is_primary: input.is_primary,
      }
    } else if (
      input.is_primary &&
      targetScope &&
      resolveActionScopeKey(d) === targetScope
    ) {
      nextDetails[k] = { ...d, is_primary: false }
    }
  }

  return { scripts: nextScripts, details: nextDetails }
}
