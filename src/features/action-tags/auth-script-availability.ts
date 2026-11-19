import type { AuthScriptOption } from './types'

/**
 * Auth Script availability for Action Tag pin select.
 * Never infers Authentication from package_key / tag_key names.
 */
export type AuthScriptAvailability =
  | 'available'
  | 'not_authentication'
  | 'not_published'
  | 'missing_release'

export function getAuthScriptAvailability(
  script: AuthScriptOption,
): AuthScriptAvailability {
  if (!script.is_authentication) return 'not_authentication'
  if (script.status !== 'published') return 'not_published'
  const publishedRelease = script.releases?.find((r) => r.status === 'published')
  if (script.releases && script.releases.length > 0 && !publishedRelease) {
    return 'not_published'
  }
  if (script.package_id != null && (!script.releases || script.releases.length === 0)) {
    return 'missing_release'
  }
  return 'available'
}

export function authAvailabilityLabel(
  state: AuthScriptAvailability,
): string | null {
  switch (state) {
    case 'available':
      return null
    case 'not_authentication':
      return 'chưa đánh dấu Authentication'
    case 'not_published':
      return 'Authentication chưa Published'
    case 'missing_release':
      return 'thiếu published release'
    default:
      return null
  }
}

/**
 * Candidates for the Auth Script select.
 * - Requires explicit `is_authentication` (no name-based inference).
 * - MOCK-only: optional `compatible_site_keys` filter when seeded.
 * - Live catalog already returns auth packages only; keep same rules for honesty.
 */
export function filterSelectableAuthScripts(
  authScripts: AuthScriptOption[],
  siteKey?: string | null,
): AuthScriptOption[] {
  return authScripts.filter((s) => {
    if (!s.is_authentication) return false
    if (!s.compatible_site_keys || s.compatible_site_keys.length === 0) {
      return true
    }
    if (!siteKey) return true
    return s.compatible_site_keys.includes(siteKey)
  })
}

export type AuthCatalogEmptyReason =
  | 'none_in_catalog'
  | 'none_marked_authentication'
  | 'none_compatible_for_site'
  | 'none_published'

/**
 * Explain why the select has no usable Authentication Script.
 * Distinguishes catalog empty vs marked-but-unpublished vs site filter.
 */
export function describeAuthCatalogEmpty(
  authScripts: AuthScriptOption[],
  selectable: AuthScriptOption[],
  siteKey?: string | null,
): { reason: AuthCatalogEmptyReason; message: string } | null {
  const available = selectable.filter(
    (s) => getAuthScriptAvailability(s) === 'available',
  )
  if (available.length > 0) return null

  if (authScripts.length === 0) {
    return {
      reason: 'none_in_catalog',
      message:
        'Catalog Authentication trống. Script chỉ Published trong Script Registry chưa đủ — cần publish với is_authentication=true (RPA Admin / SEO-OPS addon).',
    }
  }

  const marked = authScripts.filter((s) => s.is_authentication)
  if (marked.length === 0) {
    return {
      reason: 'none_marked_authentication',
      message:
        'Có Script trong payload nhưng chưa script nào được đánh dấu Authentication (is_authentication).',
    }
  }

  const publishedMarked = marked.filter(
    (s) => getAuthScriptAvailability(s) === 'available',
  )
  if (publishedMarked.length === 0) {
    return {
      reason: 'none_published',
      message:
        'Có Authentication Script nhưng chưa có bản Published khả dụng để pin.',
    }
  }

  if (siteKey && selectable.length === 0) {
    return {
      reason: 'none_compatible_for_site',
      message: `Không có Authentication Script tương thích Site [${siteKey}] (lọc compatible_site_keys — MOCK seed).`,
    }
  }

  return {
    reason: 'none_published',
    message:
      'Không có Authentication Script khả dụng để chọn.',
  }
}
