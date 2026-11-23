import { ApiError, toSafeApiMessage } from '../../lib/api/errors.ts'
import type { Campaign } from './types.ts'

export type CampaignListFilters = {
  search: string
  siteKey: string
  runMode: string
  executionMode: string
  status: string
}

/**
 * Only Cancelled Campaigns expose the Delete action.
 * Never expose deletion for Running, Paused, Draft, Scheduled, or Completed Campaigns.
 */
export function canDeleteCampaign(campaign: Pick<Campaign, 'status'>): boolean {
  return campaign.status === 'cancelled'
}

export function filterCampaigns(
  campaigns: Campaign[],
  filters: CampaignListFilters,
): Campaign[] {
  const q = filters.search.trim().toLowerCase()
  return campaigns.filter((c) => {
    if (filters.siteKey !== 'all' && c.site_key !== filters.siteKey) return false
    if (filters.runMode !== 'all' && c.run_mode !== filters.runMode) return false
    if (
      filters.executionMode !== 'all' &&
      c.execution_mode !== filters.executionMode
    ) {
      return false
    }
    if (filters.status !== 'all' && c.status !== filters.status) return false
    if (!q) return true
    const hay = [c.name, c.site_key, c.site_name, c.script_name, c.id]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export type DeleteCampaignAdapter = {
  deleteCampaign: (id: string) => Promise<void>
  listCampaigns: () => Promise<Campaign[]>
  getCampaign: (id: string) => Promise<Campaign>
}

export function formatDeleteErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message
  }
  return toSafeApiMessage(err)
}

/**
 * Executes a confirmed soft-delete against the adapter:
 * - On success: removes the row immediately, revalidates the list without unmounting UI filters, and triggers success toast.
 * - On 409 conflict: keeps the row visible, refreshes its status from the server if available, and rethrows with the backend reason.
 * - On network/auth/other failure: leaves the list unchanged and rethrows.
 */
export async function performCampaignDelete(params: {
  id: string
  adapter: DeleteCampaignAdapter
  setCampaigns: (updater: (prev: Campaign[]) => Campaign[]) => void
  showToast: (message: string, type?: 'success' | 'error') => void
}): Promise<void> {
  const { id, adapter, setCampaigns, showToast } = params
  try {
    await adapter.deleteCampaign(id)
  } catch (err) {
    if (err instanceof ApiError && err.kind === 'conflict') {
      try {
        const refreshed = await adapter.getCampaign(id)
        setCampaigns((prev) =>
          prev.map((c) => (c.id === refreshed.id ? { ...c, ...refreshed } : c)),
        )
      } catch {
        /* keep existing row if status refresh fails */
      }
    }
    throw err
  }

  setCampaigns((prev) => prev.filter((c) => c.id !== id))
  showToast('Campaign deleted')

  try {
    const list = await adapter.listCampaigns()
    setCampaigns(() => list)
  } catch {
    /* keep confirmed removal if background list revalidation fails transiently */
  }
}
