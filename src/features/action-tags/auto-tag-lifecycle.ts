import type { ScriptListItem } from '../script-registry/types.ts'
import {
  DEFAULT_CMS_PATH_TEMPLATES,
  resolveEffectivePathsForSite,
} from './cms-templates.ts'
import type {
  ActionTagItem,
  CmsPathTemplate,
  CmsType,
  PathItem,
  ScriptRequestItem,
  Site,
} from './types.ts'
import { buildTagKey, findExistingSitePathTag } from './utils.ts'

export function findMatchingActionTag(
  tags: ActionTagItem[],
  site: Site,
  path: PathItem,
): ActionTagItem | null {
  return findExistingSitePathTag(tags, site, path)
}

function nextNumericId(items: { id: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1
}

/**
 * Idempotently ensure an Action Tag exists for every effective Path across all Sites.
 *
 * - Reuses existing matching Tags (by canonical tag_key, site_id+path_id, or site_key+path_key),
 *   preserving legacy 3-part keys (e.g. facebook.group.post) and live 2-part keys
 *   (e.g. mayhopphat.create_post, mayhopphat.login).
 * - Defaults newly generated Tags to `enabled: true`.
 * - Never duplicates Tags or Script Requests when called repeatedly.
 */
export function syncActionTagsForSites(
  sites: Site[],
  paths: PathItem[],
  existingTags: ActionTagItem[],
  existingRequests: ScriptRequestItem[],
  templates: Record<CmsType, CmsPathTemplate[]> = DEFAULT_CMS_PATH_TEMPLATES,
): {
  tags: ActionTagItem[]
  requests: ScriptRequestItem[]
  createdTagKeys: string[]
} {
  const tags = existingTags.map((t) => ({
    ...t,
    enabled: t.enabled ?? true,
  }))
  const requests = existingRequests.map((r) => ({ ...r }))
  const createdTagKeys: string[] = []

  for (const site of sites) {
    const effectivePaths = resolveEffectivePathsForSite(site, paths, templates)

    for (const path of effectivePaths) {
      const existing = findMatchingActionTag(tags, site, path)
      if (existing) {
        continue
      }

      const tagKey = buildTagKey(site.key, path.key)
      if (!tagKey) continue

      const tagId = nextNumericId(tags)
      const requestId = `req_auto_${tagKey.replace(/[^a-z0-9_.-]/g, '_')}`
      const hasRequest = requests.some(
        (r) => r.action_tag_key === tagKey || r.request_id === requestId,
      )

      const newTag: ActionTagItem = {
        id: tagId,
        tag_key: tagKey,
        site_id: site.id,
        site_key: site.key,
        site_name: site.name,
        path_id: path.id > 0 ? path.id : null,
        path_key: path.key,
        path_name: path.name,
        action_id: null,
        action_key: null,
        action_name: null,
        name: tagKey,
        scripts_count: 0,
        ready: false,
        enabled: true,
        published_script_available: false,
        latest_request_status: 'pending',
        latest_request_id: requestId,
        auth_script: null,
      }

      tags.push(newTag)
      createdTagKeys.push(tagKey)

      if (!hasRequest) {
        requests.push({
          id: nextNumericId(requests),
          request_id: requestId,
          action_tag_key: tagKey,
          request_type: 'create',
          status: 'pending',
          created_at: new Date().toISOString(),
        })
      }
    }
  }

  return { tags, requests, createdTagKeys }
}

/**
 * Enable or disable an Action Tag in-place for its Site.
 * Disabling never deletes the Tag, its identity, or its Script/Auth references.
 * Re-enabling reuses the exact same Tag identity.
 */
export function setActionTagEnabled(
  tags: ActionTagItem[],
  tagId: number,
  enabled: boolean,
): ActionTagItem[] {
  return tags.map((t) => (t.id === tagId ? { ...t, enabled } : t))
}

/**
 * Resolve Published Script availability for an Action Tag,
 * strictly separated from the Tag's own enabled/disabled toggle.
 */
export function resolveTagPublishedScriptStatus(
  tag: ActionTagItem,
  scripts?: ScriptListItem[],
): {
  hasPublishedScript: boolean
  matchedScript: ScriptListItem | null
} {
  if (scripts && scripts.length > 0) {
    const keyNorm = tag.tag_key.trim().toLowerCase()
    const matched =
      scripts.find(
        (s) =>
          s.status === 'published' &&
          (s.action_tag_key ?? '').trim().toLowerCase() === keyNorm,
      ) ?? null
    return {
      hasPublishedScript:
        matched !== null ||
        Boolean(tag.published_script_available ?? tag.scripts_count > 0),
      matchedScript: matched,
    }
  }

  return {
    hasPublishedScript: Boolean(
      tag.published_script_available ?? tag.scripts_count > 0,
    ),
    matchedScript: null,
  }
}
