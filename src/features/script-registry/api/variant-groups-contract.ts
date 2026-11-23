import { ApiError, toSafeApiMessage } from '../../../lib/api/errors.ts'

export const VARIANT_GROUP_PATHS = {
  list: '/social-automation/api/script-registry/variant-groups',
  detail: (id: string) =>
    `/social-automation/api/script-registry/variant-groups/${encodeURIComponent(id)}`,
  addVariant: (id: string) =>
    `/social-automation/api/script-registry/variant-groups/${encodeURIComponent(id)}/variants`,
  updateVariant: (id: string, variantId: string) =>
    `/social-automation/api/script-registry/variant-groups/${encodeURIComponent(id)}/variants/${encodeURIComponent(variantId)}`,
  removeVariant: (id: string, variantId: string) =>
    `/social-automation/api/script-registry/variant-groups/${encodeURIComponent(id)}/variants/${encodeURIComponent(variantId)}`,
  reorder: (id: string) =>
    `/social-automation/api/script-registry/variant-groups/${encodeURIComponent(id)}/reorder`,
} as const

export type VariantGroupScopeType = 'cms_global' | 'site_action'

export type PersistedVariantItem = {
  id: string
  priority: number
  language_label: string
  package_id: number
  package_key: string
  script_id: string
  script_name: string | null
  release_id: number
  script_version: string
  release_status: string | null
  content_digest: string | null
  execution_digest: string | null
  published_at: string | null
  is_enabled: boolean
}

export type PersistedVariantGroup = {
  id: string
  name: string
  scope_type: VariantGroupScopeType
  cms_type: string | null
  cms_template_id: number | null
  cms_path_key: string | null
  global_scope_key: string | null
  action_tag_key: string | null
  is_enabled: boolean
  variants: PersistedVariantItem[]
  created_at: string | null
  updated_at: string | null
}

export type CreateVariantGroupInput = {
  name: string
  scope_type: VariantGroupScopeType
  global_scope_key?: string
  cms_type?: string
  cms_path_key?: string
  action_tag_key?: string
  is_enabled?: boolean
  variants: Array<{
    package_key: string
    release_id?: number
    script_version?: string
    language_label: string
    priority?: number
  }>
}

export type AddVariantInput = {
  package_key: string
  release_id?: number
  script_version?: string
  language_label: string
  priority?: number
}

export type UpdateVariantInput = {
  language_label?: string
  is_enabled?: boolean
}

export type VariantGroupListResult = {
  groups: PersistedVariantGroup[]
  unavailable: boolean
  unavailableReason: string | null
}

function asScopeType(raw: unknown): VariantGroupScopeType {
  return raw === 'site_action' ? 'site_action' : 'cms_global'
}

export function mapVariantItemDto(raw: unknown): PersistedVariantItem {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id: String(r.id ?? ''),
    priority: Number(r.priority ?? 1),
    language_label: String(r.language_label ?? ''),
    package_id: Number(r.package_id ?? 0),
    package_key: String(r.package_key ?? ''),
    script_id: String(r.script_id ?? r.package_key ?? ''),
    script_name:
      typeof r.script_name === 'string' && r.script_name.trim()
        ? r.script_name.trim()
        : null,
    release_id: Number(r.release_id ?? 0),
    script_version: String(r.script_version ?? ''),
    release_status:
      typeof r.release_status === 'string' ? r.release_status : null,
    content_digest:
      typeof r.content_digest === 'string' ? r.content_digest : null,
    execution_digest:
      typeof r.execution_digest === 'string' ? r.execution_digest : null,
    published_at: typeof r.published_at === 'string' ? r.published_at : null,
    is_enabled: r.is_enabled !== false,
  }
}

export function mapVariantGroupDto(raw: unknown): PersistedVariantGroup {
  const r = (raw ?? {}) as Record<string, unknown>
  const variants = Array.isArray(r.variants)
    ? r.variants.map(mapVariantItemDto).sort((a, b) => a.priority - b.priority)
    : []

  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    scope_type: asScopeType(r.scope_type),
    cms_type: typeof r.cms_type === 'string' ? r.cms_type : null,
    cms_template_id:
      r.cms_template_id != null && Number.isFinite(Number(r.cms_template_id))
        ? Number(r.cms_template_id)
        : null,
    cms_path_key: typeof r.cms_path_key === 'string' ? r.cms_path_key : null,
    global_scope_key:
      typeof r.global_scope_key === 'string' ? r.global_scope_key : null,
    action_tag_key:
      typeof r.action_tag_key === 'string' ? r.action_tag_key : null,
    is_enabled: r.is_enabled !== false,
    variants,
    created_at: typeof r.created_at === 'string' ? r.created_at : null,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : null,
  }
}

export function isVariantGroupsApiUnavailableError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  return (
    err.status === 404 ||
    err.status === 503 ||
    err.kind === 'not_found' ||
    err.code === 'schema_unavailable'
  )
}

export function formatVariantGroupApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404 || err.status === 503 || err.code === 'schema_unavailable') {
      return 'Variant Groups API unavailable on this server.'
    }
    if (err.status === 409 || err.code === 'global_scope_conflict') {
      const conflict = err.details?.conflict as
        | { name?: string; package_key?: string; group_id?: string }
        | undefined
      const who = conflict?.name || conflict?.package_key || conflict?.group_id
      return who
        ? `CMS Global conflict (409): "${who}" already owns this global scope.`
        : 'CMS Global conflict (409): another group or script already owns this global scope.'
    }
    if (err.code === 'duplicate_language_label') {
      return 'Duplicate language label in this Variant Group. Each variant must have a unique language label.'
    }
    if (err.code === 'incompatible_variant_scope') {
      return 'Selected Script is not compatible with this Variant Group scope.'
    }
    if (err.code === 'published_release_required') {
      return 'Variant requires a published Script Release.'
    }
    if (err.status === 401 || err.status === 403 || err.isAuthRequired) {
      return err.message
    }
  }
  return toSafeApiMessage(err)
}
