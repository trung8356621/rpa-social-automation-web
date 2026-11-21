import type {
  ActionTagAuthScript,
  ActionTagItem,
  AuthResolutionSource,
  Site,
} from './types.ts'

export type ActionTagAuthDisplay = {
  script: ActionTagAuthScript
  source: AuthResolutionSource | null
  sourceLabel: string | null
  isMissing: boolean
  allowManualEdit: boolean
}

export function isCmsManagedSite(
  site: { cms_type?: string | null } | null | undefined,
): boolean {
  const cms = (site?.cms_type ?? '').trim().toLowerCase()
  return cms !== '' && cms !== 'custom'
}

function labelForSource(
  source: AuthResolutionSource | null,
): string | null {
  switch (source) {
    case 'cms_global':
      return 'CMS Global'
    case 'site_specific':
      return 'Site-specific'
    case 'legacy_pin':
      return 'Legacy Pin'
    case 'missing':
      return 'Missing Auth Script'
    default:
      return null
  }
}

/**
 * Resolve read-only Auth Script display for an Action Tag.
 *
 * - For CMS-managed Sites: manual Auth Script editing is disabled/hidden;
 *   displays backend-confirmed effective_auth_script or preserved legacy pin,
 *   never inferring successful Auth resolution from frontend data alone.
 * - For non-CMS Sites: preserves manual Auth Script management.
 */
export function resolveActionTagAuthDisplay(
  tag: ActionTagItem,
  site: Site | null | undefined,
): ActionTagAuthDisplay {
  const cmsManaged = isCmsManagedSite(site)
  const allowManualEdit = !cmsManaged

  if (tag.effective_auth_script) {
    const source: AuthResolutionSource =
      tag.auth_resolution_source ??
      (cmsManaged ? 'cms_global' : 'site_specific')
    const isMissing = tag.effective_auth_script.status === 'unavailable'
    return {
      script: tag.effective_auth_script,
      source,
      sourceLabel: labelForSource(source),
      isMissing,
      allowManualEdit,
    }
  }

  if (tag.auth_script) {
    const source: AuthResolutionSource =
      tag.auth_resolution_source ?? (cmsManaged ? 'legacy_pin' : 'site_specific')
    const isMissing = tag.auth_script.status === 'unavailable'
    return {
      script: tag.auth_script,
      source,
      sourceLabel: labelForSource(source),
      isMissing,
      allowManualEdit,
    }
  }

  const source: AuthResolutionSource | null =
    tag.auth_resolution_source ?? (cmsManaged ? 'missing' : null)

  return {
    script: null,
    source,
    sourceLabel: labelForSource(source),
    isMissing: source === 'missing',
    allowManualEdit,
  }
}
