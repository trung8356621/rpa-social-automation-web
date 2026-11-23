import { ApiError, toSafeApiMessage } from '../../lib/api/errors.ts'
import type { PersistedVariantGroup } from './api/variant-groups-contract.ts'
import { normalizeLanguageCode } from './languages.ts'
import type {
  ScriptDetail,
  ScriptListItem,
  ScriptOperationalSettingsInput,
  ScriptSharingMode,
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

export type ScriptDescriptionRequestBody = {
  description: string | null
}

export function buildScriptDescriptionRequestBody(
  description: string | null | undefined,
): ScriptDescriptionRequestBody {
  if (description == null) return { description: null }
  const trimmed = description.trim()
  return { description: trimmed.length > 0 ? trimmed : null }
}

export function formatScriptDescriptionErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (
      err.status === 404 ||
      err.status === 503 ||
      err.code === 'schema_unavailable'
    ) {
      return 'Description editing API unavailable on this server (404 / schema not migrated).'
    }
    if (err.code === 'description_too_long') {
      return 'Description exceeds the maximum length of 5,000 characters.'
    }
    if (err.code === 'invalid_description') {
      return 'Description must be a valid string or empty.'
    }
    if (err.code === 'description_required') {
      return 'Description field is required in the request.'
    }
    if (err.status === 401 || err.status === 403 || err.isAuthRequired) {
      return err.message
    }
  }
  return toSafeApiMessage(err)
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

export type ScriptExecutionRole =
  | 'primary'
  | 'fallback'
  | 'enabled_unselected'
  | 'disabled'

export type CompatibleActionScriptRow = {
  package_key: string
  name: string
  language_code: string | null
  is_enabled: boolean
  is_primary: boolean
  role: ScriptExecutionRole
  priority_label: string
  effective_sharing_mode: ScriptSharingMode
  sharing_managed_automatically: boolean
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
 * Resolve effective CMS Global sharing status from Backend fields and
 * effective Variant Group membership (never inferred from Action Tag alone).
 */
export function resolveEffectiveSharingForScript(
  script: Pick<
    ScriptListItem,
    | 'package_key'
    | 'sharing_mode'
    | 'effective_sharing_mode'
    | 'sharing_managed_automatically'
    | 'is_enabled'
    | 'status'
  >,
  persistedGroups: PersistedVariantGroup[] = [],
): {
  effectiveSharingMode: ScriptSharingMode
  sharingManagedAutomatically: boolean
} {
  if (script.effective_sharing_mode) {
    return {
      effectiveSharingMode: script.effective_sharing_mode,
      sharingManagedAutomatically: Boolean(script.sharing_managed_automatically),
    }
  }

  const enabled = script.is_enabled !== false && script.status !== 'yanked'
  for (const g of persistedGroups) {
    if (!g.is_enabled) continue
    const member = g.variants.find(
      (v) => v.package_key === script.package_key && v.is_enabled,
    )
    if (member && enabled) {
      return {
        effectiveSharingMode:
          g.scope_type === 'cms_global' ? 'cms_global' : 'site_specific',
        sharingManagedAutomatically: g.scope_type === 'cms_global',
      }
    }
  }

  return {
    effectiveSharingMode: script.sharing_mode ?? 'site_specific',
    sharingManagedAutomatically: Boolean(script.sharing_managed_automatically),
  }
}

/**
 * Find compatible Scripts sharing the same logical Action scope, using actual
 * Backend configuration and effective group membership.
 * Never labels every enabled same-Action Script as an automatic fallback.
 */
export function findCompatibleScriptsForAction(
  target: Pick<
    ScriptDetail,
    'package_key' | 'global_scope' | 'eligible_global_scope' | 'action_tag_key'
  >,
  allScripts: ScriptListItem[],
  persistedGroups: PersistedVariantGroup[] = [],
): CompatibleActionScriptRow[] {
  const targetScope = resolveActionScopeKey(target)
  const matching = allScripts.filter((s) => {
    if (s.is_authentication) return false
    if (!targetScope) return s.package_key === target.package_key
    return resolveActionScopeKey(s) === targetScope
  })

  // Find actual Backend group containing target or matching scope
  const activeGroup =
    persistedGroups.find(
      (g) =>
        g.is_enabled &&
        g.variants.some((v) => v.package_key === target.package_key),
    ) ??
    persistedGroups.find(
      (g) =>
        g.is_enabled &&
        targetScope !== null &&
        (g.global_scope_key?.toLowerCase() === targetScope ||
          g.action_tag_key?.toLowerCase() === targetScope),
    ) ??
    null

  const groupItemByPkg = new Map(
    (activeGroup?.variants ?? []).map((v) => [v.package_key, v]),
  )

  const sorted = [...matching].sort((a, b) => {
    const aEnabled = a.is_enabled !== false && a.status !== 'yanked' ? 0 : 1
    const bEnabled = b.is_enabled !== false && b.status !== 'yanked' ? 0 : 1
    if (aEnabled !== bEnabled) return aEnabled - bEnabled

    const aPrimary = a.is_primary === true ? 0 : 1
    const bPrimary = b.is_primary === true ? 0 : 1
    if (aPrimary !== bPrimary) return aPrimary - bPrimary

    const aItem = groupItemByPkg.get(a.package_key)
    const bItem = groupItemByPkg.get(b.package_key)
    const aInGroup = aItem ? 0 : 1
    const bInGroup = bItem ? 0 : 1
    if (aInGroup !== bInGroup) return aInGroup - bInGroup

    const aPrio =
      aItem?.priority ?? a.fallback_priority ?? Number.MAX_SAFE_INTEGER
    const bPrio =
      bItem?.priority ?? b.fallback_priority ?? Number.MAX_SAFE_INTEGER
    if (aPrio !== bPrio) return aPrio - bPrio

    return a.name.localeCompare(b.name)
  })

  let fallbackIdx = 1
  return sorted.map((s) => {
    const enabled = s.is_enabled !== false && s.status !== 'yanked'
    const primary = enabled && s.is_primary === true
    const groupItem = groupItemByPkg.get(s.package_key)
    const sharing = resolveEffectiveSharingForScript(s, persistedGroups)

    let role: ScriptExecutionRole = 'enabled_unselected'
    let priority_label = 'Enabled (not selected)'

    if (!enabled) {
      role = 'disabled'
      priority_label = 'Disabled'
    } else if (primary) {
      role = 'primary'
      priority_label = 'Primary'
    } else if (
      (groupItem && groupItem.is_enabled) ||
      s.fallback_priority != null
    ) {
      role = 'fallback'
      priority_label = `Fallback #${fallbackIdx++}`
    }

    return {
      package_key: s.package_key,
      name: s.name,
      language_code: normalizeLanguageCode(s.language_code),
      is_enabled: enabled,
      is_primary: primary,
      role,
      priority_label,
      effective_sharing_mode: sharing.effectiveSharingMode,
      sharing_managed_automatically: sharing.sharingManagedAutomatically,
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
