import type { ActionTagItem, Site } from './types.ts'

export type ActionTagSiteGroup = {
  groupKey: string
  siteKey: string
  siteName: string
  tags: ActionTagItem[]
  enabledCount: number
}

/**
 * Group Action Tags by their Site and sort Site groups alphabetically.
 * Pure presentation helper — does not mutate Tag identities or backend data.
 */
export function groupActionTagsBySite(
  tags: ActionTagItem[],
  sites?: Site[],
): ActionTagSiteGroup[] {
  const siteById = new Map<number, Site>()
  const siteByKey = new Map<string, Site>()
  for (const s of sites ?? []) {
    siteById.set(s.id, s)
    if (s.key) siteByKey.set(s.key.trim().toLowerCase(), s)
  }

  const groupsMap = new Map<string, ActionTagSiteGroup>()

  for (const tag of tags) {
    const normSiteKey = (tag.site_key ?? '').trim().toLowerCase()
    const matchedSite =
      (tag.site_id != null ? siteById.get(tag.site_id) : undefined) ??
      (normSiteKey ? siteByKey.get(normSiteKey) : undefined)

    const groupKey =
      normSiteKey ||
      (tag.site_id != null ? `site_${tag.site_id}` : '') ||
      (tag.site_name ?? '').trim().toLowerCase() ||
      'unknown'

    const siteName =
      matchedSite?.name?.trim() ||
      tag.site_name?.trim() ||
      tag.site_key?.trim() ||
      'Unknown Site'

    let group = groupsMap.get(groupKey)
    if (!group) {
      group = {
        groupKey,
        siteKey: matchedSite?.key || tag.site_key || groupKey,
        siteName,
        tags: [],
        enabledCount: 0,
      }
      groupsMap.set(groupKey, group)
    }

    group.tags.push(tag)
    if (tag.enabled ?? true) {
      group.enabledCount += 1
    }
  }

  const groups = Array.from(groupsMap.values())
  groups.sort((a, b) => {
    const cmp = a.siteName.localeCompare(b.siteName, undefined, {
      sensitivity: 'base',
    })
    if (cmp !== 0) return cmp
    return a.siteKey.localeCompare(b.siteKey, undefined, {
      sensitivity: 'base',
    })
  })

  for (const g of groups) {
    g.tags.sort((a, b) =>
      a.tag_key.localeCompare(b.tag_key, undefined, { sensitivity: 'base' }),
    )
  }

  return groups
}

/**
 * Determine whether a Site group should be expanded.
 * Matching groups are automatically expanded when search/filters are active.
 */
export function isSiteGroupExpanded(
  groupKey: string,
  collapsedGroups: Record<string, boolean>,
  hasActiveSearchOrFilter: boolean,
): boolean {
  if (hasActiveSearchOrFilter) return true
  return !collapsedGroups[groupKey]
}
