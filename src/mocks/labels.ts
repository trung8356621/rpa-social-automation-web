/** Explicit mock marker — not live API data. */
export const MOCK_BANNER =
  'MOCK DATA — local only. No live API. Demos: ?demo=empty|error|missing-video · Scripts ?play=…&detail=… · Accounts/Keys ?demo=empty|error'

/** Shown when VITE_RPA_API_MODE=live — Action Tags + Script Registry staff APIs. */
export const LIVE_BANNER =
  'LIVE MODE — Action Tags + Script Registry staff API (session + CSRF). Other routes remain MOCK. No Client API Key.'
