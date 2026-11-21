import { ApiError, toSafeApiMessage } from '../../lib/api/errors.ts'
import type {
  ScriptGlobalConflict,
  ScriptListItem,
  ScriptSharingMode,
  ScriptSharingScope,
} from './types.ts'

export function asSharingMode(raw: unknown): ScriptSharingMode {
  return raw === 'cms_global' ? 'cms_global' : 'site_specific'
}

export function parseSharingScope(
  globalScope: unknown,
  eligibleGlobalScope: unknown,
): ScriptSharingScope | null {
  let scope =
    typeof globalScope === 'string' && globalScope.trim()
      ? globalScope.trim()
      : null
  let cmsType: string | null = null
  let pathTemplate: string | null = null

  if (typeof eligibleGlobalScope === 'string' && eligibleGlobalScope.trim()) {
    if (!scope) scope = eligibleGlobalScope.trim()
  } else if (
    eligibleGlobalScope &&
    typeof eligibleGlobalScope === 'object' &&
    !Array.isArray(eligibleGlobalScope)
  ) {
    const obj = eligibleGlobalScope as Record<string, unknown>
    const objScope =
      typeof obj.global_scope === 'string'
        ? obj.global_scope.trim()
        : typeof obj.scope === 'string'
          ? obj.scope.trim()
          : ''
    if (!scope && objScope) scope = objScope
    if (typeof obj.cms_type === 'string' && obj.cms_type.trim()) {
      cmsType = obj.cms_type.trim()
    }
    const rawPath =
      typeof obj.path_template === 'string'
        ? obj.path_template
        : typeof obj.path_template_key === 'string'
          ? obj.path_template_key
          : typeof obj.path_key === 'string'
            ? obj.path_key
            : ''
    if (rawPath.trim()) pathTemplate = rawPath.trim()
  }

  if (scope && (!cmsType || !pathTemplate) && scope.includes(':')) {
    const [c, p] = scope.split(':', 2)
    if (!cmsType && c?.trim()) cmsType = c.trim()
    if (!pathTemplate && p?.trim()) pathTemplate = p.trim()
  }

  if (!scope && cmsType && pathTemplate) {
    scope = `${cmsType}:${pathTemplate}`
  }

  if (!scope && !cmsType && !pathTemplate) return null

  return {
    scope,
    cms_type: cmsType,
    path_template: pathTemplate,
  }
}

export function mapGlobalConflict(raw: unknown): ScriptGlobalConflict {
  if (!raw) return null
  if (typeof raw === 'string') {
    const msg = raw.trim()
    return msg ? { message: msg } : null
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    const package_key =
      typeof obj.package_key === 'string' ? obj.package_key : null
    const script_id = typeof obj.script_id === 'string' ? obj.script_id : null
    const name = typeof obj.name === 'string' ? obj.name : null
    const global_scope =
      typeof obj.global_scope === 'string' ? obj.global_scope : null
    const message = typeof obj.message === 'string' ? obj.message : null
    if (!package_key && !script_id && !name && !global_scope && !message) {
      return null
    }
    return { package_key, script_id, name, global_scope, message }
  }
  return null
}

export function formatGlobalConflictLabel(
  conflict: ScriptGlobalConflict | undefined,
): string | null {
  if (!conflict) return null
  if (conflict.message) return conflict.message
  const target = conflict.name || conflict.package_key || conflict.script_id
  if (target && conflict.global_scope) {
    return `${target} (${conflict.global_scope})`
  }
  return target || conflict.global_scope || 'Existing CMS Global Script conflict'
}

export function formatSharingErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409 || err.code === 'global_scope_conflict') {
      return 'Xung đột CMS Global (409): Đã có Script khác đang chia sẻ Global cho cùng CMS Type + Path Template này.'
    }
    if (err.status === 422) {
      if (err.code === 'ineligible') {
        return 'Script không đủ điều kiện chia sẻ CMS Global (422 ineligible).'
      }
      if (err.code === 'invalid_sharing_mode') {
        return 'Chế độ chia sẻ không hợp lệ (422 invalid_sharing_mode).'
      }
      return err.message || 'Không thể cập nhật chế độ chia sẻ (422).'
    }
    if (err.status === 401 || err.status === 403 || err.isAuthRequired) {
      return err.message
    }
  }
  return toSafeApiMessage(err)
}

/**
 * Check if a target Action Tag resolves via a CMS Global Script
 * using existing Script Registry + Site CMS Type data (read-only, no extra API).
 */
export function findCmsGlobalScriptForActionTag(
  tag: {
    tag_key: string
    path_key: string
  },
  siteCmsType: string | null | undefined,
  scripts: ScriptListItem[] | undefined,
): ScriptListItem | null {
  if (!scripts || scripts.length === 0) return null
  const cms = (siteCmsType ?? '').trim().toLowerCase()
  const pathKey = (tag.path_key ?? '').trim().toLowerCase()
  if (!cms || !pathKey) return null
  const expectedScope = `${cms}:${pathKey}`

  return (
    scripts.find(
      (s) =>
        s.status === 'published' &&
        s.sharing_mode === 'cms_global' &&
        ((s.global_scope ?? '').trim().toLowerCase() === expectedScope ||
          (s.eligible_global_scope?.scope ?? '').trim().toLowerCase() ===
            expectedScope),
    ) ?? null
  )
}
