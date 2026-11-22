import type {
  ScriptGlobalConflict,
  ScriptListItem,
  ScriptSharingMode,
} from './types.ts'

export type ScriptVariantItem = {
  package_key: string
  script_id: string
  name: string
  version: string
  release_id: number | null
  language_label: string
  fallback_priority: number
  sharing_mode: ScriptSharingMode
  global_conflict: ScriptGlobalConflict
  status: ScriptListItem['status']
}

export type ScriptVariantGroup = {
  group_key: string
  logical_action_label: string
  cms_type: string | null
  path_template: string | null
  scope: string | null
  sharing_mode: ScriptSharingMode
  variants: ScriptVariantItem[]
  has_duplicate_languages: boolean
  has_sharing_conflict: boolean
  /** True only when backend explicitly supports variant group persistence. */
  backend_supported: boolean
}

export type ScriptRegistryViewPartition = {
  groups: ScriptVariantGroup[]
  ungrouped: ScriptListItem[]
}

export function inferLanguageLabelFromScript(script: {
  name?: string
  package_key?: string
  script_id?: string
  language_label?: string | null
}): string {
  if (script.language_label && script.language_label.trim()) {
    return script.language_label.trim().toUpperCase()
  }
  const hay = [script.name ?? '', script.package_key ?? '', script.script_id ?? '']
    .join(' ')
    .toUpperCase()
  const match = /\b(VI|EN|JA|KO|ZH|TH|ID|FR|DE|ES)\b/.exec(hay)
  return match?.[1] ?? 'DEFAULT'
}

export function validateVariantLanguageLabels(
  variants: Pick<ScriptVariantItem, 'package_key' | 'language_label'>[],
): { ok: true } | { ok: false; duplicates: string[]; message: string } {
  const seen = new Map<string, string>()
  const duplicates = new Set<string>()

  for (const v of variants) {
    const norm = v.language_label.trim().toUpperCase()
    if (!norm) {
      return {
        ok: false,
        duplicates: [],
        message: 'Each variant must have a non-empty language label.',
      }
    }
    if (seen.has(norm)) {
      duplicates.add(norm)
    } else {
      seen.set(norm, v.package_key)
    }
  }

  if (duplicates.size > 0) {
    const list = Array.from(duplicates)
    return {
      ok: false,
      duplicates: list,
      message: `Duplicate language label(s) in group: ${list.join(', ')}. Each variant in an Action group must have a unique language label.`,
    }
  }

  return { ok: true }
}

export function renumberVariantPriorities(
  variants: ScriptVariantItem[],
): ScriptVariantItem[] {
  return variants.map((v, idx) => ({
    ...v,
    fallback_priority: idx + 1,
  }))
}

export function reorderVariantPriority(
  variants: ScriptVariantItem[],
  packageKey: string,
  direction: 'up' | 'down',
): ScriptVariantItem[] {
  const idx = variants.findIndex((v) => v.package_key === packageKey)
  if (idx === -1) return variants
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= variants.length) return variants

  const copy = [...variants]
  const current = copy[idx]!
  copy[idx] = copy[targetIdx]!
  copy[targetIdx] = current
  return renumberVariantPriorities(copy)
}

export function setVariantLanguageLabel(
  variants: ScriptVariantItem[],
  packageKey: string,
  label: string,
): {
  variants: ScriptVariantItem[]
  validation: ReturnType<typeof validateVariantLanguageLabels>
} {
  const next = variants.map((v) =>
    v.package_key === packageKey
      ? { ...v, language_label: label.trim().toUpperCase() }
      : v,
  )
  return {
    variants: next,
    validation: validateVariantLanguageLabels(next),
  }
}

export function removeVariantFromGroup(
  variants: ScriptVariantItem[],
  packageKey: string,
): ScriptVariantItem[] {
  return renumberVariantPriorities(
    variants.filter((v) => v.package_key !== packageKey),
  )
}

function resolveScopeForGrouping(script: ScriptListItem): {
  scope: string | null
  cms_type: string | null
  path_template: string | null
} {
  const scope =
    script.global_scope?.trim() ||
    script.eligible_global_scope?.scope?.trim() ||
    null
  const cms_type = script.eligible_global_scope?.cms_type ?? null
  const path_template = script.eligible_global_scope?.path_template ?? null
  return { scope, cms_type, path_template }
}

/**
 * Group published/active Scripts sharing a logical CMS Action scope (e.g. `wordpress:create_post`)
 * into logical Action Variant Groups. Single-language legacy scripts remain ungrouped cards.
 * Preserves individual Script identities, immutable releases, and real `global_conflict` flags.
 */
export function partitionScriptsIntoVariantGroups(
  scripts: ScriptListItem[],
  options?: { backendSupported?: boolean },
): ScriptRegistryViewPartition {
  const backendSupported = options?.backendSupported ?? false
  const byScope = new Map<string, ScriptListItem[]>()
  const noScope: ScriptListItem[] = []

  for (const script of scripts) {
    const { scope } = resolveScopeForGrouping(script)
    if (!scope || script.is_authentication) {
      noScope.push(script)
      continue
    }
    const bucket = byScope.get(scope) ?? []
    bucket.push(script)
    byScope.set(scope, bucket)
  }

  const groups: ScriptVariantGroup[] = []
  const ungrouped: ScriptListItem[] = [...noScope]

  for (const [scope, bucket] of byScope.entries()) {
    if (bucket.length < 2) {
      ungrouped.push(...bucket)
      continue
    }

    const firstScope = resolveScopeForGrouping(bucket[0]!)
    const variants: ScriptVariantItem[] = bucket.map((s, idx) => ({
      package_key: s.package_key,
      script_id: s.script_id,
      name: s.name,
      version: s.version,
      release_id: s.release_id,
      language_label: inferLanguageLabelFromScript(s),
      fallback_priority: idx + 1,
      sharing_mode: s.sharing_mode ?? 'site_specific',
      global_conflict: s.global_conflict ?? null,
      status: s.status,
    }))

    const langValidation = validateVariantLanguageLabels(variants)
    const hasGlobal = variants.some((v) => v.sharing_mode === 'cms_global')
    const hasConflict = variants.some((v) => Boolean(v.global_conflict))

    const actionLabel =
      firstScope.cms_type && firstScope.path_template
        ? `${firstScope.cms_type} · ${firstScope.path_template}`
        : scope

    groups.push({
      group_key: scope,
      logical_action_label: actionLabel,
      cms_type: firstScope.cms_type,
      path_template: firstScope.path_template,
      scope,
      sharing_mode: hasGlobal ? 'cms_global' : 'site_specific',
      variants,
      has_duplicate_languages: !langValidation.ok,
      has_sharing_conflict: hasConflict,
      backend_supported: backendSupported,
    })
  }

  return { groups, ungrouped }
}
