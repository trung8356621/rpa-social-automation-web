import { resolveTagPublishedScriptStatus } from '../action-tags/auto-tag-lifecycle.ts'
import type { ActionTagItem, Site } from '../action-tags/types.ts'
import { findCmsGlobalScriptForActionTag } from '../script-registry/sharing.ts'
import type { ScriptListItem } from '../script-registry/types.ts'
import {
  allScriptVariables,
  validateShortcodeMappingForm,
  type ShortcodeMappingFormEntry,
} from './shortcode-mapping.ts'
import { assertPlainShortcodeSource } from './shortcode-source.ts'
import type {
  CampaignRunMode,
  CampaignShortcodeMapping,
  ScriptInputSchema,
} from './types.ts'

export type TagScriptResolutionSource =
  | 'site_specific'
  | 'cms_global'
  | 'missing'

export type ResolvedScriptRef = {
  package_key: string
  script_id: string
  name: string
  version: string
  release_id: number
}

export type ResolvedActionTagPlan = {
  tag_key: string
  tag_name: string
  tag_enabled: boolean
  site_key: string
  site_name: string
  cms_type: string | null
  path_key: string
  path_name: string
  effective_script: ResolvedScriptRef | null
  resolution_source: TagScriptResolutionSource
  is_runnable: boolean
  status_reason: string | null
}

/**
 * Resolve effective published Script for an Action Tag using existing
 * precedence: site_specific > cms_global > missing.
 * Never fabricates resolved Script data for missing or disabled Tags.
 */
export function resolveActionTagScript(
  tag: ActionTagItem,
  site: Site | undefined,
  scripts: ScriptListItem[],
): ResolvedActionTagPlan {
  const cmsType = site?.cms_type?.trim() || null
  const { matchedScript } = resolveTagPublishedScriptStatus(tag, scripts)

  let effective_script: ResolvedScriptRef | null = null
  let resolution_source: TagScriptResolutionSource = 'missing'

  if (matchedScript) {
    effective_script = {
      package_key: matchedScript.package_key,
      script_id: matchedScript.script_id,
      name: matchedScript.name,
      version: matchedScript.version,
      release_id: matchedScript.release_id,
    }
    resolution_source = 'site_specific'
  } else {
    const globalScript = findCmsGlobalScriptForActionTag(
      tag,
      cmsType,
      scripts,
    )
    if (globalScript) {
      effective_script = {
        package_key: globalScript.package_key,
        script_id: globalScript.script_id,
        name: globalScript.name,
        version: globalScript.version,
        release_id: globalScript.release_id,
      }
      resolution_source = 'cms_global'
    }
  }

  let status_reason: string | null = null
  if (!tag.enabled) {
    status_reason = 'Action Tag is disabled.'
  } else if (resolution_source === 'missing' || !effective_script) {
    status_reason = 'No published Script found (site-specific or CMS global).'
  }

  return {
    tag_key: tag.tag_key,
    tag_name: tag.name,
    tag_enabled: tag.enabled,
    site_key: tag.site_key,
    site_name: tag.site_name,
    cms_type: cmsType,
    path_key: tag.path_key,
    path_name: tag.path_name,
    effective_script,
    resolution_source,
    is_runnable: Boolean(
      tag.enabled && resolution_source !== 'missing' && effective_script,
    ),
    status_reason,
  }
}

export function scriptTargetKey(packageKey: string, version: string): string {
  return `${packageKey.trim()}@${version.trim()}`
}

/**
 * Deterministic signature for a published ScriptInputSchema so compatible
 * Scripts/Releases can share one Shortcode Mapping UI without assuming all
 * Tags share the same schema.
 */
export function schemaCompatibilityKey(
  packageKey: string,
  version: string,
  schema: ScriptInputSchema | undefined,
): string {
  if (!schema || !schema.schema_available) {
    return `script:${scriptTargetKey(packageKey, version)}`
  }
  const vars = allScriptVariables(schema)
    .map((v) => `${v.key}:${v.type}:${v.required ? '1' : '0'}`)
    .sort()
    .join('|')
  return `schema:${vars || 'empty'}`
}

