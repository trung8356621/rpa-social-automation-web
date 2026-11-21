import type { CmsPathTemplate, CmsType, PathItem, Site } from './types.ts'
import { normalizeTagSegment, parseInputsFromPattern } from './utils.ts'

export const CMS_TYPE_LABELS: Record<CmsType, string> = {
  wordpress: 'WordPress',
  custom: 'Custom / None',
}

export const DEFAULT_CMS_PATH_TEMPLATES: Record<CmsType, CmsPathTemplate[]> = {
  wordpress: [
    {
      cms_type: 'wordpress',
      key: 'create_post',
      name: 'Create Post',
      url_pattern: '/wp-admin/post-new.php',
      path_inputs: [],
      description: 'WordPress post editor',
      is_authentication: false,
    },
    {
      cms_type: 'wordpress',
      key: 'login',
      name: 'Login',
      url_pattern: '/wp-login.php',
      path_inputs: [],
      description: 'WordPress authentication path',
      is_authentication: true,
    },
  ],
  custom: [],
}

export function asCmsType(value: string | null | undefined): CmsType | null {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'wordpress') return 'wordpress'
  if (normalized === 'custom') return 'custom'
  return null
}

/**
 * Normalize a URL pattern for duplicate detection across a Site's effective Paths.
 */
export function normalizeUrlPattern(pattern: string): string {
  let trimmed = (pattern || '').trim()
  if (!trimmed) return '/'
  if (!trimmed.startsWith('/')) trimmed = `/${trimmed}`
  if (trimmed.length > 1) {
    trimmed = trimmed.replace(/\/+$/, '')
  }
  return trimmed
}

/**
 * Return shared Path Templates for an explicit CMS Type.
 * Never auto-classifies unrelated Dynamic CMS sites as WordPress.
 */
export function getCmsPathTemplates(
  cmsType: CmsType | null | undefined,
  templates: Record<CmsType, CmsPathTemplate[]> = DEFAULT_CMS_PATH_TEMPLATES,
): CmsPathTemplate[] {
  if (!cmsType) return []
  return templates[cmsType] ?? []
}

/**
 * Deterministic virtual ID for inherited template Paths that have not been
 * overridden in site-specific storage yet.
 */
export function virtualTemplatePathId(siteId: number, templateIndex: number): number {
  return -(Math.abs(siteId) * 100 + templateIndex + 1)
}

/**
 * Resolve the effective Paths for a Site by combining shared CMS Path Templates
 * with per-site Paths/overrides.
 *
 * - Existing Site and Path identifiers are preserved.
 * - A site-specific Path matching a template by key, template_key, or normalized
 *   url_pattern overrides the template for that Site without mutating the template.
 * - Duplicate effective Paths are prevented.
 */
export function resolveEffectivePathsForSite(
  site: Site,
  allPaths: PathItem[],
  templates: Record<CmsType, CmsPathTemplate[]> = DEFAULT_CMS_PATH_TEMPLATES,
): PathItem[] {
  const sitePaths = allPaths.filter((p) => p.site_id === site.id)
  const cmsTemplates = getCmsPathTemplates(site.cms_type, templates)

  const usedSitePathIds = new Set<number>()
  const seenKeys = new Set<string>()
  const seenPatterns = new Set<string>()
  const effective: PathItem[] = []

  cmsTemplates.forEach((tpl, index) => {
    const tplKeyNorm = normalizeTagSegment(tpl.key)
    const tplPatternNorm = normalizeUrlPattern(tpl.url_pattern)

    const override = sitePaths.find((p) => {
      if (usedSitePathIds.has(p.id)) return false
      const pKeyNorm = normalizeTagSegment(p.key)
      const pTplNorm = p.template_key ? normalizeTagSegment(p.template_key) : ''
      const pPatternNorm = normalizeUrlPattern(p.url_pattern)
      return (
        pKeyNorm === tplKeyNorm ||
        pTplNorm === tplKeyNorm ||
        pPatternNorm === tplPatternNorm
      )
    })

    if (override) {
      usedSitePathIds.add(override.id)
      const keyNorm = normalizeTagSegment(override.key)
      const patternNorm = normalizeUrlPattern(override.url_pattern)
      if (!seenKeys.has(keyNorm) && !seenPatterns.has(patternNorm)) {
        seenKeys.add(keyNorm)
        seenPatterns.add(patternNorm)
        effective.push({
          ...override,
          source: 'site',
          template_key: override.template_key ?? tpl.key,
          is_override: true,
        })
      }
      return
    }

    if (!seenKeys.has(tplKeyNorm) && !seenPatterns.has(tplPatternNorm)) {
      seenKeys.add(tplKeyNorm)
      seenPatterns.add(tplPatternNorm)
      effective.push({
        id: virtualTemplatePathId(site.id, index),
        site_id: site.id,
        site_key: site.key,
        key: tpl.key,
        name: tpl.name,
        url_pattern: tpl.url_pattern,
        path_inputs:
          tpl.path_inputs.length > 0
            ? tpl.path_inputs
            : parseInputsFromPattern(tpl.url_pattern),
        description: tpl.description ?? null,
        is_authentication: Boolean(tpl.is_authentication),
        source: 'template',
        template_key: tpl.key,
        is_override: false,
      })
    }
  })

  for (const p of sitePaths) {
    if (usedSitePathIds.has(p.id)) continue
    const keyNorm = normalizeTagSegment(p.key)
    const patternNorm = normalizeUrlPattern(p.url_pattern)
    if (seenKeys.has(keyNorm) || seenPatterns.has(patternNorm)) {
      continue
    }
    seenKeys.add(keyNorm)
    seenPatterns.add(patternNorm)
    effective.push({
      ...p,
      source: 'site',
      is_override: Boolean(p.is_override),
    })
  }

  return effective
}

/**
 * Ensure a candidate site Path does not duplicate another effective Path
 * (by normalized key or normalized url_pattern) on the same Site.
 * Overriding an inherited template with the same key/template_key is allowed.
 */
export function validateSitePathUniqueness(
  effectivePaths: PathItem[],
  candidate: {
    id?: number | null
    key: string
    url_pattern: string
    template_key?: string | null
  },
): { ok: true } | { ok: false; error: string } {
  const candKey = normalizeTagSegment(candidate.key)
  const candPattern = normalizeUrlPattern(candidate.url_pattern)
  const candTplKey = candidate.template_key
    ? normalizeTagSegment(candidate.template_key)
    : ''

  if (!candKey) {
    return { ok: false, error: 'Path key không hợp lệ.' }
  }

  for (const existing of effectivePaths) {
    if (candidate.id != null && existing.id === candidate.id) continue

    const isOverriddenTemplate =
      existing.source === 'template' &&
      candTplKey !== '' &&
      existing.template_key != null &&
      normalizeTagSegment(existing.template_key) === candTplKey

    if (isOverriddenTemplate) continue

    if (normalizeTagSegment(existing.key) === candKey) {
      return {
        ok: false,
        error: `Path key [${candKey}] đã tồn tại trên Site này.`,
      }
    }
    if (normalizeUrlPattern(existing.url_pattern) === candPattern) {
      return {
        ok: false,
        error: `URL Pattern [${candPattern}] đã tồn tại trên Site này (${existing.name}).`,
      }
    }
  }

  return { ok: true }
}
