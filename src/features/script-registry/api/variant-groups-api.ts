import { staffApiRequest } from '@/lib/api/http'

import {
  isVariantGroupsApiUnavailableError,
  mapVariantGroupDto,
  VARIANT_GROUP_PATHS,
  type AddVariantInput,
  type CreateVariantGroupInput,
  type PersistedVariantGroup,
  type UpdateVariantInput,
  type VariantGroupListResult,
} from './variant-groups-contract'

export * from './variant-groups-contract'

type GroupListEnvelope = {
  ok?: boolean
  groups?: unknown[]
  count?: number
  pending?: string
}

type GroupSingleEnvelope = {
  ok?: boolean
  group?: unknown
}

export const liveVariantGroupApi = {
  async listGroups(signal?: AbortSignal): Promise<VariantGroupListResult> {
    try {
      const res = await staffApiRequest<GroupListEnvelope>(
        VARIANT_GROUP_PATHS.list,
        { method: 'GET', signal },
      )
      if (typeof res.pending === 'string' && res.pending.trim()) {
        return {
          groups: [],
          unavailable: true,
          unavailableReason: `Variant Groups API unavailable (${res.pending}).`,
        }
      }
      const groups = Array.isArray(res.groups)
        ? res.groups.map(mapVariantGroupDto)
        : []
      return { groups, unavailable: false, unavailableReason: null }
    } catch (err: unknown) {
      if (isVariantGroupsApiUnavailableError(err)) {
        return {
          groups: [],
          unavailable: true,
          unavailableReason:
            'Variant Groups API unavailable (404 / schema not migrated).',
        }
      }
      throw err
    }
  },

  async getGroup(
    id: string,
    signal?: AbortSignal,
  ): Promise<PersistedVariantGroup> {
    const res = await staffApiRequest<GroupSingleEnvelope>(
      VARIANT_GROUP_PATHS.detail(id),
      { method: 'GET', signal },
    )
    if (!res.group) throw new Error('Variant group payload missing.')
    return mapVariantGroupDto(res.group)
  },

  async createGroup(
    input: CreateVariantGroupInput,
  ): Promise<PersistedVariantGroup> {
    const res = await staffApiRequest<GroupSingleEnvelope>(
      VARIANT_GROUP_PATHS.list,
      { method: 'POST', body: input },
    )
    if (!res.group) throw new Error('Create variant group response missing group.')
    return mapVariantGroupDto(res.group)
  },

  async addVariant(
    groupId: string,
    input: AddVariantInput,
  ): Promise<PersistedVariantGroup> {
    const res = await staffApiRequest<GroupSingleEnvelope>(
      VARIANT_GROUP_PATHS.addVariant(groupId),
      { method: 'POST', body: input },
    )
    if (!res.group) throw new Error('Add variant response missing group.')
    return mapVariantGroupDto(res.group)
  },

  async updateVariant(
    groupId: string,
    variantId: string,
    input: UpdateVariantInput,
  ): Promise<PersistedVariantGroup> {
    const res = await staffApiRequest<GroupSingleEnvelope>(
      VARIANT_GROUP_PATHS.updateVariant(groupId, variantId),
      { method: 'PATCH', body: input },
    )
    if (!res.group) throw new Error('Update variant response missing group.')
    return mapVariantGroupDto(res.group)
  },

  async removeVariant(
    groupId: string,
    variantId: string,
  ): Promise<PersistedVariantGroup> {
    const res = await staffApiRequest<GroupSingleEnvelope>(
      VARIANT_GROUP_PATHS.removeVariant(groupId, variantId),
      { method: 'DELETE' },
    )
    if (!res.group) throw new Error('Remove variant response missing group.')
    return mapVariantGroupDto(res.group)
  },

  async reorderVariants(
    groupId: string,
    variantIds: string[],
  ): Promise<PersistedVariantGroup> {
    const res = await staffApiRequest<GroupSingleEnvelope>(
      VARIANT_GROUP_PATHS.reorder(groupId),
      { method: 'PUT', body: { variant_ids: variantIds } },
    )
    if (!res.group) throw new Error('Reorder variants response missing group.')
    return mapVariantGroupDto(res.group)
  },
}
