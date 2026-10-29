import { ACCOUNTS_PATHS } from '@/lib/api/config'
import { staffApiRequest } from '@/lib/api/http'

import type { AccountItem } from '../types'
import type { LiveAccountsListResponse } from './live-types'
import { mapLiveAccountItem } from './map-account'

export async function fetchLiveAccounts(options?: {
  signal?: AbortSignal
}): Promise<AccountItem[]> {
  const payload = await staffApiRequest<LiveAccountsListResponse>(
    ACCOUNTS_PATHS.list,
    { method: 'GET', signal: options?.signal },
  )
  const rows = Array.isArray(payload.accounts) ? payload.accounts : []
  return rows.map(mapLiveAccountItem)
}
