import { ApiError } from '../../../lib/api/errors.ts'
import type {
  AddVariantInput,
  CreateVariantGroupInput,
  PersistedVariantGroup,
  PersistedVariantItem,
  UpdateVariantInput,
  VariantGroupListResult,
} from './variant-groups-api.ts'

let mockGroups: PersistedVariantGroup[] = []

export function resetMockVariantGroups(): void {
  mockGroups = []
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeLabel(raw: string): string {
  return raw.trim().toUpperCase()
}

function findGroup(id: string): PersistedVariantGroup {
  const g = mockGroups.find((x) => x.id === id)
  if (!g) {
    throw new ApiError('Variant group not found.', {
      kind: 'not_found',
      status: 404,
      code: 'variant_group_not_found',
    })
  }
  return g
}

export const mockVariantGroupApi = {
  async listGroups(): Promise<VariantGroupListResult> {
    return {
      groups: structuredClone(mockGroups),
      unavailable: false,
      unavailableReason: null,
    }
  },

  async createGroup(
    input: CreateVariantGroupInput,
  ): Promise<PersistedVariantGroup> {
    const name = input.name.trim()
    if (!name) {
      throw new ApiError('Group name is required.', {
        kind: 'validation',
        status: 422,
        code: 'name_required',
      })
    }

    if (
      input.scope_type === 'cms_global' &&
      input.global_scope_key &&
      mockGroups.some(
        (g) =>
          g.scope_type === 'cms_global' &&
          g.global_scope_key?.toLowerCase() ===
            input.global_scope_key!.toLowerCase(),
      )
    ) {
      throw new ApiError('CMS Global scope conflict.', {
        kind: 'conflict',
        status: 409,
        code: 'global_scope_conflict',
      })
    }

    const labels = new Set<string>()
    const variants: PersistedVariantItem[] = (input.variants ?? []).map(
      (v, idx) => {
        const label = normalizeLabel(v.language_label)
        if (!label) {
          throw new ApiError('Language label is required.', {
            kind: 'validation',
            status: 422,
            code: 'language_label_required',
          })
        }
        if (labels.has(label)) {
          throw new ApiError(`Duplicate language label "${label}".`, {
            kind: 'validation',
            status: 422,
            code: 'duplicate_language_label',
          })
        }
        labels.add(label)
        return {
          id: `var_${Date.now()}_${idx}`,
          priority: v.priority ?? idx + 1,
          language_label: label,
          package_id: idx + 1,
          package_key: v.package_key,
          script_id: v.package_key,
          script_name: v.package_key,
          release_id: v.release_id ?? 100 + idx,
          script_version: v.script_version ?? '1.0.0',
          release_status: 'published',
          content_digest: null,
          execution_digest: null,
          published_at: nowIso(),
          is_enabled: true,
        }
      },
    )

    const group: PersistedVariantGroup = {
      id: `grp_${Date.now()}`,
      name,
      scope_type: input.scope_type,
      cms_type: input.cms_type ?? null,
      cms_template_id: null,
      cms_path_key: input.cms_path_key ?? null,
      global_scope_key: input.global_scope_key ?? null,
      action_tag_key: input.action_tag_key ?? null,
      is_enabled: input.is_enabled ?? true,
      variants,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    mockGroups = [group, ...mockGroups]
    return structuredClone(group)
  },

  async addVariant(
    groupId: string,
    input: AddVariantInput,
  ): Promise<PersistedVariantGroup> {
    const group = findGroup(groupId)
    const label = normalizeLabel(input.language_label)
    if (!label) {
      throw new ApiError('Language label is required.', {
        kind: 'validation',
        status: 422,
        code: 'language_label_required',
      })
    }
    if (group.variants.some((v) => v.language_label === label)) {
      throw new ApiError(`Duplicate language label "${label}".`, {
        kind: 'validation',
        status: 422,
        code: 'duplicate_language_label',
      })
    }

    const nextPriority = group.variants.length + 1
    group.variants.push({
      id: `var_${Date.now()}`,
      priority: input.priority ?? nextPriority,
      language_label: label,
      package_id: nextPriority,
      package_key: input.package_key,
      script_id: input.package_key,
      script_name: input.package_key,
      release_id: input.release_id ?? 100 + nextPriority,
      script_version: input.script_version ?? '1.0.0',
      release_status: 'published',
      content_digest: null,
      execution_digest: null,
      published_at: nowIso(),
      is_enabled: true,
    })
    group.updated_at = nowIso()
    return structuredClone(group)
  },

  async updateVariant(
    groupId: string,
    variantId: string,
    input: UpdateVariantInput,
  ): Promise<PersistedVariantGroup> {
    const group = findGroup(groupId)
    const item = group.variants.find((v) => v.id === variantId)
    if (!item) {
      throw new ApiError('Variant not found.', {
        kind: 'not_found',
        status: 404,
        code: 'variant_not_found',
      })
    }
    if (input.language_label !== undefined) {
      const label = normalizeLabel(input.language_label)
      if (!label) {
        throw new ApiError('Language label is required.', {
          kind: 'validation',
          status: 422,
          code: 'language_label_required',
        })
      }
      if (
        group.variants.some((v) => v.id !== variantId && v.language_label === label)
      ) {
        throw new ApiError(`Duplicate language label "${label}".`, {
          kind: 'validation',
          status: 422,
          code: 'duplicate_language_label',
        })
      }
      item.language_label = label
    }
    if (input.is_enabled !== undefined) {
      item.is_enabled = input.is_enabled
    }
    group.updated_at = nowIso()
    return structuredClone(group)
  },

  async removeVariant(
    groupId: string,
    variantId: string,
  ): Promise<PersistedVariantGroup> {
    const group = findGroup(groupId)
    group.variants = group.variants
      .filter((v) => v.id !== variantId)
      .map((v, idx) => ({ ...v, priority: idx + 1 }))
    group.updated_at = nowIso()
    return structuredClone(group)
  },

  async reorderVariants(
    groupId: string,
    variantIds: string[],
  ): Promise<PersistedVariantGroup> {
    const group = findGroup(groupId)
    const byId = new Map(group.variants.map((v) => [v.id, v]))
    const reordered: PersistedVariantItem[] = []
    variantIds.forEach((id, idx) => {
      const found = byId.get(id)
      if (found) {
        reordered.push({ ...found, priority: idx + 1 })
      }
    })
    group.variants = reordered
    group.updated_at = nowIso()
    return structuredClone(group)
  },
}