export type SchemaMappingGroup = {
  group_key: string
  script_package_key: string
  script_version: string
  script_name: string
  tag_keys: string[]
  schema: ScriptInputSchema
  loading: boolean
  error: string | null
}

export type ScriptSchemaLookup = Record<
  string,
  {
    schema: ScriptInputSchema
    loading: boolean
    error: string | null
  }
>

/**
 * Group runnable resolved Tags by compatible Script schema.
 * Tags with missing Scripts or disabled state are excluded from mapping groups.
 */
export function groupTagsByCompatibleSchema(
  resolvedTags: ResolvedActionTagPlan[],
  schemaByTargetKey: ScriptSchemaLookup,
  unavailableFactory: (reason: string | null) => ScriptInputSchema,
): SchemaMappingGroup[] {
  const groups = new Map<string, SchemaMappingGroup>()

  for (const tag of resolvedTags) {
    if (!tag.is_runnable || !tag.effective_script) continue
    const tKey = scriptTargetKey(
      tag.effective_script.package_key,
      tag.effective_script.version,
    )
    const entry = schemaByTargetKey[tKey]
    const schema = entry?.schema ?? unavailableFactory(null)
    const groupKey = schemaCompatibilityKey(
      tag.effective_script.package_key,
      tag.effective_script.version,
      schema,
    )

    const existing = groups.get(groupKey)
    if (existing) {
      if (!existing.tag_keys.includes(tag.tag_key)) {
        existing.tag_keys.push(tag.tag_key)
      }
    } else {
      groups.set(groupKey, {
        group_key: groupKey,
        script_package_key: tag.effective_script.package_key,
        script_version: tag.effective_script.version,
        script_name: tag.effective_script.name,
        tag_keys: [tag.tag_key],
        schema,
        loading: entry?.loading ?? false,
        error: entry?.error ?? null,
      })
    }
  }

  return Array.from(groups.values())
}

export type PlannedContentItem = {
  id: string
  external_ref: string
  target_tag_keys: string[]
  raw_source: string
}

