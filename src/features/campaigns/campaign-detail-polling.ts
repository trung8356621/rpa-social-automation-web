import type { CampaignStatus } from './types.ts'

export const RUNNING_POLL_INTERVAL_MS = 5000

const TERMINAL_STATUSES = new Set<CampaignStatus>(['completed', 'cancelled'])

export function isTerminalCampaignStatus(
  status: CampaignStatus | null | undefined,
): boolean {
  return status != null && TERMINAL_STATUSES.has(status)
}

/**
 * Returns the polling interval in ms for Campaign Detail + Contents.
 * Polls every 5 seconds while Campaign is running in LIVE mode.
 * Stops polling for terminal (completed / cancelled), paused, draft, or mock campaigns.
 */
export function getCampaignDetailPollIntervalMs(
  status: CampaignStatus | null | undefined,
  mode: 'mock' | 'live',
): number | null {
  if (mode !== 'live') return null
  if (status === 'running') return RUNNING_POLL_INTERVAL_MS
  return null
}

export type DetailRefreshController = {
  refresh: (campaignId: string) => Promise<boolean>
  isInFlight: () => boolean
  dispose: () => void
  isDisposed: () => boolean
}

/**
 * Single-flight background revalidation controller for Campaign Detail + Contents.
 * - Never overlaps in-flight requests.
 * - Ignores completions after dispose() (unmount).
 * - Preserves existing state on transient network failures.
 */
export function createDetailRefreshController(params: {
  loadDetail: (id: string) => Promise<unknown>
  loadContents: (id: string) => Promise<unknown>
  onTransientError?: (err: unknown) => void
}): DetailRefreshController {
  let inFlight = false
  let disposed = false

  return {
    async refresh(campaignId: string): Promise<boolean> {
      if (!campaignId || disposed || inFlight) return false
      inFlight = true
      try {
        await params.loadDetail(campaignId)
        if (disposed) return false
        await params.loadContents(campaignId)
        return !disposed
      } catch (err) {
        if (!disposed) {
          params.onTransientError?.(err)
        }
        return false
      } finally {
        inFlight = false
      }
    },
    isInFlight() {
      return inFlight
    },
    dispose() {
      disposed = true
    },
    isDisposed() {
      return disposed
    },
  }
}
