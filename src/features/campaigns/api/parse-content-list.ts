/**
 * Parse LIVE Campaign Content list envelope (OpenAPI staffCampaignContentsList).
 * Primary: `{ ok, data: CampaignContentItem[] }`.
 * Never invents rows when envelope is missing/invalid.
 * Missing `data` is an error — not a silent empty list.
 */
export function extractLiveContentListRows(payload: unknown): unknown[] {
  if (payload == null || typeof payload !== 'object') {
    throw new Error('Campaign Content list response is empty or invalid.')
  }
  const res = payload as Record<string, unknown>

  if (Array.isArray(res.data)) return res.data

  // Defensive alias only when `data` key absent — same array shape
  if (!('data' in res) && Array.isArray(res.contents)) return res.contents

  if ('data' in res && res.data != null && !Array.isArray(res.data)) {
    throw new Error(
      'Campaign Content list response.data is not an array. Cannot parse contents.',
    )
  }

  throw new Error(
    'Campaign Content list missing data[] (OpenAPI staffCampaignContentsList).',
  )
}