export function createPlannedContentItem(
  overrides?: Partial<PlannedContentItem>,
): PlannedContentItem {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `cnt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    external_ref: '',
    target_tag_keys: [],
    raw_source: '',
    ...overrides,
  }
}

export type Step1ValidationResult =
  | { ok: true }
  | { ok: false; message: string }

export function validateStep1Plan(params: {
  name: string
  resolvedTags: ResolvedActionTagPlan[]
}): Step1ValidationResult {
  if (!params.name.trim()) {
    return { ok: false, message: 'Campaign Name is required.' }
  }
  if (params.resolvedTags.length === 0) {
    return {
      ok: false,
      message: 'Select at least one Action Tag for the Campaign plan.',
    }
  }
  const blocked = params.resolvedTags.filter((t) => !t.is_runnable)
  if (blocked.length > 0) {
    const names = blocked.map((t) => `${t.tag_key} (${t.status_reason})`).join('; ')
    return {
      ok: false,
      message: `Remove or fix unavailable Action Tags before continuing: ${names}`,
    }
  }
  return { ok: true }
}

export type ValidatedContentAssociation = {
  external_ref: string
  raw_source: string
  targets: Array<{
    action_tag_key: string
    script_package_key: string
    script_version: string
    release_id: number
    resolution_source: TagScriptResolutionSource
    shortcode_mapping: CampaignShortcodeMapping
  }>
}

export type Step2ValidationResult =
  | {
      ok: true
      groupMappings: Record<string, CampaignShortcodeMapping>
      validatedContents: ValidatedContentAssociation[]
    }
  | { ok: false; message: string }

export function validateStep2Plan(params: {
  groups: SchemaMappingGroup[]
  mappingsByGroupKey: Record<string, ShortcodeMappingFormEntry[]>
  contents: PlannedContentItem[]
  resolvedTags: ResolvedActionTagPlan[]
}): Step2ValidationResult {
  if (params.groups.length === 0) {
    return {
      ok: false,
      message: 'No runnable Action Tag / Script group available.',
    }
  }

  const groupMappings: Record<string, CampaignShortcodeMapping> = {}
  const tagToGroup = new Map<string, SchemaMappingGroup>()

  for (const group of params.groups) {
    if (group.loading) {
      return {
        ok: false,
        message: `Loading published Script schema for ${group.script_package_key}…`,
      }
    }
    if (!group.schema.schema_available) {
      return {
        ok: false,
        message:
          group.error ||
          group.schema.unavailable_reason ||
          `Script schema unavailable for ${group.script_package_key} v${group.script_version}.`,
      }
    }
    const entries = params.mappingsByGroupKey[group.group_key] ?? []
    const mapped = validateShortcodeMappingForm(entries, group.schema)
    if (!mapped.ok) {
      return {
        ok: false,
        message: `${group.script_package_key}: ${mapped.message}`,
      }
    }
    groupMappings[group.group_key] = mapped.mapping
    for (const tk of group.tag_keys) {
      tagToGroup.set(tk, group)
    }
  }

  const tagByKey = new Map(params.resolvedTags.map((t) => [t.tag_key, t]))
  const validatedContents: ValidatedContentAssociation[] = []

  for (let i = 0; i < params.contents.length; i++) {
    const item = params.contents[i]!
    const label = item.external_ref.trim() || `Content #${i + 1}`

    if (item.target_tag_keys.length === 0) {
      return {
        ok: false,
        message: `${label}: Assign at least one target Action Tag.`,
      }
    }

    try {
      assertPlainShortcodeSource(item.raw_source)
    } catch (err) {
      return {
        ok: false,
        message: `${label}: ${err instanceof Error ? err.message : 'Invalid shortcode source.'}`,
      }
    }
    if (!item.raw_source.trim()) {
      return {
        ok: false,
        message: `${label}: Shortcode source cannot be empty.`,
      }
    }

    const groupKeysUsed = new Set<string>()
    const targets: ValidatedContentAssociation['targets'] = []

    for (const tk of item.target_tag_keys) {
      const tag = tagByKey.get(tk)
      const group = tagToGroup.get(tk)
      if (!tag || !tag.is_runnable || !tag.effective_script || !group) {
        return {
          ok: false,
          message: `${label}: Target Action Tag "${tk}" is not runnable.`,
        }
      }
      groupKeysUsed.add(group.group_key)
      targets.push({
        action_tag_key: tag.tag_key,
        script_package_key: tag.effective_script.package_key,
        script_version: tag.effective_script.version,
        release_id: tag.effective_script.release_id,
        resolution_source: tag.resolution_source,
        shortcode_mapping: groupMappings[group.group_key]!,
      })
    }

    if (groupKeysUsed.size > 1) {
      return {
        ok: false,
        message: `${label}: Selected Action Tags use incompatible Script schemas. Split into separate Content items per schema group.`,
      }
    }

    // Validate required shortcodes are present in raw_source for the group's schema
    const firstGroup = tagToGroup.get(item.target_tag_keys[0]!)!
    const mapping = groupMappings[firstGroup.group_key]!
    const requiredVars = allScriptVariables(firstGroup.schema)
      .filter((v) => v.required)
      .map((v) => v.key)

    for (const reqVar of requiredVars) {
      const mappedEntry = mapping.entries.find((e) => e.variable === reqVar)
      if (!mappedEntry) {
        return {
          ok: false,
          message: `${label}: Required Script variable "${reqVar}" is not mapped to any shortcode.`,
        }
      }
      const openTag = `[${mappedEntry.shortcode}]`
      const closeTag = `[/${mappedEntry.shortcode}]`
      if (
        !item.raw_source.includes(openTag) ||
        !item.raw_source.includes(closeTag)
      ) {
        return {
          ok: false,
          message: `${label}: Required shortcode ${openTag}...${closeTag} (for "${reqVar}") is missing from Content source.`,
        }
      }
    }

    validatedContents.push({
      external_ref: item.external_ref.trim() || `content-${i + 1}`,
      raw_source: item.raw_source.trim(),
      targets,
    })
  }

  return { ok: true, groupMappings, validatedContents }
}

