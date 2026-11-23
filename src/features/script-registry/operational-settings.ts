import { normalizeLanguageCode } from './languages.ts'
import type {
  ScriptDetail,
  ScriptListItem,
  ScriptOperationalSettingsInput,
} from './types.ts'

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