export type BackendPersistenceSupport = {
  supported: boolean
  blockers: string[]
}

/**
 * Honest compatibility gate against the current backend contract
 * (`POST /social-automation/api/campaigns`).
 */
export function inspectBackendPersistenceSupport(params: {
  mode: 'mock' | 'live'
  resolvedTags: ResolvedActionTagPlan[]
  contents: PlannedContentItem[]
}): BackendPersistenceSupport {
  const blockers: string[] = []

  if (params.mode === 'live') {
    blockers.push(
      'LIVE POST /social-automation/api/campaigns currently requires account_id (hard Account UUID pin); V2 Draft creation must not require Client/Account selection.',
    )
    if (params.resolvedTags.length > 1) {
      blockers.push(
        'LIVE CampaignCreateRequest only accepts a single platform + script_id + script_version (no multi-tag action_tags[] array or per-tag release pinning).',
      )
    }
    if (params.contents.length > 0) {
      blockers.push(
        'LIVE CampaignCreateRequest.contents[] has no action_tag_key / target association or per-tag shortcode_mapping.',
      )
    }
  } else if (params.resolvedTags.length > 1) {
    blockers.push(
      'Multi-Tag Campaign persistence requires Backend V2 schema (action_tags[], per-tag script_version/release_id pin, and content -> action_tag_key). Mock single-tag Drafts can be saved locally.',
    )
  }

  return {
    supported: blockers.length === 0,
    blockers,
  }
}

export type V2CampaignDraftPlanPayload = {
  name: string
  status: 'draft'
  run_mode: CampaignRunMode
  action_tags: Array<{
    action_tag_key: string
    site_key: string
    cms_type: string | null
    script_package_key: string
    script_version: string
    release_id: number
    resolution_source: TagScriptResolutionSource
    shortcode_mapping: CampaignShortcodeMapping
  }>
  contents: Array<{
    external_ref: string
    raw_source: string
    action_tag_keys: string[]
  }>
}

export function buildV2DraftPlanPayload(params: {
  name: string
  run_mode: CampaignRunMode
  resolvedTags: ResolvedActionTagPlan[]
  groups: SchemaMappingGroup[]
  groupMappings: Record<string, CampaignShortcodeMapping>
  validatedContents: ValidatedContentAssociation[]
}): V2CampaignDraftPlanPayload {
  const mappingByTag = new Map<string, CampaignShortcodeMapping>()
  for (const g of params.groups) {
    const m = params.groupMappings[g.group_key]
    if (!m) continue
    for (const tk of g.tag_keys) mappingByTag.set(tk, m)
  }

  return {
    name: params.name.trim(),
    status: 'draft',
    run_mode: params.run_mode,
    action_tags: params.resolvedTags
      .filter((t) => t.is_runnable && t.effective_script)
      .map((t) => ({
        action_tag_key: t.tag_key,
        site_key: t.site_key,
        cms_type: t.cms_type,
        script_package_key: t.effective_script!.package_key,
        script_version: t.effective_script!.version,
        release_id: t.effective_script!.release_id,
        resolution_source: t.resolution_source,
        shortcode_mapping: mappingByTag.get(t.tag_key) ?? { entries: [] },
      })),
    contents: params.validatedContents.map((c) => ({
      external_ref: c.external_ref,
      raw_source: c.raw_source,
      action_tag_keys: c.targets.map((t) => t.action_tag_key),
    })),
  }
}
